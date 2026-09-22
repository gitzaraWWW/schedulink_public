import { useEffect, useMemo } from "react";
import CloseIcon from "../../../shared/ui/CloseIcon";
import EventDetailForm from "./EventDetailForm";
import {
  formatEventTimeRange,
  formatSelectedDate,
  isSubscriptionEvent,
} from "../utils/eventUtils";

function CalendarBadgeIcon() {
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

function DayScheduleModal({
  isOpen,
  selectedDate,
  events,
  selectedEventId,
  savingEventId,
  deletingEventId,
  detailStatus,
  onSelectEvent,
  onClearSelectedEvent,
  onClose,
  onSaveEvent,
  onDeleteEvent,
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        if (selectedEventId) {
          onClearSelectedEvent?.();
          return;
        }

        onClose();
      }
    };

    window.addEventListener("keydown", handleEscapeKey);

    return () => {
      window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen, onClearSelectedEvent, onClose, selectedEventId]);

  const sortedEvents = useMemo(() => {
    const regularEvents = [];
    const subscriptionEvents = [];

    events.forEach((event) => {
      if (isSubscriptionEvent(event)) {
        subscriptionEvents.push(event);
        return;
      }

      regularEvents.push(event);
    });

    return [...regularEvents, ...subscriptionEvents];
  }, [events]);

  if (!isOpen || !selectedDate) {
    return null;
  }

  const selectedEvent =
    sortedEvents.find((event) => event.id === selectedEventId) || null;
  const isDetailView = Boolean(selectedEvent);

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="calendar-event-modal-overlay"
      onClick={onClose}
    >
      <div
        className={`calendar-event-modal${isDetailView ? " is-detail-view" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="calendar-event-modal__scroll">
          <div className="calendar-event-modal__header">
            <div className="calendar-event-modal__eyebrow">
              <span className="calendar-event-modal__eyebrow-icon">
                <CalendarBadgeIcon />
              </span>
              <span>{isDetailView ? "상세 일정" : "선택한 날짜"}</span>
            </div>

            <button
              aria-label="일정 창 닫기"
              className="calendar-event-modal__close"
              type="button"
              onClick={onClose}
            >
              <CloseIcon size={18} />
            </button>
          </div>

          <div className="calendar-event-modal__hero">
            <h2 className="calendar-event-modal__title">
              {formatSelectedDate(selectedDate)}
            </h2>

            {!isDetailView && sortedEvents.length > 0 ? (
              <div className="calendar-event-modal__count">
                일정 {sortedEvents.length}개
              </div>
            ) : null}
          </div>

          {sortedEvents.length === 0 ? (
            <div className="calendar-event-modal__empty">
              <strong>등록된 일정이 없습니다.</strong>
              <p>이 날짜에는 아직 확인할 일정이 없어요.</p>
            </div>
          ) : null}

          {!isDetailView && sortedEvents.length > 0 ? (
            <div className="calendar-event-modal__list-shell">
              <div className="calendar-event-modal__list-copy">
                <strong>일정을 선택하면 상세 내용을 수정할 수 있습니다.</strong>
                <span>
                  제목, 시간, 장소, 설명이 있는 카드형 상세 화면으로 이동합니다.
                </span>
              </div>

              <div className="calendar-event-modal__list">
                {sortedEvents.map((event, index) => (
                  <button
                    key={event.id}
                    type="button"
                    className="calendar-event-modal__event-card"
                    onClick={() => onSelectEvent?.(event.id)}
                  >
                    <span className="calendar-event-modal__event-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div className="calendar-event-modal__event-body">
                      <strong>
                        {event.title || "제목 없는 일정"}
                      </strong>
                      <span>{formatEventTimeRange(event)}</span>
                      {event.location ? (
                        <small>{event.location}</small>
                      ) : (
                        <small>장소 미정</small>
                      )}
                    </div>

                    <span className="calendar-event-modal__event-arrow">
                      <ChevronRightIcon />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {isDetailView ? (
            <EventDetailForm
              event={selectedEvent}
              saving={savingEventId === selectedEvent.id}
              deleting={deletingEventId === selectedEvent.id}
              detailStatus={detailStatus}
              onBack={onClearSelectedEvent}
              onSave={onSaveEvent}
              onDelete={onDeleteEvent}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default DayScheduleModal;
