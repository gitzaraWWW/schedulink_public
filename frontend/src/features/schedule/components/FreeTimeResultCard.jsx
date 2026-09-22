import WeeklyCalendarPreview from "../../lucid/components/WeeklyCalendarPreview";

function CalendarOutlineIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <rect x="4.5" y="6.5" width="15" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M8 4.75v3M16 4.75v3M4.5 10.5h15"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function parseDateKey(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateTitle(dateKey) {
  const parsedDate = parseDateKey(dateKey);

  if (!parsedDate) {
    return dateKey || "";
  }

  const day = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  }).format(parsedDate);
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
  }).format(parsedDate);

  return `${day} (${weekday})`;
}

function getDayOffset(baseDateKey, valueDateKey) {
  const baseDate = parseDateKey(baseDateKey);
  const valueDate = parseDateKey(valueDateKey);

  if (!baseDate || !valueDate) {
    return 0;
  }

  return Math.round((valueDate.getTime() - baseDate.getTime()) / 86400000);
}

function formatTimelineTime(value, baseDateKey = null) {
  const match = String(value || "").match(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);

  if (!match) {
    return "";
  }

  const dayOffset = baseDateKey ? getDayOffset(baseDateKey, match[1]) : 0;
  const hour = Number(match[2]) + dayOffset * 24;
  const minute = Number(match[3]);

  return `${pad(hour)}:${pad(minute)}`;
}

function formatDurationLabel(durationMinutes) {
  const totalMinutes = Number(durationMinutes || 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  if (hours > 0) {
    return `${hours}시간`;
  }

  return `${minutes}분`;
}

function buildSummaryItems(freeSlots = []) {
  return freeSlots.slice(0, 4).map((slot, index) => ({
    id: `${slot.date}-${slot.start}-${index}`,
    rank: index + 1,
    title: formatDateTitle(slot.date),
    timeRangeLabel: `${formatTimelineTime(slot.start, slot.date)} - ${formatTimelineTime(
      slot.end,
      slot.date
    )}`,
    durationLabel: formatDurationLabel(slot.durationMinutes),
  }));
}

function SummaryCard({ item }) {
  return (
    <div className="free-time-result__summary-item">
      <div className="free-time-result__summary-rank">{item.rank}</div>
      <div className="free-time-result__summary-copy">
        <strong>{item.title}</strong>
        <span>{item.timeRangeLabel}</span>
      </div>
      <div className="free-time-result__summary-badge">{item.durationLabel}</div>
    </div>
  );
}

function FreeTimeResultCard({ lucid }) {
  const events = Array.isArray(lucid?.events) ? lucid.events : [];
  const freeSlots = Array.isArray(lucid?.freeSlots) ? lucid.freeSlots : [];
  const summaryItems = buildSummaryItems(freeSlots);

  return (
    <div className="free-time-result">
      <section className="free-time-result__section">
        <header className="free-time-result__section-header">
          <CalendarOutlineIcon />
          <strong>빈 시간 요약</strong>
        </header>
        <div className="free-time-result__summary-list">
          {summaryItems.length > 0 ? (
            summaryItems.map((item) => <SummaryCard key={item.id} item={item} />)
          ) : (
            <div className="free-time-result__empty">조건에 맞는 빈 시간이 없습니다.</div>
          )}
        </div>
      </section>

      <section className="free-time-result__section">
        <header className="free-time-result__section-header is-chart">
          <strong>주간 한눈에 보기</strong>
        </header>
        <div className="free-time-result__chart">
          <WeeklyCalendarPreview
            events={events}
            freeSlots={freeSlots}
            range={lucid?.range}
            constraints={lucid?.constraints}
            action={lucid?.action}
            embedded
          />
        </div>
        <div className="free-time-result__legend">
          <span className="free-time-result__legend-item">
            <span className="free-time-result__legend-swatch is-free" />
            60분 이상 비는 시간
          </span>
          <span className="free-time-result__legend-item">
            <span className="free-time-result__legend-swatch is-busy" />
            일정 있음
          </span>
        </div>
      </section>
    </div>
  );
}

export default FreeTimeResultCard;
