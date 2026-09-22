const assert = require("assert");
const { parseLucidQuery } = require("../services/lucidParser");

const NOW = new Date("2026-05-06T12:00:00+09:00");

const cases = [
  {
    input: "다음 달 일정 뭐야?",
    label: "다음 달",
    startDate: "2026-06-01",
    endDate: "2026-07-01",
  },
  {
    input: "6월 일정 뭐야?",
    label: "2026년 6월",
    startDate: "2026-06-01",
    endDate: "2026-07-01",
  },
  {
    input: "5월 셋째주 일정 뭐야?",
    label: "2026년 5월 셋째 주",
    startDate: "2026-05-11",
    endDate: "2026-05-18",
  },
  {
    input: "5월 6일 일정 뭐야?",
    label: "2026년 5월 6일",
    startDate: "2026-05-06",
    endDate: "2026-05-07",
  },
  {
    input: "글피 일정 뭐야?",
    label: "글피",
    startDate: "2026-05-09",
    endDate: "2026-05-10",
  },
  {
    input: "어제 일정 뭐야?",
    label: "어제",
    startDate: "2026-05-05",
    endDate: "2026-05-06",
  },
  {
    input: "다다음주 일정 뭐야?",
    label: "다다음 주",
    startDate: "2026-05-18",
    endDate: "2026-05-25",
    hasExplicitRange: true,
    hasCurrentDayReference: false,
  },
  {
    input: "오늘 일정 뭐야?",
    label: "오늘",
    startDate: "2026-05-06",
    endDate: "2026-05-07",
    hasExplicitRange: true,
    hasCurrentDayReference: true,
  },
  {
    input: "그저계 일정 뭐야?",
    label: "오늘",
    startDate: "2026-05-06",
    endDate: "2026-05-07",
    hasExplicitRange: false,
    hasCurrentDayReference: false,
  },
];

let failures = 0;

for (const testCase of cases) {
  try {
    const result = parseLucidQuery(testCase.input, { now: NOW });
    assert.strictEqual(result.action, "list_events");
    assert.strictEqual(result.range.label, testCase.label);
    assert.strictEqual(result.range.startDate, testCase.startDate);
    assert.strictEqual(result.range.endDate, testCase.endDate);
    assert.strictEqual(
      result.hasExplicitRange,
      testCase.hasExplicitRange ?? true
    );
    assert.strictEqual(
      result.hasCurrentDayReference,
      testCase.hasCurrentDayReference ?? false
    );
    console.log(`PASS lucidParser: ${testCase.input}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL lucidParser: ${testCase.input}`);
    console.error(error.message);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log("All lucid parser tests passed.");
}
