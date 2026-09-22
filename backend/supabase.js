const {
  isSupabaseConfigured,
  supabaseDelete,
  supabaseGet,
  supabaseInsert,
  supabaseInsertMany,
  supabasePatch,
} = require("./supabase/client");
const {
  DEFAULT_EVENT_DURATION_MINUTES,
  addMinutesToTime,
  resolveDurationMinutes,
} = require("./utils/time");

const USERS_TABLE = "users";
const CALENDAR_SYNC_TABLE = "calendarsync";
const EVENTS_TABLE = "events";
const PARTICIPANTS_TABLE = "participants";
const INVITATIONS_TABLE = "invitations";
const MENTION_PROFILES_TABLE = "mention_profiles";
const CALENDAR_EVENT_LINKS_TABLE = "calendar_event_links";
const EVENT_CHANGE_REQUESTS_TABLE = "event_change_requests";
const EVENT_CHANGE_REQUEST_TARGETS_TABLE = "event_change_request_targets";
const SUBSCRIPTION_CATALOG_TABLE = "subscription_catalog";
const SUBSCRIPTION_CALENDAR_EVENTS_TABLE = "subscription_calendar_events";
const USER_SUBSCRIPTIONS_TABLE = "user_subscriptions";
const USER_SUBSCRIPTION_EVENT_OVERRIDES_TABLE =
  "user_subscription_event_overrides";

function resolveStoredDurationMinutes(durationMinutes) {
  const numericDuration = Number(durationMinutes);
  return Number.isFinite(numericDuration) && numericDuration > 0 ? numericDuration : null;
}

function resolveEventTimingPayload({
  startTime,
  endTime,
  durationMinutes,
  fallbackDurationMinutes = null,
}) {
  if (!startTime) {
    return {
      startTime: startTime || null,
      endTime: endTime || null,
      durationMinutes: null,
    };
  }

  const resolvedDurationMinutes =
    resolveDurationMinutes(
      startTime,
      endTime,
      durationMinutes ?? fallbackDurationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES
    ) || DEFAULT_EVENT_DURATION_MINUTES;
  const resolvedEndTime =
    endTime || addMinutesToTime(startTime, resolvedDurationMinutes);

  return {
    startTime,
    endTime: resolvedEndTime,
    durationMinutes: resolvedDurationMinutes,
  };
}

async function upsertUserProfile(user) {
  if (!user?.email) {
    throw new Error("A user email is required to upsert a user profile.");
  }

  const existingUser = await getUserProfileByEmail(user.email).catch(() => null);

  if (!existingUser) {
    return supabaseInsert(
      USERS_TABLE,
      {
        email: user.email,
        name: user.name || null,
        profile_image: user.picture || null,
      },
      "Failed to create the users row."
    );
  }

  const payload = {
    profile_image: user.picture || null,
  };
  const existingName = String(existingUser?.name || "").trim();

  if (!existingName && user.name) {
    payload.name = user.name;
  }

  return supabasePatch(
    USERS_TABLE,
    `id=eq.${existingUser.id}`,
    payload,
    "Failed to update the users row."
  );
}

async function getUserProfileById(userId) {
  if (!userId) {
    throw new Error("userId is required.");
  }

  const data = await supabaseGet(
    USERS_TABLE,
    `id=eq.${userId}&select=id,email,name,profile_image,profile_change_count,profile_change_started_at`,
    "Failed to load the users row."
  );

  return Array.isArray(data) ? data[0] || null : data;
}

async function getUserProfileByEmail(email) {
  if (!email) {
    throw new Error("email is required.");
  }

  const encodedEmail = encodeURIComponent(email);
  const data = await supabaseGet(
    USERS_TABLE,
    `email=eq.${encodedEmail}&select=id,email,name,profile_image,profile_change_count,profile_change_started_at`,
    "Failed to load the users row."
  );

  return Array.isArray(data) ? data[0] || null : data;
}

async function getMentionProfileByUserId(userId) {
  if (!userId) {
    throw new Error("userId is required.");
  }

  const data = await supabaseGet(
    MENTION_PROFILES_TABLE,
    `user_id=eq.${userId}&select=*`,
    "Failed to load the mention profile."
  );

  return Array.isArray(data) ? data[0] || null : data;
}

async function listActiveSubscriptionCatalog() {
  const data = await supabaseGet(
    SUBSCRIPTION_CATALOG_TABLE,
    "is_active=eq.true&select=id,code,name,category,description,accent_key,icon_url,sort_order&order=sort_order.asc,created_at.asc",
    "Failed to load the subscription catalog."
  );

  return Array.isArray(data) ? data : [];
}

async function getSubscriptionCatalogItemByCode(code) {
  const trimmedCode = String(code || "").trim();

  if (!trimmedCode) {
    throw new Error("subscription code is required.");
  }

  const data = await supabaseGet(
    SUBSCRIPTION_CATALOG_TABLE,
    `code=eq.${encodeURIComponent(trimmedCode)}&is_active=eq.true&select=id,code,name,category,description,accent_key,icon_url,sort_order`,
    "Failed to load the subscription catalog item."
  );

  return Array.isArray(data) ? data[0] || null : data;
}

async function listUserSubscriptions(userId) {
  if (!userId) {
    throw new Error("userId is required.");
  }

  const data = await supabaseGet(
    USER_SUBSCRIPTIONS_TABLE,
    `user_id=eq.${userId}&select=id,user_id,subscription_id,created_at`,
    "Failed to load the user subscriptions."
  );

  return Array.isArray(data) ? data : [];
}

async function createUserSubscription({ userId, subscriptionId }) {
  if (!userId || !subscriptionId) {
    throw new Error("userId and subscriptionId are required to create a subscription.");
  }

  return supabaseInsert(
    USER_SUBSCRIPTIONS_TABLE,
    {
      user_id: userId,
      subscription_id: subscriptionId,
    },
    "Failed to create the subscription.",
    { onConflict: "user_id,subscription_id" }
  );
}

async function deleteUserSubscription({ userId, subscriptionId }) {
  if (!userId || !subscriptionId) {
    throw new Error("userId and subscriptionId are required to delete a subscription.");
  }

  return supabaseDelete(
    USER_SUBSCRIPTIONS_TABLE,
    `user_id=eq.${userId}&subscription_id=eq.${subscriptionId}`,
    "Failed to delete the subscription."
  );
}

async function listUserSubscriptionEventOverrides(userId, subscriptionCode) {
  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!subscriptionCode) {
    throw new Error("subscriptionCode is required.");
  }

  const data = await supabaseGet(
    USER_SUBSCRIPTION_EVENT_OVERRIDES_TABLE,
    `user_id=eq.${userId}&subscription_code=eq.${encodeURIComponent(
      subscriptionCode
    )}&select=*`,
    "Failed to load the subscription event overrides."
  );

  return Array.isArray(data) ? data : [];
}

async function upsertUserSubscriptionEventOverride({
  userId,
  subscriptionCode,
  externalEventId,
  isExcluded = true,
  titleSnapshot = null,
  startDateSnapshot = null,
}) {
  if (!userId || !subscriptionCode || !externalEventId) {
    throw new Error(
      "userId, subscriptionCode, and externalEventId are required to upsert a subscription event override."
    );
  }

  return supabaseInsert(
    USER_SUBSCRIPTION_EVENT_OVERRIDES_TABLE,
    {
      user_id: userId,
      subscription_code: subscriptionCode,
      external_event_id: externalEventId,
      is_excluded: Boolean(isExcluded),
      title_snapshot: titleSnapshot,
      start_date_snapshot: startDateSnapshot,
      updated_at: new Date().toISOString(),
    },
    "Failed to upsert the subscription event override.",
    { onConflict: "user_id,subscription_code,external_event_id" }
  );
}

async function deleteUserSubscriptionEventOverride({
  userId,
  subscriptionCode,
  externalEventId,
}) {
  if (!userId || !subscriptionCode || !externalEventId) {
    throw new Error(
      "userId, subscriptionCode, and externalEventId are required to delete a subscription event override."
    );
  }

  return supabaseDelete(
    USER_SUBSCRIPTION_EVENT_OVERRIDES_TABLE,
    `user_id=eq.${userId}&subscription_code=eq.${encodeURIComponent(
      subscriptionCode
    )}&external_event_id=eq.${encodeURIComponent(externalEventId)}`,
    "Failed to delete the subscription event override."
  );
}

async function listSubscriptionCalendarEvents(userId, subscriptionCode = null) {
  if (!userId) {
    throw new Error("userId is required.");
  }

  const filters = [`user_id=eq.${userId}`];

  if (subscriptionCode) {
    filters.push(`subscription_code=eq.${encodeURIComponent(subscriptionCode)}`);
  }

  const data = await supabaseGet(
    SUBSCRIPTION_CALENDAR_EVENTS_TABLE,
    `${filters.join("&")}&select=*`,
    "Failed to load the subscription calendar events."
  );

  return Array.isArray(data) ? data : [];
}

async function upsertSubscriptionCalendarEvent({
  userId,
  subscriptionCode,
  provider,
  externalEventId,
  title,
  description = null,
  startDate,
  endDate,
  detailUrl = null,
  imageUrl = null,
  googleEventId = null,
  calendarId = "primary",
  syncStatus = "synced",
  rawPayload = {},
  lastSyncedAt = null,
}) {
  if (!userId || !subscriptionCode || !provider || !externalEventId || !title) {
    throw new Error(
      "userId, subscriptionCode, provider, externalEventId, and title are required."
    );
  }

  return supabaseInsert(
    SUBSCRIPTION_CALENDAR_EVENTS_TABLE,
    {
      user_id: userId,
      subscription_code: subscriptionCode,
      provider,
      external_event_id: externalEventId,
      title,
      description,
      start_date: startDate,
      end_date: endDate,
      detail_url: detailUrl,
      image_url: imageUrl,
      google_event_id: googleEventId,
      calendar_id: calendarId,
      sync_status: syncStatus,
      raw_payload: rawPayload,
      last_synced_at: lastSyncedAt,
      updated_at: new Date().toISOString(),
    },
    "Failed to upsert the subscription calendar event.",
    { onConflict: "user_id,provider,external_event_id" }
  );
}

async function deleteSubscriptionCalendarEvent(rowId) {
  if (!rowId) {
    throw new Error("rowId is required.");
  }

  return supabaseDelete(
    SUBSCRIPTION_CALENDAR_EVENTS_TABLE,
    `id=eq.${rowId}`,
    "Failed to delete the subscription calendar event."
  );
}

async function updateUserProfileById(userId, payload) {
  if (!userId) {
    throw new Error("userId is required.");
  }

  return supabasePatch(
    USERS_TABLE,
    `id=eq.${userId}`,
    payload,
    "Failed to update the users row."
  );
}

function buildSearchableText({ displayName, teamName, nickname }) {
  return [displayName, nickname, teamName]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ");
}

function normalizeMentionSearchValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

async function upsertMentionProfile({ userId, displayName, teamName, nickname }) {
  if (!userId) {
    throw new Error("userId is required to upsert a mention profile.");
  }

  if (!displayName) {
    throw new Error("displayName is required to upsert a mention profile.");
  }

  const existingProfile = await getMentionProfileByUserId(userId).catch(() => null);
  const resolvedTeamName =
    teamName !== undefined ? teamName : existingProfile?.team_name || null;
  const resolvedNickname =
    nickname !== undefined ? nickname : existingProfile?.nickname || null;

  return supabaseInsert(
    MENTION_PROFILES_TABLE,
    {
      user_id: userId,
      display_name: displayName,
      team_name: resolvedTeamName,
      nickname: resolvedNickname,
      searchable_text: buildSearchableText({
        displayName,
        teamName: resolvedTeamName,
        nickname: resolvedNickname,
      }),
    },
    "Failed to upsert the mention profile.",
    { onConflict: "user_id" }
  );
}

async function searchMentionProfiles(query) {
  const trimmedQuery = query?.trim();

  if (!trimmedQuery) {
    return [];
  }

  const encodedQuery = encodeURIComponent(`*${trimmedQuery}*`);
  const data = await supabaseGet(
    MENTION_PROFILES_TABLE,
    `select=id,user_id,display_name,team_name,nickname,searchable_text&or=(display_name.ilike.${encodedQuery},nickname.ilike.${encodedQuery})&order=display_name.asc&limit=10`,
    "Failed to search mention profiles."
  );

  return Array.isArray(data) ? data : [];
}

async function searchMentionTeams(query) {
  const trimmedQuery = query?.trim();

  if (!trimmedQuery) {
    return [];
  }

  const encodedQuery = encodeURIComponent(`*${trimmedQuery}*`);
  const data = await supabaseGet(
    MENTION_PROFILES_TABLE,
    `select=team_name&team_name=not.is.null&team_name=ilike.${encodedQuery}&order=team_name.asc&limit=20`,
    "Failed to search mention teams."
  );

  const uniqueTeams = new Map();

  for (const row of Array.isArray(data) ? data : []) {
    const teamName = String(row?.team_name || "").trim();

    if (!teamName) {
      continue;
    }

    const key = teamName.toLowerCase();
    const currentCount = uniqueTeams.get(key)?.memberCount || 0;

    uniqueTeams.set(key, {
      id: `team:${key}`,
      name: teamName,
      memberCount: currentCount + 1,
    });
  }

  return [...uniqueTeams.values()];
}

async function getMentionProfilesByTeamName(teamName, options = {}) {
  const trimmedTeamName = String(teamName || "").trim();
  const excludedUserId = String(options.excludeUserId || "").trim();

  if (!trimmedTeamName) {
    return [];
  }

  const normalizedTeamName = normalizeMentionSearchValue(trimmedTeamName);
  const data = await supabaseGet(
    MENTION_PROFILES_TABLE,
    "select=id,user_id,display_name,team_name,nickname,searchable_text&team_name=not.is.null&order=display_name.asc&limit=500",
    "Failed to load mention profiles for the team."
  );

  const profiles = (Array.isArray(data) ? data : []).filter((profile) => {
    return (
      normalizeMentionSearchValue(profile?.team_name) === normalizedTeamName &&
      String(profile?.user_id || "").trim() !== excludedUserId
    );
  });
  const hydratedProfiles = await Promise.all(
    profiles.map(async (profile) => {
      const userProfile = profile?.user_id
        ? await getUserProfileById(profile.user_id).catch(() => null)
        : null;

      return {
        ...profile,
        profile_image: userProfile?.profile_image || null,
      };
    })
  );

  return hydratedProfiles;
}

async function findCalendarSyncByUserId(userId) {
  const data = await supabaseGet(
    CALENDAR_SYNC_TABLE,
    `user_id=eq.${userId}&select=*`,
    "Failed to load the calendar sync row."
  );

  return Array.isArray(data) ? data[0] || null : data;
}

async function saveCalendarSync({ userId, tokens }) {
  if (!userId) {
    throw new Error("userId is required to save calendar sync.");
  }

  if (!tokens?.access_token) {
    throw new Error("A Google access token is required to save calendar sync.");
  }

  const existingRow = await findCalendarSyncByUserId(userId);
  const payload = {
    user_id: userId,
    google_access_token: tokens.access_token,
    google_refresh_token: tokens.refresh_token || null,
    sync_enabled: true,
  };

  if (!existingRow) {
    return supabaseInsert(
      CALENDAR_SYNC_TABLE,
      payload,
      "Failed to create the calendar sync row."
    );
  }

  return supabasePatch(
    CALENDAR_SYNC_TABLE,
    `id=eq.${existingRow.id}`,
    payload,
    "Failed to update the calendar sync row."
  );
}

async function createEvent({
  creatorId,
  title,
  date,
  startTime,
  endTime,
  durationMinutes,
  location,
  description,
  parentEventId = null,
}) {
  if (!creatorId) {
    throw new Error("creatorId is required to create an event.");
  }

  if (!title) {
    throw new Error("title is required to create an event.");
  }

  const resolvedTiming = resolveEventTimingPayload({
    startTime,
    endTime,
    durationMinutes,
  });

  return supabaseInsert(
    EVENTS_TABLE,
    {
      creator_id: creatorId,
      title,
      date: date || null,
      start_time: resolvedTiming.startTime,
      end_time: resolvedTiming.endTime,
      duration_minutes: resolvedTiming.durationMinutes,
      location: location || null,
      description: description || null,
      parent_event_id: parentEventId,
    },
    "Failed to create the event."
  );
}

async function getEventById(eventId) {
  if (!eventId) {
    throw new Error("eventId is required.");
  }

  const data = await supabaseGet(
    EVENTS_TABLE,
    `id=eq.${eventId}&select=*`,
    "Failed to load the event."
  );

  return Array.isArray(data) ? data[0] || null : data;
}

async function getEventsByCreatorId(creatorId) {
  if (!creatorId) {
    throw new Error("creatorId is required.");
  }

  const data = await supabaseGet(
    EVENTS_TABLE,
    `creator_id=eq.${creatorId}&select=*`,
    "Failed to load creator events."
  );

  return Array.isArray(data) ? data : [];
}

async function updateEvent({
  eventId,
  creatorId,
  title,
  date,
  startTime,
  endTime,
  durationMinutes,
  location,
  description,
  lifecycleStatus,
  deletedAt,
  incrementVersion = false,
}) {
  const currentEvent = await getEventById(eventId);

  if (!currentEvent) {
    return null;
  }

  const currentDurationMinutes = resolveStoredDurationMinutes(currentEvent.duration_minutes);
  const nextStartTime = startTime ?? currentEvent.start_time;
  const nextEndTime =
    endTime ??
    (nextStartTime
      ? addMinutesToTime(
          nextStartTime,
          resolveDurationMinutes(
            currentEvent.start_time,
            currentEvent.end_time,
            currentDurationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES
          ) || DEFAULT_EVENT_DURATION_MINUTES
        )
      : currentEvent.end_time);
  const resolvedTiming = resolveEventTimingPayload({
    startTime: nextStartTime,
    endTime: nextEndTime,
    durationMinutes,
    fallbackDurationMinutes: currentDurationMinutes,
  });
  const payload = {
    creator_id: creatorId ?? currentEvent.creator_id,
    title: title ?? currentEvent.title,
    date: date ?? currentEvent.date,
    start_time: resolvedTiming.startTime,
    end_time: resolvedTiming.endTime,
    duration_minutes: resolvedTiming.durationMinutes,
    location: location ?? currentEvent.location,
    description: description ?? currentEvent.description,
    lifecycle_status: lifecycleStatus ?? currentEvent.lifecycle_status,
    deleted_at: deletedAt ?? currentEvent.deleted_at,
    version: incrementVersion ? (currentEvent.version || 1) + 1 : currentEvent.version,
  };

  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[supabase] updateEvent_payload:",
      JSON.stringify(
        {
          eventId,
          currentEvent: {
            start_time: currentEvent.start_time,
            end_time: currentEvent.end_time,
            duration_minutes: currentEvent.duration_minutes,
          },
          requested: {
            startTime: startTime ?? null,
            endTime: endTime ?? null,
            durationMinutes: durationMinutes ?? null,
          },
          resolvedTiming,
          payload,
        },
        null,
        2
      )
    );
  }

  return supabasePatch(
    EVENTS_TABLE,
    `id=eq.${eventId}`,
    payload,
    "Failed to update the event."
  );
}

async function markEventDeleted(eventId) {
  return supabasePatch(
    EVENTS_TABLE,
    `id=eq.${eventId}`,
    {
      lifecycle_status: "deleted",
      deleted_at: new Date().toISOString(),
    },
    "Failed to mark the event as deleted."
  );
}

async function createParticipant({
  eventId,
  userId,
  name,
  email,
  status = "pending",
}) {
  if (!eventId) {
    throw new Error("eventId is required to create a participant.");
  }

  if (!name) {
    throw new Error("name is required to create a participant.");
  }

  return supabaseInsert(
    PARTICIPANTS_TABLE,
    {
      event_id: eventId,
      user_id: userId || null,
      name,
      email: email || "",
      status,
    },
    "Failed to create the participant."
  );
}

async function updateParticipantStatus({ participantId, status }) {
  if (!participantId) {
    throw new Error("participantId is required.");
  }

  if (!["pending", "accepted", "rejected", "withdrawn"].includes(status)) {
    throw new Error("participants.status must be pending, accepted, rejected, or withdrawn.");
  }

  return supabasePatch(
    PARTICIPANTS_TABLE,
    `id=eq.${participantId}`,
    { status },
    "Failed to update the participant status."
  );
}

async function dismissParticipant(participantId) {
  if (!participantId) {
    throw new Error("participantId is required.");
  }

  return supabasePatch(
    PARTICIPANTS_TABLE,
    `id=eq.${participantId}`,
    {
      dismissed_at: new Date().toISOString(),
    },
    "Failed to dismiss the participant entry."
  );
}

async function createInvitation({ participantId, status = "pending" }) {
  if (!participantId) {
    throw new Error("participantId is required to create an invitation.");
  }

  return supabaseInsert(
    INVITATIONS_TABLE,
    {
      participant_id: participantId,
      status,
    },
    "Failed to create the invitation."
  );
}

async function updateInvitationStatus({ invitationId, status }) {
  if (!invitationId) {
    throw new Error("invitationId is required.");
  }

  if (!["pending", "accepted", "declined", "cancelled"].includes(status)) {
    throw new Error("invitations.status must be pending, accepted, declined, or cancelled.");
  }

  return supabasePatch(
    INVITATIONS_TABLE,
    `id=eq.${invitationId}`,
    {
      status,
      responded_at:
        status === "accepted" || status === "declined"
          ? new Date().toISOString()
          : null,
    },
    "Failed to update the invitation status."
  );
}

async function dismissInvitation(invitationId) {
  if (!invitationId) {
    throw new Error("invitationId is required.");
  }

  return supabasePatch(
    INVITATIONS_TABLE,
    `id=eq.${invitationId}`,
    {
      dismissed_at: new Date().toISOString(),
    },
    "Failed to dismiss the invitation."
  );
}

async function getParticipantEventsByUserId(userId) {
  if (!userId) {
    throw new Error("userId is required.");
  }

  const data = await supabaseGet(
    PARTICIPANTS_TABLE,
    `user_id=eq.${userId}&select=id,event_id,user_id,name,email,status,created_at,dismissed_at,events(*),invitations(id,participant_id,token,status,sent_at,responded_at,dismissed_at)&order=created_at.desc`,
    "Failed to load the participant events."
  );

  return Array.isArray(data) ? data : [];
}

async function getInvitationsByUserId(userId) {
  return getParticipantEventsByUserId(userId);
}

async function getParticipantById(participantId) {
  if (!participantId) {
    throw new Error("participantId is required.");
  }

  const data = await supabaseGet(
    PARTICIPANTS_TABLE,
    `id=eq.${participantId}&select=id,event_id,user_id,name,email,status,created_at,dismissed_at,events(*),invitations(id,participant_id,token,status,sent_at,responded_at,dismissed_at)`,
    "Failed to load the participant."
  );

  return Array.isArray(data) ? data[0] || null : data;
}

async function getParticipantsByEventId(eventId) {
  if (!eventId) {
    throw new Error("eventId is required.");
  }

  const data = await supabaseGet(
    PARTICIPANTS_TABLE,
    `event_id=eq.${eventId}&select=id,event_id,user_id,name,email,status,created_at,dismissed_at,events(*),invitations(id,participant_id,token,status,sent_at,responded_at,dismissed_at)&order=created_at.asc`,
    "Failed to load the event participants."
  );

  return Array.isArray(data) ? data : [];
}

async function createCalendarEventLink({
  eventId,
  userId,
  googleEventId,
  calendarId = "primary",
  syncStatus = "synced",
  lastSyncedAt = null,
  deletedAt = null,
}) {
  if (!eventId || !userId) {
    throw new Error("eventId and userId are required to create a calendar event link.");
  }

  return supabaseInsert(
    CALENDAR_EVENT_LINKS_TABLE,
    {
      event_id: eventId,
      user_id: userId,
      google_event_id: googleEventId,
      calendar_id: calendarId,
      sync_status: syncStatus,
      last_synced_at: lastSyncedAt,
      deleted_at: deletedAt,
    },
    "Failed to upsert the calendar event link.",
    { onConflict: "event_id,user_id" }
  );
}

async function getCalendarEventLinkByEventAndUser(eventId, userId) {
  if (!eventId || !userId) {
    throw new Error("eventId and userId are required.");
  }

  const data = await supabaseGet(
    CALENDAR_EVENT_LINKS_TABLE,
    `event_id=eq.${eventId}&user_id=eq.${userId}&select=*`,
    "Failed to load the calendar event link."
  );

  return Array.isArray(data) ? data[0] || null : data;
}

async function listCalendarEventLinksByEventId(eventId) {
  if (!eventId) {
    throw new Error("eventId is required.");
  }

  const data = await supabaseGet(
    CALENDAR_EVENT_LINKS_TABLE,
    `event_id=eq.${eventId}&select=*`,
    "Failed to load the calendar event links."
  );

  return Array.isArray(data) ? data : [];
}

async function listParticipantsByEventIds(
  eventIds = [],
  { includeWithdrawn = false } = {}
) {
  const uniqueEventIds = [...new Set((eventIds || []).filter(Boolean))];

  if (uniqueEventIds.length === 0) {
    return [];
  }

  const filters = [`event_id=in.(${uniqueEventIds.join(",")})`];

  if (!includeWithdrawn) {
    filters.push("status=neq.withdrawn");
  }

  const data = await supabaseGet(
    PARTICIPANTS_TABLE,
    `${filters.join(
      "&"
    )}&select=id,event_id,user_id,name,email,status,created_at,dismissed_at&order=created_at.asc`,
    "Failed to load the event participants."
  );

  return Array.isArray(data) ? data : [];
}

async function listCalendarEventLinksByUserId(userId) {
  if (!userId) {
    throw new Error("userId is required.");
  }

  const data = await supabaseGet(
    CALENDAR_EVENT_LINKS_TABLE,
    `user_id=eq.${userId}&select=*`,
    "Failed to load the calendar event links for the user."
  );

  return Array.isArray(data) ? data : [];
}

async function updateCalendarEventLinkStatus({
  linkId,
  syncStatus,
  googleEventId,
  lastSyncedAt,
  deletedAt,
}) {
  if (!linkId) {
    throw new Error("linkId is required.");
  }

  const payload = {
    sync_status: syncStatus,
  };

  if (googleEventId !== undefined) {
    payload.google_event_id = googleEventId;
  }

  if (lastSyncedAt !== undefined) {
    payload.last_synced_at = lastSyncedAt;
  }

  if (deletedAt !== undefined) {
    payload.deleted_at = deletedAt;
  }

  return supabasePatch(
    CALENDAR_EVENT_LINKS_TABLE,
    `id=eq.${linkId}`,
    payload,
    "Failed to update the calendar event link."
  );
}

async function markCalendarEventLinkDeleted(linkId) {
  return updateCalendarEventLinkStatus({
    linkId,
    syncStatus: "deleted",
    deletedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
  });
}

async function createEventChangeRequest({
  eventId,
  requesterUserId,
  requestType,
  requestStatus,
  creatorDecisionStatus = "pending",
  creatorDecisionReason = null,
  creatorDecidedAt = null,
  sourceText = null,
  parsedPayload = null,
  beforeSnapshot,
  afterSnapshot = null,
  expiresAt = null,
  resolvedAt = null,
}) {
  return supabaseInsert(
    EVENT_CHANGE_REQUESTS_TABLE,
    {
      event_id: eventId,
      requester_user_id: requesterUserId,
      request_type: requestType,
      request_status: requestStatus,
      creator_decision_status: creatorDecisionStatus,
      creator_decision_reason: creatorDecisionReason,
      creator_decided_at: creatorDecidedAt,
      source_text: sourceText,
      parsed_payload: parsedPayload,
      before_snapshot: beforeSnapshot,
      after_snapshot: afterSnapshot,
      expires_at: expiresAt,
      resolved_at: resolvedAt,
    },
    "Failed to create the event change request."
  );
}

async function getEventChangeRequestById(requestId) {
  if (!requestId) {
    throw new Error("requestId is required.");
  }

  const data = await supabaseGet(
    EVENT_CHANGE_REQUESTS_TABLE,
    `id=eq.${requestId}&select=*`,
    "Failed to load the event change request."
  );

  return Array.isArray(data) ? data[0] || null : data;
}

async function listPendingChangeRequestsForCreator(creatorUserId) {
  const data = await supabaseGet(
    EVENT_CHANGE_REQUESTS_TABLE,
    `request_status=eq.pending_creator_review&select=*`,
    "Failed to load pending creator review requests."
  );

  return (Array.isArray(data) ? data : []).filter(
    (item) => item.request_status === "pending_creator_review" && item.requester_user_id !== creatorUserId
  );
}

async function listEventChangeRequestsByStatus(status) {
  const data = await supabaseGet(
    EVENT_CHANGE_REQUESTS_TABLE,
    `request_status=eq.${status}&select=*`,
    "Failed to load event change requests."
  );

  return Array.isArray(data) ? data : [];
}

async function listEventChangeRequestsByEventId(eventId) {
  const data = await supabaseGet(
    EVENT_CHANGE_REQUESTS_TABLE,
    `event_id=eq.${eventId}&select=*`,
    "Failed to load event change requests for the event."
  );

  return Array.isArray(data) ? data : [];
}

async function listPendingChangeRequestTargetsByUserId(userId) {
  const data = await supabaseGet(
    EVENT_CHANGE_REQUEST_TARGETS_TABLE,
    `target_user_id=eq.${userId}&decision_status=eq.pending&select=*`,
    "Failed to load pending change request targets."
  );

  return Array.isArray(data) ? data : [];
}

async function listChangeRequestTargetsByUserId(userId) {
  const data = await supabaseGet(
    EVENT_CHANGE_REQUEST_TARGETS_TABLE,
    `target_user_id=eq.${userId}&select=*`,
    "Failed to load change request targets."
  );

  return Array.isArray(data) ? data : [];
}

async function updateEventChangeRequest(requestId, payload) {
  return supabasePatch(
    EVENT_CHANGE_REQUESTS_TABLE,
    `id=eq.${requestId}`,
    payload,
    "Failed to update the event change request."
  );
}

async function createEventChangeRequestTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return [];
  }

  return supabaseInsertMany(
    EVENT_CHANGE_REQUEST_TARGETS_TABLE,
    targets,
    "Failed to create change request targets."
  );
}

async function getEventChangeRequestTargetById(targetId) {
  const data = await supabaseGet(
    EVENT_CHANGE_REQUEST_TARGETS_TABLE,
    `id=eq.${targetId}&select=*`,
    "Failed to load the change request target."
  );

  return Array.isArray(data) ? data[0] || null : data;
}

async function getEventChangeRequestTargetsByRequestId(requestId) {
  const data = await supabaseGet(
    EVENT_CHANGE_REQUEST_TARGETS_TABLE,
    `request_id=eq.${requestId}&select=*`,
    "Failed to load the change request targets."
  );

  return Array.isArray(data) ? data : [];
}

async function updateEventChangeRequestTarget(targetId, payload) {
  return supabasePatch(
    EVENT_CHANGE_REQUEST_TARGETS_TABLE,
    `id=eq.${targetId}`,
    payload,
    "Failed to update the change request target."
  );
}

async function updateEventChangeRequestTargets(filterQuery, payload) {
  return supabasePatch(
    EVENT_CHANGE_REQUEST_TARGETS_TABLE,
    filterQuery,
    payload,
    "Failed to update the change request targets."
  );
}

module.exports = {
  buildSearchableText,
  createUserSubscription,
  createCalendarEventLink,
  createEvent,
  createEventChangeRequest,
  createEventChangeRequestTargets,
  createInvitation,
  createParticipant,
  deleteUserSubscription,
  deleteSubscriptionCalendarEvent,
  deleteUserSubscriptionEventOverride,
  dismissInvitation,
  dismissParticipant,
  findCalendarSyncByUserId,
  getCalendarEventLinkByEventAndUser,
  getEventById,
  getEventsByCreatorId,
  getEventChangeRequestById,
  getEventChangeRequestTargetById,
  getEventChangeRequestTargetsByRequestId,
  getInvitationsByUserId,
  getMentionProfileByUserId,
  getMentionProfilesByTeamName,
  getParticipantById,
  getParticipantEventsByUserId,
  getParticipantsByEventId,
  getSubscriptionCatalogItemByCode,
  getUserProfileByEmail,
  getUserProfileById,
  isSupabaseConfigured,
  listActiveSubscriptionCatalog,
  listCalendarEventLinksByEventId,
  listCalendarEventLinksByUserId,
  listSubscriptionCalendarEvents,
  listUserSubscriptionEventOverrides,
  listUserSubscriptions,
  listParticipantsByEventIds,
  listChangeRequestTargetsByUserId,
  listEventChangeRequestsByEventId,
  listEventChangeRequestsByStatus,
  listPendingChangeRequestsForCreator,
  listPendingChangeRequestTargetsByUserId,
  markCalendarEventLinkDeleted,
  markEventDeleted,
  saveCalendarSync,
  searchMentionProfiles,
  searchMentionTeams,
  updateCalendarEventLinkStatus,
  updateEvent,
  updateEventChangeRequest,
  updateEventChangeRequestTarget,
  updateEventChangeRequestTargets,
  updateInvitationStatus,
  updateParticipantStatus,
  updateUserProfileById,
  upsertUserSubscriptionEventOverride,
  upsertMentionProfile,
  upsertSubscriptionCalendarEvent,
  upsertUserProfile,
};
