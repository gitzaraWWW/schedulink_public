const MINUTES_IN_DAY = 24 * 60;
const DEFAULT_EVENT_DURATION_MINUTES = 60;

function parseClockToMinutes(timeText) {
  if (!timeText) {
    return null;
  }

  const [hoursText, minutesText = "0"] = String(timeText).split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatMinutesAsClock(totalMinutes) {
  const normalizedMinutes =
    ((Number(totalMinutes) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = String(Math.floor(normalizedMinutes / 60)).padStart(2, "0");
  const minutes = String(normalizedMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function addMinutesToTime(timeText, minutesToAdd) {
  const baseMinutes = parseClockToMinutes(timeText);
  const deltaMinutes = Number(minutesToAdd);

  if (baseMinutes === null || !Number.isFinite(deltaMinutes)) {
    return null;
  }

  return formatMinutesAsClock(baseMinutes + deltaMinutes);
}

function getDurationMinutes(startTime, endTime) {
  const startMinutes = parseClockToMinutes(startTime);
  const endMinutes = parseClockToMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  let durationMinutes = endMinutes - startMinutes;

  if (durationMinutes <= 0) {
    durationMinutes += MINUTES_IN_DAY;
  }

  return durationMinutes;
}

function resolveDurationMinutes(startTime, endTime, fallbackMinutes = null) {
  const exactDuration = getDurationMinutes(startTime, endTime);

  if (exactDuration !== null) {
    return exactDuration;
  }

  if (startTime) {
    const numericFallback = Number(fallbackMinutes);

    if (Number.isFinite(numericFallback) && numericFallback > 0) {
      return numericFallback;
    }

    return DEFAULT_EVENT_DURATION_MINUTES;
  }

  return null;
}

function addOneHour(timeText) {
  return addMinutesToTime(timeText, DEFAULT_EVENT_DURATION_MINUTES);
}

module.exports = {
  DEFAULT_EVENT_DURATION_MINUTES,
  addMinutesToTime,
  addOneHour,
  getDurationMinutes,
  parseClockToMinutes,
  resolveDurationMinutes,
};
