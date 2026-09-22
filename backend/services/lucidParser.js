const TIMEZONE = "Asia/Seoul";
const UTC_OFFSET = "+09:00";
const DEFAULT_DAY_START = "00:00";
const DEFAULT_DAY_END = "24:00";
const DEFAULT_MIN_DURATION_MINUTES = 60;
const NAMED_WEEK_ORDINAL_PATTERN =
  "첫째|첫|두번째|둘째|둘|세번째|셋째|셋|네번째|넷째|넷|다섯번째|다섯째|다섯|마지막|끝|말";
const MONTH_DAY_REGEX = new RegExp(
  `(?:(\\d{4})년\\s*)?(\\d{1,2})월\\s*(\\d{1,2})일`
);
const MONTH_WEEK_REGEX = new RegExp(
  `(?:(\\d{4})년\\s*)?(\\d{1,2})월\\s*(?:(\\d+)\\s*(?:번째|째|주차|주)|(${NAMED_WEEK_ORDINAL_PATTERN})\\s*(?:주차|주)?)`
);
const MONTH_RANGE_REGEX = new RegExp(`(?:(\\d{4})년\\s*)?(\\d{1,2})월`);
const CURRENT_DAY_REFERENCE_REGEX = /(오늘|지금|현재)/;

function pad(value) {
  return String(value).padStart(2, "0");
}

function getDateKeyInSeoul(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const partMap = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      partMap[part.type] = part.value;
    }
  }

  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

function addDays(dateKey, amount) {
  const date = new Date(`${dateKey}T12:00:00${UTC_OFFSET}`);
  date.setUTCDate(date.getUTCDate() + amount);
  return getDateKeyInSeoul(date);
}

function getWeekday(dateKey) {
  const date = new Date(`${dateKey}T12:00:00${UTC_OFFSET}`);
  return date.getUTCDay();
}

function getMonday(dateKey) {
  const weekday = getWeekday(dateKey);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(dateKey, mondayOffset);
}

function toDateTime(dateKey, timeText) {
  return `${dateKey}T${timeText}:00${UTC_OFFSET}`;
}

function normalizeText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseDurationMinutes(text) {
  const normalizedText = normalizeText(text);
  const hourHalfMatch = normalizedText.match(/(\d+)\s*시간\s*반/);

  if (hourHalfMatch) {
    return Number(hourHalfMatch[1]) * 60 + 30;
  }

  const hourMatch = normalizedText.match(/(\d+)\s*시간/);

  if (hourMatch) {
    return Number(hourMatch[1]) * 60;
  }

  const minuteMatch = normalizedText.match(/(\d+)\s*분/);

  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  return DEFAULT_MIN_DURATION_MINUTES;
}

function getLastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildWeekRange(label, startDate) {
  const endDate = addDays(startDate, 7);

  return {
    label,
    startDate,
    endDate,
    timeMin: toDateTime(startDate, "00:00"),
    timeMax: toDateTime(endDate, "00:00"),
  };
}

function buildDayRange(label, startDate) {
  const endDate = addDays(startDate, 1);

  return {
    label,
    startDate,
    endDate,
    timeMin: toDateTime(startDate, "00:00"),
    timeMax: toDateTime(endDate, "00:00"),
  };
}

function buildMonthRange(label, year, month) {
  const startDate = `${year}-${pad(month)}-01`;
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const endYear = nextMonth.getUTCFullYear();
  const endMonth = nextMonth.getUTCMonth() + 1;
  const endDate = `${endYear}-${pad(endMonth)}-01`;

  return {
    label,
    startDate,
    endDate,
    timeMin: toDateTime(startDate, "00:00"),
    timeMax: toDateTime(endDate, "00:00"),
  };
}

function parseWeekOrdinal(value) {
  const normalizedValue = String(value || "")
    .replace(/\s+/g, "")
    .replace(/번째|번쨰|번재|째|주차|주/g, "");

  if (/^\d+$/.test(normalizedValue)) {
    return Number(normalizedValue);
  }

  const ordinalMap = {
    첫: 1,
    두: 2,
    둘: 2,
    세: 3,
    셋: 3,
    네: 4,
    넷: 4,
    다섯: 5,
    마지막: "last",
    끝: "last",
    말: "last",
  };

  return ordinalMap[normalizedValue] || null;
}

function formatWeekOrdinalLabel(ordinal) {
  if (ordinal === "last") {
    return "마지막";
  }

  const labels = ["", "첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째"];

  return labels[ordinal] || `${ordinal}번째`;
}

function parseMonthDayRange(text, now = new Date()) {
  const normalizedText = normalizeText(text);
  const monthDayMatch = normalizedText.match(MONTH_DAY_REGEX);

  if (!monthDayMatch) {
    return null;
  }

  const currentYear = Number(getDateKeyInSeoul(now).slice(0, 4));
  const year = monthDayMatch[1] ? Number(monthDayMatch[1]) : currentYear;
  const month = Number(monthDayMatch[2]);
  const day = Number(monthDayMatch[3]);

  if (!year || month < 1 || month > 12 || day < 1 || day > getLastDayOfMonth(year, month)) {
    return null;
  }

  const startDate = `${year}-${pad(month)}-${pad(day)}`;
  return buildDayRange(`${year}년 ${month}월 ${day}일`, startDate);
}

function parseMonthWeekRange(text, now = new Date()) {
  const normalizedText = normalizeText(text);
  const monthWeekMatch = normalizedText.match(MONTH_WEEK_REGEX);

  if (!monthWeekMatch) {
    return null;
  }

  const currentYear = Number(getDateKeyInSeoul(now).slice(0, 4));
  const year = monthWeekMatch[1] ? Number(monthWeekMatch[1]) : currentYear;
  const month = Number(monthWeekMatch[2]);
  const ordinal = parseWeekOrdinal(monthWeekMatch[3] || monthWeekMatch[4]);

  if (
    !year ||
    month < 1 ||
    month > 12 ||
    !ordinal ||
    (ordinal !== "last" && (ordinal < 1 || ordinal > 6))
  ) {
    return null;
  }

  const firstDateKey = `${year}-${pad(month)}-01`;
  const firstMonday = getMonday(firstDateKey);
  const startDate =
    ordinal === "last"
      ? getMonday(`${year}-${pad(month)}-${pad(getLastDayOfMonth(year, month))}`)
      : addDays(firstMonday, (ordinal - 1) * 7);
  const label = `${year}년 ${month}월 ${formatWeekOrdinalLabel(ordinal)} 주`;

  return buildWeekRange(label, startDate);
}

function parseMonthRange(text, now = new Date()) {
  const normalizedText = normalizeText(text);
  const currentDateKey = getDateKeyInSeoul(now);
  const currentYear = Number(currentDateKey.slice(0, 4));
  const currentMonth = Number(currentDateKey.slice(5, 7));

  if (normalizedText.includes("다다음 달") || normalizedText.includes("다다음달")) {
    const targetDate = new Date(Date.UTC(currentYear, currentMonth + 1, 1));
    return buildMonthRange(
      "다다음 달",
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth() + 1
    );
  }

  if (normalizedText.includes("다음 달") || normalizedText.includes("다음달")) {
    const targetDate = new Date(Date.UTC(currentYear, currentMonth, 1));
    return buildMonthRange(
      "다음 달",
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth() + 1
    );
  }

  if (
    normalizedText.includes("이번 달") ||
    normalizedText.includes("이번달") ||
    normalizedText.includes("금달")
  ) {
    return buildMonthRange("이번 달", currentYear, currentMonth);
  }

  const monthMatch = normalizedText.match(MONTH_RANGE_REGEX);

  if (!monthMatch) {
    return null;
  }

  const year = monthMatch[1] ? Number(monthMatch[1]) : currentYear;
  const month = Number(monthMatch[2]);

  if (!year || month < 1 || month > 12) {
    return null;
  }

  return buildMonthRange(`${year}년 ${month}월`, year, month);
}

function parseRelativeWeekRange(text, now = new Date()) {
  const normalizedText = normalizeText(text);
  const todayKey = getDateKeyInSeoul(now);
  const thisMonday = getMonday(todayKey);

  if (normalizedText.includes("다다음 주") || normalizedText.includes("다다음주")) {
    return buildWeekRange("다다음 주", addDays(thisMonday, 14));
  }

  if (normalizedText.includes("다음 주") || normalizedText.includes("다음주")) {
    return buildWeekRange("다음 주", addDays(thisMonday, 7));
  }

  if (normalizedText.includes("이번 주") || normalizedText.includes("이번주")) {
    return buildWeekRange("이번 주", thisMonday);
  }

  return null;
}

function parseRelativeDayRange(text, now = new Date()) {
  const normalizedText = normalizeText(text);
  const todayKey = getDateKeyInSeoul(now);

  if (normalizedText.includes("그저께")) {
    return buildDayRange("그저께", addDays(todayKey, -2));
  }

  if (normalizedText.includes("그제")) {
    return buildDayRange("그제", addDays(todayKey, -2));
  }

  if (normalizedText.includes("어제")) {
    return buildDayRange("어제", addDays(todayKey, -1));
  }

  if (normalizedText.includes("글피")) {
    return buildDayRange("글피", addDays(todayKey, 3));
  }

  if (normalizedText.includes("모레")) {
    return buildDayRange("모레", addDays(todayKey, 2));
  }

  if (normalizedText.includes("내일")) {
    return buildDayRange("내일", addDays(todayKey, 1));
  }

  if (normalizedText.includes("오늘")) {
    return buildDayRange("오늘", todayKey);
  }

  return null;
}

function resolveExplicitRange(text, now = new Date()) {
  return (
    parseMonthDayRange(text, now) ||
    parseMonthWeekRange(text, now) ||
    parseMonthRange(text, now) ||
    parseRelativeWeekRange(text, now) ||
    parseRelativeDayRange(text, now)
  );
}

function hasCurrentDayReference(text) {
  return CURRENT_DAY_REFERENCE_REGEX.test(normalizeText(text));
}

function resolveRange(text, now = new Date()) {
  const explicitRange = resolveExplicitRange(text, now);

  if (explicitRange) {
    return explicitRange;
  }

  return buildDayRange("오늘", getDateKeyInSeoul(now));
}

function resolveAction(text) {
  const normalizedText = normalizeText(text);
  const hasFreeTimeIntent =
    /(빈\s*시간|비는\s*시간|비어|비었|가능한\s*시간|가능\s*시간|시간\s*비|남는\s*시간|틈)/.test(
      normalizedText
    );

  if (hasFreeTimeIntent) {
    return "find_free_time";
  }

  const hasListIntent =
    /(일정|스케줄|약속|뭐\s*있|보여|알려|조회|검색)/.test(normalizedText);

  if (hasListIntent) {
    return "list_events";
  }

  return "unknown";
}

function parseLucidQuery(text, options = {}) {
  const now = options.now || new Date();
  const action = resolveAction(text);
  const explicitRange = resolveExplicitRange(text, now);
  const range = explicitRange || buildDayRange("오늘", getDateKeyInSeoul(now));
  const minDurationMinutes = parseDurationMinutes(text);

  return {
    action,
    range,
    hasExplicitRange: Boolean(explicitRange),
    hasCurrentDayReference: hasCurrentDayReference(text),
    constraints: {
      dayStart: DEFAULT_DAY_START,
      dayEnd: DEFAULT_DAY_END,
      minDurationMinutes,
      timezone: TIMEZONE,
    },
  };
}

module.exports = {
  DEFAULT_DAY_END,
  DEFAULT_DAY_START,
  DEFAULT_MIN_DURATION_MINUTES,
  TIMEZONE,
  UTC_OFFSET,
  addDays,
  getDateKeyInSeoul,
  parseLucidQuery,
  toDateTime,
};
