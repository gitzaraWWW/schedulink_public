import { useEffect, useMemo, useState } from "react";
import CloseIcon from "../../../shared/ui/CloseIcon";
import {
  fetchSubscriptionEvents,
  fetchSubscriptions,
  updateSubscription,
  updateSubscriptionEventPreferences,
} from "../api/subscriptionApi";

const DEFAULT_SUBSCRIPTION_ITEMS = [
  {
    id: "maplestory",
    code: "maplestory",
    title: "메이플스토리",
    category: "MMORPG",
    description: "추후 업데이트 예정",
    accent: "orange",
    iconUrl: "",
    subscribed: false,
  },
  {
    id: "game_a",
    code: "game_a",
    title: "게임A",
    category: "MOBA",
    description: "추후 업데이트 예정",
    accent: "gold",
    iconUrl: "",
    subscribed: false,
  },
  {
    id: "game_b",
    code: "game_b",
    title: "게임B",
    category: "FPS",
    description: "추후 업데이트 예정",
    accent: "rose",
    iconUrl: "",
    subscribed: false,
  },
  {
    id: "game_c",
    code: "game_c",
    title: "게임C",
    category: "RPG",
    description: "추후 업데이트 예정",
    accent: "violet",
    iconUrl: "",
    subscribed: false,
  },
  {
    id: "ai_content_engineering",
    code: "ai_content_engineering",
    title: "AI콘텐츠공학과",
    category: "학과",
    description: "추후 업데이트 예정",
    accent: "mint",
    iconUrl: "",
    subscribed: false,
  },
];

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path
        d="M15.5 4.5 8 12l7.5 7.5"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m16 16 3.75 3.75"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FeedIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M6 17.25a1 1 0 1 1 0 1.99 1 1 0 0 1 0-1.99Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M5.75 12.5a5.75 5.75 0 0 1 5.75 5.75" stroke="currentColor" strokeWidth="1.9" />
      <path d="M5.75 7.75a10.5 10.5 0 0 1 10.5 10.5" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="m4.75 10 3.25 3.25L15.25 6"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M7 4v3M17 4v3M4.5 9.5h15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="4.5"
        y="6.5"
        width="15"
        height="13"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M8 4.75h7.25V12M15 5 7.25 12.75"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.25 10.25v3A2 2 0 0 1 13.25 15.25h-8.5a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardIcon({ accent, iconUrl, title }) {
  const [imageFailed, setImageFailed] = useState(false);
  const normalizedIconUrl = String(iconUrl || "").trim();
  const shouldShowImage = Boolean(normalizedIconUrl) && !imageFailed;

  return (
    <span className={`subscription-page__card-icon subscription-page__card-icon--${accent}`}>
      {shouldShowImage ? (
        <img
          src={normalizedIconUrl}
          alt={`${title} 아이콘`}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <FeedIcon />
      )}
    </span>
  );
}

function FilterTab({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      className={`subscription-page__filter${active ? " is-active" : ""}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}

function formatEventDateRange(startDate, endDate) {
  if (!startDate) {
    return "일정 날짜 미정";
  }

  const formatter = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const start = new Date(`${startDate}T00:00:00+09:00`);

  if (Number.isNaN(start.getTime())) {
    return startDate;
  }

  if (!endDate || endDate === startDate) {
    return formatter.format(start);
  }

  const end = new Date(`${endDate}T00:00:00+09:00`);

  if (Number.isNaN(end.getTime())) {
    return formatter.format(start);
  }

  return `${formatter.format(start)} ~ ${formatter.format(end)}`;
}

function buildSubscriptionPreview(events) {
  const selectedCount = events.filter((event) => event.selected).length;
  return `${events.length}개 중 ${selectedCount}개 선택됨`;
}

function createInitialModalState() {
  return {
    isOpen: false,
    item: null,
    events: [],
    loading: false,
    saving: false,
    error: "",
    subscribeOnSave: false,
  };
}

function SubscriptionEventModal({
  modalState,
  onClose,
  onToggleEvent,
  onSelectAll,
  onClearAll,
  onSave,
}) {
  useEffect(() => {
    if (!modalState.isOpen) {
      return undefined;
    }

    const handleEscapeKey = (event) => {
      if (event.key === "Escape" && !modalState.saving) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscapeKey);
    return () => window.removeEventListener("keydown", handleEscapeKey);
  }, [modalState.isOpen, modalState.saving, onClose]);

  if (!modalState.isOpen) {
    return null;
  }

  const selectedCount = modalState.events.filter((event) => event.selected).length;
  const saveLabel =
    selectedCount === 0 ? "저장 (선택 없음)" : `저장 (${selectedCount}개 선택)`;

  return (
    <div
      className="subscription-event-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!modalState.saving) {
          onClose();
        }
      }}
    >
      <div
        className="subscription-event-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="subscription-event-modal__header">
          <div className="subscription-event-modal__title-group">
            <span className="subscription-event-modal__badge">
              <CardIcon
                accent={modalState.item?.accent || "mint"}
                iconUrl={modalState.item?.iconUrl || ""}
                title={modalState.item?.title || "구독"}
              />
            </span>
            <div className="subscription-event-modal__title-copy">
              <strong>{modalState.item?.title || "구독 이벤트"}</strong>
              <p>캘린더에 표시할 이벤트를 선택하세요.</p>
            </div>
          </div>

          <button
            type="button"
            className="subscription-event-modal__close"
            aria-label="이벤트 선택창 닫기"
            onClick={onClose}
            disabled={modalState.saving}
          >
            <CloseIcon size={26} strokeWidth={2.4} />
          </button>
        </div>

        <div className="subscription-event-modal__toolbar">
          <div className="subscription-event-modal__summary">
            <strong>
              {modalState.loading ? "불러오는 중..." : buildSubscriptionPreview(modalState.events)}
            </strong>
            <span>선택 상태는 이후 이벤트 보기 버튼으로 언제든 수정할 수 있습니다.</span>
          </div>

          <div className="subscription-event-modal__toolbar-actions">
            <button
              type="button"
              onClick={onSelectAll}
              disabled={modalState.loading || modalState.saving}
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={onClearAll}
              disabled={modalState.loading || modalState.saving}
            >
              전체 해제
            </button>
          </div>
        </div>

        {modalState.error ? (
          <div className="subscription-event-modal__error" role="status" aria-live="polite">
            {modalState.error}
          </div>
        ) : null}

        <div className="subscription-event-modal__body">
          {modalState.loading ? (
            <div className="subscription-event-modal__empty">
              <strong>구독 이벤트를 불러오는 중입니다</strong>
              <p>잠시만 기다려 주세요.</p>
            </div>
          ) : modalState.events.length === 0 ? (
            <div className="subscription-event-modal__empty">
              <strong>선택할 이벤트가 없습니다</strong>
              <p>현재 이 구독 항목에는 표시할 이벤트가 없습니다.</p>
            </div>
          ) : (
            <div className="subscription-event-modal__list">
              {modalState.events.map((event) => (
                <label
                  key={event.externalEventId}
                  className={`subscription-event-modal__item${
                    event.selected ? " is-selected" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={event.selected}
                    onChange={() => onToggleEvent(event.externalEventId)}
                    disabled={modalState.saving}
                  />
                  <span className="subscription-event-modal__checkbox" aria-hidden="true">
                    <CheckIcon />
                  </span>

                  <span className="subscription-event-modal__item-copy">
                    <strong>{event.title}</strong>
                    {event.description ? <span>{event.description}</span> : null}
                    <small>
                      <CalendarIcon />
                      <span>{formatEventDateRange(event.startDate, event.endDate)}</span>
                    </small>
                    {event.detailUrl ? (
                      <a
                        href={event.detailUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(eventObject) => eventObject.stopPropagation()}
                      >
                        <ExternalLinkIcon />
                        <span>상세 페이지 열기</span>
                      </a>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="subscription-event-modal__footer">
          <button
            type="button"
            className="subscription-event-modal__secondary"
            onClick={onClose}
            disabled={modalState.saving}
          >
            취소
          </button>
          <button
            type="button"
            className="subscription-event-modal__primary"
            onClick={onSave}
            disabled={modalState.loading || modalState.saving}
          >
            {modalState.saving ? "저장 중..." : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionCard({
  item,
  disabled,
  onOpenEvents,
  onToggle,
}) {
  const handleOpen = () => onOpenEvents(item, { subscribeOnSave: !item.subscribed });

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpen();
    }
  };

  return (
    <article
      className={`subscription-page__card${item.subscribed ? " is-subscribed" : ""}`}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      <div className="subscription-page__card-top">
        <CardIcon accent={item.accent} iconUrl={item.iconUrl} title={item.title} />

        <div className="subscription-page__card-copy">
          <div className="subscription-page__card-head">
            <div className="subscription-page__card-title-row">
              <strong>{item.title}</strong>
              <span className="subscription-page__tag">{item.category}</span>
              {item.subscribed ? (
                <span className="subscription-page__tag subscription-page__tag--subscribed">
                  구독중
                </span>
              ) : null}
            </div>

            <button
              type="button"
              className={`subscription-page__switch${item.subscribed ? " is-on" : ""}`}
              role="switch"
              aria-checked={item.subscribed}
              aria-label={`${item.title} 구독 전환`}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onToggle(item.id);
              }}
            >
              <span className="subscription-page__switch-thumb" />
            </button>
          </div>

          <p>{item.description}</p>

          <div className="subscription-page__card-actions">
            <button
              type="button"
              className="subscription-page__card-action"
              onClick={(event) => {
                event.stopPropagation();
                handleOpen();
              }}
            >
              이벤트 보기
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function SubscriptionView({ onBack, onSubscriptionChanged }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [savingIds, setSavingIds] = useState([]);
  const [eventModal, setEventModal] = useState(createInitialModalState());

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscriptions() {
      try {
        setLoading(true);
        setLoadError("");
        const data = await fetchSubscriptions();
        const nextItems =
          Array.isArray(data.items) && data.items.length > 0
            ? data.items
            : DEFAULT_SUBSCRIPTION_ITEMS;

        if (cancelled) {
          return;
        }

        setItems(nextItems);

        if (!Array.isArray(data.items) || data.items.length === 0) {
          setActionError("등록된 구독 항목이 없어 기본 항목으로 표시 중입니다.");
        }
      } catch (nextLoadError) {
        if (cancelled) {
          return;
        }

        setItems(DEFAULT_SUBSCRIPTION_ITEMS);
        setActionError("구독 정보를 불러오지 못해 기본 항목으로 표시 중입니다.");
        setLoadError(nextLoadError.message || "");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSubscriptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const subscribedCount = items.filter((item) => item.subscribed).length;

    return {
      all: items.length,
      subscribed: subscribedCount,
      unsubscribed: items.length - subscribedCount,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      if (activeFilter === "subscribed" && !item.subscribed) {
        return false;
      }

      if (activeFilter === "unsubscribed" && item.subscribed) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const title = String(item.title || "").toLowerCase();
      const category = String(item.category || "").toLowerCase();
      const description = String(item.description || "").toLowerCase();

      return (
        title.includes(normalizedQuery) ||
        category.includes(normalizedQuery) ||
        description.includes(normalizedQuery)
      );
    });
  }, [activeFilter, items, searchQuery]);

  const closeEventModal = () => {
    if (eventModal.saving) {
      return;
    }

    setEventModal(createInitialModalState());
  };

  const openEventModal = async (item, { subscribeOnSave = false } = {}) => {
    setActionError("");
    setEventModal({
      isOpen: true,
      item,
      events: [],
      loading: true,
      saving: false,
      error: "",
      subscribeOnSave,
    });

    try {
      const data = await fetchSubscriptionEvents(item.code);
      setEventModal({
        isOpen: true,
        item: { ...item, ...(data.item || {}) },
        events: Array.isArray(data.events) ? data.events : [],
        loading: false,
        saving: false,
        error: "",
        subscribeOnSave,
      });
    } catch (error) {
      setEventModal({
        isOpen: true,
        item,
        events: [],
        loading: false,
        saving: false,
        error: error.message || "구독 이벤트를 불러오지 못했습니다.",
        subscribeOnSave,
      });
    }
  };

  const handleToggleSubscription = async (itemId) => {
    const currentItem = items.find((item) => item.id === itemId);

    if (!currentItem || savingIds.includes(itemId)) {
      return;
    }

    if (!currentItem.subscribed) {
      await openEventModal(currentItem, { subscribeOnSave: true });
      return;
    }

    setSavingIds((currentIds) => [...currentIds, itemId]);
    setActionError("");

    try {
      await updateSubscription(itemId, false);
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === itemId ? { ...item, subscribed: false } : item
        )
      );
      if (eventModal.item?.id === itemId) {
        setEventModal(createInitialModalState());
      }
      await onSubscriptionChanged?.();
    } catch (updateError) {
      setActionError(updateError.message || "구독 상태를 변경하지 못했습니다.");
    } finally {
      setSavingIds((currentIds) => currentIds.filter((currentId) => currentId !== itemId));
    }
  };

  const handleToggleModalEvent = (externalEventId) => {
    if (eventModal.saving) {
      return;
    }

    setEventModal((currentState) => ({
      ...currentState,
      events: currentState.events.map((event) =>
        event.externalEventId === externalEventId
          ? { ...event, selected: !event.selected, excluded: event.selected }
          : event
      ),
    }));
  };

  const handleSelectAllEvents = () => {
    if (eventModal.saving) {
      return;
    }

    setEventModal((currentState) => ({
      ...currentState,
      events: currentState.events.map((event) => ({
        ...event,
        selected: true,
        excluded: false,
      })),
    }));
  };

  const handleClearAllEvents = () => {
    if (eventModal.saving) {
      return;
    }

    setEventModal((currentState) => ({
      ...currentState,
      events: currentState.events.map((event) => ({
        ...event,
        selected: false,
        excluded: true,
      })),
    }));
  };

  const handleSaveEventPreferences = async () => {
    if (!eventModal.item || eventModal.loading || eventModal.saving) {
      return;
    }

    const excludedExternalEventIds = eventModal.events
      .filter((event) => !event.selected)
      .map((event) => event.externalEventId);

    setEventModal((currentState) => ({
      ...currentState,
      saving: true,
      error: "",
    }));

    try {
      const preferenceResult = await updateSubscriptionEventPreferences(
        eventModal.item.code,
        excludedExternalEventIds
      );

      if (eventModal.subscribeOnSave) {
        await updateSubscription(eventModal.item.code, true);
      }

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.code === eventModal.item.code
            ? { ...item, ...(preferenceResult.item || {}), subscribed: true }
            : item
        )
      );

      setEventModal(createInitialModalState());
      await onSubscriptionChanged?.();
    } catch (error) {
      setEventModal((currentState) => ({
        ...currentState,
        saving: false,
        error: error.message || "이벤트 선택 상태를 저장하지 못했습니다.",
      }));
    }
  };

  const emptyMessage = loading
    ? {
        title: "구독 항목을 불러오는 중입니다",
        description: "잠시만 기다려 주세요.",
      }
    : loadError
      ? {
          title: "구독 항목을 불러오지 못했습니다",
          description: loadError,
        }
      : {
          title: "조건에 맞는 구독 항목이 없습니다",
          description: "검색어를 바꾸거나 다른 필터를 선택해 다시 확인해 보세요.",
        };

  return (
    <>
      <div className="subscription-page-shell">
        <div className="subscription-page">
          <section className="subscription-page__intro">
            <div className="subscription-page__header">
              <div className="subscription-page__topbar">
                <button type="button" className="subscription-page__back" onClick={onBack}>
                  <ArrowLeftIcon />
                </button>
                <div className="subscription-page__title-group">
                  <span className="subscription-page__feed-badge">
                    <FeedIcon />
                  </span>
                  <strong className="subscription-page__title">구독관리</strong>
                </div>
                <div className="subscription-page__summary-badge">
                  <span className="subscription-page__summary-dot" />
                  <strong>{counts.subscribed}개 구독중</strong>
                </div>
              </div>
            </div>

            <div className="subscription-page__panel">
              <p className="subscription-page__description">
                관심 있는 게임이나 소식을 구독하면 캘린더에 필요한 일정과 업데이트 알림을
                빠르게 모아볼 수 있어요.
              </p>

              <label className="subscription-page__search" aria-label="구독 항목 검색">
                <span className="subscription-page__search-icon">
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="게임이나 소식 검색..."
                />
              </label>

              <div className="subscription-page__filters" role="tablist" aria-label="구독 필터">
                <FilterTab
                  active={activeFilter === "all"}
                  label="전체"
                  count={counts.all}
                  onClick={() => setActiveFilter("all")}
                />
                <FilterTab
                  active={activeFilter === "subscribed"}
                  label="구독중"
                  count={counts.subscribed}
                  onClick={() => setActiveFilter("subscribed")}
                />
                <FilterTab
                  active={activeFilter === "unsubscribed"}
                  label="미구독"
                  count={counts.unsubscribed}
                  onClick={() => setActiveFilter("unsubscribed")}
                />
              </div>
            </div>
          </section>

          <div className="subscription-page__body">
            {actionError ? (
              <div className="subscription-page__inline-error" role="status" aria-live="polite">
                {actionError}
              </div>
            ) : null}

            {loading || loadError || filteredItems.length === 0 ? (
              <div className="subscription-page__empty">
                <strong>{emptyMessage.title}</strong>
                <p>{emptyMessage.description}</p>
              </div>
            ) : (
              <div className="subscription-page__list">
                {filteredItems.map((item) => (
                  <SubscriptionCard
                    key={item.id}
                    item={item}
                    disabled={savingIds.includes(item.id)}
                    onOpenEvents={openEventModal}
                    onToggle={handleToggleSubscription}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <SubscriptionEventModal
        modalState={eventModal}
        onClose={closeEventModal}
        onToggleEvent={handleToggleModalEvent}
        onSelectAll={handleSelectAllEvents}
        onClearAll={handleClearAllEvents}
        onSave={handleSaveEventPreferences}
      />
    </>
  );
}

export default SubscriptionView;
