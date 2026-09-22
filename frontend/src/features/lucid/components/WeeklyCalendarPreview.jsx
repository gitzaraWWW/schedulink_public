const SLOT_MINUTES = 360;
const SLOT_HEIGHT = 56;
const DEFAULT_DISPLAY_START = "00:00";
const DEFAULT_DISPLAY_END = "24:00";
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const dayNumberFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
});
const weekdayFormatter = new Intl.DateTimeFormat("ko-KR", {
  weekday: "short",
});

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

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(dateKey, amount) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return dateKey;
  }

  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function getRangeDayCount(range) {
  const startDate = parseDateKey(range?.startDate);
  const endDate = parseDateKey(range?.endDate);

  if (!startDate || !endDate) {
    return 0;
  }

  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
}

function getDateKeys(range) {
  if (!range?.startDate || !range?.endDate) {
    return [];
  }

  const dateKeys = [];
  let currentDate = range.startDate;

  while (currentDate < range.endDate && dateKeys.length < 7) {
    dateKeys.push(currentDate);
    currentDate = addDays(currentDate, 1);
  }

  return dateKeys;
}

function isMonthLikeRange(range) {
  return getRangeDayCount(range) > 7;
}

function timeToMinutes(timeText) {
  const [hours, minutes] = String(timeText || "00:00").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function getDayOffset(baseDateKey, valueDateKey) {
  const baseDate = parseDateKey(baseDateKey);
  const valueDate = parseDateKey(valueDateKey);

  if (!baseDate || !valueDate) {
    return 0;
  }

  return Math.round((valueDate.getTime() - baseDate.getTime()) / 86400000);
}

function dateTimeToMinutes(value, baseDateKey = null) {
  const match = String(value || "").match(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);

  if (match) {
    const dayOffset = baseDateKey ? getDayOffset(baseDateKey, match[1]) : 0;
    return dayOffset * 1440 + Number(match[2]) * 60 + Number(match[3]);
  }

  return null;
}

function formatDayHeaderParts(dateKey) {
  const parsedDate = parseDateKey(dateKey);

  if (!parsedDate) {
    return {
      day: dateKey,
      weekday: "",
    };
  }

  return {
    day: dayNumberFormatter.format(parsedDate),
    weekday: weekdayFormatter.format(parsedDate),
  };
}

function formatTimelineMinute(minute) {
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

function formatBlockTime(value, baseDateKey = null) {
  const minute = dateTimeToMinutes(value, baseDateKey);

  if (minute === null) {
    return "";
  }

  return formatTimelineMinute(minute);
}

function formatMonthEventLabel(event) {
  const title = event?.title || "일정";

  if (event?.allDay || /^\d{4}-\d{2}-\d{2}$/.test(String(event?.start || ""))) {
    return title;
  }

  const timeLabel = formatBlockTime(event?.start, String(event?.start || "").slice(0, 10));
  return timeLabel ? `${timeLabel} ${title}` : title;
}

function formatDurationLabel(minutes) {
  const totalMinutes = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;

  if (hours && remainder) {
    return `${hours}시간 ${remainder}분`;
  }

  if (hours) {
    return `${hours}시간`;
  }

  return `${remainder}분`;
}

function buildTimedBlocks({
  events,
  freeSlots,
  dateKeys,
  displayStart,
  displayEnd,
  showFreeSlots,
}) {
  const startMinute = timeToMinutes(displayStart);
  const endMinute = timeToMinutes(displayEnd);
  const totalMinutes = Math.max(1, endMinute - startMinute);
  const blocks = [];

  events.forEach((event, index) => {
    if (!event?.start) {
      return;
    }

    const isAllDayEvent =
      event?.allDay || /^\d{4}-\d{2}-\d{2}$/.test(String(event?.start || ""));

    if (isAllDayEvent) {
      const startDateKey = String(event?.start || "").slice(0, 10);
      const endDateKey = String(event?.end || event?.start || "").slice(0, 10);
      const lastCoveredDateKey = endDateKey ? addDays(endDateKey, -1) : startDateKey;

      dateKeys.forEach((dateKey, dayIndex) => {
        if (dateKey < startDateKey || dateKey > lastCoveredDateKey) {
          return;
        }

        blocks.push({
          id: `event-${event.id || index}-${dateKey}`,
          dayIndex,
          startMinute,
          endMinute,
          title: event.title || "종일 일정",
          subtitle: `${formatTimelineMinute(startMinute)}-${formatTimelineMinute(endMinute)}`,
          tone: "event",
        });
      });

      return;
    }

    if (!event?.end) {
      return;
    }

    dateKeys.forEach((dateKey, dayIndex) => {
      const eventStart = dateTimeToMinutes(event.start, dateKey);
      const eventEnd = dateTimeToMinutes(event.end, dateKey);

      if (eventStart === null || eventEnd === null) {
        return;
      }

      const clippedStart = Math.max(eventStart, startMinute);
      const clippedEnd = Math.min(eventEnd, endMinute);

      if (clippedEnd <= clippedStart) {
        return;
      }

      blocks.push({
        id: `event-${event.id || index}-${dateKey}`,
        dayIndex,
        startMinute: clippedStart,
        endMinute: clippedEnd,
        title: event.title || "일정",
        subtitle: `${formatTimelineMinute(clippedStart)}-${formatTimelineMinute(clippedEnd)}`,
        tone: "event",
      });
    });
  });

  if (showFreeSlots) {
    freeSlots.forEach((slot, index) => {
      const dayIndex = dateKeys.indexOf(slot.date);
      const slotStart = dateTimeToMinutes(slot.start, slot.date);
      const slotEnd = dateTimeToMinutes(slot.end, slot.date);

      if (dayIndex < 0 || slotStart === null || slotEnd === null) {
        return;
      }

      const clippedStart = Math.max(slotStart, startMinute);
      const clippedEnd = Math.min(slotEnd, endMinute);

      if (clippedEnd <= clippedStart) {
        return;
      }

      blocks.push({
        id: `free-${slot.start || index}`,
        dayIndex,
        startMinute: clippedStart,
        endMinute: clippedEnd,
        title: "빈 시간",
        subtitle: `${formatTimelineMinute(clippedStart)}-${formatTimelineMinute(clippedEnd)}`,
        metaLabel: formatDurationLabel(slot.durationMinutes || clippedEnd - clippedStart),
        tone: "free",
      });
    });
  }

  return blocks.map((block) => ({
    ...block,
    top: ((block.startMinute - startMinute) / totalMinutes) * 100,
    height: ((block.endMinute - block.startMinute) / totalMinutes) * 100,
  }));
}

function buildMonthCells(range) {
  const rangeStart = parseDateKey(range?.startDate);
  const rangeEnd = parseDateKey(range?.endDate);

  if (!rangeStart || !rangeEnd) {
    return [];
  }

  const monthStart = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const monthEnd = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 0);
  const gridStart = new Date(monthStart);
  const gridEnd = new Date(monthEnd);

  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  const todayKey = toDateKey(new Date());
  const cells = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const dateKey = toDateKey(cursor);

    cells.push({
      dateKey,
      day: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() === monthStart.getMonth(),
      isToday: dateKey === todayKey,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return cells;
}

function buildMonthEventMap(events) {
  const mapped = new Map();

  events.forEach((event) => {
    const dateKey = String(event?.start || "").slice(0, 10);

    if (!dateKey) {
      return;
    }

    if (!mapped.has(dateKey)) {
      mapped.set(dateKey, []);
    }

    mapped.get(dateKey).push(event);
  });

  for (const [dateKey, items] of mapped.entries()) {
    mapped.set(
      dateKey,
      items.sort((left, right) => String(left?.start || "").localeCompare(String(right?.start || "")))
    );
  }

  return mapped;
}

function CalendarFrame({ range, action, children, label = "캘린더 미리보기", embedded = false }) {
  if (embedded) {
    return <div style={{ width: "100%" }}>{children}</div>;
  }

  return (
    <div
      aria-label={`${range?.label || label} ${label}`}
      style={{
        width: "100%",
        overflow: "hidden",
        borderRadius: "8px",
        border: "1px solid rgba(205, 221, 228, 0.92)",
        backgroundColor: "var(--bw-white)",
      }}
    >
      <div style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
            padding: "8px 10px",
            borderBottom: "1px solid rgba(229, 232, 240, 0.95)",
            backgroundColor: "#f8fbfd",
          }}
        >
          <strong style={{ color: "var(--bw-800)", fontSize: "12px" }}>
            {range?.label || label}
          </strong>
          <span style={{ color: "var(--mint-600)", fontSize: "10px", fontWeight: 700 }}>
            {action === "find_free_time" ? "빈 시간" : "일정"}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function MonthlyCalendarPreview({ events = [], range, action }) {
  const cells = buildMonthCells(range);
  const eventMap = buildMonthEventMap(events);

  if (cells.length === 0) {
    return null;
  }

  return (
    <CalendarFrame range={range} action={action} label="월간 캘린더 미리보기">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          borderBottom: "1px solid rgba(229, 232, 240, 0.95)",
          backgroundColor: "#f8fbfd",
        }}
      >
        {WEEKDAY_LABELS.map((weekday, index) => (
          <div
            key={weekday}
            style={{
              padding: "6px 4px",
              textAlign: "center",
              fontSize: "10px",
              fontWeight: 800,
              color: index === 0 ? "#d25a74" : "var(--bw-600)",
              borderLeft: index === 0 ? "none" : "1px solid rgba(229, 232, 240, 0.95)",
            }}
          >
            {weekday}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        }}
      >
        {cells.map((cell, index) => {
          const dayEvents = eventMap.get(cell.dateKey) || [];
          const hiddenCount = Math.max(0, dayEvents.length - 3);

          return (
            <div
              key={cell.dateKey}
              style={{
                minWidth: 0,
                minHeight: "76px",
                display: "grid",
                alignContent: "start",
                gap: "3px",
                padding: "6px 4px 5px",
                borderLeft: index % 7 === 0 ? "none" : "1px solid rgba(229, 232, 240, 0.95)",
                borderTop: index < 7 ? "none" : "1px solid rgba(229, 232, 240, 0.95)",
                backgroundColor: cell.isToday
                  ? "rgba(238, 248, 246, 0.9)"
                  : cell.isCurrentMonth
                    ? "var(--bw-white)"
                    : "#f8fbfd",
              }}
            >
              <span
                style={{
                  display: "inline-grid",
                  placeItems: "center",
                  width: "22px",
                  height: "22px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 800,
                  color: cell.isCurrentMonth ? "var(--bw-700)" : "var(--bw-300)",
                  backgroundColor: cell.isToday ? "var(--mint-500)" : "transparent",
                }}
              >
                <span style={{ color: cell.isToday ? "var(--bw-white)" : "inherit" }}>
                  {cell.day}
                </span>
              </span>

              {dayEvents.slice(0, 3).map((event, eventIndex) => (
                <span
                  key={`${cell.dateKey}-${event.id || eventIndex}`}
                  title={formatMonthEventLabel(event)}
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    padding: "2px 4px",
                    borderRadius: "5px",
                    backgroundColor: event?.allDay
                      ? "var(--theme-soft-88)"
                      : "rgba(118, 79, 255, 0.12)",
                    color: event?.allDay ? "var(--mint-600)" : "#6b4ce6",
                    fontSize: "9px",
                    fontWeight: 800,
                  }}
                >
                  {formatMonthEventLabel(event)}
                </span>
              ))}

              {hiddenCount > 0 ? (
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "var(--bw-500)",
                    paddingLeft: "2px",
                  }}
                >
                  +{hiddenCount}개 더보기
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </CalendarFrame>
  );
}

function WeeklyCalendarPreview({
  events = [],
  freeSlots = [],
  range,
  constraints = {},
  action,
  embedded = false,
}) {
  const safeConstraints =
    constraints && typeof constraints === "object" ? constraints : {};

  if (isMonthLikeRange(range) && action !== "find_free_time") {
    return <MonthlyCalendarPreview events={events} range={range} action={action} />;
  }

  const dateKeys = getDateKeys(range);

  if (dateKeys.length === 0) {
    return null;
  }

  const dayCount = dateKeys.length;
  const displayStart =
    safeConstraints.displayStart || safeConstraints.dayStart || DEFAULT_DISPLAY_START;
  const displayEnd =
    safeConstraints.displayEnd || safeConstraints.dayEnd || DEFAULT_DISPLAY_END;
  const startMinute = timeToMinutes(displayStart);
  const endMinute = timeToMinutes(displayEnd);
  const slotCount = Math.max(1, Math.ceil((endMinute - startMinute) / SLOT_MINUTES));
  const bodyHeight = slotCount * SLOT_HEIGHT + 4;
  const todayKey = toDateKey(new Date());
  const timedBlocks = buildTimedBlocks({
    events,
    freeSlots,
    dateKeys,
    displayStart,
    displayEnd,
    showFreeSlots: action === "find_free_time",
  });
  const hourLabels = Array.from({ length: slotCount + 1 }, (_, index) => {
    const minute = Math.min(endMinute, startMinute + index * SLOT_MINUTES);
    return formatTimelineMinute(minute);
  });

  return (
    <CalendarFrame
      range={range}
      action={action}
      label="주간 캘린더 미리보기"
      embedded={embedded}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `44px repeat(${dayCount}, minmax(0, 1fr))`,
          borderBottom: "1px solid rgba(229, 232, 240, 0.95)",
        }}
      >
        <div />
        {dateKeys.map((dateKey) => {
          const header = formatDayHeaderParts(dateKey);

          return (
            <div
              key={dateKey}
              style={{
                minHeight: "34px",
                display: "grid",
                placeItems: "center",
                padding: "4px 2px",
                borderLeft: "1px solid rgba(229, 232, 240, 0.95)",
                backgroundColor:
                  dateKey === todayKey ? "var(--theme-soft-90)" : "var(--bw-white)",
                color: "var(--bw-600)",
                fontSize: embedded ? "10px" : "11px",
                fontWeight: 800,
                lineHeight: 1.15,
                textAlign: "center",
              }}
            >
              <span>{header.day}</span>
              <span>({header.weekday})</span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "44px minmax(0, 1fr)",
        }}
      >
        <div
          style={{
            position: "relative",
            height: `${bodyHeight}px`,
            borderRight: "1px solid rgba(229, 232, 240, 0.95)",
            backgroundColor: "#f8fbfd",
          }}
        >
          {hourLabels.map((label, index) => (
            <div
              key={`${label}-${index}`}
              style={{
                position: "absolute",
                top: index === 0 ? "2px" : `${index * SLOT_HEIGHT - 6}px`,
                right: "5px",
                color: "var(--bw-400)",
                fontSize: "9px",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div
          style={{
            position: "relative",
            height: `${bodyHeight}px`,
            backgroundImage:
              "linear-gradient(to right, rgba(229, 232, 240, 0.95) 1px, transparent 1px), linear-gradient(to bottom, rgba(229, 232, 240, 0.95) 1px, transparent 1px)",
            backgroundSize: `calc(100% / ${dayCount}) 100%, 100% ${SLOT_HEIGHT}px`,
            overflow: "hidden",
          }}
        >
          {dateKeys.map((dateKey, index) =>
            dateKey === todayKey ? (
              <div
                key={`today-${dateKey}`}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `calc(${index} * 100% / ${dayCount})`,
                  width: `calc(100% / ${dayCount})`,
                  backgroundColor: "var(--theme-fill-08)",
                }}
              />
            ) : null
          )}

          {timedBlocks.map((block) => {
            const isEmbeddedFree = embedded && block.tone === "free";
            const isEmbeddedEvent = embedded && block.tone === "event";
            const isFullDayBlock =
              block.startMinute === startMinute && block.endMinute === endMinute;
            const embeddedTimeLabel = isFullDayBlock
              ? `${formatTimelineMinute(startMinute)}\n-\n${formatTimelineMinute(endMinute)}`
              : block.subtitle.replace("-", "\n-\n");

            return (
              <div
                key={block.id}
                title={`${block.title} ${block.subtitle}`}
                style={{
                  position: "absolute",
                  left: `calc(${block.dayIndex} * 100% / ${dayCount} + 5px)`,
                  top: `calc(${block.top}% + 4px)`,
                  width: `calc(100% / ${dayCount} - 10px)`,
                  height: `calc(${block.height}% - 10px)`,
                  minHeight: embedded ? "26px" : "18px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  justifyItems: "center",
                  gap: embedded ? "1px" : "1px",
                  padding: embedded ? "3px 2px" : "3px 4px",
                  overflow: "hidden",
                  borderRadius: embedded ? "9px" : "6px",
                  backgroundColor: isEmbeddedFree
                    ? "var(--theme-soft-88)"
                    : isEmbeddedEvent
                      ? "#e7ebf1"
                      : block.tone === "free"
                        ? "var(--theme-soft-88)"
                        : "var(--mint-500)",
                  border: isEmbeddedFree
                    ? "1px solid var(--theme-border-92)"
                    : isEmbeddedEvent
                      ? "1px solid #d7dde6"
                      : block.tone === "free"
                        ? "1px solid var(--theme-border-92)"
                        : "1px solid var(--mint-500)",
                  color: embedded
                    ? "var(--bw-800)"
                    : block.tone === "free"
                      ? "var(--mint-600)"
                      : "var(--bw-white)",
                  fontSize: embedded ? "6px" : "9px",
                  fontWeight: 800,
                  lineHeight: embedded ? 1.1 : 1.1,
                  boxSizing: "border-box",
                  textAlign: "center",
                }}
              >
                {embedded ? (
                  <>
                    <span
                      style={{
                        display: "block",
                        whiteSpace: "pre-line",
                        textAlign: "center",
                        wordBreak: "keep-all",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.1,
                      }}
                    >
                      {embeddedTimeLabel}
                    </span>
                    {block.tone === "free" && block.metaLabel ? (
                      <span
                        style={{
                          display: "block",
                          fontSize: "5px",
                          color: "var(--mint-600)",
                          lineHeight: 1.1,
                          textAlign: "center",
                        }}
                      >
                        {block.metaLabel}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {block.title}
                    </span>
                    <span style={{ fontSize: "8px", opacity: 0.85 }}>{block.subtitle}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </CalendarFrame>
  );
}

export default WeeklyCalendarPreview;
