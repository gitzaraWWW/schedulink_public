export function isSubscriptionEvent(event) {
  const privateExtendedProps = event.extendedProperties?.private || {};

  return (
    privateExtendedProps.eventSource === "subscription" ||
    privateExtendedProps.subscriptionCode === "maplestory"
  );
}

export function normalizeEvent(event) {
  const privateExtendedProps = event.extendedProperties?.private || {};
  const subscriptionEvent = isSubscriptionEvent(event);
  const eventPriority = Number(privateExtendedProps.eventPriority);
  const normalizedEvent = {
    id: event.id,
    title: event.summary || event.title || "",
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
    sourcePriority:
      Number.isFinite(eventPriority) && eventPriority > 0
        ? eventPriority
        : subscriptionEvent
          ? 3
          : 1,
    location: event.location || "",
    description: event.description || "",
    extendedProperties: event.extendedProperties || {},
    attendees: normalizeAttendees(event.attendees || event.participants || []),
    schedulink:
      event.schedulink && typeof event.schedulink === "object"
        ? {
            isManaged: Boolean(event.schedulink.isManaged),
            internalEventId: event.schedulink.internalEventId || null,
            creatorId: event.schedulink.creatorId || null,
            participantId: event.schedulink.participantId || null,
            participantStatus: event.schedulink.participantStatus || null,
            participants: Array.isArray(event.schedulink.participants)
              ? event.schedulink.participants.map((participant, index) => ({
                  id:
                    participant?.id ||
                    participant?.userId ||
                    participant?.email ||
                    `participant-${index}`,
                  userId: participant?.userId || null,
                  name: participant?.name || null,
                  email: participant?.email || "",
                  status: participant?.status || "",
                  displayName:
                    participant?.displayName ||
                    participant?.name ||
                    participant?.email ||
                    "이름 미정",
                  teamName: participant?.teamName || null,
                  nickname: participant?.nickname || null,
                  profileImage: participant?.profileImage || null,
                }))
              : [],
            canSave: Boolean(event.schedulink.canSave),
            canDelete: Boolean(event.schedulink.canDelete),
            saveMode: event.schedulink.saveMode || null,
            deleteMode: event.schedulink.deleteMode || null,
          }
        : {
            isManaged: false,
            internalEventId: null,
            creatorId: null,
            participantId: null,
            participantStatus: null,
            participants: [],
            canSave: false,
            canDelete: false,
            saveMode: null,
            deleteMode: null,
          },
  };

  return {
    ...normalizedEvent,
    spanVariant: getEventSpanVariant(normalizedEvent),
  };
}

export function sortEvents(eventList) {
  return [...eventList].sort((firstEvent, secondEvent) => {
    const first = new Date(firstEvent.start).getTime();
    const second = new Date(secondEvent.start).getTime();

    if (first !== second) {
      return first - second;
    }

    const firstPriority = Number(firstEvent.sourcePriority || 1);
    const secondPriority = Number(secondEvent.sourcePriority || 1);

    if (firstPriority !== secondPriority) {
      return firstPriority - secondPriority;
    }

    return String(firstEvent.title || "").localeCompare(
      String(secondEvent.title || ""),
      "ko"
    );
  });
}

export function upsertEvent(eventList, rawEvent) {
  const nextEvent = normalizeEvent(rawEvent);
  const filteredEvents = eventList.filter((event) => event.id !== nextEvent.id);

  return sortEvents([...filteredEvents, nextEvent]);
}

function normalizeAttendees(attendees) {
  if (!Array.isArray(attendees)) {
    return [];
  }

  return attendees.map((attendee, index) => ({
    id: attendee.id || attendee.email || attendee.user_id || `attendee-${index}`,
    name:
      attendee.displayName ||
      attendee.name ||
      attendee.email ||
      attendee.text ||
      "이름 미정",
    email: attendee.email || attendee.address || "",
    status: attendee.responseStatus || attendee.status || "",
  }));
}

function isDateOnlyString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseDateOnlyString(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function parseEventDate(value) {
  if (!value) {
    return null;
  }

  if (isDateOnlyString(value)) {
    return parseDateOnlyString(value);
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function buildFallbackEventEnd(event, eventStart) {
  const fallbackEnd = new Date(eventStart);

  if (event.allDay || isDateOnlyString(event.start)) {
    fallbackEnd.setDate(fallbackEnd.getDate() + 1);
    return fallbackEnd;
  }

  fallbackEnd.setMinutes(fallbackEnd.getMinutes() + 1);
  return fallbackEnd;
}

function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getEventSpanVariant(event) {
  const eventStart = parseEventDate(event.start);

  if (!eventStart) {
    return "single-day";
  }

  const parsedEventEnd = parseEventDate(event.end);
  let eventEnd =
    parsedEventEnd && parsedEventEnd > eventStart
      ? parsedEventEnd
      : buildFallbackEventEnd(event, eventStart);

  if ((event.allDay || isDateOnlyString(event.start)) && eventEnd > eventStart) {
    eventEnd = new Date(eventEnd.getTime() - 1);
  }

  return toDateKey(eventStart) === toDateKey(eventEnd)
    ? "single-day"
    : "multi-day";
}

export function eventOverlapsDate(event, dateString) {
  if (!dateString) {
    return false;
  }

  const dayStart = parseDateOnlyString(dateString);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const eventStart = parseEventDate(event.start);
  if (!eventStart) {
    return false;
  }

  const parsedEventEnd = parseEventDate(event.end);
  const eventEnd =
    parsedEventEnd && parsedEventEnd > eventStart
      ? parsedEventEnd
      : buildFallbackEventEnd(event, eventStart);

  return eventStart < dayEnd && eventEnd > dayStart;
}

export function getEventsForDate(eventList, dateString) {
  return sortEvents(
    eventList.filter((event) => eventOverlapsDate(event, dateString))
  );
}

export function formatSelectedDate(dateString) {
  if (!dateString) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(parseDateOnlyString(dateString));
}

export function formatEventTimeRange(event) {
  if (event.allDay) {
    return "하루 종일";
  }

  const eventStart = parseEventDate(event.start);
  if (!eventStart) {
    return "시간 미정";
  }

  const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const eventEnd = parseEventDate(event.end);
  if (!eventEnd) {
    return timeFormatter.format(eventStart);
  }

  return `${timeFormatter.format(eventStart)} - ${timeFormatter.format(
    eventEnd
  )}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatEventDateForInput(value) {
  const parsedDate = parseEventDate(value);

  if (!parsedDate) {
    return "";
  }

  return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(
    parsedDate.getDate()
  )}`;
}

export function formatEventTimeForInput(value) {
  const parsedDate = parseEventDate(value);

  if (!parsedDate) {
    return "";
  }

  return `${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}`;
}
