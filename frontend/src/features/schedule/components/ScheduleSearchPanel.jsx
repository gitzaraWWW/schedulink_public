import { useEffect, useMemo, useRef, useState } from "react";
import CloseIcon from "../../../shared/ui/CloseIcon";
import { formatEventTimeRange, sortEvents } from "../../calendar/utils/eventUtils";

function SearchIcon({ size = 20, strokeWidth = 1.8 }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <path d="M16 19a4 4 0 0 0-8 0" />
      <circle cx="12" cy="10" r="3" />
      <path d="M19.5 18a3.5 3.5 0 0 0-2.5-3.35" />
      <path d="M17 7.2a3 3 0 0 1 0 5.6" />
    </svg>
  );
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function addYears(date, amount) {
  const nextDate = new Date(date);
  nextDate.setFullYear(nextDate.getFullYear() + amount);
  return nextDate;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function formatSectionLabel(dateKey, todayKey) {
  const parsedDate = parseDateValue(dateKey);

  if (!parsedDate) {
    return dateKey;
  }

  if (dateKey === todayKey) {
    return "오늘";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parsedDate);
}

function formatSectionSubLabel(dateKey) {
  const parsedDate = parseDateValue(dateKey);

  if (!parsedDate) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsedDate);
}

function formatSearchableDate(value) {
  const parsedDate = parseDateValue(value);

  if (!parsedDate) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parsedDate);
}

function buildEventSearchText(event) {
  const attendeeText = Array.isArray(event.attendees)
    ? event.attendees
        .map((attendee) => [attendee.name, attendee.email].filter(Boolean).join(" "))
        .join(" ")
    : "";

  return normalizeSearchText(
    [
      event.title,
      event.location,
      event.description,
      event.start,
      formatSearchableDate(event.start),
      attendeeText,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getGroupedEvents(events, searchText) {
  const today = startOfDay(new Date());
  const minPastDate = addDays(today, -7);
  const maxFutureDate = addYears(today, 2);
  const normalizedQuery = normalizeSearchText(searchText);
  const groups = [];
  const groupsByDateKey = new Map();

  sortEvents(events).forEach((event) => {
    const eventStart = parseDateValue(event.start);

    if (!eventStart) {
      return;
    }

    const eventDay = startOfDay(eventStart);

    if (eventDay < minPastDate || eventDay > maxFutureDate) {
      return;
    }

    if (normalizedQuery && !buildEventSearchText(event).includes(normalizedQuery)) {
      return;
    }

    const dateKey = toDateKey(eventDay);

    if (!groupsByDateKey.has(dateKey)) {
      const nextGroup = {
        dateKey,
        items: [],
      };
      groupsByDateKey.set(dateKey, nextGroup);
      groups.push(nextGroup);
    }

    groupsByDateKey.get(dateKey).items.push(event);
  });

  return groups;
}

function getResultCount(groups) {
  return groups.reduce((total, group) => total + group.items.length, 0);
}

function getStatusMeta(event) {
  const start = parseDateValue(event.start);
  const end = parseDateValue(event.end);
  const now = new Date();

  if (event.allDay) {
    return {
      label: "종일",
      background: "var(--theme-soft-92)",
      color: "var(--mint-600)",
    };
  }

  if (start && end && start <= now && end >= now) {
    return {
      label: "진행중",
      background: "var(--theme-soft-92)",
      color: "var(--mint-600)",
    };
  }

  return {
    label: "예정",
    background: "rgba(245, 247, 251, 1)",
    color: "var(--bw-500)",
  };
}

function getAttendeeCount(event) {
  return Array.isArray(event.attendees) ? event.attendees.length : 0;
}

function ScheduleSearchPanel({ isOpen, events = [], onClose }) {
  const [query, setQuery] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const sectionRefs = useRef(new Map());
  const todayKey = useMemo(() => toDateKey(startOfDay(new Date())), []);
  const groupedEvents = useMemo(() => getGroupedEvents(events, query), [events, query]);
  const resultCount = useMemo(() => getResultCount(groupedEvents), [groupedEvents]);
  const todaySectionExists = groupedEvents.some((group) => group.dateKey === todayKey);
  const initialSectionKey = todaySectionExists
    ? todayKey
    : groupedEvents.find((group) => group.dateKey >= todayKey)?.dateKey ||
      groupedEvents[0]?.dateKey ||
      null;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frameId);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !initialSectionKey) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const container = scrollRef.current;
      const section = sectionRefs.current.get(initialSectionKey);

      if (!container || !section) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      const nextScrollTop =
        container.scrollTop + (sectionRect.top - containerRect.top) - 12;
      container.scrollTop = Math.max(nextScrollTop, 0);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [initialSectionKey, isOpen, query]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1500,
        background: "rgba(29, 42, 67, 0.18)",
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="일정 리스트"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(420px, 100vw)",
          height: "100vh",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr)",
          background: "var(--bw-white)",
          borderLeft: "1px solid rgba(229, 232, 240, 0.96)",
          boxShadow: "-24px 0 48px rgba(57, 86, 105, 0.14)",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "18px",
            padding: "28px 22px 18px",
            borderBottom: "1px solid rgba(229, 232, 240, 0.96)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,250,252,0.98) 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div style={{ display: "grid", gap: "6px", minWidth: 0 }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--mint-500)",
                }}
              >
                Schedulink
              </span>
              <strong
                style={{
                  fontSize: "34px",
                  lineHeight: 0.96,
                  letterSpacing: "-0.05em",
                  color: "var(--bw-900)",
                }}
              >
                일정 리스트
              </strong>
              <span
                style={{
                  fontSize: "14px",
                  color: "var(--bw-500)",
                  lineHeight: 1.6,
                }}
              >
                최대 2년치 일정 목록을 확인할 수 있습니다.
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="일정 리스트 닫기"
              style={{
                width: "42px",
                height: "42px",
                padding: 0,
                borderRadius: "12px",
                border: "1px solid rgba(205, 221, 228, 0.92)",
                background: "var(--bw-white)",
                color: "var(--bw-700)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                cursor: "pointer",
                boxShadow: "none",
              }}
            >
              <CloseIcon size={18} />
            </button>
          </div>

          <label
            style={{
              display: "grid",
              gridTemplateColumns: query
                ? "18px minmax(0, 1fr) 28px"
                : "18px minmax(0, 1fr)",
              gap: "12px",
              alignItems: "center",
              minHeight: "48px",
              padding: "0 16px",
              borderRadius: "999px",
              border: "1px solid rgba(205, 221, 228, 0.92)",
              background: "#f7f8fd",
            }}
          >
            <span style={{ color: "var(--bw-500)", display: "grid", placeItems: "center" }}>
              <SearchIcon size={18} />
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="검색"
              aria-label="일정 검색어"
              style={{
                border: 0,
                padding: 0,
                background: "transparent",
                boxShadow: "none",
                color: "var(--bw-800)",
                fontSize: "15px",
                minWidth: 0,
                outline: "none",
              }}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="검색어 지우기"
                style={{
                  width: "28px",
                  height: "28px",
                  padding: 0,
                  border: 0,
                  borderRadius: "8px",
                  background: "transparent",
                  color: "var(--bw-500)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  boxShadow: "none",
                }}
              >
                <CloseIcon size={14} />
              </button>
            ) : null}
          </label>

          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--bw-500)" }}>
            {query ? `검색 결과 ${resultCount}개` : `전체 일정 ${resultCount}개`}
          </span>
        </div>

        <div
          ref={scrollRef}
          className="mention-panel-scroll"
          style={{
            overflowY: "auto",
            padding: "18px 22px 28px",
            display: "grid",
            alignContent: "start",
            gap: "20px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(249,251,253,1) 100%)",
          }}
        >
          {groupedEvents.length === 0 ? (
            <div
              style={{
                display: "grid",
                gap: "8px",
                padding: "24px 20px",
                borderRadius: "18px",
                border: "1px solid rgba(205, 221, 228, 0.92)",
                background: "var(--bw-white)",
              }}
            >
              <strong style={{ fontSize: "18px", color: "var(--bw-900)" }}>
                표시할 일정이 없습니다
              </strong>
              <span style={{ color: "var(--bw-600)", lineHeight: 1.6 }}>
                검색어를 바꾸거나 동기화 상태를 다시 확인해 주세요.
              </span>
            </div>
          ) : (
            groupedEvents.map((group) => (
              <section
                key={group.dateKey}
                ref={(element) => {
                  if (element) {
                    sectionRefs.current.set(group.dateKey, element);
                  } else {
                    sectionRefs.current.delete(group.dateKey);
                  }
                }}
                style={{ display: "grid", gap: "10px" }}
              >
                <div
                  style={{
                    display: "grid",
                    gap: "4px",
                    paddingTop: "4px",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "18px",
                      letterSpacing: "-0.04em",
                      color: "var(--bw-900)",
                    }}
                  >
                    {formatSectionLabel(group.dateKey, todayKey)}
                  </strong>
                  <span style={{ fontSize: "13px", color: "var(--bw-400)" }}>
                    {formatSectionSubLabel(group.dateKey)}
                  </span>
                </div>

                <div style={{ display: "grid", gap: "10px" }}>
                  {group.items.map((event, index) => {
                    const attendeeCount = getAttendeeCount(event);
                    const statusMeta = getStatusMeta(event);

                    return (
                      <article
                        key={`${group.dateKey}-${event.id || index}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "4px minmax(0, 1fr) auto",
                          columnGap: "12px",
                          alignItems: "stretch",
                          padding: "14px 14px 14px 0",
                          borderRadius: "16px",
                          border: "1px solid rgba(205, 221, 228, 0.92)",
                          background: "var(--bw-white)",
                          boxShadow: "0 10px 22px rgba(57, 86, 105, 0.05)",
                        }}
                      >
                        <div
                          aria-hidden="true"
                          style={{
                            borderRadius: "999px",
                            background:
                              "linear-gradient(180deg, var(--mint-500) 0%, var(--mint-300) 100%)",
                            margin: "2px 0",
                          }}
                        />

                        <div
                          style={{
                            display: "grid",
                            gap: "8px",
                            minWidth: 0,
                            paddingLeft: "2px",
                          }}
                        >
                          <strong
                            style={{
                              fontSize: "18px",
                              lineHeight: 1.35,
                              color: "var(--bw-900)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {event.title || "제목 없는 일정"}
                          </strong>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              flexWrap: "wrap",
                              color: "var(--bw-500)",
                              fontSize: "14px",
                              fontWeight: 600,
                            }}
                          >
                            <span>{formatEventTimeRange(event)}</span>
                            {attendeeCount > 0 ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <PeopleIcon />
                                {attendeeCount}명
                              </span>
                            ) : null}
                          </div>

                          {event.location ? (
                            <span
                              style={{
                                fontSize: "14px",
                                color: "var(--bw-400)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {event.location}
                            </span>
                          ) : null}
                        </div>

                        <span
                          style={{
                            alignSelf: "center",
                            padding: "7px 10px",
                            borderRadius: "999px",
                            background: statusMeta.background,
                            color: statusMeta.color,
                            fontSize: "12px",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default ScheduleSearchPanel;
