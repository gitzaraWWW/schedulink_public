const { TIMEZONE, normalizeTimeValue, parseScheduleText } = require("../scheduleParser");
const {
  createEvent,
  createEventChangeRequest,
  createEventChangeRequestTargets,
  createInvitation,
  createParticipant,
  getEventById,
  getEventsByCreatorId,
  getEventChangeRequestById,
  getEventChangeRequestTargetById,
  getEventChangeRequestTargetsByRequestId,
  getParticipantEventsByUserId,
  getParticipantsByEventId,
  getUserProfileById,
  listChangeRequestTargetsByUserId,
  listEventChangeRequestsByEventId,
  listEventChangeRequestsByStatus,
  listPendingChangeRequestTargetsByUserId,
  markEventDeleted,
  updateEvent,
  updateEventChangeRequest,
  updateEventChangeRequestTarget,
  updateParticipantStatus,
  upsertMentionProfile,
} = require("../supabase");
const { createHttpError } = require("../utils/errors");
const scheduleText = require("../utils/scheduleText");
const {
  DEFAULT_EVENT_DURATION_MINUTES,
  addMinutesToTime,
  getDurationMinutes,
  resolveDurationMinutes,
} = require("../utils/time");
const { ensureSessionUser } = require("./sessionUserService");
const {
  findMentionProfileByLabel,
  hydrateMentionEmails,
  isSelfReference,
  normalizeMentionLabel,
} = require("./mentionService");
const {
  createCalendarEventsForAcceptedParticipants,
  deleteCalendarEventForUser,
  deleteCalendarEventsForAcceptedParticipants,
  patchCalendarEventsForAcceptedParticipants,
} = require("./calendarService");

function assertParsedCreateFields(parsed) {
  if (!parsed?.summary) {
    throw createHttpError(400, "일정 제목을 이해하지 못했습니다. 제목이 드러나게 다시 입력해 주세요.", {
      parsed,
    });
  }

  if (!parsed?.date) {
    throw createHttpError(400, "일정 날짜를 이해하지 못했습니다. 날짜가 드러나게 다시 입력해 주세요.", {
      parsed,
    });
  }

  if (!parsed?.startTime) {
    throw createHttpError(
      400,
      "일정 시작 시간을 이해하지 못했습니다. 시간을 포함해 다시 입력해 주세요.",
      {
        parsed,
      }
    );
  }
}

function createExpiresAt(hours = 24) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hours);
  return expiresAt.toISOString();
}

function normalizeClock(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 5);
}

function getCurrentSeoulDateTime() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const map = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return new Date(
    `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+09:00`
  );
}

function buildSeoulDateTime(dateText, timeText) {
  if (!dateText || !timeText) {
    return null;
  }

  return new Date(`${dateText}T${normalizeClock(timeText)}:00+09:00`);
}

function resolveEventDurationMinutes(eventLike) {
  return resolveDurationMinutes(
    normalizeClock(eventLike?.start_time ?? eventLike?.startTime),
    normalizeClock(eventLike?.end_time ?? eventLike?.endTime),
    eventLike?.duration_minutes ?? eventLike?.durationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES
  );
}

function buildTimeMentionCandidates(timeText) {
  const normalizedTime = normalizeClock(timeText);

  if (!normalizedTime) {
    return [];
  }

  const [hoursText, minutesText] = normalizedTime.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const shortHour = String(hours);
  const paddedHour = String(hours).padStart(2, "0");
  const candidates = new Set([
    `${paddedHour}:${minutesText}`,
    `${shortHour}:${minutesText}`,
    `${paddedHour}시`,
    `${shortHour}시`,
  ]);

  if (minutes === 0) {
    candidates.add(`${shortHour}시부터`);
    candidates.add(`${paddedHour}시부터`);
    candidates.add(`${shortHour}시까지`);
    candidates.add(`${paddedHour}시까지`);
  } else if (minutes === 30) {
    candidates.add(`${shortHour}시반`);
    candidates.add(`${paddedHour}시반`);
    candidates.add(`${shortHour}시 ${minutesText}분`);
    candidates.add(`${paddedHour}시 ${minutesText}분`);
    candidates.add(`${shortHour}시${minutesText}분`);
    candidates.add(`${paddedHour}시${minutesText}분`);
  } else {
    candidates.add(`${shortHour}시 ${minutesText}분`);
    candidates.add(`${paddedHour}시 ${minutesText}분`);
    candidates.add(`${shortHour}시${minutesText}분`);
    candidates.add(`${paddedHour}시${minutesText}분`);
  }

  return [...candidates].sort((left, right) => right.length - left.length);
}

function findLastTimeMentionIndex(sourceText, timeText) {
  const text = String(sourceText || "");

  for (const candidate of buildTimeMentionCandidates(timeText)) {
    const index = text.lastIndexOf(candidate);

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function sourceTextExplicitlyChangesEndTime(sourceText, startTime, endTime) {
  if (!sourceText || !startTime || !endTime) {
    return false;
  }

  const startIndex = findLastTimeMentionIndex(sourceText, startTime);

  if (startIndex < 0) {
    return false;
  }

  const changeSegment = String(sourceText)
    .slice(startIndex)
    .replace(
      /\s*(?:으로|로)?\s*(?:변경(?:해줘)?|수정(?:해줘)?|바꿔(?:줘)?|옮겨(?:줘)?|미뤄(?:줘)?|당겨(?:줘)?|잡아(?:줘)?)\s*$/u,
      ""
    )
    .trim();
  const changeHints = scheduleText.analyzeScheduleSlots(changeSegment, normalizeTimeValue);

  return normalizeClock(changeHints.endTimeHint) === normalizeClock(endTime);
}

function resolveRequestedEndTimeForUpdate(eventRow, parsed, nextStartTime) {
  const requestedEndTime = parsed.changeSet?.endTime ?? parsed.endTime ?? null;
  const currentStartTime = normalizeClock(eventRow?.start_time);
  const currentEndTime = normalizeClock(eventRow?.end_time);

  if (!requestedEndTime) {
    return null;
  }

  if (!currentEndTime || normalizeClock(requestedEndTime) !== currentEndTime) {
    return requestedEndTime;
  }

  if (!nextStartTime || nextStartTime === currentStartTime) {
    return requestedEndTime;
  }

  if (sourceTextExplicitlyChangesEndTime(parsed?.sourceText, nextStartTime, requestedEndTime)) {
    return requestedEndTime;
  }

  return null;
}

function assertEventStartIsNotInPast({ date, startTime, message }) {
  const scheduledAt = buildSeoulDateTime(date, startTime);

  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    return;
  }

  const nowInSeoul = getCurrentSeoulDateTime();

  if (scheduledAt < nowInSeoul) {
    throw createHttpError(
      400,
      message || "이미 지난 시간입니다. 미래 시간을 선택해 주세요."
    );
  }
}

async function buildParticipantDrafts(
  parsedParticipants,
  selectedMentions = [],
  teamMentions = []
) {
  const draftsByKey = new Map();
  const mentionLookup = new Map();
  const normalizedTeamMentions = new Set(
    (teamMentions || [])
      .map((teamMention) => normalizeMentionLabel(teamMention))
      .filter(Boolean)
  );

  function addDraft(draft) {
    if (!draft?.name || !String(draft.name).trim()) {
      return;
    }

    const normalizedName = String(draft.name).trim();
    const key = draft.userId
      ? `user:${draft.userId}`
      : `name:${normalizedName.toLowerCase()}`;

    if (!draftsByKey.has(key)) {
      draftsByKey.set(key, {
        userId: draft.userId || null,
        name: normalizedName,
        email: draft.email || null,
      });
    }
  }

  for (const profile of selectedMentions) {
    if (!profile?.user_id || !profile?.display_name) {
      continue;
    }

    addDraft({
      userId: profile.user_id,
      name: profile.display_name,
      email: profile.email || null,
    });

    [profile.display_name, profile.nickname].forEach((label) => {
      const normalizedLabel = normalizeMentionLabel(label);
      if (normalizedLabel) {
        mentionLookup.set(normalizedLabel, profile);
      }
    });
  }

  for (const participant of parsedParticipants || []) {
    if (!participant || participant.type === "self") {
      continue;
    }

    if (participant.type === "mention") {
      const mentionName = String(participant.text || "")
        .replace(/^@+/, "")
        .trim();
      const normalizedMentionName = normalizeMentionLabel(mentionName);

      if (!mentionName) {
        continue;
      }

      if (normalizedTeamMentions.has(normalizedMentionName)) {
        continue;
      }

      const matchedProfile =
        mentionLookup.get(normalizedMentionName) ||
        (await findMentionProfileByLabel(mentionName));

      if (matchedProfile) {
        addDraft({
          userId: matchedProfile.user_id,
          name: matchedProfile.display_name,
          email: matchedProfile.email || null,
        });
      } else {
        addDraft({
          userId: null,
          name: mentionName,
          email: null,
        });
      }

      continue;
    }

    const rawText = String(participant.text || "").trim();

    if (!rawText || isSelfReference(rawText)) {
      continue;
    }

    const isEmail = participant.type === "email" || rawText.includes("@");
    const normalizedName = isEmail ? rawText.split("@")[0] : rawText;

    addDraft({
      userId: null,
      name: normalizedName,
      email: isEmail ? rawText : null,
    });
  }

  return [...draftsByKey.values()];
}

function buildParticipantSearchLabels(participant) {
  return [
    participant.name,
    participant.email,
    participant.email ? String(participant.email).split("@")[0] : null,
  ]
    .filter(Boolean)
    .map((value) => normalizeMentionLabel(value));
}

function pickRandomItem(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

function getEligibleOwnershipCandidates(eventParticipants = [], currentUserId) {
  const acceptedCandidates = eventParticipants.filter(
    (participant) =>
      participant.user_id &&
      participant.user_id !== currentUserId &&
      participant.status === "accepted"
  );
  const pendingCandidates = eventParticipants.filter(
    (participant) =>
      participant.user_id &&
      participant.user_id !== currentUserId &&
      participant.status === "pending"
  );

  return acceptedCandidates.length > 0 ? acceptedCandidates : pendingCandidates;
}

function serializeOwnershipCandidates(candidates = []) {
  return candidates.map((participant) => ({
    participantId: participant.id,
    userId: participant.user_id,
    name: participant.name || null,
    email: participant.email || null,
    status: participant.status || null,
  }));
}

function findOwnershipCandidateByUserId(candidates, userId) {
  if (!userId) {
    return null;
  }

  return candidates.find((participant) => participant.user_id === userId) || null;
}

async function resolveOwnershipParticipantByTarget({
  ownershipTarget,
  parsedParticipants = [],
  selectedMentions = [],
  eligibleCandidates = [],
}) {
  if (eligibleCandidates.length === 0) {
    return {
      participant: null,
      wasExplicit: false,
    };
  }

  const explicitTarget =
    ownershipTarget ||
    (parsedParticipants || []).find(
      (participant) => participant && participant.type !== "self" && participant.text
    ) ||
    null;

  if (!explicitTarget?.text) {
    return {
      participant: null,
      wasExplicit: false,
    };
  }

  const selectedMentionsByLabel = new Map();

  for (const profile of selectedMentions || []) {
    for (const label of [profile?.display_name, profile?.nickname]) {
      const normalizedLabel = normalizeMentionLabel(label);

      if (normalizedLabel) {
        selectedMentionsByLabel.set(normalizedLabel, profile);
      }
    }
  }

  const explicitText = String(explicitTarget.text || "").replace(/^@+/, "").trim();
  const normalizedExplicitText = normalizeMentionLabel(explicitText);

  let explicitUserId = null;
  const selectedMentionProfile = selectedMentionsByLabel.get(normalizedExplicitText);

  if (selectedMentionProfile?.user_id) {
    explicitUserId = selectedMentionProfile.user_id;
  } else if (explicitTarget.type === "mention" || explicitTarget.type === "email") {
    const matchedProfile = await findMentionProfileByLabel(explicitText);
    explicitUserId = matchedProfile?.user_id || null;
  }

  const exactMatch = eligibleCandidates.find((participant) => {
    if (explicitUserId && participant.user_id === explicitUserId) {
      return true;
    }

    return buildParticipantSearchLabels(participant).includes(normalizedExplicitText);
  });

  return {
    participant: exactMatch || null,
    wasExplicit: true,
  };
}

function buildOwnershipSelectionRequiredError({ eligibleCandidates, targetEvent, parsed }) {
  return createHttpError(409, "새 주최자가 될 사람을 선택해 주세요.", {
    code: "ownership_selection_required",
    ownershipSelectionRequired: true,
    ownershipCandidates: serializeOwnershipCandidates(eligibleCandidates),
    targetEvent: {
      id: targetEvent.id,
      title: targetEvent.title || null,
      date: targetEvent.date || null,
      startTime: normalizeClock(targetEvent.start_time),
      endTime: normalizeClock(targetEvent.end_time),
      location: targetEvent.location || null,
    },
    parsed,
  });
}

async function transferOrganizerRoleIfNeeded({
  savedUser,
  targetEvent,
  eventParticipants,
  parsed,
  selectedMentions = [],
  ownershipSelection = null,
}) {
  if (targetEvent.creator_id !== savedUser.id) {
    return null;
  }

  const eligibleCandidates = getEligibleOwnershipCandidates(eventParticipants, savedUser.id);

  if (eligibleCandidates.length === 0) {
    throw createHttpError(
      409,
      "주최자 권한을 넘길 수 있는 참가자가 없습니다."
    );
  }

  let transferredOwner = null;

  if (ownershipSelection?.mode === "specific") {
    transferredOwner = findOwnershipCandidateByUserId(
      eligibleCandidates,
      ownershipSelection.userId
    );

    if (!transferredOwner) {
      throw createHttpError(
        404,
        "선택한 사용자는 이 일정에서 주최자를 맡을 수 있는 참가자가 아닙니다."
      );
    }
  } else if (ownershipSelection?.mode === "random") {
    transferredOwner = pickRandomItem(eligibleCandidates);
  } else {
    const ownershipResolution = await resolveOwnershipParticipantByTarget({
      ownershipTarget: parsed.ownershipTarget || null,
      parsedParticipants: parsed.participants || [],
      selectedMentions,
      eligibleCandidates,
    });

    if (ownershipResolution.participant) {
      transferredOwner = ownershipResolution.participant;
    } else if (eligibleCandidates.length === 1) {
      transferredOwner = eligibleCandidates[0];
    } else {
      throw buildOwnershipSelectionRequiredError({
        eligibleCandidates,
        targetEvent,
        parsed,
      });
    }
  }

  await updateEvent({
    eventId: targetEvent.id,
    creatorId: transferredOwner.user_id,
    incrementVersion: true,
  });

  return transferredOwner;
}

function buildEventSnapshot(eventRow, participants) {
  return {
    id: eventRow?.id || null,
    title: eventRow?.title || null,
    date: eventRow?.date || null,
    startTime: normalizeClock(eventRow?.start_time),
    endTime: normalizeClock(eventRow?.end_time),
    durationMinutes: resolveEventDurationMinutes(eventRow),
    location: eventRow?.location || null,
    lifecycleStatus: eventRow?.lifecycle_status || "active",
    version: eventRow?.version || 1,
    participants: (participants || []).map((participant) => ({
      id: participant.id,
      userId: participant.user_id || null,
      name: participant.name || null,
      email: participant.email || null,
      status: participant.status || null,
    })),
  };
}

function buildRequestedEventShape(parsed) {
  return {
    title: parsed?.summary || null,
    date: parsed?.date || null,
    startTime: normalizeClock(parsed?.startTime),
    endTime: normalizeClock(parsed?.endTime),
    durationMinutes: getDurationMinutes(parsed?.startTime, parsed?.endTime),
    location: parsed?.location || null,
    participants: parsed?.participants || [],
  };
}

function applyChangeSetToEvent(eventRow, parsed) {
  const nextTitle = parsed.changeSet?.summary ?? parsed.summary ?? eventRow.title;
  const nextDate = parsed.changeSet?.date ?? parsed.date ?? eventRow.date;
  const nextStartTime =
    parsed.changeSet?.startTime ?? parsed.startTime ?? normalizeClock(eventRow.start_time);
  const fallbackDurationMinutes = resolveEventDurationMinutes(eventRow);
  const requestedEndTime = resolveRequestedEndTimeForUpdate(
    eventRow,
    parsed,
    nextStartTime
  );
  const nextEndTime =
    requestedEndTime ??
    (nextStartTime
      ? addMinutesToTime(
          nextStartTime,
          fallbackDurationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES
        )
      : normalizeClock(eventRow.end_time));
  const nextLocation =
    parsed.changeSet?.location ?? parsed.location ?? eventRow.location ?? null;
  const nextDurationMinutes = resolveDurationMinutes(
    nextStartTime,
    nextEndTime,
    fallbackDurationMinutes
  );

  return {
    title: nextTitle,
    date: nextDate,
    startTime: nextStartTime,
    endTime: nextEndTime,
    durationMinutes: nextDurationMinutes,
    location: nextLocation,
  };
}

function assertTargetEventPresent(parsed) {
  if (!parsed?.targetEvent) {
    throw createHttpError(400, "대상 일정을 찾지 못했습니다. 일정 제목이나 시간을 더 구체적으로 입력해 주세요.", {
      parsed,
    });
  }
}

function assertUpdateHasChanges(nextEvent, currentEvent, parsed) {
  const noMeaningfulChange =
    nextEvent.title === currentEvent.title &&
    String(nextEvent.date || "") === String(currentEvent.date || "") &&
    normalizeClock(nextEvent.startTime) === normalizeClock(currentEvent.start_time) &&
    normalizeClock(nextEvent.endTime) === normalizeClock(currentEvent.end_time) &&
    String(nextEvent.location || "") === String(currentEvent.location || "");

  if (noMeaningfulChange) {
    throw createHttpError(
      400,
      "변경된 내용이 확인되지 않았습니다. 무엇을 바꿀지 구체적으로 입력해 주세요.",
      { parsed }
    );
  }
}

function matchesString(value, target) {
  if (!target) {
    return true;
  }

  const normalizedValue = normalizeEventSearchText(value);
  const normalizedTarget = normalizeEventSearchText(target);

  if (!normalizedTarget) {
    return true;
  }

  if (!normalizedValue) {
    return false;
  }

  return normalizedValue.includes(normalizedTarget);
}

function stripTrailingKoreanParticles(text) {
  let current = String(text || "").trim();
  const trailingParticlePattern =
    /(으로|로|에게|한테|께|에서|으로는|로는|은|는|이|가|을|를|과|와|랑|도|만|의)$/;

  while (trailingParticlePattern.test(current)) {
    current = current.replace(trailingParticlePattern, "").trim();
  }

  return current;
}

function normalizeEventSearchText(text) {
  return String(text || "")
    .replace(/[.,!?()[\]{}\\/|:_\-"'`~]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => stripTrailingKoreanParticles(token))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function tokenizeEventSearchText(text) {
  return normalizeEventSearchText(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeEventSearchTextSafe(text) {
  return scheduleText.normalizeSearchText(text);
}

function tokenizeEventSearchTextSafe(text) {
  return scheduleText.tokenizeSearchText(text);
}

function buildTargetSummaryCandidates(targetEvent, sourceText = null) {
  if (!targetEvent) {
    return [];
  }

  const precomputedCandidates = Array.isArray(targetEvent.summaryCandidates)
    ? targetEvent.summaryCandidates.filter(Boolean)
    : [];

  if (precomputedCandidates.length > 0) {
    return [...new Set(precomputedCandidates)];
  }

  return scheduleText.buildSummaryCandidates({
    summary: targetEvent.summary,
    sourceText,
    location: targetEvent.location,
  });
}

function getSummaryMatchDiagnostics(eventRow, targetEvent, sourceText = null) {
  const summaryCandidates = buildTargetSummaryCandidates(targetEvent, sourceText);

  if (summaryCandidates.length === 0) {
    return {
      summaryCandidates: [],
      matched: true,
      matchedCandidate: null,
      score: 0,
    };
  }

  const searchableCandidates = [
    {
      label: "title",
      normalizedText: normalizeEventSearchTextSafe(eventRow.title),
      tokens: tokenizeEventSearchTextSafe(eventRow.title),
      bonus: 3,
    },
    {
      label: "location_title",
      normalizedText: normalizeEventSearchTextSafe(
        [eventRow.location, eventRow.title].filter(Boolean).join(" ")
      ),
      tokens: tokenizeEventSearchTextSafe(
        [eventRow.location, eventRow.title].filter(Boolean).join(" ")
      ),
      bonus: 1,
    },
    {
      label: "title_location",
      normalizedText: normalizeEventSearchTextSafe(
        [eventRow.title, eventRow.location].filter(Boolean).join(" ")
      ),
      tokens: tokenizeEventSearchTextSafe(
        [eventRow.title, eventRow.location].filter(Boolean).join(" ")
      ),
      bonus: 1,
    },
  ].filter((candidate) => candidate.normalizedText);

  let bestMatch = {
    matched: false,
    matchedCandidate: null,
    score: 0,
  };

  for (const summaryCandidate of summaryCandidates) {
    const normalizedTarget = normalizeEventSearchTextSafe(summaryCandidate);
    const targetTokens = tokenizeEventSearchTextSafe(summaryCandidate);

    if (!normalizedTarget || targetTokens.length === 0) {
      continue;
    }

    for (const candidate of searchableCandidates) {
      let score = 0;

      if (candidate.normalizedText === normalizedTarget) {
        score = 12 + candidate.bonus;
      } else if (
        candidate.normalizedText.includes(normalizedTarget) ||
        normalizedTarget.includes(candidate.normalizedText)
      ) {
        score = 9 + candidate.bonus;
      } else {
        const tokenMatches = targetTokens.every(
          (token) =>
            candidate.normalizedText.includes(token) ||
            candidate.tokens.some(
              (candidateToken) =>
                candidateToken === token ||
                candidateToken.includes(token) ||
                token.includes(candidateToken)
            )
        );

        if (tokenMatches) {
          score = 7 + candidate.bonus;
        }
      }

      if (score > bestMatch.score) {
        bestMatch = {
          matched: score > 0,
          matchedCandidate: summaryCandidate,
          score,
        };
      }
    }
  }

  return {
    summaryCandidates,
    matched: bestMatch.matched,
    matchedCandidate: bestMatch.matchedCandidate,
    score: bestMatch.score,
  };
}

function matchesEventSummary(eventRow, targetSummary) {
  if (!targetSummary) {
    return true;
  }

  const normalizedTarget = normalizeEventSearchText(targetSummary);
  const targetTokens = tokenizeEventSearchText(targetSummary);

  if (!normalizedTarget || targetTokens.length === 0) {
    return true;
  }

  const searchableCandidates = [
    eventRow.title,
    [eventRow.location, eventRow.title].filter(Boolean).join(" "),
    [eventRow.title, eventRow.location].filter(Boolean).join(" "),
  ]
    .map((candidate) => ({
      normalizedText: normalizeEventSearchText(candidate),
      tokens: tokenizeEventSearchText(candidate),
    }))
    .filter((candidate) => candidate.normalizedText);

  return searchableCandidates.some((candidate) =>
    targetTokens.every(
      (token) =>
        candidate.normalizedText.includes(token) ||
        candidate.tokens.some(
          (candidateToken) =>
            candidateToken === token ||
            candidateToken.includes(token) ||
            token.includes(candidateToken)
        )
    )
  );
}

function getTargetEventMatchDiagnostics(
  eventRow,
  targetEvent,
  { allowPendingDelete = false, sourceText = null } = {}
) {
  const summaryDiagnostics = getSummaryMatchDiagnostics(
    eventRow,
    targetEvent,
    sourceText
  );
  const summaryMatches = summaryDiagnostics.matched;
  const dateMatches =
    !targetEvent.date || String(eventRow.date) === String(targetEvent.date);
  const startTimeMatches =
    !targetEvent.startTime ||
    normalizeClock(eventRow.start_time) === normalizeClock(targetEvent.startTime);
  const endTimeMatches =
    !targetEvent.endTime ||
    normalizeClock(eventRow.end_time) === normalizeClock(targetEvent.endTime);
  const locationMatches = matchesString(eventRow.location, targetEvent.location);
  const lifecycleMatches =
    eventRow.lifecycle_status !== "deleted" &&
    (allowPendingDelete || eventRow.lifecycle_status !== "pending_delete");

  return {
    eventId: eventRow.id,
    title: eventRow.title,
    date: eventRow.date,
    startTime: normalizeClock(eventRow.start_time),
    endTime: normalizeClock(eventRow.end_time),
    location: eventRow.location,
    lifecycleStatus: eventRow.lifecycle_status,
    normalizedTargetSummary: normalizeEventSearchTextSafe(targetEvent.summary),
    targetSummaryCandidates: summaryDiagnostics.summaryCandidates,
    matchedSummaryCandidate: summaryDiagnostics.matchedCandidate,
    summaryScore: summaryDiagnostics.score,
    normalizedTitle: normalizeEventSearchTextSafe(eventRow.title),
    normalizedLocation: normalizeEventSearchTextSafe(eventRow.location),
    normalizedCombined: normalizeEventSearchTextSafe(
      [eventRow.location, eventRow.title].filter(Boolean).join(" ")
    ),
    summaryMatches,
    dateMatches,
    startTimeMatches,
    endTimeMatches,
    locationMatches,
    lifecycleMatches,
    matched:
      summaryMatches &&
      dateMatches &&
      startTimeMatches &&
      endTimeMatches &&
      locationMatches &&
      lifecycleMatches,
  };
}

function hasMeaningfulTargetParticipants(targetParticipants = []) {
  return (targetParticipants || []).some(
    (participant) => participant && participant.type !== "self" && participant.text
  );
}

function getRelaxedTargetEventMatchDiagnostics(
  strictDiagnostics,
  targetEvent,
  { participantsMatch = true } = {}
) {
  const hasSummary = buildTargetSummaryCandidates(targetEvent).length > 0;
  const hasDate = Boolean(targetEvent?.date);
  const hasStartTime = Boolean(normalizeClock(targetEvent?.startTime));
  const hasEndTime = Boolean(normalizeClock(targetEvent?.endTime));
  const hasLocation = Boolean(normalizeEventSearchTextSafe(targetEvent?.location));
  const hasParticipants = hasMeaningfulTargetParticipants(targetEvent?.participants);

  const providedSignalCount = [
    hasSummary,
    hasDate,
    hasStartTime,
    hasEndTime,
    hasLocation,
    hasParticipants,
  ].filter(Boolean).length;

  const matchedAnchors = [];

  if (hasSummary && strictDiagnostics.summaryMatches) {
    matchedAnchors.push("summary");
  }

  if (hasDate && strictDiagnostics.dateMatches) {
    matchedAnchors.push("date");
  }

  if (hasStartTime && strictDiagnostics.startTimeMatches) {
    matchedAnchors.push("startTime");
  }

  if (hasEndTime && strictDiagnostics.endTimeMatches) {
    matchedAnchors.push("endTime");
  }

  if (hasLocation && strictDiagnostics.locationMatches) {
    matchedAnchors.push("location");
  }

  if (hasParticipants && participantsMatch) {
    matchedAnchors.push("participants");
  }

  const strongAnchorCount = [
    hasSummary && strictDiagnostics.summaryMatches,
    hasDate && strictDiagnostics.dateMatches,
    hasStartTime && strictDiagnostics.startTimeMatches,
    hasParticipants && participantsMatch,
  ].filter(Boolean).length;

  const score =
    (hasSummary && strictDiagnostics.summaryMatches ? 4 : 0) +
    (hasDate && strictDiagnostics.dateMatches ? 5 : 0) +
    (hasStartTime && strictDiagnostics.startTimeMatches ? 3 : 0) +
    (hasEndTime && strictDiagnostics.endTimeMatches ? 1 : 0) +
    (hasLocation && strictDiagnostics.locationMatches ? 2 : 0) +
    (hasParticipants && participantsMatch ? 3 : 0);

  const hardConflict =
    !strictDiagnostics.lifecycleMatches ||
    (hasDate && !strictDiagnostics.dateMatches) ||
    (hasParticipants && !participantsMatch);

  const matched =
    !strictDiagnostics.matched &&
    !hardConflict &&
    providedSignalCount >= 2 &&
    matchedAnchors.length >= 2 &&
    strongAnchorCount >= 2 &&
    score >= 7;

  return {
    providedSignalCount,
    matchedAnchorCount: matchedAnchors.length,
    matchedAnchors,
    strongAnchorCount,
    participantsMatch,
    score,
    hardConflict,
    matched,
  };
}

function shouldLogScheduleDebug() {
  return process.env.NODE_ENV !== "production";
}

function stripCommonScheduleTokens(text) {
  return String(text || "")
    .replace(/@\S+/g, " ")
    .replace(
      /(오늘|내일|모레|글피|이번주|다음주|\d{4}-\d{2}-\d{2}|\d{1,2}월\s*\d{1,2}일|\d{1,2}일)/g,
      " "
    )
    .replace(
      /(오전\s*\d{1,2}시(\s*\d{1,2}분)?|오후\s*\d{1,2}시(\s*\d{1,2}분)?|\d{1,2}:\d{2}|\d{1,2}시(\s*\d{1,2}분)?|\d{1,2}시반)/g,
      " "
    )
    .replace(
      /(지워줘|삭제해줘|없애줘|제거해줘|바꿔줘|변경해줘|수정해줘|잡아줘|추가해줘|만들어줘|등록해줘)/g,
      " "
    )
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferTargetSummaryFromSourceText(text) {
  const stripped = stripCommonScheduleTokens(text);

  if (!stripped) {
    return null;
  }

  const commonTitles = [
    "팀 회의",
    "프로젝트 회의",
    "면담",
    "상담",
    "인터뷰",
    "통화",
    "미팅",
    "회의",
    "스터디",
    "약속",
    "점심",
    "저녁",
    "식사",
  ];

  const matchedTitle = commonTitles.find((title) => stripped.includes(title));

  if (matchedTitle) {
    return matchedTitle;
  }

  return stripped;
}

function inferTargetSummaryFromSourceTextSafe(text) {
  const candidates = scheduleText.buildSummaryCandidates({
    sourceText: text,
  });

  return candidates[0] || null;
}

function enrichParsedTargetEvent(parsed, sourceText) {
  if (!parsed || !parsed.targetEvent) {
    return parsed;
  }

  parsed.targetEvent.sourceText = sourceText || null;
  parsed.targetEvent.summaryCandidates = buildTargetSummaryCandidates(
    parsed.targetEvent,
    sourceText
  );
  parsed.targetEvent.summary =
    parsed.targetEvent.summary ||
    parsed.targetEvent.summaryCandidates[0] ||
    inferTargetSummaryFromSourceTextSafe(sourceText) ||
    inferTargetSummaryFromSourceText(sourceText);
  parsed.targetEvent.date = parsed.targetEvent.date || null;
  parsed.targetEvent.startTime = parsed.targetEvent.startTime || null;
  parsed.targetEvent.endTime = parsed.targetEvent.endTime || null;
  parsed.targetEvent.location = parsed.targetEvent.location || null;
  parsed.targetEvent.participants =
    parsed.targetEvent.participants?.length > 0
      ? parsed.targetEvent.participants
      : parsed.participants || [];

  return parsed;
}

function matchesTargetParticipants(eventParticipants, targetParticipants) {
  const meaningfulTargets = (targetParticipants || []).filter(
    (participant) => participant && participant.type !== "self" && participant.text
  );

  if (meaningfulTargets.length === 0) {
    return true;
  }

  return meaningfulTargets.every((targetParticipant) => {
    const normalizedTarget = normalizeMentionLabel(
      String(targetParticipant.text || "").replace(/^@+/, "")
    );

    return (eventParticipants || []).some((eventParticipant) => {
      const candidateLabels = [
        eventParticipant.name,
        eventParticipant.email,
        eventParticipant.email
          ? String(eventParticipant.email).split("@")[0]
          : null,
      ]
        .filter(Boolean)
        .map((value) => normalizeMentionLabel(value));

      return candidateLabels.includes(normalizedTarget);
    });
  });
}

function matchesTargetEvent(eventRow, targetEvent) {
  if (!targetEvent) {
    return false;
  }

  return getTargetEventMatchDiagnostics(eventRow, targetEvent).matched;
}

async function assertNoActiveChangeRequestForEvent(eventId) {
  const requests = await listEventChangeRequestsByEventId(eventId);
  const activeRequest = requests.find((request) =>
    ["pending_creator_review", "pending_participant_approval"].includes(
      request.request_status
    )
  );

  if (activeRequest) {
    throw createHttpError(
      409,
      "이 일정에는 처리 중인 변경 요청이 있습니다. 해당 요청이 끝난 뒤 다시 시도해 주세요."
    );
  }
}

function assertNoPendingParticipantsForSharedMutation(
  participants,
  creatorUserId
) {
  const hasPendingInvitees = (participants || []).some((participant) => {
    if (!participant) {
      return false;
    }

    if (participant.user_id === creatorUserId) {
      return false;
    }

    return participant.status === "pending";
  });

  if (hasPendingInvitees) {
    throw createHttpError(
      409,
      "아직 응답하지 않은 참여자가 있습니다. 모두 응답한 뒤 수정하거나 삭제할 수 있습니다."
    );
  }
}

async function findTargetEventForUser(
  userId,
  targetEvent,
  { allowPendingDelete = false } = {}
) {
  if (!targetEvent) {
    throw createHttpError(400, "대상 일정을 찾지 못했습니다. 일정 제목이나 시간을 더 구체적으로 입력해 주세요.");
  }

  const participantRows = await getParticipantEventsByUserId(userId);
  const activeParticipantRows = participantRows.filter((row) =>
    ["accepted", "pending"].includes(row.status)
  );
  const creatorOwnedEvents = await getEventsByCreatorId(userId).catch(() => []);
  const baseCandidateEvents = [
    ...activeParticipantRows.map((row) => row.events),
    ...creatorOwnedEvents,
  ]
    .filter(Boolean)
    .filter((event, index, collection) => {
      return collection.findIndex((item) => item.id === event.id) === index;
    });
  const shouldCheckParticipants = hasMeaningfulTargetParticipants(
    targetEvent.participants
  );
  const candidateEvaluations = [];

  for (const candidate of baseCandidateEvents) {
    const strictDiagnostics = getTargetEventMatchDiagnostics(candidate, targetEvent, {
      allowPendingDelete,
      sourceText: targetEvent.sourceText || null,
    });

    let participantsMatch = true;

    if (shouldCheckParticipants) {
      // Participant matching is only fetched when the user actually referenced attendees.
      const participants = await getParticipantsByEventId(candidate.id);
      participantsMatch = matchesTargetParticipants(
        participants,
        targetEvent.participants
      );
    }

    const relaxedDiagnostics = getRelaxedTargetEventMatchDiagnostics(
      strictDiagnostics,
      targetEvent,
      {
        participantsMatch,
      }
    );

    candidateEvaluations.push({
      event: candidate,
      strictDiagnostics,
      relaxedDiagnostics,
      participantsMatch,
    });
  }

  const narrowedCandidates = candidateEvaluations
    .filter(
      ({ strictDiagnostics, participantsMatch }) =>
        strictDiagnostics.matched && participantsMatch
    )
    .map(({ event }) => event);

  let selectedRelaxedCandidate = null;

  if (narrowedCandidates.length === 0) {
    const relaxedCandidates = candidateEvaluations
      .filter(({ relaxedDiagnostics }) => relaxedDiagnostics.matched)
      .sort((left, right) => {
        if (right.relaxedDiagnostics.score !== left.relaxedDiagnostics.score) {
          return right.relaxedDiagnostics.score - left.relaxedDiagnostics.score;
        }

        return (
          right.relaxedDiagnostics.matchedAnchorCount -
          left.relaxedDiagnostics.matchedAnchorCount
        );
      });

    if (relaxedCandidates.length === 1) {
      selectedRelaxedCandidate = relaxedCandidates[0].event;
    } else if (relaxedCandidates.length > 1) {
      const [bestCandidate, secondCandidate] = relaxedCandidates;

      if (
        bestCandidate.relaxedDiagnostics.score >=
          secondCandidate.relaxedDiagnostics.score + 2 &&
        bestCandidate.relaxedDiagnostics.matchedAnchorCount >=
          secondCandidate.relaxedDiagnostics.matchedAnchorCount
      ) {
        selectedRelaxedCandidate = bestCandidate.event;
      }
    }
  }

  if (shouldLogScheduleDebug()) {
    console.log(
      "[scheduleService] findTargetEvent_candidates:",
      JSON.stringify(
        {
          targetEvent,
          participantRowCount: participantRows.length,
          activeParticipantRowCount: activeParticipantRows.length,
          creatorOwnedEventCount: creatorOwnedEvents.length,
          baseCandidateCount: baseCandidateEvents.length,
          strictCandidateCount: narrowedCandidates.length,
          strictEvaluations: candidateEvaluations.map(
            ({ strictDiagnostics, participantsMatch }) => ({
              ...strictDiagnostics,
              participantsMatch,
            })
          ),
          relaxedEvaluations: candidateEvaluations.map(
            ({ event, relaxedDiagnostics }) => ({
              eventId: event.id,
              title: event.title,
              ...relaxedDiagnostics,
            })
          ),
          matchedCount: narrowedCandidates.length,
          matchedEvents: narrowedCandidates.map((candidate) => ({
            id: candidate.id,
            title: candidate.title,
            date: candidate.date,
            start_time: candidate.start_time,
            end_time: candidate.end_time,
            location: candidate.location,
            lifecycle_status: candidate.lifecycle_status,
          })),
          selectedRelaxedCandidate,
        },
        null,
        2
      )
    );
  }

  if (narrowedCandidates.length === 0) {
    if (selectedRelaxedCandidate) {
      return selectedRelaxedCandidate;
    }

    throw createHttpError(404, "No matching event could be found for this request.");
  }

  if (narrowedCandidates.length > 1) {
    throw createHttpError(409, "조건에 맞는 일정이 여러 개입니다. 제목이나 시간을 더 구체적으로 입력해 주세요.");
  }

  return narrowedCandidates[0];
}

async function resolveLegacyDeleteRequests(eventId, resolvedAt) {
  const requests = await listEventChangeRequestsByEventId(eventId);

  for (const request of requests) {
    if (
      request.request_type !== "delete_request" ||
      request.request_status !== "pending_participant_approval"
    ) {
      continue;
    }

    const targets = await getEventChangeRequestTargetsByRequestId(request.id);

    for (const target of targets) {
      if (target.decision_status !== "pending") {
        continue;
      }

      await updateEventChangeRequestTarget(target.id, {
        decision_status: "rejected",
        decision_reason: "Event was deleted directly by the creator.",
        decided_at: resolvedAt,
      });
    }

    await updateEventChangeRequest(request.id, {
      request_status: "completed",
      creator_decision_status: request.creator_decision_status || "auto_approved",
      creator_decided_at: request.creator_decided_at || resolvedAt,
      resolved_at: resolvedAt,
    });
  }
}

async function saveParsedScheduleToDatabase({
  session,
  parsed,
  selectedMentions = [],
  teamMentions = [],
}) {
  const savedUser = await ensureSessionUser(session);

  await upsertMentionProfile({
    userId: savedUser?.id,
    displayName: savedUser?.name || session.user?.name,
  });

  const eventRow = await createEvent({
    creatorId: savedUser?.id,
    title: parsed.summary,
    date: parsed.date,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    durationMinutes: getDurationMinutes(parsed.startTime, parsed.endTime),
    location: parsed.location,
  });

  const selectedMentionsWithEmail = await hydrateMentionEmails(selectedMentions);
  const participantDrafts = await buildParticipantDrafts(
    parsed.participants,
    selectedMentionsWithEmail,
    teamMentions
  );

  const creatorParticipant = await createParticipant({
    eventId: eventRow?.id,
    userId: savedUser?.id,
    name: savedUser?.name || session.user?.name || "Creator",
    email: savedUser?.email || session.user?.email || "",
    status: "accepted",
  });

  const participantRows = [creatorParticipant];
  const invitationRows = [];
  const participantKeys = new Set([`user:${savedUser?.id}`]);

  for (const draft of participantDrafts) {
    const key = draft.userId
      ? `user:${draft.userId}`
      : `name:${String(draft.name || "").trim().toLowerCase()}`;

    if (participantKeys.has(key)) {
      continue;
    }

    participantKeys.add(key);

    const participantRow = await createParticipant({
      eventId: eventRow?.id,
      userId: draft.userId,
      name: draft.name,
      email: draft.email || "",
      status: "pending",
    });

    participantRows.push(participantRow);

    if (draft.userId) {
      const invitationRow = await createInvitation({
        participantId: participantRow?.id,
        status: "pending",
      });
      invitationRows.push(invitationRow);
    }
  }

  return {
    savedUser,
    eventRow,
    participantRows,
    invitationRows,
  };
}

async function createPersonalSplitEvent({
  session,
  savedUser,
  parentEventId,
  nextEvent,
}) {
  await upsertMentionProfile({
    userId: savedUser?.id,
    displayName: savedUser?.name || session.user?.name,
  });

  const eventRow = await createEvent({
    creatorId: savedUser?.id,
    title: nextEvent.title,
    date: nextEvent.date,
    startTime: nextEvent.startTime,
    endTime: nextEvent.endTime,
    durationMinutes: nextEvent.durationMinutes,
    location: nextEvent.location,
    parentEventId,
  });

  const participantRow = await createParticipant({
    eventId: eventRow?.id,
    userId: savedUser?.id,
    name: savedUser?.name || session.user?.name || "Creator",
    email: savedUser?.email || session.user?.email || "",
    status: "accepted",
  });

  return {
    eventRow,
    participantRows: [participantRow],
    invitationRows: [],
  };
}

async function syncCreatedEventIfReady(eventId) {
  const eventParticipants = await getParticipantsByEventId(eventId);
  const allAccepted =
    eventParticipants.length > 0 &&
    eventParticipants.every((participant) => participant.status === "accepted");

  if (!allAccepted) {
    return {
      participants: eventParticipants,
      syncResult: null,
    };
  }

  const syncResult = await createCalendarEventsForAcceptedParticipants(eventParticipants);

  return {
    participants: eventParticipants,
    syncResult,
  };
}

async function handleCreateEvent(
  session,
  parsed,
  selectedMentions,
  teamMentions = []
) {
  assertParsedCreateFields(parsed);
  assertEventStartIsNotInPast({
    date: parsed.date,
    startTime: parsed.startTime,
    message: "과거의 일정을 만들 수 없습니다. 미래의 시간을 선택해 주세요.",
  });

  const dbResult = await saveParsedScheduleToDatabase({
    session,
    parsed,
    selectedMentions,
    teamMentions,
  });
  const { participants, syncResult } = await syncCreatedEventIfReady(dbResult.eventRow?.id);
  const syncedImmediately = Boolean(syncResult);
  const syncFailedUsers = syncResult?.failedUsers || [];

  let message =
    "일정이 등록되었습니다. 초대된 참여자가 모두 수락하면 각 캘린더에 자동으로 반영됩니다";

  if (syncedImmediately) {
    message =
      syncFailedUsers.length > 0
        ? `일정은 등록되었지만, 일부 참여자의 캘린더에는 아직 반영되지 않았습니다. : ${syncFailedUsers
            .map((item) => `${item.userId} (${item.reason})`)
            .join(", ")}`
        : "일정이 등록되었습니다. 수락한 참여자들의 캘린더에 일정이 등록되었습니다.";
  }
  
  return {
    success: true,
    action: parsed.action,
    message,
    parsed,
    db: {
      event: dbResult.eventRow,
      participants,
      invitations: dbResult.invitationRows,
    },
    syncResult,
  };
}

async function handleUpdateRequest(session, parsed) {
  const savedUser = await ensureSessionUser(session);
  assertTargetEventPresent(parsed);
  const targetEvent = await findTargetEventForUser(savedUser.id, parsed.targetEvent);
  await assertNoActiveChangeRequestForEvent(targetEvent.id);
  const eventParticipants = await getParticipantsByEventId(targetEvent.id);
  assertNoPendingParticipantsForSharedMutation(
    eventParticipants,
    targetEvent.creator_id
  );
  const beforeSnapshot = buildEventSnapshot(targetEvent, eventParticipants);
  const nextEvent = applyChangeSetToEvent(targetEvent, parsed);

  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[scheduleService] handleUpdateRequest_computed_next_event:",
      JSON.stringify(
        {
          targetEvent: {
            id: targetEvent.id,
            startTime: normalizeClock(targetEvent.start_time),
            endTime: normalizeClock(targetEvent.end_time),
            durationMinutes: resolveEventDurationMinutes(targetEvent),
          },
          parsedChangeSet: parsed.changeSet || null,
          parsedTopLevel: {
            startTime: parsed.startTime || null,
            endTime: parsed.endTime || null,
          },
          nextEvent,
        },
        null,
        2
      )
    );
  }

  assertEventStartIsNotInPast({
    date: nextEvent.date,
    startTime: nextEvent.startTime,
    message:
      "지난 시간으로는 일정을 변경할 수 없습니다. 이후의 시간을 선택해 주세요.",
  });
  assertUpdateHasChanges(nextEvent, targetEvent, parsed);

  if (targetEvent.creator_id === savedUser.id) {
    const updatedEvent = await updateEvent({
      eventId: targetEvent.id,
      title: nextEvent.title,
      date: nextEvent.date,
      startTime: nextEvent.startTime,
      endTime: nextEvent.endTime,
      durationMinutes: nextEvent.durationMinutes,
      location: nextEvent.location,
      incrementVersion: true,
    });

    const updatedParticipants = await getParticipantsByEventId(targetEvent.id);
    const syncResult = await patchCalendarEventsForAcceptedParticipants(
      updatedParticipants,
      updatedEvent
    );

    return {
      success: true,
      action: parsed.action,
      message: "일정이 수정되었습니다. 참여자에게 변경 내용이 안내됩니다.",
      parsed,
      event: updatedEvent,
      beforeSnapshot,
      afterSnapshot: buildEventSnapshot(updatedEvent, updatedParticipants),
      syncResult,
    };
  }

  const changeRequest = await createEventChangeRequest({
    eventId: targetEvent.id,
    requesterUserId: savedUser.id,
    requestType: "update_proposal",
    requestStatus: "pending_creator_review",
    creatorDecisionStatus: "pending",
    sourceText: parsed.sourceText || null,
    parsedPayload: parsed,
    beforeSnapshot,
    afterSnapshot: {
      ...beforeSnapshot,
      ...nextEvent,
    },
    expiresAt: createExpiresAt(),
  });

  return {
    success: true,
    action: parsed.action,
    message: "수정 요청을 주최자에게 전달했습니다. 승인되면 일정에 반영됩니다.",
    parsed,
    changeRequest,
  };
}

async function handleDeleteRequest(session, parsed) {
  const savedUser = await ensureSessionUser(session);
  assertTargetEventPresent(parsed);
  const targetEvent = await findTargetEventForUser(savedUser.id, parsed.targetEvent, {
    allowPendingDelete: true,
  });

  if (targetEvent.creator_id !== savedUser.id) {
    throw createHttpError(
      403,
      "이 일정은 주최자만 삭제할 수 있습니다."
    );
  }

  if (targetEvent.lifecycle_status !== "pending_delete") {
    await assertNoActiveChangeRequestForEvent(targetEvent.id);
  }

  const eventParticipants = await getParticipantsByEventId(targetEvent.id);
  assertNoPendingParticipantsForSharedMutation(
    eventParticipants,
    targetEvent.creator_id
  );
  const beforeSnapshot = buildEventSnapshot(targetEvent, eventParticipants);
  const acceptedParticipants = eventParticipants.filter(
    (participant) => participant.status === "accepted"
  );
  const otherAcceptedParticipants = acceptedParticipants.filter(
    (participant) => participant.user_id && participant.user_id !== savedUser.id
  );
  const resolvedAt = new Date().toISOString();

  if (targetEvent.lifecycle_status === "pending_delete") {
    await resolveLegacyDeleteRequests(targetEvent.id, resolvedAt);
  }

  let changeRequest = null;
  let targets = [];

  if (otherAcceptedParticipants.length > 0) {
    changeRequest = await createEventChangeRequest({
      eventId: targetEvent.id,
      requesterUserId: savedUser.id,
      requestType: "delete_request",
      requestStatus: "completed",
      creatorDecisionStatus: "auto_approved",
      creatorDecidedAt: resolvedAt,
      sourceText: parsed.sourceText || null,
      parsedPayload: parsed,
      beforeSnapshot,
      afterSnapshot: null,
      resolvedAt,
    });

    targets = await createEventChangeRequestTargets(
      otherAcceptedParticipants.map((participant) => ({
        request_id: changeRequest.id,
        participant_id: participant.id,
        target_user_id: participant.user_id,
        decision_status: "accepted",
        decision_reason: "Delete notice delivered automatically.",
        decided_at: resolvedAt,
      }))
    );
  }

  const deletedEvent = await markEventDeleted(targetEvent.id);
  const deleteSyncResult = await deleteCalendarEventsForAcceptedParticipants(
    acceptedParticipants
  );

  return {
    success: true,
    action: parsed.action,
    message:
      otherAcceptedParticipants.length > 0
        ? "일정을 삭제했고 참여자에게도 안내했습니다."
        : "일정을 삭제했습니다.",
    parsed,
    event: deletedEvent,
    changeRequest,
    targets,
    beforeSnapshot,
    syncResult: deleteSyncResult,
  };
}

async function handleSelfAttendanceChange(
  session,
  parsed,
  selectedMentions = [],
  ownershipSelection = null
) {
  const savedUser = await ensureSessionUser(session);
  assertTargetEventPresent(parsed);
  const targetEvent = await findTargetEventForUser(savedUser.id, parsed.targetEvent);
  const eventParticipants = await getParticipantsByEventId(targetEvent.id);
  const ownParticipant = eventParticipants.find(
    (participant) => participant.user_id === savedUser.id
  );

  if (!ownParticipant) {
    throw createHttpError(404, "이 일정의 참여자가 아닙니다.");
  }

  const transferredOwner = await transferOrganizerRoleIfNeeded({
    savedUser,
    targetEvent,
    eventParticipants,
    parsed,
    selectedMentions,
    ownershipSelection,
  });

  const participant = await updateParticipantStatus({
    participantId: ownParticipant.id,
    status: "withdrawn",
  });

  const calendarResult = await deleteCalendarEventForUser(savedUser.id, targetEvent.id).catch(
    (error) => ({
      success: false,
      reason: error.message,
    })
  );

  return {
    success: true,
    action: parsed.action,
    message: transferredOwner
      ? `일정 참석이 취소되었습니다. 주최자 권한은 ${transferredOwner.name || transferredOwner.email || transferredOwner.user_id}님에게 이전되었습니다.`
      : "일정 참석이 취소되었습니다.",
    parsed,
    participant,
    transferredOwner,
    calendarResult,
  };
}

async function handleSelfEventSplit(
  session,
  parsed,
  selectedMentions = [],
  ownershipSelection = null
) {
  const savedUser = await ensureSessionUser(session);
  assertTargetEventPresent(parsed);
  const targetEvent = await findTargetEventForUser(savedUser.id, parsed.targetEvent);
  const eventParticipants = await getParticipantsByEventId(targetEvent.id);
  const ownParticipant = eventParticipants.find(
    (participant) => participant.user_id === savedUser.id
  );

  if (!ownParticipant) {
    throw createHttpError(404, "이 일정의 참가자가 아닙니다.");
  }

  const transferredOwner = await transferOrganizerRoleIfNeeded({
    savedUser,
    targetEvent,
    eventParticipants,
    parsed,
    selectedMentions,
    ownershipSelection,
  });

  const nextEvent = applyChangeSetToEvent(targetEvent, parsed);
  assertEventStartIsNotInPast({
    date: nextEvent.date,
    startTime: nextEvent.startTime,
    message:
      "개인 일정은 과거 시각으로 옮길 수 없습니다. 미래 시간을 선택해 주세요.",
  });

  const branchDbResult = await createPersonalSplitEvent({
    session,
    savedUser,
    parentEventId: targetEvent.id,
    nextEvent,
  });

  const participant = await updateParticipantStatus({
    participantId: ownParticipant.id,
    status: "withdrawn",
  });

  const { participants: branchedParticipants, syncResult: branchSyncResult } =
    await syncCreatedEventIfReady(branchDbResult.eventRow?.id);
  const deleteOriginalCalendarResult = await deleteCalendarEventForUser(
    savedUser.id,
    targetEvent.id
  ).catch((error) => ({
    success: false,
    reason: error.message,
  }));

  const organizerMessage = transferredOwner
    ? ` 주최자 권한은 ${
        transferredOwner.name || transferredOwner.email || transferredOwner.user_id
      }님에게 이전되었습니다.`
    : "";

  return {
    success: true,
    action: parsed.action,
    message: `개인 일정이 공동 일정에서 분리되었습니다.${organizerMessage}`,
    parsed,
    participant,
    transferredOwner,
    event: branchDbResult.eventRow,
    db: {
      event: branchDbResult.eventRow,
      participants: branchedParticipants,
      invitations: branchDbResult.invitationRows,
    },
    syncResult: {
      createdPersonalEvent: branchSyncResult,
      deletedOriginalCalendarEvent: deleteOriginalCalendarResult,
    },
  };
}

async function handlePersonalHideOrDelete(session, parsed) {
  const savedUser = await ensureSessionUser(session);
  assertTargetEventPresent(parsed);
  const targetEvent = await findTargetEventForUser(savedUser.id, parsed.targetEvent);
  const calendarResult = await deleteCalendarEventForUser(savedUser.id, targetEvent.id).catch(
    (error) => ({
      success: false,
      reason: error.message,
    })
  );

  return {
    success: true,
    action: parsed.action,
    message: "내 캘린더에서만 일정을 제거했습니다.",
    parsed,
    calendarResult,
  };
}

async function quickAdd(
  session,
  text,
  selectedMentions = [],
  teamMentions = [],
  ownershipSelection = null
) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[scheduleService] quickAdd_input_text:", text);
    console.log(
      "[scheduleService] quickAdd_selected_mentions:",
      JSON.stringify(
        (selectedMentions || []).map((mention) => ({
          user_id: mention.user_id,
          display_name: mention.display_name,
          nickname: mention.nickname,
        })),
        null,
        2
      )
    );
  }

  const { parsed, currentDateTime, timezone } = await parseScheduleText(text);
  parsed.sourceText = text;
  enrichParsedTargetEvent(parsed, text);

  if (process.env.NODE_ENV !== "production") {
    console.log("[scheduleService] quickAdd_final_action:", parsed.action);
    console.log(
      "[scheduleService] quickAdd_final_parsed:",
      JSON.stringify(parsed, null, 2)
    );
  }

  let payload;

  switch (parsed.action) {
    case "create_event":
      payload = await handleCreateEvent(
        session,
        parsed,
        selectedMentions,
        teamMentions
      );
      break;
    case "update_event_request":
      payload = await handleUpdateRequest(session, parsed);
      break;
    case "delete_event_request":
      payload = await handleDeleteRequest(session, parsed);
      break;
    case "self_event_split":
      payload = await handleSelfEventSplit(
        session,
        parsed,
        selectedMentions,
        ownershipSelection
      );
      break;
    case "self_attendance_change":
      payload = await handleSelfAttendanceChange(
        session,
        parsed,
        selectedMentions,
        ownershipSelection
      );
      break;
    case "personal_hide_or_delete":
      payload = await handlePersonalHideOrDelete(session, parsed);
      break;
    default:
      throw createHttpError(400, "지원하지 않는 일정 요청입니다.", { parsed });
  }

  return {
    ...payload,
    currentDateTime,
    timezone,
  };
}

async function quickAddLegacy(
  session,
  text,
  selectedMentions = [],
  teamMentions = [],
  ownershipSelection = null
) {
  return quickAdd(
    session,
    text,
    selectedMentions,
    teamMentions,
    ownershipSelection
  );
}

async function listActionItems(session) {
  const savedUser = await ensureSessionUser(session);
  const pendingDeleteApprovalTargets = await listPendingChangeRequestTargetsByUserId(
    savedUser.id
  );
  const allDeleteTargets = await listChangeRequestTargetsByUserId(savedUser.id);
  const pendingCreatorRequests = await listEventChangeRequestsByStatus(
    "pending_creator_review"
  );
  const creatorReviewRequests = [];
  const deleteApprovalTargets = [];
  const deleteNotifications = [];

  async function resolveRequester(request) {
    if (!request?.requester_user_id) {
      return null;
    }

    const userProfile = await getUserProfileById(request.requester_user_id).catch(() => null);

    if (!userProfile) {
      return null;
    }

    return {
      id: userProfile.id,
      name: userProfile.name || null,
      email: userProfile.email || null,
      profile_image: userProfile.profile_image || null,
    };
  }

  for (const request of pendingCreatorRequests) {
    // eslint-disable-next-line no-await-in-loop
    const event = await getEventById(request.event_id);
    // eslint-disable-next-line no-await-in-loop
    const requester = await resolveRequester(request);

    if (event?.creator_id === savedUser.id) {
      creatorReviewRequests.push({
        ...request,
        event,
        requester,
      });
    }
  }

  for (const target of pendingDeleteApprovalTargets) {
    // eslint-disable-next-line no-await-in-loop
    const request = await getEventChangeRequestById(target.request_id);
    // eslint-disable-next-line no-await-in-loop
    const event = request ? await getEventById(request.event_id) : null;

    deleteApprovalTargets.push({
      ...target,
      request,
      event,
    });
  }

  for (const target of allDeleteTargets) {
    if (target.dismissed_at) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const request = await getEventChangeRequestById(target.request_id);

    if (!request || request.request_type !== "delete_request") {
      continue;
    }

    if (request.request_status !== "completed") {
      continue;
    }

    if (target.decision_reason !== "Delete notice delivered automatically.") {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const event = await getEventById(request.event_id);

    deleteNotifications.push({
      ...target,
      request,
      event,
    });
  }

  return {
    success: true,
    creatorReviewRequests,
    deleteApprovalTargets,
    deleteNotifications,
  };
}

function isAutoDeliveredDeleteNotification(target, request, savedUserId) {
  return Boolean(
    target &&
      request &&
      target.target_user_id === savedUserId &&
      !target.dismissed_at &&
      request.request_type === "delete_request" &&
      request.request_status === "completed" &&
      target.decision_reason === "Delete notice delivered automatically."
  );
}

async function markDeleteNotificationsRead(session, targetIds = []) {
  const savedUser = await ensureSessionUser(session);
  const uniqueTargetIds = [...new Set((targetIds || []).filter(Boolean))];

  if (uniqueTargetIds.length === 0) {
    return {
      success: true,
      updatedTargetIds: [],
    };
  }

  const updatedTargetIds = [];

  for (const targetId of uniqueTargetIds) {
    // eslint-disable-next-line no-await-in-loop
    const target = await getEventChangeRequestTargetById(targetId);

    if (!target || target.read_at || target.dismissed_at) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const request = await getEventChangeRequestById(target.request_id);

    if (!isAutoDeliveredDeleteNotification(target, request, savedUser.id)) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await updateEventChangeRequestTarget(target.id, {
      read_at: new Date().toISOString(),
    });
    updatedTargetIds.push(target.id);
  }

  return {
    success: true,
    updatedTargetIds,
  };
}

async function dismissDeleteNotification(session, targetId) {
  const savedUser = await ensureSessionUser(session);
  const target = await getEventChangeRequestTargetById(targetId);

  if (!target) {
    throw createHttpError(404, "삭제 알림 대상을 찾지 못했습니다.");
  }

  const request = await getEventChangeRequestById(target.request_id);

  if (!isAutoDeliveredDeleteNotification(target, request, savedUser.id)) {
    throw createHttpError(403, "내 삭제 알림만 숨길 수 있습니다.");
  }

  const now = new Date().toISOString();
  const updatedTarget = await updateEventChangeRequestTarget(target.id, {
    read_at: target.read_at || now,
    dismissed_at: now,
  });

  return {
    success: true,
    message: "삭제 알림을 숨겼습니다.",
    target: updatedTarget,
  };
}

async function reviewUpdateProposal(session, requestId, decision, decisionReason = null) {
  const savedUser = await ensureSessionUser(session);
  const changeRequest = await getEventChangeRequestById(requestId);

  if (!changeRequest) {
    throw createHttpError(404, "변경 요청을 찾지 못했습니다.");
  }

  const targetEvent = await getEventById(changeRequest.event_id);

  if (!targetEvent || targetEvent.creator_id !== savedUser.id) {
    throw createHttpError(403, "이 제안은 일정 주최자만 검토할 수 있습니다.");
  }

  if (changeRequest.request_type !== "update_proposal") {
    throw createHttpError(400, "수정 제안이 아닌 요청입니다.");
  }

  if (changeRequest.request_status !== "pending_creator_review") {
    throw createHttpError(400, "이 수정 제안은 이미 처리되었습니다.");
  }

  if (!["approved", "rejected"].includes(decision)) {
    throw createHttpError(400, "처리 결과 값이 올바르지 않습니다.");
  }

  if (decision === "rejected") {
    const rejectedRequest = await updateEventChangeRequest(requestId, {
      request_status: "rejected",
      creator_decision_status: "rejected",
      creator_decision_reason: decisionReason,
      creator_decided_at: new Date().toISOString(),
      resolved_at: new Date().toISOString(),
    });

    return {
      success: true,
      message: "수정 제안을 반려했습니다.",
      changeRequest: rejectedRequest,
    };
  }

  const nextEvent = changeRequest.after_snapshot || {};
  const updatedEvent = await updateEvent({
    eventId: targetEvent.id,
    title: nextEvent.title,
    date: nextEvent.date,
    startTime: nextEvent.startTime,
    endTime: nextEvent.endTime,
    durationMinutes: nextEvent.durationMinutes,
    location: nextEvent.location,
    incrementVersion: true,
  });
  const participants = await getParticipantsByEventId(targetEvent.id);
  const syncResult = await patchCalendarEventsForAcceptedParticipants(
    participants,
    updatedEvent
  );
  const approvedRequest = await updateEventChangeRequest(requestId, {
    request_status: "completed",
    creator_decision_status: "approved",
    creator_decision_reason: decisionReason,
    creator_decided_at: new Date().toISOString(),
    resolved_at: new Date().toISOString(),
  });

  return {
    success: true,
    message: "수정 제안을 승인하고 일정에 반영했습니다.",
    changeRequest: approvedRequest,
    event: updatedEvent,
    syncResult,
  };
}

async function respondToDeleteRequest(session, targetId, decision, decisionReason = null) {
  const savedUser = await ensureSessionUser(session);
  const target = await getEventChangeRequestTargetById(targetId);

  if (!target) {
    throw createHttpError(404, "삭제 요청 대상을 찾지 못했습니다.");
  }

  if (target.target_user_id !== savedUser.id) {
    throw createHttpError(403, "내 삭제 요청에만 응답할 수 있습니다.");
  }

  if (!["accepted", "rejected"].includes(decision)) {
    throw createHttpError(400, "응답 값이 올바르지 않습니다.");
  }

  if (target.decision_status !== "pending") {
    throw createHttpError(400, "이 삭제 요청에는 이미 응답했습니다.");
  }

  const updatedTarget = await updateEventChangeRequestTarget(targetId, {
    decision_status: decision,
    decision_reason: decisionReason,
    decided_at: new Date().toISOString(),
  });
  const changeRequest = await getEventChangeRequestById(target.request_id);

  if (
    changeRequest?.request_type === "delete_request" &&
    changeRequest?.request_status === "completed" &&
    target.decision_reason === "Delete notice delivered automatically."
  ) {
    throw createHttpError(400, "이 삭제 알림은 별도 응답이 필요하지 않습니다.");
  }

  if (decision === "rejected") {
    const targetEvent = await getEventById(changeRequest.event_id);
    const rejectedRequest = await updateEventChangeRequest(changeRequest.id, {
      request_status: "rejected",
      resolved_at: new Date().toISOString(),
    });

    if (targetEvent?.lifecycle_status === "pending_delete") {
      await updateEvent({
        eventId: targetEvent.id,
        lifecycleStatus: "active",
      });
    }

    return {
      success: true,
      message: "삭제 요청을 거절했습니다.",
      target: updatedTarget,
      changeRequest: rejectedRequest,
    };
  }

  const targets = await getEventChangeRequestTargetsByRequestId(changeRequest.id);
  const allAccepted =
    targets.length > 0 && targets.every((item) => item.decision_status === "accepted");

  if (!allAccepted) {
    return {
      success: true,
      message: "삭제 요청을 수락했습니다. 다른 참여자의 응답을 기다리고 있습니다.",
      target: updatedTarget,
    };
  }

  const eventParticipants = await getParticipantsByEventId(changeRequest.event_id);
  const deleteSyncResult = await deleteCalendarEventsForAcceptedParticipants(
    eventParticipants
  );
  const deletedEvent = await markEventDeleted(changeRequest.event_id);
  const completedRequest = await updateEventChangeRequest(changeRequest.id, {
    request_status: "completed",
    resolved_at: new Date().toISOString(),
  });

  return {
    success: true,
    message: "공동 일정을 삭제했습니다.",
    target: updatedTarget,
    changeRequest: completedRequest,
    event: deletedEvent,
    syncResult: deleteSyncResult,
  };
}

module.exports = {
  dismissDeleteNotification,
  listActionItems,
  markDeleteNotificationsRead,
  quickAdd,
  quickAddLegacy,
  respondToDeleteRequest,
  reviewUpdateProposal,
};
