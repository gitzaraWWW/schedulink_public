const { getAuthorizedCalendar } = require("../integrations/googleClient");
const { fetchMaplestoryOngoingEvents } = require("../integrations/maplestoryClient");
const {
  deleteSubscriptionCalendarEvent,
  findCalendarSyncByUserId,
  listSubscriptionCalendarEvents,
  upsertSubscriptionCalendarEvent,
} = require("../supabase");
const { createHttpError } = require("../utils/errors");

const MAPLESTORY_PROVIDER = "nexon_maplestory";
const MAPLESTORY_SUBSCRIPTION_CODE = "maplestory";
const NEXON_OPEN_API_ATTRIBUTION = "Data based on NEXON Open API";

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00+09:00`);

  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  date.setDate(date.getDate() + days);

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseDateKey(value) {
  const text = normalizeWhitespace(value);

  if (!text) {
    return null;
  }

  const isoDateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);

  if (isoDateMatch) {
    return isoDateMatch[1];
  }

  const dottedDateMatch = text.match(/(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})/);

  if (dottedDateMatch) {
    return [
      dottedDateMatch[1],
      String(dottedDateMatch[2]).padStart(2, "0"),
      String(dottedDateMatch[3]).padStart(2, "0"),
    ].join("-");
  }

  const koreanDateMatch = text.match(
    /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/
  );

  if (koreanDateMatch) {
    return [
      koreanDateMatch[1],
      String(koreanDateMatch[2]).padStart(2, "0"),
      String(koreanDateMatch[3]).padStart(2, "0"),
    ].join("-");
  }

  return null;
}

function resolveEventId(item) {
  return (
    item?.notice_id ||
    item?.event_id ||
    item?.id ||
    item?.noticeId ||
    item?.eventId ||
    null
  );
}

function resolveEventTitle(item) {
  return (
    item?.title ||
    item?.notice_title ||
    item?.event_name ||
    item?.name ||
    item?.noticeTitle ||
    item?.eventName ||
    ""
  );
}

function resolveEventDescription(item) {
  return (
    item?.description ||
    item?.summary ||
    item?.contents ||
    item?.notice_summary ||
    item?.noticeSummary ||
    ""
  );
}

function resolveEventUrl(item) {
  return (
    item?.url ||
    item?.notice_url ||
    item?.detail_url ||
    item?.detailUrl ||
    item?.noticeUrl ||
    null
  );
}

function resolveEventImageUrl(item) {
  return (
    item?.thumbnail_image_url ||
    item?.image_url ||
    item?.thumbnail_url ||
    item?.thumbnailImageUrl ||
    item?.imageUrl ||
    null
  );
}

function resolveEventStartDate(item) {
  return parseDateKey(
    item?.date_event_start ||
      item?.event_start_date ||
      item?.start_date ||
      item?.dateStart ||
      item?.eventStartDate ||
      item?.startDate ||
      item?.date
  );
}

function resolveEventEndDate(item, fallbackStartDate) {
  return (
    parseDateKey(
      item?.date_event_end ||
        item?.event_end_date ||
        item?.end_date ||
        item?.dateEnd ||
        item?.eventEndDate ||
        item?.endDate
    ) || fallbackStartDate
  );
}

function extractEventList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload?.event_notice,
    payload?.eventNotice,
    payload?.notice_event,
    payload?.noticeEvent,
    payload?.ongoing_event_notice,
    payload?.ongoingEventNotice,
    payload?.event_notice_list,
    payload?.eventNoticeList,
    payload?.notices,
    payload?.events,
  ];

  return candidates.find(Array.isArray) || [];
}

function normalizeMaplestoryEvents(payload) {
  return extractEventList(payload)
    .map((item) => {
      const externalEventId = resolveEventId(item);
      const title = normalizeWhitespace(resolveEventTitle(item));
      const description = normalizeWhitespace(resolveEventDescription(item));
      const startDate = resolveEventStartDate(item);
      const endDate = resolveEventEndDate(item, startDate);

      if (!externalEventId || !title || !startDate || !endDate) {
        return null;
      }

      return {
        provider: MAPLESTORY_PROVIDER,
        externalEventId: String(externalEventId),
        title,
        description,
        startDate,
        endDate,
        detailUrl: resolveEventUrl(item),
        imageUrl: resolveEventImageUrl(item),
        rawPayload: item,
      };
    })
    .filter(Boolean);
}

function sortSubscriptionSourceEvents(events) {
  return [...events].sort((firstEvent, secondEvent) => {
    const firstStart = String(firstEvent.startDate || "");
    const secondStart = String(secondEvent.startDate || "");

    if (firstStart !== secondStart) {
      return firstStart.localeCompare(secondStart);
    }

    const firstEnd = String(firstEvent.endDate || "");
    const secondEnd = String(secondEvent.endDate || "");

    if (firstEnd !== secondEnd) {
      return firstEnd.localeCompare(secondEnd);
    }

    return String(firstEvent.title || "").localeCompare(
      String(secondEvent.title || ""),
      "ko"
    );
  });
}

async function listMaplestorySubscriptionEvents() {
  const payload = await fetchMaplestoryOngoingEvents();
  const events = sortSubscriptionSourceEvents(normalizeMaplestoryEvents(payload));

  if (events.length === 0) {
    throw createHttpError(
      502,
      "메이플스토리 이벤트 응답에서 표시할 일정을 찾지 못했습니다."
    );
  }

  return events;
}

async function listSubscriptionSourceEvents(subscriptionCode) {
  if (subscriptionCode === MAPLESTORY_SUBSCRIPTION_CODE) {
    return listMaplestorySubscriptionEvents();
  }

  return [];
}

function buildSubscriptionCalendarDescription(event) {
  const lines = [];

  if (event.description) {
    lines.push(event.description);
  }

  lines.push("구독 항목: 메이플스토리");

  if (event.detailUrl) {
    lines.push(`상세 링크: ${event.detailUrl}`);
  }

  lines.push(NEXON_OPEN_API_ATTRIBUTION);

  return lines.join("\n\n");
}

function buildAllDayCalendarEventRequest(event) {
  return {
    summary: event.title,
    description: buildSubscriptionCalendarDescription(event),
    extendedProperties: {
      private: {
        subscriptionCode: MAPLESTORY_SUBSCRIPTION_CODE,
        eventPriority: "3",
        eventSource: "subscription",
      },
    },
    start: {
      date: event.startDate,
      timeZone: "Asia/Seoul",
    },
    end: {
      date: addDays(event.endDate, 1),
      timeZone: "Asia/Seoul",
    },
  };
}

async function getCalendarClientForUser(userId) {
  const calendarSync = await findCalendarSyncByUserId(userId);

  if (!calendarSync?.sync_enabled || !calendarSync.google_access_token) {
    return null;
  }

  return getAuthorizedCalendar({
    access_token: calendarSync.google_access_token,
    refresh_token: calendarSync.google_refresh_token,
  });
}

async function upsertSyncedEventRow(userId, subscriptionCode, event, googleEventId) {
  return upsertSubscriptionCalendarEvent({
    userId,
    subscriptionCode,
    provider: event.provider,
    externalEventId: event.externalEventId,
    title: event.title,
    description: event.description || null,
    startDate: event.startDate,
    endDate: event.endDate,
    detailUrl: event.detailUrl || null,
    imageUrl: event.imageUrl || null,
    googleEventId,
    calendarId: "primary",
    syncStatus: "synced",
    rawPayload: event.rawPayload,
    lastSyncedAt: new Date().toISOString(),
  });
}

async function deleteCalendarEventByGoogleId(calendar, googleEventId) {
  if (!googleEventId) {
    return;
  }

  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "none",
    });
  } catch (error) {
    if (error?.code !== 404) {
      throw error;
    }
  }
}

async function syncSubscriptionEventsForUser(
  userId,
  subscriptionCode,
  events,
  { excludedExternalEventIds = [] } = {}
) {
  const calendar = await getCalendarClientForUser(userId);

  if (!calendar) {
    throw createHttpError(
      409,
      "구독 일정을 추가하려면 먼저 Google Calendar 연동이 필요합니다."
    );
  }

  const excludedEventIdSet = new Set(
    (Array.isArray(excludedExternalEventIds) ? excludedExternalEventIds : []).map((eventId) =>
      String(eventId)
    )
  );
  const activeEvents = events.filter(
    (event) => !excludedEventIdSet.has(String(event.externalEventId))
  );
  const existingRows = await listSubscriptionCalendarEvents(userId, subscriptionCode);
  const existingByExternalId = new Map(
    existingRows.map((row) => [String(row.external_event_id), row])
  );
  const incomingExternalIds = new Set(
    activeEvents.map((event) => String(event.externalEventId))
  );
  const syncedRows = [];
  const createdRows = [];

  try {
    for (const event of activeEvents) {
      const existingRow = existingByExternalId.get(String(event.externalEventId)) || null;
      const requestBody = buildAllDayCalendarEventRequest(event);
      let googleEventId = existingRow?.google_event_id || null;

      if (googleEventId) {
        const response = await calendar.events.patch({
          calendarId: existingRow.calendar_id || "primary",
          eventId: googleEventId,
          requestBody,
          sendUpdates: "none",
        });
        googleEventId = response.data?.id || googleEventId;
      } else {
        const response = await calendar.events.insert({
          calendarId: "primary",
          requestBody,
          sendUpdates: "none",
        });
        googleEventId = response.data?.id || null;
      }

      const savedRow = await upsertSyncedEventRow(
        userId,
        subscriptionCode,
        event,
        googleEventId
      );

      syncedRows.push(savedRow);

      if (!existingRow) {
        createdRows.push(savedRow);
      }
    }

    for (const existingRow of existingRows) {
      if (incomingExternalIds.has(String(existingRow.external_event_id))) {
        continue;
      }

      await deleteCalendarEventByGoogleId(calendar, existingRow.google_event_id);
      await deleteSubscriptionCalendarEvent(existingRow.id);
    }
  } catch (error) {
    for (const row of createdRows) {
      try {
        await deleteCalendarEventByGoogleId(calendar, row.google_event_id);
      } catch {}

      try {
        await deleteSubscriptionCalendarEvent(row.id);
      } catch {}
    }

    throw error;
  }

  return {
    provider: events[0]?.provider || subscriptionCode,
    syncedCount: syncedRows.length,
    totalCount: events.length,
    excludedCount: excludedEventIdSet.size,
  };
}

async function syncMaplestorySubscriptionForUser(
  userId,
  { excludedExternalEventIds = [] } = {}
) {
  const events = await listMaplestorySubscriptionEvents();

  return syncSubscriptionEventsForUser(userId, MAPLESTORY_SUBSCRIPTION_CODE, events, {
    excludedExternalEventIds,
  });
}

async function removeMaplestorySubscriptionForUser(userId) {
  const calendar = await getCalendarClientForUser(userId);
  const existingRows = await listSubscriptionCalendarEvents(
    userId,
    MAPLESTORY_SUBSCRIPTION_CODE
  );

  for (const row of existingRows) {
    if (calendar) {
      await deleteCalendarEventByGoogleId(calendar, row.google_event_id);
    }

    await deleteSubscriptionCalendarEvent(row.id);
  }

  return {
    provider: MAPLESTORY_PROVIDER,
    removedCount: existingRows.length,
  };
}

async function syncSubscriptionCalendarForUser(userId, subscriptionCode, options = {}) {
  if (subscriptionCode === MAPLESTORY_SUBSCRIPTION_CODE) {
    return syncMaplestorySubscriptionForUser(userId, options);
  }

  return {
    provider: subscriptionCode,
    syncedCount: 0,
    totalCount: 0,
    excludedCount: 0,
  };
}

async function removeSubscriptionCalendarForUser(userId, subscriptionCode) {
  if (subscriptionCode === MAPLESTORY_SUBSCRIPTION_CODE) {
    return removeMaplestorySubscriptionForUser(userId);
  }

  return {
    provider: subscriptionCode,
    removedCount: 0,
  };
}

module.exports = {
  listSubscriptionSourceEvents,
  removeSubscriptionCalendarForUser,
  syncSubscriptionCalendarForUser,
};
