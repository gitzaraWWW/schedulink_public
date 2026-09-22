const { UTC_OFFSET, addDays, getDateKeyInSeoul, toDateTime } = require("./lucidParser");

const MINUTE_MS = 60 * 1000;

function parseDateTime(value) {
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getEventStart(event) {
  return event?.start?.dateTime || event?.start?.date || null;
}

function getEventEnd(event) {
  return event?.end?.dateTime || event?.end?.date || null;
}

function isAllDayEvent(event) {
  return Boolean(event?.start?.date && !event?.start?.dateTime);
}

function getDateRange(startDate, endDate) {
  const dates = [];
  let currentDate = startDate;

  while (currentDate < endDate) {
    dates.push(currentDate);
    currentDate = addDays(currentDate, 1);
  }

  return dates;
}

function compareDate(value) {
  return String(value || "").slice(0, 10);
}

function allDayOverlapsDate(event, dateKey) {
  const startDate = event?.start?.date;
  const endDate = event?.end?.date || addDays(startDate, 1);

  if (!startDate) {
    return false;
  }

  return compareDate(startDate) <= dateKey && dateKey < compareDate(endDate);
}

function clampInterval(start, end, min, max) {
  const clampedStart = start > min ? start : min;
  const clampedEnd = end < max ? end : max;

  if (clampedEnd <= clampedStart) {
    return null;
  }

  return {
    start: clampedStart,
    end: clampedEnd,
  };
}

function getBusyIntervalsForDate(events, dateKey, windowStart, windowEnd, options) {
  const intervals = [];
  const treatAllDayAsBusy = options?.treatAllDayAsBusy !== false;

  for (const event of events || []) {
    if (isAllDayEvent(event)) {
      if (treatAllDayAsBusy && allDayOverlapsDate(event, dateKey)) {
        intervals.push({
          start: windowStart,
          end: windowEnd,
        });
      }

      continue;
    }

    const eventStart = parseDateTime(getEventStart(event));
    const eventEnd = parseDateTime(getEventEnd(event));

    if (!eventStart || !eventEnd || eventEnd <= eventStart) {
      continue;
    }

    const interval = clampInterval(eventStart, eventEnd, windowStart, windowEnd);

    if (interval) {
      intervals.push(interval);
    }
  }

  return mergeIntervals(intervals);
}

function mergeIntervals(intervals) {
  const sortedIntervals = [...intervals].sort(
    (left, right) => left.start.getTime() - right.start.getTime()
  );
  const mergedIntervals = [];

  for (const interval of sortedIntervals) {
    const previousInterval = mergedIntervals[mergedIntervals.length - 1];

    if (!previousInterval || interval.start > previousInterval.end) {
      mergedIntervals.push({ ...interval });
      continue;
    }

    if (interval.end > previousInterval.end) {
      previousInterval.end = interval.end;
    }
  }

  return mergedIntervals;
}

function roundUpToNextMinute(date) {
  const timestamp = date.getTime();
  const roundedTimestamp = Math.ceil(timestamp / MINUTE_MS) * MINUTE_MS;
  return new Date(roundedTimestamp);
}

function formatDateTimeInSeoul(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const partMap = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      partMap[part.type] = part.value;
    }
  }

  return `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}${UTC_OFFSET}`;
}

function formatSlot(dateKey, start, end) {
  return {
    date: dateKey,
    start: formatDateTimeInSeoul(start),
    end: formatDateTimeInSeoul(end),
    durationMinutes: Math.floor((end.getTime() - start.getTime()) / MINUTE_MS),
  };
}

function findFreeSlots(events, range, constraints = {}, options = {}) {
  const dayStart = constraints.dayStart || "09:00";
  const dayEnd = constraints.dayEnd || "22:00";
  const minDurationMinutes = Number(constraints.minDurationMinutes || 60);
  const now = options.now || new Date();
  const todayKey = getDateKeyInSeoul(now);
  const dateKeys = getDateRange(range.startDate, range.endDate);
  const freeSlots = [];

  for (const dateKey of dateKeys) {
    const rawWindowStart = parseDateTime(toDateTime(dateKey, dayStart));
    const windowEnd = parseDateTime(toDateTime(dateKey, dayEnd));

    if (!rawWindowStart || !windowEnd || windowEnd <= rawWindowStart) {
      continue;
    }

    const windowStart =
      dateKey === todayKey && now > rawWindowStart
        ? roundUpToNextMinute(now)
        : rawWindowStart;

    if (windowEnd <= windowStart || dateKey < todayKey) {
      continue;
    }

    const busyIntervals = getBusyIntervalsForDate(events, dateKey, windowStart, windowEnd, {
      treatAllDayAsBusy: options.treatAllDayAsBusy,
    });
    let cursor = windowStart;

    for (const interval of busyIntervals) {
      if (interval.start > cursor) {
        const slot = formatSlot(dateKey, cursor, interval.start);

        if (slot.durationMinutes >= minDurationMinutes) {
          freeSlots.push(slot);
        }
      }

      if (interval.end > cursor) {
        cursor = interval.end;
      }
    }

    if (windowEnd > cursor) {
      const slot = formatSlot(dateKey, cursor, windowEnd);

      if (slot.durationMinutes >= minDurationMinutes) {
        freeSlots.push(slot);
      }
    }
  }

  return freeSlots;
}

module.exports = {
  findFreeSlots,
};
