const OpenAI = require("openai");
const scheduleText = require("./utils/scheduleText");

const TIMEZONE = "Asia/Seoul";
const VALID_ACTIONS = [
  "create_event",
  "update_event_request",
  "delete_event_request",
  "self_event_split",
  "self_attendance_change",
  "personal_hide_or_delete",
];
const VALID_PARTICIPANT_TYPES = ["self", "mention", "free_text", "email"];

function shouldLogScheduleDebug() {
  return process.env.NODE_ENV !== "production";
}

function logScheduleDebug(label, value) {
  if (!shouldLogScheduleDebug()) {
    return;
  }

  const renderedValue =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  console.log(`[scheduleParser] ${label}:`, renderedValue);
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function getCurrentDateTimeInSeoul() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const map = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+09:00`;
}

function isValidDate(dateStr) {
  if (dateStr === null) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isValidTime(timeStr) {
  if (timeStr === null) {
    return true;
  }

  return /^\d{2}:\d{2}$/.test(timeStr);
}

function padTwoDigits(value) {
  return String(value).padStart(2, "0");
}

const RELATIVE_DATE_PATTERNS = [
  {
    pattern: /(\uB0B4\uC77C\s*\uBAA8\uB808|\uB0B4\uC77C\uBAA8\uB808|\uB0BC\s*\uBAA8\uB808|\uB0BC\uBAA8\uB808)/,
    offset: 2,
  },
  {
    pattern: /(\uC624\uB298)/,
    offset: 0,
  },
  {
    pattern: /(\uB0B4\uC77C|\uB0BC)/,
    offset: 1,
  },
  {
    pattern: /(\uBAA8\uB808)/,
    offset: 2,
  },
  {
    pattern: /(\uAE00\uD53C)/,
    offset: 3,
  },
];

const WEEKDAY_NAME_TO_INDEX = new Map([
  ["\uC77C", 0],
  ["\uC6D4", 1],
  ["\uD654", 2],
  ["\uC218", 3],
  ["\uBAA9", 4],
  ["\uAE08", 5],
  ["\uD1A0", 6],
]);

function createUtcDateFromDateText(dateText) {
  const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatUtcDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const year = String(date.getUTCFullYear());
  const month = padTwoDigits(date.getUTCMonth() + 1);
  const day = padTwoDigits(date.getUTCDate());
  return `${year}-${month}-${day}`;
}

function addDaysUtc(date, days) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + Number(days || 0));
  return nextDate;
}

function resolveCurrentSeoulDateText(currentDateTime = null) {
  const explicitDateMatch = String(currentDateTime || "").match(/^(\d{4}-\d{2}-\d{2})T/);

  if (explicitDateMatch?.[1]) {
    return explicitDateMatch[1];
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  if (!map.year || !map.month || !map.day) {
    return null;
  }

  return `${map.year}-${map.month}-${map.day}`;
}

function resolveRelativeWeekdayDate(baseDateText, weekModifier, weekdayText) {
  const baseDate = createUtcDateFromDateText(baseDateText);
  const targetWeekday = WEEKDAY_NAME_TO_INDEX.get(String(weekdayText || "").trim());

  if (!baseDate || targetWeekday === undefined) {
    return null;
  }

  const baseWeekday = baseDate.getUTCDay();
  const mondayBasedCurrentWeekday = baseWeekday === 0 ? 7 : baseWeekday;
  const mondayBasedTargetWeekday = targetWeekday === 0 ? 7 : targetWeekday;
  const currentWeekStart = addDaysUtc(baseDate, -(mondayBasedCurrentWeekday - 1));
  const normalizedWeekModifier = String(weekModifier || "").replace(/\s+/g, "");
  const weekOffset = normalizedWeekModifier === "\uB2E4\uC74C\uC8FC" ? 7 : 0;

  return formatUtcDate(
    addDaysUtc(currentWeekStart, weekOffset + mondayBasedTargetWeekday - 1)
  );
}

function resolveUpcomingWeekdayDate(baseDateText, weekdayText) {
  const baseDate = createUtcDateFromDateText(baseDateText);
  const targetWeekday = WEEKDAY_NAME_TO_INDEX.get(String(weekdayText || "").trim());

  if (!baseDate || targetWeekday === undefined) {
    return null;
  }

  const baseWeekday = baseDate.getUTCDay();
  const offset = (targetWeekday - baseWeekday + 7) % 7;
  return formatUtcDate(addDaysUtc(baseDate, offset));
}

function resolveExplicitDateFromText(text, currentDateTime = null) {
  const source = String(text || "");

  if (!source.trim()) {
    return null;
  }

  const baseDateText = resolveCurrentSeoulDateText(currentDateTime);
  const baseDate = createUtcDateFromDateText(baseDateText);

  if (!baseDateText || !baseDate) {
    return null;
  }

  const normalizedText = source.replace(/\s+/g, " ").trim();
  const explicitIsoDateMatch = normalizedText.match(/\b(\d{4}-\d{2}-\d{2})\b/);

  if (explicitIsoDateMatch?.[1]) {
    return explicitIsoDateMatch[1];
  }

  const relativeWeekdayMatch = normalizedText.match(
    /(\uC774\uBC88\s*\uC8FC|\uB2E4\uC74C\s*\uC8FC)\s*([\uC77C\uC6D4\uD654\uC218\uBAA9\uAE08\uD1A0])\uC694\uC77C/
  );

  if (relativeWeekdayMatch) {
    return resolveRelativeWeekdayDate(
      baseDateText,
      relativeWeekdayMatch[1],
      relativeWeekdayMatch[2]
    );
  }

  for (const { pattern, offset } of RELATIVE_DATE_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return formatUtcDate(addDaysUtc(baseDate, offset));
    }
  }

  const bareWeekdayMatch = normalizedText.match(
    /(?:^|\s)([\uC77C\uC6D4\uD654\uC218\uBAA9\uAE08\uD1A0])\uC694\uC77C(?=\s|$|[.,!?])/
  );

  if (bareWeekdayMatch?.[1]) {
    return resolveUpcomingWeekdayDate(baseDateText, bareWeekdayMatch[1]);
  }

  return null;
}

function normalizeTimeValue(timeStr) {
  if (timeStr === null || timeStr === undefined) {
    return null;
  }

  const raw = String(timeStr).trim();

  if (!raw) {
    return null;
  }

  const compact = raw.replace(/\s+/g, "");

  if (compact === "정오") {
    return "12:00";
  }

  if (compact === "자정") {
    return "00:00";
  }

  const plainClockMatch = compact.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (plainClockMatch) {
    const hours = Number(plainClockMatch[1]);
    const minutes = Number(plainClockMatch[2]);

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}`;
    }
  }

  const meridiemClockMatch = compact.match(
    /^(오전|오후|밤|저녁|낮|새벽)(\d{1,2}):(\d{2})$/
  );

  if (meridiemClockMatch) {
    const [, meridiem, hourText, minuteText] = meridiemClockMatch;
    let hours = Number(hourText);
    const minutes = Number(minuteText);

    if (hours >= 0 && hours <= 12 && minutes >= 0 && minutes <= 59) {
      if (["오후", "밤", "저녁", "낮"].includes(meridiem)) {
        if (hours < 12) {
          hours += 12;
        }
      } else if (hours === 12) {
        hours = 0;
      }

      return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}`;
    }
  }

  const koreanClockMatch = compact.match(
    /^(오전|오후|밤|저녁|낮|새벽)?(\d{1,2})시(?:(\d{1,2})분?)?(반)?$/
  );

  if (koreanClockMatch) {
    const [, meridiem, hourText, minuteText, halfFlag] = koreanClockMatch;
    let hours = Number(hourText);
    let minutes = minuteText ? Number(minuteText) : 0;

    if (halfFlag) {
      minutes = 30;
    }

    if (hours >= 0 && hours <= 12 && minutes >= 0 && minutes <= 59) {
      if (meridiem && ["오후", "밤", "저녁", "낮"].includes(meridiem)) {
        if (hours < 12) {
          hours += 12;
        }
      } else if (meridiem && ["오전", "새벽"].includes(meridiem) && hours === 12) {
        hours = 0;
      }

      return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}`;
    }
  }

  const hourOnlyMatch = compact.match(/^(\d{1,2})시$/);

  if (hourOnlyMatch) {
    const hours = Number(hourOnlyMatch[1]);

    if (hours >= 0 && hours <= 23) {
      return `${padTwoDigits(hours)}:00`;
    }
  }

  return raw;
}

function normalizeParsedScheduleTimes(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return parsed;
  }

  parsed.startTime = normalizeTimeValueSafe(parsed.startTime);
  parsed.endTime = normalizeTimeValueSafe(parsed.endTime);

  if (parsed.targetEvent && typeof parsed.targetEvent === "object") {
    parsed.targetEvent.startTime = normalizeTimeValueSafe(parsed.targetEvent.startTime);
    parsed.targetEvent.endTime = normalizeTimeValueSafe(parsed.targetEvent.endTime);
  }

  if (parsed.changeSet && typeof parsed.changeSet === "object") {
    parsed.changeSet.startTime = normalizeTimeValueSafe(parsed.changeSet.startTime);
    parsed.changeSet.endTime = normalizeTimeValueSafe(parsed.changeSet.endTime);
  }

  return parsed;
}

function normalizeTimeValueSafe(timeStr) {
  if (timeStr === null || timeStr === undefined) {
    return null;
  }

  const raw = String(timeStr).trim();

  if (!raw) {
    return null;
  }

  const compact = raw.replace(/\s+/g, "");

  if (compact === "\uC815\uC624") {
    return "12:00";
  }

  if (compact === "\uC790\uC815") {
    return "00:00";
  }

  const plainClockMatch = compact.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (plainClockMatch) {
    const hours = Number(plainClockMatch[1]);
    const minutes = Number(plainClockMatch[2]);

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}`;
    }
  }

  const meridiemClockMatch = compact.match(
    /^(\uC624\uC804|\uC624\uD6C4)(\d{1,2}):(\d{2})$/
  );

  if (meridiemClockMatch) {
    const [, meridiem, hourText, minuteText] = meridiemClockMatch;
    let hours = Number(hourText);
    const minutes = Number(minuteText);

    if (hours >= 0 && hours <= 12 && minutes >= 0 && minutes <= 59) {
      if (meridiem === "\uC624\uD6C4" && hours < 12) {
        hours += 12;
      } else if (meridiem === "\uC624\uC804" && hours === 12) {
        hours = 0;
      }

      return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}`;
    }
  }

  const koreanClockMatch = compact.match(
    /^(\uC624\uC804|\uC624\uD6C4)?(\d{1,2})\uC2DC(?:(\d{1,2})\uBD84)?(\uBC18)?$/
  );

  if (koreanClockMatch) {
    const [, meridiem, hourText, minuteText, halfFlag] = koreanClockMatch;
    let hours = Number(hourText);
    let minutes = minuteText ? Number(minuteText) : 0;

    if (halfFlag) {
      minutes = 30;
    }

    if (hours >= 0 && hours <= 12 && minutes >= 0 && minutes <= 59) {
      if (meridiem === "\uC624\uD6C4" && hours < 12) {
        hours += 12;
      } else if (meridiem === "\uC624\uC804" && hours === 12) {
        hours = 0;
      }

      return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}`;
    }
  }

  const hourOnlyMatch = compact.match(/^(\d{1,2})\uC2DC$/);

  if (hourOnlyMatch) {
    const hours = Number(hourOnlyMatch[1]);

    if (hours >= 0 && hours <= 23) {
      return `${padTwoDigits(hours)}:00`;
    }
  }

  return raw;
}

function extractTimeHintSafe(text) {
  const source = String(text || "");
  const patterns = [
    /(\uC624\uC804\s*\d{1,2}:\d{2})/,
    /(\uC624\uD6C4\s*\d{1,2}:\d{2})/,
    /(\d{1,2}:\d{2})/,
    /(\uC624\uC804\s*\d{1,2}\uC2DC(?:\s*\d{1,2}\uBD84)?(?:\s*\uBC18)?)/,
    /(\uC624\uD6C4\s*\d{1,2}\uC2DC(?:\s*\d{1,2}\uBD84)?(?:\s*\uBC18)?)/,
    /(\d{1,2}\uC2DC(?:\s*\d{1,2}\uBD84)?(?:\s*\uBC18)?)/,
    /(\uC815\uC624|\uC790\uC815)/,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);

    if (match?.[1]) {
      return normalizeTimeValueSafe(match[1]);
    }
  }

  return null;
}

function cleanSummaryCandidateSafe(summary, location) {
  return scheduleText.cleanSummaryCandidate(summary, location);
}

function extractSummaryHintSafe(text) {
  const candidates = scheduleText.buildSummaryCandidates({
    sourceText: text,
  });
  return candidates[0] || null;
}

function normalizeSummarySearchText(text) {
  return String(text || "")
    .replace(/[.,!?()[\]{}\\/|:_\-"'`~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripSummaryParticle(token) {
  let current = String(token || "").trim();
  const trailingParticles = [
    "에서",
    "으로",
    "로",
    "에게",
    "한테",
    "부터",
    "까지",
    "처럼",
    "하고",
    "과",
    "와",
    "은",
    "는",
    "을",
    "를",
    "에",
  ];

  for (const particle of trailingParticles) {
    if (current.length > particle.length && current.endsWith(particle)) {
      current = current.slice(0, -particle.length).trim();
      break;
    }
  }

  return current;
}

function isLikelyTrailingVerbToken(token) {
  const normalizedToken = String(token || "").trim().toLowerCase();
  const explicitVerbTokens = new Set([
    "하다",
    "하기",
    "하자",
    "할래",
    "할게",
    "할거야",
    "해",
    "해요",
    "먹다",
    "먹어",
    "먹어요",
    "먹자",
    "먹을래",
    "먹을거야",
    "가다",
    "가자",
    "갈래",
    "갈거야",
    "가요",
    "보다",
    "보자",
    "볼래",
    "볼거야",
    "봐",
    "봐요",
    "만나다",
    "만나자",
    "만날래",
    "만날거야",
    "만나",
    "만나요",
  ]);

  return explicitVerbTokens.has(normalizedToken);
}

function stripLeadingLocationFromSummary(summary, location) {
  const value = String(summary || "").trim();
  const normalizedLocation = normalizeSummarySearchText(location);

  if (!value || !normalizedLocation) {
    return value;
  }

  const locationPrefixes = [
    location,
    `${location}에서`,
    `${location}에`,
    `${location}으로`,
    `${location}로`,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  for (const prefix of locationPrefixes) {
    if (value.startsWith(`${prefix} `)) {
      return value.slice(prefix.length).trim();
    }
  }

  const tokens = value.split(/\s+/).filter(Boolean);

  if (tokens.length > 1) {
    const firstToken = stripSummaryParticle(tokens[0]);

    if (normalizeSummarySearchText(firstToken) === normalizedLocation) {
      return tokens.slice(1).join(" ").trim();
    }
  }

  return value;
}

function cleanSummaryCandidate(summary, location) {
  let value = String(summary || "")
    .replace(/[.,!?()[\]{}\\/|:_\-"'`~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) {
    return null;
  }

  value = stripLeadingLocationFromSummary(value, location);

  let tokens = value.split(/\s+/).filter(Boolean);

  while (tokens.length > 1 && isLikelyTrailingVerbToken(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  tokens = tokens.map((token) => stripSummaryParticle(token)).filter(Boolean);

  return tokens.join(" ").trim() || null;
}

function normalizeParsedScheduleSummaries(parsed, hints) {
  if (!parsed || typeof parsed !== "object") {
    return parsed;
  }

  parsed.summary = cleanSummaryCandidateSafe(
    parsed.summary || hints?.summaryHint || null,
    parsed.location
  );

  if (parsed.targetEvent && typeof parsed.targetEvent === "object") {
    parsed.targetEvent.summary = cleanSummaryCandidateSafe(
      parsed.targetEvent.summary,
      parsed.targetEvent.location
    );
  }

  if (parsed.changeSet && typeof parsed.changeSet === "object") {
    parsed.changeSet.summary = cleanSummaryCandidateSafe(
      parsed.changeSet.summary,
      parsed.changeSet.location
    );
  }

  return parsed;
}

function normalizeScheduleInputText(text) {
  return String(text || "")
    .replace(/(@\S+)\s+(이랑|랑|와|과)/g, "$1 $2")
    .replace(
      /(회의|스터디|약속|미팅|점심|저녁|식사)(잡아줘|추가해줘|만들어줘|등록해줘|지워줘|삭제해줘|없애줘|제거해줘|바꿔줘|변경해줘|수정해줘)/g,
      "$1 $2"
    )
    .replace(/\s+/g, " ")
    .trim();
}

function extractMentionHints(text) {
  const matches = String(text || "").match(/@[^\s,]+/g) || [];
  return [...new Set(matches)];
}

function extractTimeHint(text) {
  const source = String(text || "");
  const patterns = [
    /(오전\s*\d{1,2}시(?:\s*\d{1,2}분)?)/,
    /(오후\s*\d{1,2}시(?:\s*\d{1,2}분)?)/,
    /(\d{1,2}:\d{2})/,
    /(\d{1,2}시반)/,
    /(\d{1,2}시(?:\s*\d{1,2}분)?)/,
    /(정오|자정)/,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);

    if (match?.[1]) {
      return normalizeTimeValue(match[1]);
    }
  }

  return null;
}

function stripForSummaryHint(text) {
  return String(text || "")
    .replace(/@[^\s,]+/g, " ")
    .replace(
      /(오늘|내일|모레|글피|이번주|다음주|\d{4}-\d{2}-\d{2}|\d{1,2}월\s*\d{1,2}일|\d{1,2}일)/g,
      " "
    )
    .replace(
      /(오전\s*\d{1,2}시(?:\s*\d{1,2}분)?|오후\s*\d{1,2}시(?:\s*\d{1,2}분)?|\d{1,2}:\d{2}|\d{1,2}시(?:\s*\d{1,2}분)?|정오|자정)/g,
      " "
    )
    .replace(
      /(지워줘|삭제해줘|없애줘|제거해줘|바꿔줘|변경해줘|수정해줘|잡아줘|추가해줘|만들어줘|등록해줘|해줘|나랑|이랑|랑|와|과|에서|에)/g,
      " "
    )
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSummaryHint(text) {
  const stripped = stripForSummaryHint(text);

  if (!stripped) {
    return null;
  }

  const commonTitles = [
    "팀 회의",
    "프로젝트 회의",
    "점심 회의",
    "저녁 약속",
    "미팅",
    "회의",
    "스터디",
    "약속",
    "점심",
    "저녁",
    "식사",
  ];

  const matched = commonTitles.find((title) => stripped.includes(title));

  if (matched) {
    return matched;
  }

  return stripped;
}

function buildParserHints(text, currentDateTime = null) {
  const slotHints = scheduleText.analyzeScheduleSlots(text, normalizeTimeValueSafe);
  const summarySourceText = slotHints.summarySourceText || text;

  return {
    normalizedText: normalizeScheduleInputText(text),
    dateHint: resolveExplicitDateFromText(text, currentDateTime),
    mentionHints: extractMentionHints(text),
    startTimeHint: slotHints.startTimeHint || extractTimeHintSafe(text),
    endTimeHint: slotHints.endTimeHint || null,
    locationHint: slotHints.locationHint || null,
    locationCandidates: slotHints.locationCandidates || [],
    detectedTimeRange: Boolean(slotHints.detectedTimeRange),
    summarySourceText,
    summaryHint: extractSummaryHintSafe(summarySourceText),
  };
}

function applyParserHints(parsed, hints) {
  if (!parsed || !hints) {
    return parsed;
  }

  if (parsed.action === "create_event") {
    parsed.summary = parsed.summary || hints.summaryHint || null;
    parsed.date = hints.dateHint || parsed.date || null;
    parsed.startTime = parsed.startTime || hints.startTimeHint || null;
    parsed.endTime = parsed.endTime || hints.endTimeHint || null;
    parsed.location = parsed.location || hints.locationHint || null;

    if ((!parsed.participants || parsed.participants.length === 0) && hints.mentionHints.length > 0) {
      parsed.participants = hints.mentionHints.map((mention) => ({
        type: "mention",
        text: mention,
      }));
    }
  }

  if (
    [
      "update_event_request",
      "delete_event_request",
      "self_event_split",
      "self_attendance_change",
      "personal_hide_or_delete",
    ].includes(parsed.action) &&
    parsed.targetEvent
  ) {
    parsed.targetEvent.summary =
      parsed.targetEvent.summary || hints.summaryHint || null;
    parsed.targetEvent.location =
      parsed.targetEvent.location || hints.locationHint || null;
    parsed.targetEvent.endTime =
      parsed.targetEvent.endTime || hints.endTimeHint || null;

    if (
      (!parsed.targetEvent.participants || parsed.targetEvent.participants.length === 0) &&
      hints.mentionHints.length > 0
    ) {
      parsed.targetEvent.participants = hints.mentionHints.map((mention) => ({
        type: "mention",
        text: mention,
      }));
    }
  }

  if (
    ["self_event_split", "self_attendance_change"].includes(parsed.action) &&
    !parsed.ownershipTarget
  ) {
    const explicitParticipant =
      (parsed.participants || []).find(
        (participant) => participant && participant.type !== "self" && participant.text
      ) || null;

    if (explicitParticipant) {
      parsed.ownershipTarget = explicitParticipant;
    } else if (
      hints.mentionHints.length === 1 &&
      /(주최자|넘겨|위임|맡아|담당)/.test(hints.normalizedText || "")
    ) {
      parsed.ownershipTarget = {
        type: "mention",
        text: hints.mentionHints[0],
      };
    }
  }

  return parsed;
}

function createHttpError(status, message, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function validateParticipants(participants, parsed) {
  if (!Array.isArray(participants)) {
    throw createHttpError(400, "AI did not return a participants array.", {
      parsed,
    });
  }

  for (const participant of participants) {
    if (!participant || typeof participant !== "object") {
      throw createHttpError(400, "AI returned an invalid participant object.", {
        parsed,
      });
    }

    if (!VALID_PARTICIPANT_TYPES.includes(participant.type)) {
      throw createHttpError(400, "AI returned an unsupported participant type.", {
        parsed,
      });
    }

    if (participant.type === "self") {
      continue;
    }

    if (!participant.text || typeof participant.text !== "string") {
      throw createHttpError(400, "AI returned a participant without text.", {
        parsed,
      });
    }
  }
}

function validateOwnershipTarget(ownershipTarget, parsed) {
  if (ownershipTarget === null) {
    return;
  }

  if (!ownershipTarget || typeof ownershipTarget !== "object") {
    throw createHttpError(400, "AI returned an invalid ownershipTarget object.", {
      parsed,
    });
  }

  if (!VALID_PARTICIPANT_TYPES.includes(ownershipTarget.type)) {
    throw createHttpError(400, "AI returned an unsupported ownershipTarget type.", {
      parsed,
    });
  }

  if (ownershipTarget.type === "self") {
    return;
  }

  if (!ownershipTarget.text || typeof ownershipTarget.text !== "string") {
    throw createHttpError(400, "AI returned an ownershipTarget without text.", {
      parsed,
    });
  }
}

function validateTargetEvent(targetEvent, parsed) {
  if (targetEvent === null) {
    return;
  }

  if (!targetEvent || typeof targetEvent !== "object") {
    throw createHttpError(400, "AI returned an invalid targetEvent object.", {
      parsed,
    });
  }

  if (!isValidDate(targetEvent.date)) {
    throw createHttpError(400, "AI returned an invalid targetEvent.date format.", {
      parsed,
    });
  }

  if (!isValidTime(targetEvent.startTime) || !isValidTime(targetEvent.endTime)) {
    throw createHttpError(400, "AI returned an invalid targetEvent time format.", {
      parsed,
    });
  }

  validateParticipants(targetEvent.participants, parsed);
}

function validateChangeSet(changeSet, parsed) {
  if (changeSet === null) {
    return;
  }

  if (!changeSet || typeof changeSet !== "object") {
    throw createHttpError(400, "AI returned an invalid changeSet object.", {
      parsed,
    });
  }

  if (!isValidDate(changeSet.date)) {
    throw createHttpError(400, "AI returned an invalid changeSet.date format.", {
      parsed,
    });
  }

  if (!isValidTime(changeSet.startTime) || !isValidTime(changeSet.endTime)) {
    throw createHttpError(400, "AI returned an invalid changeSet time format.", {
      parsed,
    });
  }

  validateParticipants(changeSet.participants, parsed);
}

function validateParsedSchedule(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw createHttpError(502, "OpenAI did not return a valid schedule JSON object.");
  }

  if (!VALID_ACTIONS.includes(parsed.action)) {
    throw createHttpError(400, "AI returned an unsupported action.", { parsed });
  }

  if (!isValidDate(parsed.date)) {
    throw createHttpError(400, "AI returned an invalid date format.", { parsed });
  }

  if (!isValidTime(parsed.startTime) || !isValidTime(parsed.endTime)) {
    throw createHttpError(400, "AI returned an invalid time format.", { parsed });
  }

  validateParticipants(parsed.participants, parsed);
  validateOwnershipTarget(parsed.ownershipTarget, parsed);
  validateTargetEvent(parsed.targetEvent, parsed);
  validateChangeSet(parsed.changeSet, parsed);
}

async function parseScheduleText(text) {
  if (!process.env.OPENAI_API_KEY) {
    throw createHttpError(500, "OPENAI_API_KEY is not configured.");
  }

  if (!text || !text.trim()) {
    throw createHttpError(400, "Please enter a schedule sentence.");
  }

  const client = getOpenAIClient();

  if (!client) {
    throw createHttpError(500, "OpenAI client could not be initialized.");
  }

  const currentDateTime = getCurrentDateTimeInSeoul();
  const parserHints = buildParserHints(text, currentDateTime);
  logScheduleDebug("normalized_input_text", parserHints.normalizedText);
  logScheduleDebug("parser_hints", parserHints);
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You convert schedule sentences into JSON only.
Return JSON without markdown, explanations, or extra text.

The current datetime is ${currentDateTime} and the timezone is ${TIMEZONE}.

Rules:
1. Classify the request as one of: create_event, update_event_request, delete_event_request, self_event_split, self_attendance_change, personal_hide_or_delete.
2. create_event means making a brand new event.
3. update_event_request means proposing or applying a schedule change such as title, date, time, or location.
4. delete_event_request means deleting the shared event itself.
5. self_event_split means the speaker wants only their own copy of the shared event changed by splitting it off into a separate personal event, for example "move only my schedule by 2 hours" or "make only my event tomorrow".
6. self_attendance_change means the speaker wants to leave the event, for example "I cannot go" or "I will skip it".
7. personal_hide_or_delete means the speaker wants the event removed only from their own calendar view, not for everyone.
8. Return action, summary, date, startTime, endTime, location, participants, ownershipTarget, targetEvent, and changeSet.
9. For create_event, summary/date/startTime/endTime/location/participants should describe the new event. targetEvent and changeSet should be null.
10. For update_event_request, targetEvent should describe the existing event to find. changeSet should contain only the changed values, and participants should usually be an empty array because attendee editing is out of scope.
11. For delete_event_request, targetEvent should describe the event to remove. changeSet should be null.
12. For self_event_split, targetEvent should describe the existing shared event to find. changeSet should contain the speaker's new personal event values. participants should usually be an empty array.
13. For self_attendance_change and personal_hide_or_delete, targetEvent should describe the event to find. changeSet should be null.
14. If the speaker says who should take over as organizer when they leave the shared event, set ownershipTarget to that participant. Otherwise use null.
15. date must use YYYY-MM-DD and time must use HH:MM.
16. If a field is unknown, use null.
17. participants must always be an array.
18. Each participant must be an object with type and text.
19. ownershipTarget must be either null or one participant object with type and text.
20. type must be one of self, mention, free_text, email.
21. References to the speaker themself should be { "type": "self", "text": null }.
22. Mentions like @nickname should be { "type": "mention", "text": "@nickname" }.
23. Email addresses should be { "type": "email", "text": "name@example.com" }.
24. Plain names should be { "type": "free_text", "text": "Name" }.
25. For Korean input, summary must be a short event title noun phrase, not a sentence.
26. For Korean input, do not include case particles or postpositions in summary, such as 은, 는, 을, 를, 와, 과, 에, 에서, 로, 으로.
27. For Korean input, if a place is expressed with 에, 에서, 로, or 으로, put that place into location, not summary.
28. For Korean input, do not include trailing verbs or sentence endings in summary, such as 하다, 하기, 하자, 먹다, 먹자, 먹을거야, 가다, 가자.
29. Example: "3시 원주에서 밥 먹을거야" should become summary "밥", location "원주", startTime "15:00".
30. For Korean update or delete requests, treat generic words such as \uC77C\uC815, \uC2A4\uCF00\uC904, \uC57D\uC18D, \uC774\uBCA4\uD2B8, and \uBAA8\uC784 as weak meta words unless they are the whole title.
31. If the user says something like "\uB3D9\uC544\uB9AC \uC77C\uC815 \uBCC0\uACBD\uD574\uC918", prefer the distinguishing title phrase over the generic meta word.
32. For update or delete requests, do not copy the changed time into targetEvent unless the user explicitly identifies the existing event by that same time.
33. Example: "\uB3D9\uC544\uB9AC \uC77C\uC815 \uBCC0\uACBD\uD574\uC918" should target "\uB3D9\uC544\uB9AC" or "\uB3D9\uC544\uB9AC \uC77C\uC815", but not the generic title "\uC77C\uC815" when a more specific title is present.
        `.trim(),
      },
      {
        role: "user",
        content: JSON.stringify({
          originalText: text,
          normalizedText: parserHints.normalizedText,
          hints: parserHints,
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "schedule_parser",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            action: {
              type: "string",
              enum: VALID_ACTIONS,
            },
            summary: { type: ["string", "null"] },
            date: { type: ["string", "null"] },
            startTime: { type: ["string", "null"] },
            endTime: { type: ["string", "null"] },
            location: { type: ["string", "null"] },
            participants: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  type: { type: "string" },
                  text: { type: ["string", "null"] },
                },
                required: ["type", "text"],
              },
            },
            ownershipTarget: {
              type: ["object", "null"],
              additionalProperties: false,
              properties: {
                type: { type: "string" },
                text: { type: ["string", "null"] },
              },
              required: ["type", "text"],
            },
            targetEvent: {
              type: ["object", "null"],
              additionalProperties: false,
              properties: {
                summary: { type: ["string", "null"] },
                date: { type: ["string", "null"] },
                startTime: { type: ["string", "null"] },
                endTime: { type: ["string", "null"] },
                location: { type: ["string", "null"] },
                participants: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: { type: "string" },
                      text: { type: ["string", "null"] },
                    },
                    required: ["type", "text"],
                  },
                },
              },
              required: [
                "summary",
                "date",
                "startTime",
                "endTime",
                "location",
                "participants",
              ],
            },
            changeSet: {
              type: ["object", "null"],
              additionalProperties: false,
              properties: {
                summary: { type: ["string", "null"] },
                date: { type: ["string", "null"] },
                startTime: { type: ["string", "null"] },
                endTime: { type: ["string", "null"] },
                location: { type: ["string", "null"] },
                participants: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: { type: "string" },
                      text: { type: ["string", "null"] },
                    },
                    required: ["type", "text"],
                  },
                },
              },
              required: [
                "summary",
                "date",
                "startTime",
                "endTime",
                "location",
                "participants",
              ],
            },
          },
          required: [
            "action",
            "summary",
            "date",
            "startTime",
            "endTime",
            "location",
            "participants",
            "ownershipTarget",
            "targetEvent",
            "changeSet",
          ],
        },
      },
    },
  });

  const parsedText = completion.choices?.[0]?.message?.content;

  if (!parsedText) {
    throw createHttpError(502, "No parsed result was returned from OpenAI.");
  }

  logScheduleDebug("openai_raw_content", parsedText);

  let parsed;

  try {
    parsed = JSON.parse(parsedText);
  } catch (error) {
    throw createHttpError(502, "OpenAI returned invalid JSON.", {
      cause: error,
      raw: parsedText,
    });
  }

  applyParserHints(parsed, parserHints);
  normalizeParsedScheduleTimes(parsed);
  normalizeParsedScheduleSummaries(parsed, parserHints);
  logScheduleDebug("normalized_parsed_json", parsed);
  validateParsedSchedule(parsed);

  return {
    currentDateTime,
    timezone: TIMEZONE,
    parsed,
  };
}

module.exports = {
  TIMEZONE,
  cleanSummaryCandidate: cleanSummaryCandidateSafe,
  normalizeTimeValue: normalizeTimeValueSafe,
  normalizeParsedScheduleSummaries,
  parseScheduleText,
  resolveExplicitDateFromText,
};
