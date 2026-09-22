const assert = require("assert");
const {
  cleanSummaryCandidate,
  normalizeTimeValue,
} = require("../scheduleParser");
const {
  analyzeScheduleSlots,
  buildSummaryCandidates,
} = require("../utils/scheduleText");

const summaryCases = [
  {
    name: "removes location prefix and trailing verb",
    input: {
      summary: "\uC6D0\uC8FC\uC5D0\uC11C \uBC25 \uBA39\uC744\uAC70\uC57C",
      location: "\uC6D0\uC8FC",
    },
    expected: "\uBC25",
  },
  {
    name: "removes object particle",
    input: {
      summary: "\uBC25\uC744",
      location: null,
    },
    expected: "\uBC25",
  },
  {
    name: "removes topic particle",
    input: {
      summary: "\uD68C\uC758\uB294",
      location: null,
    },
    expected: "\uD68C\uC758",
  },
  {
    name: "keeps bare noun phrase",
    input: {
      summary: "\uD504\uB85C\uC81D\uD2B8 \uD68C\uC758",
      location: "\uAC15\uB0A8",
    },
    expected: "\uD504\uB85C\uC81D\uD2B8 \uD68C\uC758",
  },
  {
    name: "removes leading location token",
    input: {
      summary: "\uAC15\uB0A8 \uD68C\uC758",
      location: "\uAC15\uB0A8",
    },
    expected: "\uD68C\uC758",
  },
  {
    name: "removes trailing action token",
    input: {
      summary: "\uC810\uC2EC \uBA39\uC790",
      location: null,
    },
    expected: "\uC810\uC2EC",
  },
];

const candidateCases = [
  {
    name: "keeps specific title over generic schedule word",
    input: {
      sourceText: "\uB3D9\uC544\uB9AC \uC77C\uC815 \uBCC0\uACBD\uD574\uC918",
    },
    expected: ["\uB3D9\uC544\uB9AC \uC77C\uC815", "\uB3D9\uC544\uB9AC"],
    forbidden: ["\uC77C\uC815"],
  },
  {
    name: "keeps generic word when it is the whole title",
    input: {
      sourceText: "\uC77C\uC815 \uBCC0\uACBD\uD574\uC918",
    },
    expected: ["\uC77C\uC815"],
  },
  {
    name: "extracts summary from location and action sentence",
    input: {
      sourceText: "3\uC2DC \uC6D0\uC8FC\uC5D0\uC11C \uBC25 \uBA39\uC744\uAC70\uC57C",
      location: "\uC6D0\uC8FC",
    },
    expected: ["\uBC25"],
    forbidden: ["\uC6D0\uC8FC", "\uBA39\uC744\uAC70\uC57C"],
  },
  {
    name: "falls back from eat verb to meal title when noun is missing",
    input: {
      sourceText: "\uB0B4\uC77C 6\uC2DC\uC5D0 \uBA39\uC744\uAC70\uC57C",
    },
    expected: ["\uBC25"],
  },
  {
    name: "falls back from work verb to business title when noun is missing",
    input: {
      sourceText: "\uB0B4\uC77C 6\uC2DC\uC5D0 \uC77C\uD560 \uAC70\uB2C8\uAE4C \uC54C\uC544\uC11C \uC798 \uC7A1\uC544",
    },
    expected: ["\uC5C5\uBB34"],
    forbidden: ["\uC77C"],
  },
  {
    name: "keeps explicit noun title over work fallback",
    input: {
      sourceText: "\uB0B4\uC77C 6\uC2DC\uC5D0 \uD504\uB85C\uC81D\uD2B8 \uC77C\uD560 \uAC70\uC57C",
    },
    expected: ["\uD504\uB85C\uC81D\uD2B8"],
    forbidden: ["\uC5C5\uBB34"],
  },
  {
    name: "falls back from sleep verb to sleep title when noun is missing",
    input: {
      sourceText: "\uC624\uB298 \uC77C\uCC0D \uC790\uC57C\uC9C0",
    },
    expected: ["\uC218\uBA74"],
  },
  {
    name: "falls back from hospital verb to hospital title when noun is missing",
    input: {
      sourceText: "\uB0B4\uC77C \uBCD1\uC6D0\uAC00\uC57C \uD574",
    },
    expected: ["\uBCD1\uC6D0"],
  },
];

const timeCases = [
  {
    name: "normalizes afternoon hour",
    input: "\uC624\uD6C4 3\uC2DC",
    expected: "15:00",
  },
  {
    name: "normalizes morning half hour",
    input: "\uC624\uC804 9\uC2DC \uBC18",
    expected: "09:30",
  },
  {
    name: "normalizes noon",
    input: "\uC815\uC624",
    expected: "12:00",
  },
];

const slotCases = [
  {
    name: "parses explicit time range without 까지",
    input: "3\uC2DC\uC5D0\uC11C 5\uC2DC",
    expected: {
      startTimeHint: "03:00",
      endTimeHint: "05:00",
      locationHint: null,
    },
  },
  {
    name: "parses time range and later numeric location",
    input: "3\uC2DC\uC5D0\uC11C5\uC2DC\uAE4C\uC9C0 3\uC2DC\uC5D0\uC11C \uC2A4\uCF00\uC904 \uC788\uC5B4",
    expected: {
      startTimeHint: "03:00",
      endTimeHint: "05:00",
      locationHint: "3\uC2DC",
    },
  },
  {
    name: "distinguishes time then numeric location",
    input: "3\uC2DC\uC5D0 3\uC2DC\uC5D0\uC11C \uD68C\uC758\uAC00 \uC788\uC5B4",
    expected: {
      startTimeHint: "03:00",
      endTimeHint: null,
      locationHint: "3\uC2DC",
    },
  },
  {
    name: "distinguishes numeric location then time",
    input: "3\uC2DC\uC5D0\uC11C 3\uC2DC\uC5D0 \uD68C\uC758",
    expected: {
      startTimeHint: "03:00",
      endTimeHint: null,
      locationHint: "3\uC2DC",
    },
  },
];

let failures = 0;

for (const testCase of summaryCases) {
  try {
    const actual = cleanSummaryCandidate(
      testCase.input.summary,
      testCase.input.location
    );
    assert.strictEqual(actual, testCase.expected);
    console.log(`PASS cleanSummaryCandidate: ${testCase.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL cleanSummaryCandidate: ${testCase.name}`);
    console.error(error.message);
  }
}

for (const testCase of candidateCases) {
  try {
    const actual = buildSummaryCandidates(testCase.input);

    for (const expected of testCase.expected) {
      assert.ok(
        actual.includes(expected),
        `Expected candidates to include "${expected}", got ${JSON.stringify(actual)}`
      );
    }

    for (const forbidden of testCase.forbidden || []) {
      assert.ok(
        !actual.includes(forbidden),
        `Expected candidates to exclude "${forbidden}", got ${JSON.stringify(actual)}`
      );
    }

    console.log(`PASS buildSummaryCandidates: ${testCase.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL buildSummaryCandidates: ${testCase.name}`);
    console.error(error.message);
  }
}

for (const testCase of timeCases) {
  try {
    const actual = normalizeTimeValue(testCase.input);
    assert.strictEqual(actual, testCase.expected);
    console.log(`PASS normalizeTimeValue: ${testCase.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL normalizeTimeValue: ${testCase.name}`);
    console.error(error.message);
  }
}

for (const testCase of slotCases) {
  try {
    const actual = analyzeScheduleSlots(testCase.input, normalizeTimeValue);
    assert.strictEqual(actual.startTimeHint, testCase.expected.startTimeHint);
    assert.strictEqual(actual.endTimeHint, testCase.expected.endTimeHint);
    assert.strictEqual(actual.locationHint, testCase.expected.locationHint);
    console.log(`PASS analyzeScheduleSlots: ${testCase.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL analyzeScheduleSlots: ${testCase.name}`);
    console.error(error.message);
  }
}

if (failures > 0) {
  process.exitCode = 1;
  console.error(`\n${failures} test case(s) failed.`);
} else {
  console.log("\nAll schedule normalization tests passed.");
}
