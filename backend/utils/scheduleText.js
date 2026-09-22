const PUNCTUATION_REGEX = /[.,!?()[\]{}\\/|:_\-"'`~]+/g;
const WHITESPACE_REGEX = /\s+/g;
const MENTION_REGEX = /@[^\s,]+/g;

const PARTICLES = [
  "\uC5D0\uC11C",
  "\uC73C\uB85C",
  "\uC5D0\uAC8C",
  "\uD55C\uD14C",
  "\uBD80\uD130",
  "\uAE4C\uC9C0",
  "\uCC98\uB7FC",
  "\uD558\uACE0",
  "\uC640",
  "\uACFC",
  "\uC740",
  "\uB294",
  "\uC774",
  "\uAC00",
  "\uC744",
  "\uB97C",
  "\uC5D0",
  "\uB85C",
  "\uB3C4",
];

const LOCATION_PARTICLES = [
  "\uC5D0\uC11C",
  "\uC73C\uB85C",
  "\uC5D0",
  "\uB85C",
];

const WEAK_SCHEDULE_WORDS = new Set([
  "\uC77C\uC815",
  "\uC2A4\uCF00\uC904",
  "\uC57D\uC18D",
  "\uC774\uBCA4\uD2B8",
  "\uBAA8\uC784",
]);

const TRAILING_VERB_TOKENS = new Set([
  "\uD558\uB2E4",
  "\uD558\uAE30",
  "\uD558\uC790",
  "\uD560\uB798",
  "\uD560\uAC8C",
  "\uD560\uAC70\uC57C",
  "\uD574",
  "\uD574\uC694",
  "\uBA39\uB2E4",
  "\uBA39\uC5B4",
  "\uBA39\uC5B4\uC694",
  "\uBA39\uC790",
  "\uBA39\uC744\uB798",
  "\uBA39\uC744\uAC70\uC57C",
  "\uAC00\uB2E4",
  "\uAC00\uC790",
  "\uAC08\uB798",
  "\uAC08\uAC70\uC57C",
  "\uAC00\uC694",
  "\uBCF4\uB2E4",
  "\uBCF4\uC790",
  "\uBCFC\uB798",
  "\uBCFC\uAC70\uC57C",
  "\uBD10",
  "\uBD10\uC694",
  "\uB9CC\uB098\uB2E4",
  "\uB9CC\uB098\uC790",
  "\uB9CC\uB0A0\uB798",
  "\uB9CC\uB0A0\uAC70\uC57C",
  "\uB9CC\uB098",
  "\uB9CC\uB098\uC694",
]);

const ACTION_TOKENS = new Set([
  "\uBCC0\uACBD",
  "\uBCC0\uACBD\uD574",
  "\uBCC0\uACBD\uD574\uC918",
  "\uC218\uC815",
  "\uC218\uC815\uD574",
  "\uC218\uC815\uD574\uC918",
  "\uC0AD\uC81C",
  "\uC0AD\uC81C\uD574",
  "\uC0AD\uC81C\uD574\uC918",
  "\uCDE8\uC18C",
  "\uCDE8\uC18C\uD574",
  "\uCDE8\uC18C\uD574\uC918",
  "\uC7A1\uC544\uC918",
  "\uB9CC\uB4E4\uC5B4\uC918",
  "\uB4F1\uB85D\uD574\uC918",
  "\uCD94\uAC00\uD574\uC918",
  "\uC62E\uAE68\uC918",
  "\uBBF8\uB8E8\uC918",
  "\uBE7C\uC918",
]);

const TIME_LOCATION_PARTICLES = ["\uC5D0\uC11C", "\uBD80\uD130"];
const TIME_POINT_PARTICLES = ["\uC5D0"];
const RANGE_END_PARTICLES = ["\uAE4C\uC9C0"];

const COMMON_EVENT_TITLES = [
  "\uD68C\uC758",
  "\uD504\uB85C\uC81D\uD2B8 \uD68C\uC758",
  "\uBA74\uB2F4",
  "\uC0C1\uB2F4",
  "\uC778\uD130\uBDF0",
  "\uD1B5\uD654",
  "\uBBF8\uD305",
  "\uC2A4\uD130\uB514",
  "\uC810\uC2EC",
  "\uC800\uB141",
  "\uC2DD\uC0AC",
];

const NOISE_TOKENS = new Set([
  "\uC624\uB298",
  "\uB0B4\uC77C",
  "\uB0BC",
  "\uBAA8\uB808",
  "\uAE00\uD53C",
  "\uC5B4\uC81C",
  "\uC774\uBC88\uC8FC",
  "\uB2E4\uC74C\uC8FC",
  "\uC624\uC804",
  "\uC624\uD6C4",
  "\uAC70",
  "\uAC70\uC57C",
  "\uAC70\uB2C8\uAE4C",
  "\uB2C8\uAE4C",
  "\uAC83",
  "\uAC83\uAC19\uC740\uB370",
  "\uC54C\uC544\uC11C",
  "\uC798",
  "\uC880",
  "\uADF8\uB0E5",
  "\uB300\uCDA9",
  "\uC815\uB3C4",
  "\uCBE4",
  "\uC77C\uCC0D",
  "\uC5D0",
  "\uC788\uC5B4",
  "\uC788\uC744",
  "\uC788\uC744\uAC70\uC57C",
  "\uC788\uC744\uAC83",
  "\uAC19\uC740\uB370",
]);

const VERB_FORM_SUFFIX_PATTERNS = [
  /\uD558(?:\uC57C|\uC57C\uC9C0|\uACA0|\uACE0|\uB294|\uACE0\uC2F6)/,
  /\uD560(?:\uAC70\uC57C|\uB798|\uAC8C|\uAC70\uB2C8\uAE4C)?$/,
  /\uBA39(?:\uC5B4|\uC790|\uC744\uAC70\uC57C|\uC744\uB798|\uACE0\uC2F6)$/,
  /\uAC00(?:\uC57C|\uC57C\uC9C0|\uC790|\uB294|)$/ ,
  /\uAC08(?:\uAC70\uC57C|\uB798)?$/,
  /\uC790(?:\uC57C|\uC57C\uC9C0|\uACE0)$/,
  /\uBCF4(?:\uC790|\uC790|\uACE0\uC2F6|\uC57C)$/,
  /\uB9CC\uB098(?:\uC790|\uC57C|\uACE0)$/,
  /\uC788(?:\uC5B4|\uC744|\uC744\uAC70\uC57C)$/,
];

const VERB_FALLBACK_SUMMARY_RULES = [
  {
    summary: "\uBC25",
    stems: ["\uBA39", "\uC2DD\uC0AC\uD558", "\uBC25\uBA39"],
  },
  {
    summary: "\uC5C5\uBB34",
    stems: [
      "\uC77C\uD558",
      "\uC77C\uD560",
      "\uC77C\uD790",
      "\uADFC\uBB34\uD558",
      "\uCD9C\uADFC\uD558",
      "\uC5C5\uBB34\uD558",
    ],
  },
  {
    summary: "\uACF5\uBD80",
    stems: ["\uACF5\uBD80\uD558", "\uACF5\uBD80\uD560"],
  },
  {
    summary: "\uC6B4\uB3D9",
    stems: ["\uC6B4\uB3D9\uD558", "\uC6B4\uB3D9\uD560"],
  },
  {
    summary: "\uD68C\uC758",
    stems: ["\uD68C\uC758\uD558", "\uBBF8\uD305\uD558", "\uB17C\uC758\uD558"],
  },
  {
    summary: "\uB9CC\uB0A8",
    stems: ["\uB9CC\uB098", "\uB9CC\uB0A0"],
  },
  {
    summary: "\uD1B5\uD654",
    stems: ["\uD1B5\uD654\uD558", "\uC804\uD654\uD558", "\uC5F0\uB77D\uD558"],
  },
  {
    summary: "\uC0C1\uB2F4",
    stems: ["\uC0C1\uB2F4\uD558", "\uC0C1\uB2F4\uD560"],
  },
  {
    summary: "\uBCD1\uC6D0",
    stems: ["\uBCD1\uC6D0\uAC00", "\uC9C4\uB8CC\uBC1B", "\uC9C4\uB8CC\uD558"],
  },
  {
    summary: "\uC218\uBA74",
    stems: ["\uC790", "\uC798", "\uC218\uBA74\uD558"],
  },
  {
    summary: "\uC7A5\uBCF4\uAE30",
    stems: ["\uC7A5\uBCF4\uBCF4", "\uC1FC\uD551\uD558", "\uAD6C\uB9E4\uD558"],
  },
  {
    summary: "\uC774\uB3D9",
    stems: ["\uC774\uB3D9\uD558", "\uAC00", "\uAC08"],
  },
];

function normalizeWhitespace(text) {
  return String(text || "").replace(WHITESPACE_REGEX, " ").trim();
}

function stripTrailingParticle(token) {
  let current = String(token || "").trim();

  for (const particle of PARTICLES) {
    if (current.length > particle.length && current.endsWith(particle)) {
      current = current.slice(0, -particle.length).trim();
      break;
    }
  }

  return current;
}

function stripLocationParticle(token) {
  let current = String(token || "").trim();

  for (const particle of LOCATION_PARTICLES) {
    if (current.length > particle.length && current.endsWith(particle)) {
      return current.slice(0, -particle.length).trim();
    }
  }

  return current;
}

function hasLocationParticle(token) {
  const value = String(token || "").trim();
  return LOCATION_PARTICLES.some(
    (particle) => value.length > particle.length && value.endsWith(particle)
  );
}

function normalizeSearchText(text) {
  return normalizeWhitespace(String(text || "").replace(PUNCTUATION_REGEX, " "))
    .split(/\s+/)
    .map((token) => stripTrailingParticle(token))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function tokenizeSearchText(text) {
  return normalizeSearchText(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function isWeakScheduleWord(token) {
  const stripped = stripTrailingParticle(token);
  return WEAK_SCHEDULE_WORDS.has(stripped);
}

function isLikelyTrailingVerbToken(token) {
  const stripped = stripTrailingParticle(token);
  return TRAILING_VERB_TOKENS.has(stripped);
}

function isActionToken(token) {
  const stripped = stripTrailingParticle(token);
  return ACTION_TOKENS.has(stripped);
}

function isIgnorableSummaryToken(token) {
  const stripped = stripTrailingParticle(token);
  return NOISE_TOKENS.has(stripped);
}

function isLikelyVerbFormToken(token) {
  const stripped = stripTrailingParticle(token);

  if (isLikelyTrailingVerbToken(stripped)) {
    return true;
  }

  if (VERB_FORM_SUFFIX_PATTERNS.some((pattern) => pattern.test(stripped))) {
    return true;
  }

  return (
    /(?:\uD558|\uD560|\uD790|\uBA39|\uAC08|\uBCFC|\uB9CC\uB0A0|\uC7A1|\uC788)\S*$/.test(
      stripped
    ) &&
    stripped.length >= 2
  );
}

function matchesVerbStem(token, stem) {
  const normalizedToken = String(token || "").trim();
  const normalizedStem = String(stem || "").trim();

  if (!normalizedToken || !normalizedStem) {
    return false;
  }

  return (
    normalizedToken === normalizedStem ||
    normalizedToken.startsWith(normalizedStem)
  );
}

function stripLeadingLocationFromSummary(summary, location) {
  const value = normalizeWhitespace(summary);
  const normalizedLocation = normalizeSearchText(location);

  if (!value || !normalizedLocation) {
    return value;
  }

  const locationPrefixes = [
    location,
    `${location}\uC5D0\uC11C`,
    `${location}\uC5D0`,
    `${location}\uC73C\uB85C`,
    `${location}\uB85C`,
  ]
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);

  for (const prefix of locationPrefixes) {
    if (value.startsWith(`${prefix} `)) {
      return value.slice(prefix.length).trim();
    }
  }

  const tokens = value.split(/\s+/).filter(Boolean);

  if (tokens.length > 1) {
    const firstToken = stripTrailingParticle(tokens[0]);

    if (normalizeSearchText(firstToken) === normalizedLocation) {
      return tokens.slice(1).join(" ").trim();
    }
  }

  return value;
}

function cleanSummaryCandidate(summary, location) {
  let value = normalizeWhitespace(String(summary || "").replace(PUNCTUATION_REGEX, " "));

  if (!value) {
    return null;
  }

  value = stripLeadingLocationFromSummary(value, location);

  let tokens = value.split(/\s+/).filter(Boolean);

  while (tokens.length > 1 && isLikelyTrailingVerbToken(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  tokens = tokens.map((token) => stripTrailingParticle(token)).filter(Boolean);

  return tokens.join(" ").trim() || null;
}

function removeTimeExpressions(text) {
  return String(text || "")
    .replace(
      /(?:\uC624\uC804|\uC624\uD6C4)\s*\d{1,2}(?::\d{2})?/g,
      " "
    )
    .replace(
      /(?:\uC624\uC804|\uC624\uD6C4)?\s*\d{1,2}\s*\uC2DC(?:\s*\d{1,2}\s*\uBD84)?(?:\s*\uBC18)?/g,
      " "
    )
    .replace(/\d{1,2}:\d{2}/g, " ")
    .replace(/\b(?:\uC815\uC624|\uC790\uC815)\b/g, " ");
}

function tokenizeSummarySource(text) {
  return normalizeWhitespace(
    removeTimeExpressions(String(text || "").replace(MENTION_REGEX, " ").replace(PUNCTUATION_REGEX, " "))
  )
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function addCandidate(set, candidate) {
  const value = normalizeWhitespace(candidate);
  if (value) {
    set.add(value);
  }
}

function stripKnownSuffix(token, suffixes) {
  const value = String(token || "").trim();

  for (const suffix of suffixes) {
    if (value.length > suffix.length && value.endsWith(suffix)) {
      return {
        base: value.slice(0, -suffix.length).trim(),
        suffix,
      };
    }
  }

  return {
    base: value,
    suffix: null,
  };
}

function isNormalizedTimeValue(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
}

function isTokenTimeLike(token, normalizeTimeValue) {
  if (typeof normalizeTimeValue !== "function") {
    return false;
  }

  const candidates = [
    stripKnownSuffix(token, [...TIME_LOCATION_PARTICLES, ...TIME_POINT_PARTICLES, ...RANGE_END_PARTICLES]).base,
    stripTrailingParticle(token),
    token,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return candidates.some((candidate) =>
    isNormalizedTimeValue(normalizeTimeValue(candidate))
  );
}

function normalizeTokenTime(token, normalizeTimeValue) {
  if (typeof normalizeTimeValue !== "function") {
    return null;
  }

  const stripped = stripKnownSuffix(
    token,
    [...TIME_LOCATION_PARTICLES, ...TIME_POINT_PARTICLES, ...RANGE_END_PARTICLES]
  ).base;
  const normalized = normalizeTimeValue(stripped);

  return isNormalizedTimeValue(normalized) ? normalized : null;
}

function analyzeScheduleSlots(text, normalizeTimeValue) {
  const normalizedInput = normalizeWhitespace(String(text || ""))
    .replace(/(\d{1,2}\s*\uC2DC)(\uC5D0\uC11C|\uBD80\uD130)(\d{1,2}\s*\uC2DC)/g, "$1$2 $3")
    .replace(/(\d{1,2}:\d{2})(\uC5D0\uC11C|\uBD80\uD130)(\d{1,2}:\d{2})/g, "$1$2 $3");
  const tokens = normalizedInput
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const consumedIndexes = new Set();
  const locationCandidates = [];
  let startTimeHint = null;
  let endTimeHint = null;
  let detectedTimeRange = false;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const nextToken = tokens[index + 1] || null;
    const { base: rangeBase, suffix: rangeSuffix } = stripKnownSuffix(
      token,
      TIME_LOCATION_PARTICLES
    );

    if (
      rangeSuffix &&
      isTokenTimeLike(rangeBase, normalizeTimeValue) &&
      nextToken
    ) {
      const nextPointInfo = stripKnownSuffix(nextToken, TIME_POINT_PARTICLES);
      const nextTime =
        nextPointInfo.suffix === null
          ? normalizeTokenTime(nextToken, normalizeTimeValue)
          : null;
      const nextSuffixInfo = stripKnownSuffix(nextToken, RANGE_END_PARTICLES);
      const nextLooksLikeRangeEnd =
        nextTime ||
        (nextSuffixInfo.suffix &&
          isTokenTimeLike(nextSuffixInfo.base, normalizeTimeValue));

      if (nextLooksLikeRangeEnd) {
        startTimeHint = startTimeHint || normalizeTokenTime(rangeBase, normalizeTimeValue);
        endTimeHint =
          endTimeHint ||
          normalizeTokenTime(
            nextSuffixInfo.suffix ? nextSuffixInfo.base : nextToken,
            normalizeTimeValue
          );
        consumedIndexes.add(index);
        consumedIndexes.add(index + 1);
        detectedTimeRange = true;
        index += 1;
        continue;
      }
    }

    const { base: pointBase, suffix: pointSuffix } = stripKnownSuffix(
      token,
      TIME_POINT_PARTICLES
    );

    if (
      pointSuffix &&
      isTokenTimeLike(pointBase, normalizeTimeValue) &&
      !startTimeHint
    ) {
      startTimeHint = normalizeTokenTime(pointBase, normalizeTimeValue);
      consumedIndexes.add(index);
      continue;
    }

    const { base: locationBase, suffix: locationSuffix } = stripKnownSuffix(
      token,
      LOCATION_PARTICLES
    );

    if (!locationSuffix || !locationBase) {
      continue;
    }

    const locationIsTimeLike = isTokenTimeLike(locationBase, normalizeTimeValue);

    if (locationSuffix === "\uC5D0" && locationIsTimeLike) {
      continue;
    }

    if (
      locationSuffix === "\uC5D0\uC11C" &&
      locationIsTimeLike &&
      nextToken &&
      isTokenTimeLike(nextToken, normalizeTimeValue) &&
      stripKnownSuffix(nextToken, TIME_POINT_PARTICLES).suffix === null
    ) {
      continue;
    }

    locationCandidates.push(locationBase);
    consumedIndexes.add(index);
  }

  const summarySourceText = tokens
    .filter((_, index) => !consumedIndexes.has(index))
    .join(" ");

  return {
    startTimeHint,
    endTimeHint,
    locationHint: locationCandidates[0] || null,
    locationCandidates,
    summarySourceText,
    detectedTimeRange,
  };
}

function expandCandidateVariants(set, candidate) {
  const cleaned = cleanSummaryCandidate(candidate, null);

  if (!cleaned) {
    return;
  }

  addCandidate(set, cleaned);

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const strongTokens = tokens.filter((token) => !isWeakScheduleWord(token));

  if (strongTokens.length > 0 && strongTokens.length < tokens.length) {
    addCandidate(set, strongTokens.join(" "));
  }
}

function inferSummaryCandidatesFromText(text, location = null) {
  const tokens = tokenizeSummarySource(text)
    .filter((token) => !isActionToken(token))
    .filter((token) => !hasLocationParticle(token))
    .filter((token) => !isIgnorableSummaryToken(token));

  while (tokens.length > 1 && isLikelyTrailingVerbToken(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  const cleanedTokens = tokens
    .map((token) => stripTrailingParticle(token))
    .filter((token) => !isIgnorableSummaryToken(token))
    .filter((token) => !isLikelyVerbFormToken(token))
    .filter(Boolean);

  const candidates = new Set();

  if (cleanedTokens.length > 0) {
    expandCandidateVariants(candidates, cleanedTokens.join(" "));
  }

  for (const title of COMMON_EVENT_TITLES) {
    if (normalizeWhitespace(text).includes(title)) {
      expandCandidateVariants(candidates, title);
    }
  }

  const filteredCandidates = [...candidates].map((candidate) =>
    cleanSummaryCandidate(candidate, location)
  );

  return [...new Set(filteredCandidates.filter(Boolean))];
}

function inferFallbackSummaryFromVerbTokens(text) {
  const normalizedTokens = tokenizeSummarySource(text)
    .map((token) => stripTrailingParticle(token))
    .filter(Boolean);

  for (const token of normalizedTokens) {
    for (const rule of VERB_FALLBACK_SUMMARY_RULES) {
      if ((rule.stems || []).some((stem) => matchesVerbStem(token, stem))) {
        return rule.summary;
      }
    }
  }

  return null;
}

function buildSummaryCandidates({ summary = null, sourceText = null, location = null } = {}) {
  const candidates = new Set();

  if (summary) {
    expandCandidateVariants(candidates, summary);
  }

  if (sourceText) {
    for (const candidate of inferSummaryCandidatesFromText(sourceText, location)) {
      expandCandidateVariants(candidates, candidate);
    }
  }

  const normalizedCandidates = [...candidates]
    .map((candidate) => cleanSummaryCandidate(candidate, location))
    .filter(Boolean);

  const hasStrongCandidate = normalizedCandidates.some((candidate) =>
    candidate
      .split(/\s+/)
      .map((token) => stripTrailingParticle(token))
      .some((token) => token && !isWeakScheduleWord(token))
  );

  const filteredCandidates = hasStrongCandidate
    ? normalizedCandidates.filter((candidate) =>
        candidate
          .split(/\s+/)
          .map((token) => stripTrailingParticle(token))
          .some((token) => token && !isWeakScheduleWord(token))
      )
    : normalizedCandidates;

  const finalCandidates = [...new Set(filteredCandidates)];

  if (finalCandidates.length === 0 && sourceText) {
    const fallbackSummary = inferFallbackSummaryFromVerbTokens(sourceText);

    if (fallbackSummary) {
      return [fallbackSummary];
    }
  }

  return finalCandidates;
}

module.exports = {
  analyzeScheduleSlots,
  buildSummaryCandidates,
  cleanSummaryCandidate,
  hasLocationParticle,
  inferSummaryCandidatesFromText,
  isLikelyTrailingVerbToken,
  isWeakScheduleWord,
  normalizeSearchText,
  normalizeWhitespace,
  stripLocationParticle,
  stripTrailingParticle,
  tokenizeSearchText,
};
