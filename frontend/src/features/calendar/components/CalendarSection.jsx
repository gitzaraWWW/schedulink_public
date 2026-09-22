import { useEffect, useMemo, useRef, useState } from "react";
import koLocale from "@fullcalendar/core/locales/ko";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import SectionCard from "../../../shared/ui/SectionCard";

const YEAR_OPTIONS = Array.from({ length: 16 }, (_, index) => 2020 + index);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const PICKER_ROW_HEIGHT = 52;
const PICKER_EDGE_SPACER = PICKER_ROW_HEIGHT * 2;
const SNAP_DELAY_MS = 80;

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="m7 10 5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function formatToolbarLabel(date) {
  return `${date.getFullYear()}. ${date.getMonth() + 1}.`;
}

function isDateOnlyValue(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseCalendarEventDate(value) {
  if (!value) {
    return null;
  }

  if (isDateOnlyValue(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const nextDate = new Date(year, month - 1, day);
  nextDate.setDate(nextDate.getDate() + days);
  return toDateKey(nextDate);
}

function promoteMultiDayEventForWeekView(event) {
  if (event?.spanVariant !== "multi-day") {
    return event;
  }

  const eventStart = parseCalendarEventDate(event.start);

  if (!eventStart) {
    return event;
  }

  const parsedEnd = parseCalendarEventDate(event.end);
  let inclusiveEnd =
    parsedEnd && parsedEnd > eventStart ? new Date(parsedEnd) : new Date(eventStart);

  if ((event.allDay || isDateOnlyValue(event.start)) && parsedEnd && parsedEnd > eventStart) {
    inclusiveEnd = new Date(inclusiveEnd.getTime() - 1);
  }

  return {
    ...event,
    start: toDateKey(eventStart),
    end: addDaysToDateKey(toDateKey(inclusiveEnd), 1),
    allDay: true,
  };
}

function buildCalendarEventClassNames(arg) {
  if (arg.view.type !== "dayGridMonth") {
    return [];
  }

  const spanVariant =
    arg.event.extendedProps?.spanVariant === "multi-day"
      ? "multi-day"
      : "single-day";

  return ["schedulink-calendar-event", `is-${spanVariant}`];
}

function buildDayOptions(year, month) {
  const count = getDaysInMonth(year, month);

  return Array.from({ length: count }, (_, index) => {
    const day = index + 1;

    return {
      value: day,
      label: `${day}일`,
    };
  });
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
  formatLabel,
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
              {formatLabel ? formatLabel(option) : option.label}
            </button>
          );
        })}
        <div style={{ height: `${PICKER_EDGE_SPACER}px` }} />
      </div>
      <div className="calendar-wheel__selection" aria-hidden="true" />
    </div>
  );
}

function CalendarSection({ events, onDateClick, onEventClick, onRangeChange }) {
  const calendarRef = useRef(null);
  const yearColumnRef = useRef(null);
  const monthColumnRef = useRef(null);
  const dayColumnRef = useRef(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState("dayGridMonth");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(currentDate.getFullYear());
  const [draftMonth, setDraftMonth] = useState(currentDate.getMonth() + 1);
  const [draftDay, setDraftDay] = useState(currentDate.getDate());

  const dayOptions = useMemo(
    () => buildDayOptions(draftYear, draftMonth),
    [draftYear, draftMonth]
  );
  const clampedDraftDay = Math.min(draftDay, getDaysInMonth(draftYear, draftMonth));
  const calendarEvents = useMemo(() => {
    if (currentView !== "timeGridWeek") {
      return events;
    }

    return (events || []).map(promoteMultiDayEventForWeekView);
  }, [currentView, events]);

  useEffect(() => {
    if (!isPickerOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollColumnToIndex(
        yearColumnRef.current,
        YEAR_OPTIONS.indexOf(draftYear),
        "auto"
      );
      scrollColumnToIndex(
        monthColumnRef.current,
        MONTH_OPTIONS.indexOf(draftMonth),
        "auto"
      );
      scrollColumnToIndex(
        dayColumnRef.current,
        Math.max(
          0,
          dayOptions.findIndex((option) => option.value === clampedDraftDay)
        ),
        "auto"
      );
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [clampedDraftDay, dayOptions, draftMonth, draftYear, isPickerOpen]);

  const openPicker = () => {
    setDraftYear(currentDate.getFullYear());
    setDraftMonth(currentDate.getMonth() + 1);
    setDraftDay(currentDate.getDate());
    setIsPickerOpen(true);
  };

  const handleConfirmDate = () => {
    const api = calendarRef.current?.getApi();

    if (!api) {
      setIsPickerOpen(false);
      return;
    }

    const nextDate = new Date(draftYear, draftMonth - 1, clampedDraftDay);
    api.gotoDate(nextDate);
    setCurrentDate(nextDate);
    setIsPickerOpen(false);
  };

  const handleChangeView = (viewName) => {
    const api = calendarRef.current?.getApi();

    if (!api) {
      return;
    }

    api.changeView(viewName);
    setCurrentView(viewName);
  };

  return (
    <>
      <SectionCard style={{ padding: 0, background: "transparent", border: 0 }}>
        <div className="calendar-surface calendar-frame">
          <div className="calendar-toolbar">
            <button
              type="button"
              className="calendar-toolbar__title"
              onClick={openPicker}
              aria-label="날짜 선택"
            >
              <span>{formatToolbarLabel(currentDate)}</span>
              <ChevronDownIcon />
            </button>

            <div className="calendar-toolbar__views" aria-label="달력 보기 전환">
              <button
                type="button"
                className={`calendar-toolbar__view${
                  currentView === "dayGridMonth" ? " is-active" : ""
                }`}
                onClick={() => handleChangeView("dayGridMonth")}
              >
                월
              </button>
              <button
                type="button"
                className={`calendar-toolbar__view${
                  currentView === "timeGridWeek" ? " is-active" : ""
                }`}
                onClick={() => handleChangeView("timeGridWeek")}
              >
                주
              </button>
            </div>
          </div>

          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locale={koLocale}
            initialView="dayGridMonth"
            events={calendarEvents}
            eventDisplay="block"
            displayEventTime={false}
            eventClassNames={buildCalendarEventClassNames}
            eventOrder="sourcePriority,start,-duration,title"
            height="auto"
            headerToolbar={false}
            dayHeaderFormat={{ weekday: "short" }}
            views={{
              dayGridMonth: {
                dayMaxEventRows: 4,
              },
              timeGridWeek: {
                slotDuration: "02:00:00",
                slotLabelInterval: "02:00:00",
                snapDuration: "00:30:00",
              },
            }}
            moreLinkText={(count) => `+${count}`}
            datesSet={(info) => {
              setCurrentDate(new Date(info.view.currentStart));
              setCurrentView(info.view.type);
              onRangeChange?.(info.view.currentStart);
            }}
            dateClick={(info) => onDateClick?.(info.dateStr)}
            eventClick={(info) =>
              onEventClick?.({
                eventId: info.event.id,
                dateString: info.event.startStr.slice(0, 10),
              })
            }
          />
        </div>
      </SectionCard>

      {isPickerOpen ? (
        <div className="bottom-sheet-overlay" onClick={() => setIsPickerOpen(false)}>
          <div
            className="bottom-sheet calendar-picker-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="날짜 선택"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bottom-sheet__handle" />

            <div className="calendar-picker-sheet__summary">
              {draftYear}년 {draftMonth}월 {clampedDraftDay}일
            </div>

            <div className="calendar-picker-sheet__columns">
              <WheelColumn
                options={YEAR_OPTIONS.map((year) => ({
                  value: year,
                  label: `${year}년`,
                }))}
                selectedValue={draftYear}
                onChange={setDraftYear}
                columnRef={yearColumnRef}
                ariaLabel="연도 선택"
                formatLabel={(option) => option.label}
              />

              <WheelColumn
                options={MONTH_OPTIONS.map((month) => ({
                  value: month,
                  label: `${month}월`,
                }))}
                selectedValue={draftMonth}
                onChange={setDraftMonth}
                columnRef={monthColumnRef}
                ariaLabel="월 선택"
                formatLabel={(option) => option.label}
              />

              <WheelColumn
                options={dayOptions}
                selectedValue={clampedDraftDay}
                onChange={setDraftDay}
                columnRef={dayColumnRef}
                ariaLabel="일 선택"
                formatLabel={(option) => option.label}
              />
            </div>

            <div className="calendar-picker-sheet__actions">
              <button
                type="button"
                className="calendar-picker-sheet__button"
                onClick={() => setIsPickerOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="calendar-picker-sheet__button is-primary"
                onClick={handleConfirmDate}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default CalendarSection;
