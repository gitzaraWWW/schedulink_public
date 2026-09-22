const { TIMEZONE } = require("../scheduleParser");
const {
  createCalendarEventLink,
  findCalendarSyncByUserId,
  getCalendarEventLinkByEventAndUser,
  getMentionProfileByUserId,
  getParticipantEventsByUserId,
  getUserProfileById,
  listCalendarEventLinksByUserId,
  listParticipantsByEventIds,
  markCalendarEventLinkDeleted,
  updateCalendarEventLinkStatus,
} = require("../supabase");
const { getAuthorizedCalendar } = require("../integrations/googleClient");
const { createHttpError } = require("../utils/errors");
const { addOneHour } = require("../utils/time");
const { ensureSessionUser } = require("./sessionUserService");

function normalizeClock(value) {
  if (!value) {
    return null;
  }

  return String(value).length === 5 ? `${value}:00` : String(value);
}

function normalizeTextField(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

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

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function toDateKey(date) {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toSeoulDateTime(dateText) {
  return `${dateText}T00:00:00+09:00`;
}

function buildDefaultEventListRange(now = new Date()) {
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startDate = toDateKey(addMonths(currentMonth, -1));
  const endDate = toDateKey(addMonths(currentMonth, 2));

  return {
    startDate,
    endDate,
  };
}

function resolveEventListRange(options = {}) {
  const startDate = isDateKey(options.startDate) ? options.startDate : null;
  const endDate = isDateKey(options.endDate) ? options.endDate : null;

  if (startDate && endDate && startDate < endDate) {
    return {
      startDate,
      endDate,
    };
  }

  return buildDefaultEventListRange();
}

function resolveTimedEventRange(dateText, startTime, endTime) {
  const normalizedStart = normalizeClock(startTime);
  const normalizedEnd = normalizeClock(endTime);

  if (!dateText || !normalizedStart || !normalizedEnd) {
    return {
      startDate: dateText,
      endDate: dateText,
      startDateTime: normalizedStart,
      endDateTime: normalizedEnd,
    };
  }

  const startDate = dateText;
  const endDate = normalizedEnd <= normalizedStart ? addDays(dateText, 1) : dateText;

  return {
    startDate,
    endDate,
    startDateTime: normalizedStart,
    endDateTime: normalizedEnd,
  };
}

function buildOwnCalendarEventRequest(parsed, originalText) {
  const requestBody = {
    summary: parsed.summary,
  };

  if (parsed.description) {
    requestBody.description = parsed.description;
  }

  if (parsed.location) {
    requestBody.location = parsed.location;
  }

  if (parsed.startTime) {
    const endTime = parsed.endTime || addOneHour(parsed.startTime);
    const timeRange = resolveTimedEventRange(parsed.date, parsed.startTime, endTime);

    requestBody.start = {
      dateTime: `${timeRange.startDate}T${timeRange.startDateTime}`,
      timeZone: TIMEZONE,
    };
    requestBody.end = {
      dateTime: `${timeRange.endDate}T${timeRange.endDateTime}`,
      timeZone: TIMEZONE,
    };
  } else {
    requestBody.start = {
      date: parsed.date,
      timeZone: TIMEZONE,
    };
    requestBody.end = {
      date: addDays(parsed.date, 1),
      timeZone: TIMEZONE,
    };
  }

  return requestBody;
}

function buildStoredCalendarEventRequest(eventRow) {
  const requestBody = {
    summary: eventRow?.title || "Schedulink event",
  };

  if (eventRow?.description) {
    requestBody.description = eventRow.description;
  }

  if (eventRow?.location) {
    requestBody.location = eventRow.location;
  }

  if (eventRow?.start_time) {
    const timeRange = resolveTimedEventRange(
      eventRow.date,
      eventRow.start_time,
      eventRow.end_time
    );

    requestBody.start = {
      dateTime: `${timeRange.startDate}T${timeRange.startDateTime}`,
      timeZone: TIMEZONE,
    };
    requestBody.end = {
      dateTime: `${timeRange.endDate}T${timeRange.endDateTime}`,
      timeZone: TIMEZONE,
    };
  } else {
    requestBody.start = {
      date: eventRow?.date,
      timeZone: TIMEZONE,
    };
    requestBody.end = {
      date: addDays(eventRow?.date, 1),
      timeZone: TIMEZONE,
    };
  }

  return requestBody;
}

function buildDirectCalendarEventPatchRequest(payload = {}) {
  const summary = normalizeTextField(payload.title);
  const date = payload.date || null;
  const startTime = payload.startTime ? String(payload.startTime).slice(0, 5) : "";
  const endTime = payload.endTime ? String(payload.endTime).slice(0, 5) : "";
  const location = normalizeTextField(payload.location);
  const description = normalizeTextField(payload.description);

  if (!summary) {
    throw createHttpError(400, "일정 제목을 입력해 주세요.");
  }

  if (!isValidDate(String(date || ""))) {
    throw createHttpError(400, "올바른 날짜 형식이 아닙니다.");
  }

  const hasStartTime = Boolean(startTime);
  const hasEndTime = Boolean(endTime);

  if (hasStartTime !== hasEndTime) {
    throw createHttpError(400, "시작 시간과 종료 시간을 모두 입력해 주세요.");
  }

  if (hasStartTime && !isValidTime(startTime)) {
    throw createHttpError(400, "올바른 시작 시간 형식이 아닙니다.");
  }

  if (hasEndTime && !isValidTime(endTime)) {
    throw createHttpError(400, "올바른 종료 시간 형식이 아닙니다.");
  }

  const requestBody = {
    summary,
    description: description || "",
    location: location || "",
  };

  if (hasStartTime) {
    const timeRange = resolveTimedEventRange(date, startTime, endTime);

    requestBody.start = {
      dateTime: `${timeRange.startDate}T${timeRange.startDateTime}`,
      timeZone: TIMEZONE,
    };
    requestBody.end = {
      dateTime: `${timeRange.endDate}T${timeRange.endDateTime}`,
      timeZone: TIMEZONE,
    };
  } else {
    requestBody.start = {
      date,
      timeZone: TIMEZONE,
    };
    requestBody.end = {
      date: addDays(date, 1),
      timeZone: TIMEZONE,
    };
  }

  return requestBody;
}

function buildSchedulinkMetadata(eventRow, participantRow, savedUserId) {
  if (!eventRow || !savedUserId) {
    return {
      isManaged: false,
    };
  }

  const isOwner = eventRow.creator_id === savedUserId;

  return {
    isManaged: true,
    internalEventId: eventRow.id,
    creatorId: eventRow.creator_id || null,
    participantId: participantRow?.id || null,
    participantStatus: participantRow?.status || null,
    participants: [],
    canSave: true,
    canDelete: true,
    saveMode: isOwner ? "direct_update" : "proposal_update",
    deleteMode: isOwner ? "direct_delete" : "hide_only",
  };
}

function resolveParticipantDisplayName(participant, mentionProfile, userProfile) {
  const emailLocalPart = participant?.email
    ? String(participant.email).split("@")[0]
    : null;

  return (
    mentionProfile?.display_name ||
    participant?.name ||
    userProfile?.name ||
    emailLocalPart ||
    "이름 미정"
  );
}

function buildParticipantPresentation(participant, mentionProfile, userProfile) {
  return {
    id: participant?.id || null,
    userId: participant?.user_id || null,
    name: participant?.name || null,
    email: participant?.email || null,
    status: participant?.status || null,
    displayName: resolveParticipantDisplayName(
      participant,
      mentionProfile,
      userProfile
    ),
    teamName: mentionProfile?.team_name || null,
    nickname: mentionProfile?.nickname || null,
    profileImage: userProfile?.profile_image || null,
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

async function listCalendarEvents(session, options = {}) {
  if (!session?.tokens) {
    throw createHttpError(401, "Google Calendar 연결 정보가 없습니다.");
  }

  const savedUser = await ensureSessionUser(session);
  const range = resolveEventListRange(options);
  const calendar = getAuthorizedCalendar(session.tokens);
  const [participantRows, calendarLinks] = await Promise.all([
    getParticipantEventsByUserId(savedUser.id).catch(() => []),
    listCalendarEventLinksByUserId(savedUser.id).catch(() => []),
  ]);
  const participantByEventId = new Map(
    (participantRows || [])
      .filter((row) => row?.event_id && row?.events)
      .map((row) => [row.event_id, row])
  );
  const linkByGoogleEventId = new Map(
    (calendarLinks || [])
      .filter((link) => link?.google_event_id)
      .map((link) => [link.google_event_id, link])
  );
  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: toSeoulDateTime(range.startDate),
    timeMax: toSeoulDateTime(range.endDate),
    singleEvents: true,
    orderBy: "startTime",
  });

  const managedEventIds = [
    ...new Set(
      (response.data.items || [])
        .map((item) => linkByGoogleEventId.get(item.id)?.event_id || null)
        .filter(Boolean)
    ),
  ];
  const allParticipants = await listParticipantsByEventIds(managedEventIds).catch(
    () => []
  );
  const uniqueUserIds = [
    ...new Set(
      (allParticipants || [])
        .map((participant) => participant?.user_id || null)
        .filter(Boolean)
    ),
  ];
  const [userProfiles, mentionProfiles] = await Promise.all([
    Promise.all(
      uniqueUserIds.map(async (userId) => [userId, await getUserProfileById(userId).catch(() => null)])
    ),
    Promise.all(
      uniqueUserIds.map(async (userId) => [
        userId,
        await getMentionProfileByUserId(userId).catch(() => null),
      ])
    ),
  ]);
  const userProfileById = new Map(userProfiles);
  const mentionProfileByUserId = new Map(mentionProfiles);
  const participantsByEventId = new Map();

  for (const participant of allParticipants || []) {
    if (!participant?.event_id) {
      continue;
    }

    const currentParticipants = participantsByEventId.get(participant.event_id) || [];
    currentParticipants.push(
      buildParticipantPresentation(
        participant,
        mentionProfileByUserId.get(participant.user_id) || null,
        userProfileById.get(participant.user_id) || null
      )
    );
    participantsByEventId.set(participant.event_id, currentParticipants);
  }

  return (response.data.items || []).map((item) => {
    const link = linkByGoogleEventId.get(item.id) || null;
    const participantRow = link?.event_id
      ? participantByEventId.get(link.event_id) || null
      : null;
    const eventRow = participantRow?.events || null;
    const schedulink = buildSchedulinkMetadata(
      eventRow,
      participantRow,
      savedUser.id
    );
    const participants = link?.event_id
      ? participantsByEventId.get(link.event_id) || []
      : [];

    return {
      ...item,
      description: eventRow?.description ?? item.description ?? "",
      schedulink: {
        ...schedulink,
        participants,
      },
    };
  });
}

async function patchExternalCalendarEvent(session, googleEventId, payload = {}) {
  if (!session?.tokens) {
    throw createHttpError(401, "Google Calendar 연결 정보가 없습니다.");
  }

  if (!googleEventId) {
    throw createHttpError(400, "googleEventId is required.");
  }

  await ensureSessionUser(session);

  const calendar = getAuthorizedCalendar(session.tokens);
  const response = await calendar.events.patch({
    calendarId: "primary",
    eventId: googleEventId,
    requestBody: buildDirectCalendarEventPatchRequest(payload),
    sendUpdates: "none",
  });

  return {
    success: true,
    resultType: "updated",
    message: "구글 캘린더 일정이 수정되었습니다.",
    event: response.data || null,
  };
}

async function insertOwnCalendarEvent(tokens, parsed, originalText) {
  const calendar = getAuthorizedCalendar(tokens);
  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: buildOwnCalendarEventRequest(parsed, originalText),
    sendUpdates: "none",
  });

  return response.data;
}

async function createCalendarEventForUser(userId, eventRow) {
  const calendar = await getCalendarClientForUser(userId);

  if (!calendar) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[calendarService] createCalendarEventForUser_skipped:",
        JSON.stringify(
          {
            userId,
            eventId: eventRow?.id || null,
            reason: "calendar sync not enabled",
          },
          null,
          2
        )
      );
    }

    return {
      success: false,
      reason: "calendar sync not enabled",
    };
  }

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: buildStoredCalendarEventRequest(eventRow),
    sendUpdates: "none",
  });

  const calendarEvent = response.data || null;

  await createCalendarEventLink({
    eventId: eventRow.id,
    userId,
    googleEventId: calendarEvent?.id || null,
    syncStatus: "synced",
    lastSyncedAt: new Date().toISOString(),
    deletedAt: null,
  });

  return {
    success: true,
    calendarEvent,
  };
}

async function createCalendarEventsForAcceptedParticipants(eventParticipants) {
  const createdEvents = [];
  const failedUsers = [];

  for (const participant of eventParticipants) {
    if (!participant?.user_id || participant.status !== "accepted") {
      continue;
    }

    try {
      const result = await createCalendarEventForUser(
        participant.user_id,
        participant.events
      );

      if (!result.success) {
        failedUsers.push({
          userId: participant.user_id,
          reason: result.reason,
        });
        continue;
      }

      createdEvents.push({
        userId: participant.user_id,
        calendarEventId: result.calendarEvent?.id || null,
      });
    } catch (error) {
      failedUsers.push({
        userId: participant.user_id,
        reason: error.message || "calendar sync failed",
      });
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[calendarService] createCalendarEventsForAcceptedParticipants_result:",
      JSON.stringify(
        {
          acceptedParticipantCount: (eventParticipants || []).filter(
            (participant) => participant?.user_id && participant.status === "accepted"
          ).length,
          createdEvents,
          failedUsers,
        },
        null,
        2
      )
    );
  }

  return { createdEvents, failedUsers };
}

async function patchCalendarEventForUser(userId, eventRow) {
  const link = await getCalendarEventLinkByEventAndUser(eventRow.id, userId);

  if (!link?.google_event_id || link.sync_status === "deleted") {
    return {
      success: false,
      reason: "calendar event link not found",
    };
  }

  const calendar = await getCalendarClientForUser(userId);

  if (!calendar) {
    return {
      success: false,
      reason: "calendar sync not enabled",
    };
  }

  await updateCalendarEventLinkStatus({
    linkId: link.id,
    syncStatus: "pending_update",
  });

  const response = await calendar.events.patch({
    calendarId: link.calendar_id || "primary",
    eventId: link.google_event_id,
    requestBody: buildStoredCalendarEventRequest(eventRow),
    sendUpdates: "none",
  });

  await updateCalendarEventLinkStatus({
    linkId: link.id,
    syncStatus: "synced",
    lastSyncedAt: new Date().toISOString(),
    googleEventId: response.data?.id || link.google_event_id,
    deletedAt: null,
  });

  return {
    success: true,
    calendarEvent: response.data || null,
  };
}

async function patchCalendarEventsForAcceptedParticipants(eventParticipants, eventRow) {
  const patchedEvents = [];
  const failedUsers = [];

  for (const participant of eventParticipants) {
    if (!participant?.user_id || participant.status !== "accepted") {
      continue;
    }

    try {
      const result = await patchCalendarEventForUser(participant.user_id, eventRow);

      if (!result.success) {
        failedUsers.push({
          userId: participant.user_id,
          reason: result.reason,
        });
        continue;
      }

      patchedEvents.push({
        userId: participant.user_id,
        calendarEventId: result.calendarEvent?.id || null,
      });
    } catch (error) {
      failedUsers.push({
        userId: participant.user_id,
        reason: error.message || "calendar patch failed",
      });
    }
  }

  return { patchedEvents, failedUsers };
}

async function deleteCalendarEventForUser(userId, eventId) {
  const link = await getCalendarEventLinkByEventAndUser(eventId, userId);

  if (!link?.google_event_id || link.sync_status === "deleted") {
    return {
      success: false,
      reason: "calendar event link not found",
    };
  }

  const calendar = await getCalendarClientForUser(userId);

  if (!calendar) {
    return {
      success: false,
      reason: "calendar sync not enabled",
    };
  }

  await updateCalendarEventLinkStatus({
    linkId: link.id,
    syncStatus: "pending_delete",
  });

  await calendar.events.delete({
    calendarId: link.calendar_id || "primary",
    eventId: link.google_event_id,
    sendUpdates: "none",
  });

  await markCalendarEventLinkDeleted(link.id);

  return { success: true };
}

async function deleteExternalCalendarEvent(session, googleEventId) {
  if (!session?.tokens) {
    throw createHttpError(401, "Google Calendar 연결 정보가 없습니다.");
  }

  if (!googleEventId) {
    throw createHttpError(400, "googleEventId is required.");
  }

  await ensureSessionUser(session);

  const calendar = getAuthorizedCalendar(session.tokens);
  await calendar.events.delete({
    calendarId: "primary",
    eventId: googleEventId,
    sendUpdates: "none",
  });

  return {
    success: true,
    resultType: "deleted",
    message: "구글 캘린더 일정이 삭제되었습니다.",
  };
}

async function deleteCalendarEventsForAcceptedParticipants(eventParticipants) {
  const deletedUsers = [];
  const failedUsers = [];

  for (const participant of eventParticipants) {
    if (!participant?.user_id || participant.status !== "accepted") {
      continue;
    }

    try {
      const result = await deleteCalendarEventForUser(
        participant.user_id,
        participant.event_id
      );

      if (!result.success) {
        failedUsers.push({
          userId: participant.user_id,
          reason: result.reason,
        });
        continue;
      }

      deletedUsers.push({
        userId: participant.user_id,
      });
    } catch (error) {
      failedUsers.push({
        userId: participant.user_id,
        reason: error.message || "calendar delete failed",
      });
    }
  }

  return { deletedUsers, failedUsers };
}

module.exports = {
  buildOwnCalendarEventRequest,
  buildStoredCalendarEventRequest,
  createCalendarEventsForAcceptedParticipants,
  deleteExternalCalendarEvent,
  deleteCalendarEventForUser,
  deleteCalendarEventsForAcceptedParticipants,
  insertOwnCalendarEvent,
  listCalendarEvents,
  patchExternalCalendarEvent,
  patchCalendarEventsForAcceptedParticipants,
};
