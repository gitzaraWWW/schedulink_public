const { getAuthorizedCalendar } = require("../integrations/googleClient");
const { createHttpError } = require("../utils/errors");
const { findFreeSlots } = require("./freeTimeService");
const { parseLucidQuery } = require("./lucidParser");

function normalizeCalendarEvent(event = {}) {
  return {
    id: event.id || null,
    title: event.summary || "제목 없는 일정",
    start: event.start?.dateTime || event.start?.date || null,
    end: event.end?.dateTime || event.end?.date || null,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
    location: event.location || "",
    description: event.description || "",
    attendees: Array.isArray(event.attendees)
      ? event.attendees.map((attendee) => ({
          name: attendee.displayName || attendee.email || "",
          email: attendee.email || "",
          status: attendee.responseStatus || "",
        }))
      : [],
  };
}

async function listGoogleEventsForRange(session, range) {
  if (!session?.tokens) {
    throw createHttpError(401, "Google Calendar 연결 정보가 없습니다.");
  }

  const calendar = getAuthorizedCalendar(session.tokens);
  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: range.timeMin,
    timeMax: range.timeMax,
    singleEvents: true,
    orderBy: "startTime",
  });

  return response.data.items || [];
}

function buildListMessage(range, events) {
  if (events.length === 0) {
    return `${range.label} 일정이 없습니다.`;
  }

  return `${range.label} 일정은 ${events.length}개입니다.`;
}

function buildFreeTimeMessage(range, freeSlots, constraints) {
  if (freeSlots.length === 0) {
    return `${range.label} ${constraints.minDurationMinutes}분 이상 비는 시간이 없습니다.`;
  }

  return `${range.label} ${constraints.minDurationMinutes}분 이상 비는 시간은 ${freeSlots.length}개입니다.`;
}

function buildClarificationMessage(action) {
  if (action === "find_free_time") {
    return "문장을 정확히 이해하지 못했어요. 날짜나 기간을 다시 입력해 주세요. 예: 오늘 빈 시간, 다음 주 1시간 비는 시간";
  }

  return "문장을 정확히 이해하지 못했어요. 날짜나 기간을 다시 입력해 주세요. 예: 오늘 일정, 다음 주 일정, 5월 6일 일정";
}

async function answerLucidQuery(session, text, options = {}) {
  const trimmedText = String(text || "").trim();

  if (!trimmedText) {
    throw createHttpError(400, "질문 내용을 입력해 주세요.");
  }

  const query = parseLucidQuery(trimmedText, {
    now: options.now,
  });

  if (query.action === "unknown") {
    return {
      success: false,
      mode: "lucid",
      action: "unknown",
      message: buildClarificationMessage(query.action),
      range: query.range,
      constraints: query.constraints,
    };
  }

  if (!query.hasExplicitRange && !query.hasCurrentDayReference) {
    return {
      success: false,
      mode: "lucid",
      action: query.action,
      message: buildClarificationMessage(query.action),
      range: query.range,
      constraints: query.constraints,
    };
  }

  const rawEvents = await listGoogleEventsForRange(session, query.range);
  const events = rawEvents.map(normalizeCalendarEvent);

  if (query.action === "find_free_time") {
    const freeSlots = findFreeSlots(rawEvents, query.range, query.constraints, {
      now: options.now,
      treatAllDayAsBusy: true,
    });

    return {
      success: true,
      mode: "lucid",
      action: query.action,
      message: buildFreeTimeMessage(query.range, freeSlots, query.constraints),
      range: query.range,
      constraints: query.constraints,
      events,
      freeSlots,
    };
  }

  return {
    success: true,
    mode: "lucid",
    action: query.action,
    message: buildListMessage(query.range, events),
    range: query.range,
    events,
  };
}

module.exports = {
  answerLucidQuery,
  listGoogleEventsForRange,
  normalizeCalendarEvent,
};
