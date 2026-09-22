const {
  createUserSubscription,
  deleteUserSubscription,
  deleteUserSubscriptionEventOverride,
  getSubscriptionCatalogItemByCode,
  listActiveSubscriptionCatalog,
  listSubscriptionCalendarEvents,
  listUserSubscriptionEventOverrides,
  listUserSubscriptions,
  upsertUserSubscriptionEventOverride,
} = require("../supabase");
const { createHttpError } = require("../utils/errors");
const {
  listSubscriptionSourceEvents,
  removeSubscriptionCalendarForUser,
  syncSubscriptionCalendarForUser,
} = require("./subscriptionCalendarService");
const { ensureSessionUser } = require("./sessionUserService");

function mapSubscriptionItem(item, subscribedIds) {
  return {
    id: item.code,
    code: item.code,
    title: item.name,
    category: item.category,
    description: item.description || "",
    accent: item.accent_key || "mint",
    iconUrl: item.icon_url || "",
    subscribed: subscribedIds.has(item.id),
  };
}

function normalizeExternalEventIds(eventIds) {
  if (!Array.isArray(eventIds)) {
    return [];
  }

  return [...new Set(eventIds.map((eventId) => String(eventId || "").trim()).filter(Boolean))];
}

function mapSubscriptionEvent(event, { excludedIds, syncedIds }) {
  const externalEventId = String(event.externalEventId);
  const excluded = excludedIds.has(externalEventId);

  return {
    externalEventId,
    title: event.title,
    description: event.description || "",
    startDate: event.startDate,
    endDate: event.endDate,
    detailUrl: event.detailUrl || null,
    imageUrl: event.imageUrl || null,
    excluded,
    selected: !excluded,
    synced: syncedIds.has(externalEventId),
  };
}

async function getSubscriptionContext(session, code) {
  const user = await ensureSessionUser(session);
  const [catalogItem, userSubscriptions] = await Promise.all([
    getSubscriptionCatalogItemByCode(code),
    listUserSubscriptions(user.id),
  ]);

  if (!catalogItem) {
    throw createHttpError(404, "구독 항목을 찾을 수 없습니다.");
  }

  const subscribedIds = new Set(
    userSubscriptions.map((item) => item?.subscription_id).filter(Boolean)
  );

  return {
    user,
    catalogItem,
    subscribedIds,
    mappedItem: mapSubscriptionItem(catalogItem, subscribedIds),
  };
}

async function listSubscriptions(session) {
  const user = await ensureSessionUser(session);
  const [catalogItems, userSubscriptions] = await Promise.all([
    listActiveSubscriptionCatalog(),
    listUserSubscriptions(user.id),
  ]);
  const subscribedIds = new Set(
    userSubscriptions.map((item) => item?.subscription_id).filter(Boolean)
  );

  return {
    items: catalogItems.map((item) => mapSubscriptionItem(item, subscribedIds)),
  };
}

async function listSubscriptionEvents(session, code) {
  const { user, mappedItem } = await getSubscriptionContext(session, code);
  const [sourceEvents, overrideRows, syncedRows] = await Promise.all([
    listSubscriptionSourceEvents(code),
    listUserSubscriptionEventOverrides(user.id, code),
    listSubscriptionCalendarEvents(user.id, code),
  ]);
  const excludedIds = new Set(
    overrideRows
      .filter((row) => row?.is_excluded !== false)
      .map((row) => String(row.external_event_id))
  );
  const syncedIds = new Set(
    syncedRows.map((row) => String(row.external_event_id)).filter(Boolean)
  );

  return {
    item: mappedItem,
    events: sourceEvents.map((event) =>
      mapSubscriptionEvent(event, {
        excludedIds,
        syncedIds,
      })
    ),
  };
}

async function updateSubscription(session, { code, subscribed }) {
  const user = await ensureSessionUser(session);
  const catalogItem = await getSubscriptionCatalogItemByCode(code);

  if (!catalogItem) {
    throw createHttpError(404, "구독 항목을 찾을 수 없습니다.");
  }

  if (subscribed) {
    await createUserSubscription({
      userId: user.id,
      subscriptionId: catalogItem.id,
    });

    try {
      const overrideRows = await listUserSubscriptionEventOverrides(user.id, catalogItem.code);
      const excludedExternalEventIds = overrideRows
        .filter((row) => row?.is_excluded !== false)
        .map((row) => String(row.external_event_id))
        .filter(Boolean);

      await syncSubscriptionCalendarForUser(user.id, catalogItem.code, {
        excludedExternalEventIds,
      });
    } catch (error) {
      await deleteUserSubscription({
        userId: user.id,
        subscriptionId: catalogItem.id,
      }).catch(() => null);
      throw error;
    }
  } else {
    await removeSubscriptionCalendarForUser(user.id, catalogItem.code);
    await deleteUserSubscription({
      userId: user.id,
      subscriptionId: catalogItem.id,
    });
  }

  return {
    item: {
      id: catalogItem.code,
      code: catalogItem.code,
      subscribed,
    },
  };
}

async function updateSubscriptionEventPreferences(
  session,
  { code, excludedExternalEventIds }
) {
  const { user, catalogItem, mappedItem, subscribedIds } = await getSubscriptionContext(
    session,
    code
  );
  const normalizedExcludedIds = normalizeExternalEventIds(excludedExternalEventIds);
  const [sourceEvents, existingOverrideRows] = await Promise.all([
    listSubscriptionSourceEvents(code),
    listUserSubscriptionEventOverrides(user.id, code),
  ]);
  const sourceEventById = new Map(
    sourceEvents.map((event) => [String(event.externalEventId), event])
  );

  for (const externalEventId of normalizedExcludedIds) {
    if (!sourceEventById.has(externalEventId)) {
      throw createHttpError(400, "유효하지 않은 구독 이벤트가 포함되어 있습니다.");
    }
  }

  const nextExcludedIdSet = new Set(normalizedExcludedIds);
  const existingExcludedIds = new Set(
    existingOverrideRows
      .filter((row) => row?.is_excluded !== false)
      .map((row) => String(row.external_event_id))
      .filter(Boolean)
  );

  const upsertTasks = normalizedExcludedIds
    .filter((externalEventId) => !existingExcludedIds.has(externalEventId))
    .map((externalEventId) => {
      const sourceEvent = sourceEventById.get(externalEventId);

      return upsertUserSubscriptionEventOverride({
        userId: user.id,
        subscriptionCode: code,
        externalEventId,
        isExcluded: true,
        titleSnapshot: sourceEvent?.title || null,
        startDateSnapshot: sourceEvent?.startDate || null,
      });
    });

  const deleteTasks = [...existingExcludedIds]
    .filter((externalEventId) => !nextExcludedIdSet.has(externalEventId))
    .map((externalEventId) =>
      deleteUserSubscriptionEventOverride({
        userId: user.id,
        subscriptionCode: code,
        externalEventId,
      })
    );

  await Promise.all([...upsertTasks, ...deleteTasks]);

  const isSubscribed = subscribedIds.has(catalogItem.id);

  if (isSubscribed) {
    await syncSubscriptionCalendarForUser(user.id, code, {
      excludedExternalEventIds: normalizedExcludedIds,
    });
  }

  const syncedRows = isSubscribed
    ? await listSubscriptionCalendarEvents(user.id, code)
    : [];
  const syncedIds = new Set(
    syncedRows.map((row) => String(row.external_event_id)).filter(Boolean)
  );

  return {
    item: mappedItem,
    events: sourceEvents.map((event) =>
      mapSubscriptionEvent(event, {
        excludedIds: nextExcludedIdSet,
        syncedIds,
      })
    ),
  };
}

module.exports = {
  listSubscriptionEvents,
  listSubscriptions,
  updateSubscription,
  updateSubscriptionEventPreferences,
};
