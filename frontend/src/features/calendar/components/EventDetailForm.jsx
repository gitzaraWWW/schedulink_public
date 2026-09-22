import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatEventDateForInput,
  formatEventTimeForInput,
} from "../utils/eventUtils";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const PICKER_ROW_HEIGHT = 52;
const PICKER_EDGE_SPACER = PICKER_ROW_HEIGHT * 2;
const SNAP_DELAY_MS = 80;
const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "10:00";
const TIME_PERIOD_OPTIONS = [
  { value: "AM", label: "오전" },
  { value: "PM", label: "오후" },
];
const TIME_HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: String(index + 1),
}));
const TIME_MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index * 5,
  label: String(index * 5).padStart(2, "0"),
}));

function CalendarLineIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3v3M17 3v3M4.5 9.5h15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="4.5"
        y="5.5"
        width="15"
        height="14"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7.8v4.8l3.2 1.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M5.5 19.2c0-2.8 2.9-4.8 6.5-4.8s6.5 2 6.5 4.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.2" fill="currentColor" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 5.5h10a2 2 0 0 1 2 2v9L14.5 21H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M14 21v-4.2a1 1 0 0 1 1-1H19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 10h7M8.5 13.5h5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m7 4.5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TimeRangeArrowIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="m9 5.5 8 8.5-8 8.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m15 6-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronNavRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 7h15M9.5 3.8h5M8 7v11m4-11v11m4-11v11M7.5 20.2h9a2 2 0 0 0 2-2V7h-13v11.2a2 2 0 0 0 2 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m6.5 12.5 3.6 3.6 7.4-8.1"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5v2.2M12 18.3v2.2M4.9 12h2.2M16.9 12h2.2M6.9 6.9l1.5 1.5M15.6 15.6l1.5 1.5M17.1 6.9l-1.5 1.5M8.4 15.6l-1.5 1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 8.1c1.9 0 3.5 1.6 3.5 3.5S13.9 15 12 15s-3.5-1.6-3.5-3.4S10.1 8.1 12 8.1Z"
        fill="currentColor"
        opacity="0.92"
      />
    </svg>
  );
}

function ToggleSwitchIcon({ checked }) {
  return (
    <span
      className={`event-detail-form__all-day-switch${checked ? " is-on" : ""}`}
      aria-hidden="true"
    >
      <span className="event-detail-form__all-day-switch-knob" />
    </span>
  );
}

function buildDraft(event) {
  return {
    allDay: Boolean(event?.allDay),
    title: event?.title || "",
    participants:
      (event?.attendees || [])
        .map((attendee) => attendee.name || attendee.email)
        .filter(Boolean)
        .join(", ") || "",
    date: formatEventDateForInput(event?.start),
    startTime: event?.allDay ? "" : formatEventTimeForInput(event?.start),
    endTime: event?.allDay ? "" : formatEventTimeForInput(event?.end),
    location: event?.location || "",
    description: event?.description || "",
  };
}

function addMinutesToTimeValue(timeValue, minutesToAdd) {
  if (!timeValue) {
    return DEFAULT_END_TIME;
  }

  const [hoursValue, minutesValue] = timeValue.split(":").map(Number);

  if (!Number.isInteger(hoursValue) || !Number.isInteger(minutesValue)) {
    return DEFAULT_END_TIME;
  }

  const nextMinutes = hoursValue * 60 + minutesValue + minutesToAdd;
  const normalizedMinutes = ((nextMinutes % 1440) + 1440) % 1440;
  const nextHours = Math.floor(normalizedMinutes / 60);
  const nextRemainder = normalizedMinutes % 60;

  return `${String(nextHours).padStart(2, "0")}:${String(nextRemainder).padStart(
    2,
    "0"
  )}`;
}

function resolveTimedRange(startTime, endTime) {
  const nextStartTime = startTime || DEFAULT_START_TIME;
  const nextEndTime = endTime || addMinutesToTimeValue(nextStartTime, 60);

  return {
    startTime: nextStartTime,
    endTime: nextEndTime,
  };
}

function buildNotice(event) {
  const metadata = event?.schedulink || {};

  if (!metadata.isManaged) {
    return {
      tone: "neutral",
      text: "Google Calendar 일정은 여기에서 바로 수정하거나 삭제할 수 있습니다.",
    };
  }

  if (metadata.saveMode === "proposal_update") {
    return {
      tone: "info",
      text: "저장하면 주최자에게 수정 제안이 전송됩니다.",
    };
  }

  if (metadata.deleteMode === "hide_only") {
    return {
      tone: "info",
      text: "삭제하면 내 캘린더에서만 이 일정이 숨겨집니다.",
    };
  }

  return {
    tone: "neutral",
    text: "제목, 시간, 장소, 설명을 이 화면에서 바로 정리할 수 있습니다.",
  };
}

function getParticipantInitials(participant) {
  const source = String(
    participant?.displayName || participant?.name || participant?.email || ""
  ).trim();

  if (!source) {
    return "?";
  }

  const plainSource = source.replace(/\s+/g, "");
  return plainSource.slice(0, Math.min(2, plainSource.length)).toUpperCase();
}

function isOrganizerParticipant(participant, creatorId) {
  return Boolean(creatorId) && participant?.userId === creatorId;
}

function orderParticipants(participants, creatorId) {
  if (!Array.isArray(participants) || participants.length < 2 || !creatorId) {
    return Array.isArray(participants) ? participants : [];
  }

  const organizers = [];
  const others = [];

  for (const participant of participants) {
    if (isOrganizerParticipant(participant, creatorId)) {
      organizers.push(participant);
    } else {
      others.push(participant);
    }
  }

  return [...organizers, ...others];
}

function parseDateInputValue(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSummaryDateLabel(dateValue) {
  const parsedDate = parseDateInputValue(dateValue);

  if (!parsedDate) {
    return "날짜 미정";
  }

  return `${parsedDate.getMonth() + 1}월 ${parsedDate.getDate()}일 (${
    WEEKDAY_LABELS[parsedDate.getDay()]
  })`;
}

function formatCalendarHeaderLabel(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function buildCalendarGrid(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + weekIndex * 7 + dayIndex);

      return {
        key: cellDate.toISOString(),
        date: cellDate,
        label: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === month,
      };
    })
  );
}

function isSameDay(firstDate, secondDate) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function buildTimePickerState(timeValue) {
  if (!timeValue) {
    return {
      period: "AM",
      hour: 9,
      minute: 0,
    };
  }

  const [hoursValue, minutesValue] = timeValue.split(":").map(Number);
  const normalizedHour = Number.isNaN(hoursValue) ? 9 : hoursValue;
  const normalizedMinute = Number.isNaN(minutesValue) ? 0 : minutesValue;
  const period = normalizedHour >= 12 ? "PM" : "AM";
  let hour = normalizedHour % 12;

  if (hour === 0) {
    hour = 12;
  }

  return {
    period,
    hour,
    minute: Math.round(normalizedMinute / 5) * 5,
  };
}

function formatSummaryTimeLabel(timeValue) {
  if (!timeValue) {
    return "시간 미정";
  }

  const [hourValue, minuteValue] = timeValue.split(":").map(Number);
  const parsedDate = new Date(2026, 0, 1, hourValue || 0, minuteValue || 0);

  if (Number.isNaN(parsedDate.getTime())) {
    return "시간 미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(parsedDate);
}

function toTimeInputValue({ period, hour, minute }) {
  let normalizedHour = hour % 12;

  if (period === "PM") {
    normalizedHour += 12;
  }

  if (period === "AM" && hour === 12) {
    normalizedHour = 0;
  }

  if (period === "PM" && hour === 12) {
    normalizedHour = 12;
  }

  return `${String(normalizedHour).padStart(2, "0")}:${String(
    minute
  ).padStart(2, "0")}`;
}

function getToneClass(tone) {
  if (tone === "success") {
    return "is-success";
  }

  if (tone === "error") {
    return "is-error";
  }

  if (tone === "info") {
    return "is-info";
  }

  return "is-neutral";
}

function getClampedIndex(scrollTop, optionsLength) {
  const nextIndex = Math.round(scrollTop / PICKER_ROW_HEIGHT);
  return Math.min(Math.max(nextIndex, 0), optionsLength - 1);
}

function scrollColumnToIndex(target, index, behavior = "smooth") {
  if (!target || index < 0) {
    return;
  }

  target.scrollTo({
    top: index * PICKER_ROW_HEIGHT,
    behavior,
  });
}

function WheelColumn({
  options,
  selectedValue,
  onChange,
  columnRef,
  ariaLabel,
}) {
  const dragStateRef = useRef({
    active: false,
    pointerId: null,
    startY: 0,
    startScrollTop: 0,
  });
  const snapTimerRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const snapToNearest = (target, behavior = "smooth") => {
    const nextIndex = getClampedIndex(target.scrollTop, options.length);
    const nextOption = options[nextIndex];

    if (nextOption && nextOption.value !== selectedValue) {
      onChange(nextOption.value);
    }

    scrollColumnToIndex(target, nextIndex, behavior);
  };

  const queueSnap = (target) => {
    if (snapTimerRef.current) {
      window.clearTimeout(snapTimerRef.current);
    }

    snapTimerRef.current = window.setTimeout(() => {
      snapToNearest(target);
      snapTimerRef.current = null;
    }, SNAP_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      if (snapTimerRef.current) {
        window.clearTimeout(snapTimerRef.current);
      }
    };
  }, []);

  const handleScroll = (event) => {
    const target = event.currentTarget;
    const nextIndex = getClampedIndex(target.scrollTop, options.length);
    const nextOption = options[nextIndex];

    if (nextOption && nextOption.value !== selectedValue) {
      onChange(nextOption.value);
    }

    if (!dragStateRef.current.active) {
      queueSnap(target);
    }
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: event.currentTarget.scrollTop,
    };
    suppressClickRef.current = false;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const dragState = dragStateRef.current;

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaY = event.clientY - dragState.startY;

    if (Math.abs(deltaY) > 3) {
      suppressClickRef.current = true;
    }

    event.currentTarget.scrollTop = dragState.startScrollTop - deltaY;
  };

  const endDrag = (event) => {
    const dragState = dragStateRef.current;

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = {
      active: false,
      pointerId: null,
      startY: 0,
      startScrollTop: 0,
    };
    setIsDragging(false);
    snapToNearest(event.currentTarget);

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  return (
    <div className="calendar-wheel">
      <div
        ref={columnRef}
        className={`calendar-wheel__scroller${isDragging ? " is-dragging" : ""}`}
        aria-label={ariaLabel}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div style={{ height: `${PICKER_EDGE_SPACER}px` }} />
        {options.map((option) => {
          const isSelected = option.value === selectedValue;

          return (
            <button
              key={option.value}
              type="button"
              className={`calendar-wheel__option${isSelected ? " is-selected" : ""}`}
              onClick={(event) => {
                if (suppressClickRef.current) {
                  event.preventDefault();
                  return;
                }

                onChange(option.value);
                const optionIndex = options.findIndex(
                  (item) => item.value === option.value
                );
                scrollColumnToIndex(columnRef.current, optionIndex);
              }}
            >
              {option.label}
            </button>
          );
        })}
        <div style={{ height: `${PICKER_EDGE_SPACER}px` }} />
      </div>
      <div className="calendar-wheel__selection" aria-hidden="true" />
    </div>
  );
}

function FieldShell({
  label,
  icon,
  trailing,
  children,
  readOnly = false,
  className = "",
}) {
  const nextClassName = [
    "event-detail-form__field",
    className,
    readOnly ? "is-readonly" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={nextClassName}>
      <span className="event-detail-form__label">{label}</span>
      <span className="event-detail-form__control">
        {icon ? <span className="event-detail-form__control-icon">{icon}</span> : null}
        <span className="event-detail-form__control-input">{children}</span>
        {trailing ? (
          <span className="event-detail-form__control-trailing">{trailing}</span>
        ) : null}
      </span>
    </label>
  );
}

function ParticipantAvatar({ participant }) {
  if (participant?.profileImage) {
    return (
      <img
        src={participant.profileImage}
        alt={participant.displayName || participant.name || "참여자"}
        className="event-detail-form__participant-avatar-image"
      />
    );
  }

  return (
    <span className="event-detail-form__participant-avatar-fallback">
      {getParticipantInitials(participant)}
    </span>
  );
}

function EventDetailForm({
  event,
  saving = false,
  deleting = false,
  detailStatus = null,
  onBack,
  onSave,
  onDelete,
}) {
  const [draft, setDraft] = useState(() => buildDraft(event));
  const [activePicker, setActivePicker] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    parseDateInputValue(formatEventDateForInput(event?.start)) || new Date()
  );
  const [pendingDate, setPendingDate] = useState(() =>
    formatEventDateForInput(event?.start)
  );
  const [pendingTimeState, setPendingTimeState] = useState(() =>
    buildTimePickerState(formatEventTimeForInput(event?.start))
  );
  const [isParticipantListOpen, setIsParticipantListOpen] = useState(false);
  const periodColumnRef = useRef(null);
  const hourColumnRef = useRef(null);
  const minuteColumnRef = useRef(null);
  const lastTimedRangeRef = useRef(
    resolveTimedRange(
      event?.allDay ? "" : formatEventTimeForInput(event?.start),
      event?.allDay ? "" : formatEventTimeForInput(event?.end)
    )
  );

  useEffect(() => {
    const nextDraft = buildDraft(event);
    setDraft(nextDraft);
    setActivePicker(null);
    setPendingDate(nextDraft.date);
    setCalendarMonth(parseDateInputValue(nextDraft.date) || new Date());
    setPendingTimeState(buildTimePickerState(nextDraft.startTime));
    setIsParticipantListOpen(false);
    lastTimedRangeRef.current = resolveTimedRange(
      nextDraft.startTime,
      nextDraft.endTime
    );
  }, [event]);

  useEffect(() => {
    if (!activePicker || activePicker === "date") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollColumnToIndex(
        periodColumnRef.current,
        TIME_PERIOD_OPTIONS.findIndex(
          (option) => option.value === pendingTimeState.period
        ),
        "auto"
      );
      scrollColumnToIndex(
        hourColumnRef.current,
        TIME_HOUR_OPTIONS.findIndex((option) => option.value === pendingTimeState.hour),
        "auto"
      );
      scrollColumnToIndex(
        minuteColumnRef.current,
        TIME_MINUTE_OPTIONS.findIndex(
          (option) => option.value === pendingTimeState.minute
        ),
        "auto"
      );
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activePicker, pendingTimeState]);

  const calendarGrid = useMemo(
    () => buildCalendarGrid(calendarMonth),
    [calendarMonth]
  );

  if (!event) {
    return null;
  }

  const metadata = event.schedulink || {};
  const notice = buildNotice(event);
  const busy = saving || deleting;
  const saveLocked = Boolean(detailStatus?.lockSave);
  const isExternalEvent = !metadata.isManaged;
  const saveDisabled =
    busy || (!metadata.canSave && !isExternalEvent) || saveLocked;
  const deleteDisabled = busy || (!metadata.canDelete && !isExternalEvent);
  const participants = Array.isArray(metadata.participants)
    ? metadata.participants
    : [];
  const orderedParticipants = orderParticipants(
    participants,
    metadata.creatorId || null
  );
  const visibleParticipants = orderedParticipants.slice(0, 5);
  const hiddenParticipantCount = Math.max(
    0,
    orderedParticipants.length - visibleParticipants.length
  );
  const summaryDateLabel = formatSummaryDateLabel(draft.date);
  const startSummaryTime = draft.allDay
    ? "하루 종일"
    : formatSummaryTimeLabel(draft.startTime);
  const endSummaryTime = draft.allDay
    ? ""
    : formatSummaryTimeLabel(draft.endTime);
  const selectedCalendarDate =
    parseDateInputValue(pendingDate || draft.date) || new Date();

  const handleFieldChange = (field, value) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));

    if (field === "startTime" || field === "endTime") {
      const nextStartTime = field === "startTime" ? value : draft.startTime;
      const nextEndTime = field === "endTime" ? value : draft.endTime;
      lastTimedRangeRef.current = resolveTimedRange(nextStartTime, nextEndTime);
    }
  };

  const openDatePicker = () => {
    setPendingDate(draft.date || toDateInputValue(new Date()));
    setCalendarMonth(parseDateInputValue(draft.date) || new Date());
    setActivePicker((currentPicker) => (currentPicker === "date" ? null : "date"));
  };

  const openTimePicker = (target) => {
    const sourceTime = target === "start" ? draft.startTime : draft.endTime;
    setPendingTimeState(buildTimePickerState(sourceTime));
    setActivePicker((currentPicker) =>
      currentPicker === `time-${target}` ? null : `time-${target}`
    );
  };

  const handleApplyDate = () => {
    if (pendingDate) {
      handleFieldChange("date", pendingDate);
    }

    setActivePicker(null);
  };

  const handleApplyTime = () => {
    if (activePicker === "time-start") {
      handleFieldChange("startTime", toTimeInputValue(pendingTimeState));
    }

    if (activePicker === "time-end") {
      handleFieldChange("endTime", toTimeInputValue(pendingTimeState));
    }

    setActivePicker(null);
  };

  const handleAllDayToggle = () => {
    setDraft((currentDraft) => {
      if (currentDraft.allDay) {
        const restoredRange = resolveTimedRange(
          lastTimedRangeRef.current?.startTime,
          lastTimedRangeRef.current?.endTime
        );
        setPendingTimeState(buildTimePickerState(restoredRange.startTime));

        return {
          ...currentDraft,
          allDay: false,
          startTime: restoredRange.startTime,
          endTime: restoredRange.endTime,
        };
      }

      lastTimedRangeRef.current = resolveTimedRange(
        currentDraft.startTime,
        currentDraft.endTime
      );

      return {
        ...currentDraft,
        allDay: true,
        startTime: "",
        endTime: "",
      };
    });
    setActivePicker(null);
  };

  return (
    <div className="event-detail-form">
      <section className="event-detail-form__summary-card">
        <div className="event-detail-form__summary-header">
          <div className="event-detail-form__summary-copy">
            <div className="event-detail-form__summary-eyebrow">
              <span className="event-detail-form__summary-dot" />
              일정 상세
            </div>
          </div>

          <button
            type="button"
            className="event-detail-form__ghost-button"
            onClick={onBack}
          >
            <CalendarLineIcon />
            <span>다른 일정 보기</span>
            <ChevronRightIcon />
          </button>
        </div>

        <input
          type="text"
          className="event-detail-form__summary-title-input"
          value={draft.title}
          onChange={(event) => handleFieldChange("title", event.target.value)}
          placeholder="제목 없는 일정"
          aria-label="상단 일정 제목"
        />

        <div className="event-detail-form__summary-divider" />

        <div className="event-detail-form__time-panel">
          <div className="event-detail-form__all-day-row">
            <div className="event-detail-form__all-day-copy">
              <small>종일 설정</small>
              <strong>{draft.allDay ? "켜짐" : "시간 지정"}</strong>
            </div>
            <button
              type="button"
              className="event-detail-form__all-day-toggle"
              onClick={handleAllDayToggle}
              role="switch"
              aria-checked={draft.allDay}
              aria-label="하루 종일 일정 전환"
            >
              <ToggleSwitchIcon checked={draft.allDay} />
            </button>
          </div>

          {draft.allDay ? (
            <div className="event-detail-form__time-range is-all-day">
              <div className="event-detail-form__time-slot">
                <small>일정</small>
                <button
                  type="button"
                  className={`event-detail-form__summary-date-button${
                    activePicker === "date" ? " is-active" : ""
                  }`}
                  onClick={openDatePicker}
                >
                  {summaryDateLabel}
                </button>
                <strong className="event-detail-form__time-value">
                  {startSummaryTime}
                </strong>
              </div>
            </div>
          ) : (
            <div className="event-detail-form__time-range">
              <div className="event-detail-form__time-slot">
                <small>시작</small>
                <button
                  type="button"
                  className={`event-detail-form__summary-date-button${
                    activePicker === "date" ? " is-active" : ""
                  }`}
                  onClick={openDatePicker}
                >
                  {summaryDateLabel}
                </button>
                <button
                  type="button"
                  className={`event-detail-form__summary-time-button${
                    activePicker === "time-start" ? " is-active" : ""
                  }`}
                  onClick={() => openTimePicker("start")}
                >
                  {startSummaryTime}
                </button>
              </div>

              <span className="event-detail-form__time-arrow">
                <TimeRangeArrowIcon />
              </span>

              <div className="event-detail-form__time-slot">
                <small>종료</small>
                <button
                  type="button"
                  className={`event-detail-form__summary-date-button${
                    activePicker === "date" ? " is-active" : ""
                  }`}
                  onClick={openDatePicker}
                >
                  {summaryDateLabel}
                </button>
                <button
                  type="button"
                  className={`event-detail-form__summary-time-button${
                    activePicker === "time-end" ? " is-active" : ""
                  }`}
                  onClick={() => openTimePicker("end")}
                >
                  {endSummaryTime}
                </button>
              </div>
            </div>
          )}

          {activePicker === "date" ? (
            <div className="event-detail-form__picker-panel">
              <div className="event-detail-form__calendar-header">
                <button
                  type="button"
                  className="event-detail-form__picker-nav"
                  onClick={() =>
                    setCalendarMonth(
                      (currentMonth) =>
                        new Date(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth() - 1,
                          1
                        )
                    )
                  }
                >
                  <ChevronLeftIcon />
                </button>

                <strong>{formatCalendarHeaderLabel(calendarMonth)}</strong>

                <button
                  type="button"
                  className="event-detail-form__picker-nav"
                  onClick={() =>
                    setCalendarMonth(
                      (currentMonth) =>
                        new Date(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth() + 1,
                          1
                        )
                    )
                  }
                >
                  <ChevronNavRightIcon />
                </button>
              </div>

              <div className="event-detail-form__calendar-weekdays">
                {WEEKDAY_LABELS.map((weekday) => (
                  <span key={weekday}>{weekday}</span>
                ))}
              </div>

              <div className="event-detail-form__calendar-grid">
                {calendarGrid.flat().map((cell) => {
                  const isSelected = isSameDay(cell.date, selectedCalendarDate);

                  return (
                    <button
                      key={cell.key}
                      type="button"
                      className={`event-detail-form__calendar-day${
                        cell.isCurrentMonth ? "" : " is-outside"
                      }${isSelected ? " is-selected" : ""}`}
                      onClick={() => setPendingDate(toDateInputValue(cell.date))}
                    >
                      {cell.label}
                    </button>
                  );
                })}
              </div>

              <div className="event-detail-form__picker-actions">
                <button
                  type="button"
                  className="event-detail-form__picker-action"
                  onClick={() => setActivePicker(null)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="event-detail-form__picker-action is-primary"
                  onClick={handleApplyDate}
                >
                  선택
                </button>
              </div>
            </div>
          ) : null}

          {activePicker === "time-start" || activePicker === "time-end" ? (
            <div className="event-detail-form__picker-panel">
              <div className="event-detail-form__time-wheel-columns">
                <WheelColumn
                  options={TIME_PERIOD_OPTIONS}
                  selectedValue={pendingTimeState.period}
                  onChange={(nextPeriod) =>
                    setPendingTimeState((currentState) => ({
                      ...currentState,
                      period: nextPeriod,
                    }))
                  }
                  columnRef={periodColumnRef}
                  ariaLabel="오전 오후 선택"
                />

                <WheelColumn
                  options={TIME_HOUR_OPTIONS}
                  selectedValue={pendingTimeState.hour}
                  onChange={(nextHour) =>
                    setPendingTimeState((currentState) => ({
                      ...currentState,
                      hour: nextHour,
                    }))
                  }
                  columnRef={hourColumnRef}
                  ariaLabel="시간 선택"
                />

                <WheelColumn
                  options={TIME_MINUTE_OPTIONS}
                  selectedValue={pendingTimeState.minute}
                  onChange={(nextMinute) =>
                    setPendingTimeState((currentState) => ({
                      ...currentState,
                      minute: nextMinute,
                    }))
                  }
                  columnRef={minuteColumnRef}
                  ariaLabel="분 선택"
                />
              </div>

              <div className="event-detail-form__picker-actions">
                <button
                  type="button"
                  className="event-detail-form__picker-action"
                  onClick={() => setActivePicker(null)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="event-detail-form__picker-action is-primary"
                  onClick={handleApplyTime}
                >
                  적용
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="event-detail-form__summary-divider" />

        <div className="event-detail-form__participants-card">
          <div className="event-detail-form__participants-header">
            <div className="event-detail-form__participants-copy">
              <span className="event-detail-form__participants-label">참여자</span>
              <strong>
                {participants.length > 0
                  ? `${participants.length}명 참여`
                  : "등록된 참여자가 없습니다."}
              </strong>
            </div>

            {hiddenParticipantCount > 0 ? (
              <button
                type="button"
                className="event-detail-form__participants-more"
                onClick={() =>
                  setIsParticipantListOpen((currentValue) => !currentValue)
                }
              >
                +{hiddenParticipantCount}
              </button>
            ) : null}
          </div>

          {participants.length > 0 ? (
            <div className="event-detail-form__participants-rail">
              {visibleParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="event-detail-form__participant-chip"
                >
                  <span className="event-detail-form__participant-avatar">
                    <ParticipantAvatar participant={participant} />
                  </span>
                  <span className="event-detail-form__participant-copy">
                    <span className="event-detail-form__participant-name">
                      {participant.displayName}
                    </span>
                    {isOrganizerParticipant(
                      participant,
                      metadata.creatorId || null
                    ) ? (
                      <span className="event-detail-form__participant-badge">
                        주최자
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {isParticipantListOpen && participants.length > 0 ? (
            <div className="event-detail-form__participants-list">
              {orderedParticipants.map((participant) => (
                <div
                  key={`${participant.id}-detail`}
                  className="event-detail-form__participants-list-item"
                >
                  <span className="event-detail-form__participant-avatar is-large">
                    <ParticipantAvatar participant={participant} />
                  </span>
                  <div className="event-detail-form__participants-list-copy">
                    <div className="event-detail-form__participants-list-title">
                      <strong>{participant.displayName}</strong>
                      {isOrganizerParticipant(
                        participant,
                        metadata.creatorId || null
                      ) ? (
                        <span className="event-detail-form__participant-badge">
                          주최자
                        </span>
                      ) : null}
                    </div>
                    <span>
                      {[participant.teamName, participant.status]
                        .filter(Boolean)
                        .join(" · ") || participant.email || ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className={`event-detail-form__notice ${getToneClass(notice.tone)}`}
        >
          <span className="event-detail-form__notice-icon">
            <SparkIcon />
          </span>
          <span>{notice.text}</span>
        </div>

        {detailStatus?.text ? (
          <div
            className={`event-detail-form__notice ${getToneClass(
              detailStatus.tone
            )}`}
          >
            <span className="event-detail-form__notice-icon">
              <SparkIcon />
            </span>
            <span>{detailStatus.text}</span>
          </div>
        ) : null}
      </section>

      <div className="event-detail-form__grid">
        <FieldShell
          label="참여자"
          icon={<PeopleIcon />}
          trailing={<PlusIcon />}
          readOnly
        >
          <input
            type="text"
            value={draft.participants}
            readOnly
            placeholder="참여자를 추가하세요"
          />
        </FieldShell>

        <FieldShell label="장소" icon={<MapPinIcon />}>
          <input
            type="text"
            value={draft.location}
            onChange={(event) => handleFieldChange("location", event.target.value)}
            placeholder="장소를 입력하세요"
          />
        </FieldShell>

        <label className="event-detail-form__field event-detail-form__field--textarea">
          <span className="event-detail-form__label">설명</span>
          <span className="event-detail-form__textarea-shell">
            <span className="event-detail-form__textarea-icon">
              <NoteIcon />
            </span>
            <textarea
              value={draft.description}
              onChange={(event) =>
                handleFieldChange("description", event.target.value)
              }
              placeholder="회의 목적, 준비물, 메모 등을 적어보세요"
              rows={6}
            />
          </span>
        </label>
      </div>

      <div className="event-detail-form__footer">
        <button
          type="button"
          className="event-detail-form__footer-button is-secondary"
          disabled={deleteDisabled}
          onClick={() => onDelete?.(event)}
        >
          <TrashIcon />
          <span>{deleting ? "삭제하는 중..." : "삭제하기"}</span>
        </button>

        <button
          type="button"
          className="event-detail-form__footer-button is-primary"
          disabled={saveDisabled}
          onClick={() => onSave?.(event, draft)}
        >
          <CheckIcon />
          <span>{saving ? "저장하는 중..." : "저장하기"}</span>
        </button>
      </div>
    </div>
  );
}

export default EventDetailForm;
