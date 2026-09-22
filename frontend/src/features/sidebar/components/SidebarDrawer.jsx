import { useEffect, useMemo, useRef, useState } from "react";
import CloseIcon from "../../../shared/ui/CloseIcon";
import UserHeader from "../../auth/components/UserHeader";

const holdDelayMs = 450;

function formatConversationMeta(updatedAt) {
  if (!updatedAt) {
    return "방금 전";
  }

  const updatedTime = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - updatedTime.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  return `${updatedTime.getMonth() + 1}/${updatedTime.getDate()}`;
}

function Icon({ name }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    style: { display: "block" },
  };

  switch (name) {
    case "compose":
      return (
        <svg {...props}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "archive":
      return (
        <svg {...props}>
          <path d="M3 7.5h18" />
          <path d="M5.5 4h13A1.5 1.5 0 0 1 20 5.5v3A1.5 1.5 0 0 1 18.5 10h-13A1.5 1.5 0 0 1 4 8.5v-3A1.5 1.5 0 0 1 5.5 4Z" />
          <path d="M6 10v8.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V10" />
          <path d="M10 13h4" />
        </svg>
      );
    case "subscription":
      return (
        <svg {...props}>
          <path
            d="M6 17.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Z"
            fill="currentColor"
            stroke="none"
          />
          <path d="M5.5 12.5a6 6 0 0 1 6 6" />
          <path d="M5.5 8a10.5 10.5 0 0 1 10.5 10.5" />
        </svg>
      );
    case "chat":
      return (
        <svg {...props}>
          <path d="M7 18.5 3.5 20v-4.5A7.5 7.5 0 1 1 11 19a8 8 0 0 1-4-.5Z" />
        </svg>
      );
    case "pin":
      return (
        <svg {...props}>
          <path d="m15 4 5 5" />
          <path d="M9.5 20.5 10 14l-6-6 9-4 5 5-4 9-6.5.5Z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...props}>
          <path d="M4 7h16" />
          <path d="M9 3h6" />
          <path d="M6.5 7 7 19.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L17.5 7" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      );
    case "rename":
      return (
        <svg {...props}>
          <path d="M4 20h16" />
          <path d="M6 16V7.5A2.5 2.5 0 0 1 8.5 5h7A2.5 2.5 0 0 1 18 7.5V16" />
          <path d="M9 9h6" />
        </svg>
      );
    case "logout":
      return (
        <svg {...props}>
          <path d="M10 5.5H7.5A1.5 1.5 0 0 0 6 7v10a1.5 1.5 0 0 0 1.5 1.5H10" />
          <path d="M13 16.5 18 12l-5-4.5" />
          <path d="M18 12H9" />
        </svg>
      );
    default:
      return null;
  }
}

function SidebarDrawer({
  isOpen,
  onClose,
  conversations,
  currentConversationId,
  onCreateConversation,
  onSelectConversation,
  onRenameConversation,
  onTogglePin,
  onToggleArchive,
  onMoveToTrash,
  onOpenArchive,
  onOpenSubscription,
  onOpenProfilePage,
  user,
  profileForm,
  onLogout,
}) {
  const holdTimerRef = useRef(null);
  const holdTriggeredRef = useRef(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [renameTargetId, setRenameTargetId] = useState(null);

  const resetTransientState = () => {
    setSelectedConversation(null);
    setSearchQuery("");
    setRenameTargetId(null);
    setRenameDraft("");
  };

  const activeSelectedConversation = selectedConversation
    ? conversations.find((conversation) => conversation.id === selectedConversation.id) ||
      selectedConversation
    : null;

  const renameTarget = renameTargetId
    ? conversations.find((conversation) => conversation.id === renameTargetId) || null
    : null;

  const filteredConversations = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();

    if (!trimmedQuery) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      (conversation.title || "제목 없음").toLowerCase().includes(trimmedQuery)
    );
  }, [conversations, searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEscapeKey = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (renameTargetId) {
        setRenameTargetId(null);
        setRenameDraft("");
        return;
      }

      if (activeSelectedConversation) {
        setSelectedConversation(null);
        return;
      }

      resetTransientState();
      onClose?.();
    };

    window.addEventListener("keydown", handleEscapeKey);

    return () => {
      window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [activeSelectedConversation, isOpen, onClose, renameTargetId]);

  const clearHoldTimer = () => {
    if (!holdTimerRef.current) {
      return;
    }

    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  };

  useEffect(() => clearHoldTimer, []);

  const handleCloseDrawer = () => {
    clearHoldTimer();
    resetTransientState();
    onClose?.();
  };

  const startHoldTimer = (conversation) => {
    clearHoldTimer();
    holdTriggeredRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      holdTriggeredRef.current = true;
      setSelectedConversation(conversation);
      holdTimerRef.current = null;
    }, holdDelayMs);
  };

  const openRenameDialog = () => {
    if (!activeSelectedConversation) {
      return;
    }

    setRenameTargetId(activeSelectedConversation.id);
    setRenameDraft(activeSelectedConversation.title || "제목 없음");
    setSelectedConversation(null);
  };

  const closeRenameDialog = () => {
    setRenameTargetId(null);
    setRenameDraft("");
  };

  const handleRenameSubmit = (event) => {
    event.preventDefault();

    const nextTitle = renameDraft.trim();

    if (!renameTargetId || !nextTitle) {
      return;
    }

    onRenameConversation?.(renameTargetId, nextTitle);
    closeRenameDialog();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="sidebar-overlay" onClick={handleCloseDrawer}>
        <aside
          className="sidebar-drawer"
          aria-label="대화 사이드바"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sidebar-drawer__top">
            <div className="sidebar-drawer__header">
              <div className="sidebar-drawer__title-block">
                <strong>작업 공간</strong>
                <span>일정 대화를 만들고 상태를 관리합니다.</span>
              </div>
              <button
                type="button"
                className="sidebar-close"
                onClick={handleCloseDrawer}
              >
                <CloseIcon size={16} strokeWidth={2} />
              </button>
            </div>

            <label className="sidebar-search" aria-label="대화 검색">
              <span className="sidebar-search__icon">
                <Icon name="search" />
              </span>
              <input
                type="text"
                className="sidebar-search__input"
                placeholder="검색"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <div className="sidebar-drawer__section-label">메뉴</div>

            <div className="sidebar-drawer__actions">
            <button
              type="button"
              className="sidebar-action sidebar-action--new"
              onClick={() => {
                onCreateConversation?.();
                handleCloseDrawer();
              }}
            >
              <span className="sidebar-action__icon">
                <Icon name="compose" />
              </span>
              <span className="sidebar-action__content">
                <strong>새 대화</strong>
                <span>새 일정 초안을 시작합니다.</span>
              </span>
            </button>

            <button
              type="button"
              className="sidebar-action sidebar-action--archive"
              onClick={() => {
                onOpenArchive?.();
                handleCloseDrawer();
              }}
            >
              <span className="sidebar-action__icon">
                <Icon name="archive" />
              </span>
              <span className="sidebar-action__content">
                <strong>보관함 열기</strong>
                <span>보관한 대화와 삭제한 대화를 확인합니다.</span>
              </span>
            </button>
            <button
              type="button"
              className="sidebar-action sidebar-action--subscription"
              onClick={() => {
                onOpenSubscription?.();
                if (onOpenSubscription) {
                  handleCloseDrawer();
                }
              }}
            >
              <span className="sidebar-action__icon sidebar-action__icon--subscription">
                <Icon name="subscription" />
              </span>
              <span className="sidebar-action__content">
                <strong>구독관리</strong>
                <span>게임과 소식 구독하기</span>
              </span>
            </button>
            </div>
          </div>

          <div className="sidebar-drawer__list">
            <div className="sidebar-drawer__section-label">최근 대화</div>
            {filteredConversations.length === 0 ? (
              <div className="sidebar-drawer__empty">
                <strong>
                  {searchQuery.trim()
                    ? "검색 결과가 없습니다."
                    : "아직 대화가 없습니다."}
                </strong>
                <span>
                  {searchQuery.trim()
                    ? "다른 검색어로 다시 시도해보세요."
                    : "새 대화를 만들고 일정 초안을 정리해보세요."}
                </span>
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`sidebar-chat-item${
                    currentConversationId === conversation.id ? " is-active" : ""
                  }`}
                  onClick={() => {
                    if (holdTriggeredRef.current) {
                      holdTriggeredRef.current = false;
                      return;
                    }

                    onSelectConversation?.(conversation.id);
                    handleCloseDrawer();
                  }}
                  onPointerDown={() => startHoldTimer(conversation)}
                  onPointerUp={clearHoldTimer}
                  onPointerLeave={clearHoldTimer}
                  onPointerCancel={clearHoldTimer}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    clearHoldTimer();
                    setSelectedConversation(conversation);
                  }}
                >
                  <span className="sidebar-chat-item__icon">
                    <Icon name="chat" />
                  </span>
                  <span className="sidebar-chat-item__body">
                    <strong>{conversation.title || "제목 없음"}</strong>
                    <span className="sidebar-chat-item__meta-row">
                      <span>{formatConversationMeta(conversation.updatedAt)}</span>
                      {conversation.isPinned ? (
                        <span className="sidebar-chat-item__badge sidebar-chat-item__badge--pin">
                          고정됨
                        </span>
                      ) : null}
                      {conversation.isArchived ? (
                        <span className="sidebar-chat-item__badge">보관됨</span>
                      ) : null}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="sidebar-drawer__footer">
            <div className="sidebar-profile">
              <UserHeader
                user={user}
                form={profileForm}
                onOpenProfilePage={() => {
                  onOpenProfilePage?.();
                  handleCloseDrawer();
                }}
                triggerClassName="sidebar-profile__avatar"
              />
              <div className="sidebar-profile__copy">
                <strong>{profileForm?.displayName || user?.name || "이름 없음"}</strong>
                <span>{user?.email || "이메일 없음"}</span>
              </div>
              <button
                type="button"
                className="sidebar-profile__logout"
                aria-label="로그아웃"
                onClick={onLogout}
              >
                <Icon name="logout" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {activeSelectedConversation ? (
        <div
          className="bottom-sheet-overlay"
          onClick={() => setSelectedConversation(null)}
        >
          <div
            className="bottom-sheet"
            role="dialog"
            aria-label="대화 작업"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bottom-sheet__handle" />
            <div className="bottom-sheet__header">
              <strong>{activeSelectedConversation.title || "제목 없음"}</strong>
              <span>{formatConversationMeta(activeSelectedConversation.updatedAt)}</span>
            </div>
            <div className="bottom-sheet__actions">
              <button
                type="button"
                className="bottom-sheet__action"
                onClick={openRenameDialog}
              >
                <span className="bottom-sheet__action-icon">
                  <Icon name="rename" />
                </span>
                <span>이름 바꾸기</span>
              </button>
              <button
                type="button"
                className={`bottom-sheet__action${
                  activeSelectedConversation.isPinned ? " is-active" : ""
                }`}
                onClick={() => {
                  onTogglePin?.(activeSelectedConversation.id);
                  setSelectedConversation(null);
                }}
              >
                <span className="bottom-sheet__action-icon">
                  <Icon name="pin" />
                </span>
                <span>
                  {activeSelectedConversation.isPinned
                    ? "상단 고정 해제"
                    : "상단 고정"}
                </span>
              </button>
              <button
                type="button"
                className={`bottom-sheet__action${
                  activeSelectedConversation.isArchived ? " is-active" : ""
                }`}
                onClick={() => {
                  onToggleArchive?.(activeSelectedConversation.id);
                  setSelectedConversation(null);
                }}
              >
                <span className="bottom-sheet__action-icon">
                  <Icon name="archive" />
                </span>
                <span>
                  {activeSelectedConversation.isArchived
                    ? "보관함에서 꺼내기"
                    : "보관함으로 이동"}
                </span>
              </button>
              <button
                type="button"
                className="bottom-sheet__action bottom-sheet__action--danger"
                onClick={() => {
                  onMoveToTrash?.(activeSelectedConversation.id);
                  setSelectedConversation(null);
                }}
              >
                <span className="bottom-sheet__action-icon">
                  <Icon name="trash" />
                </span>
                <span>휴지통으로 이동</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {renameTarget ? (
        <div className="sidebar-dialog-overlay" onClick={closeRenameDialog}>
          <form
            className="sidebar-dialog"
            onSubmit={handleRenameSubmit}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sidebar-dialog__header">
              <div>
                <strong>대화 이름 바꾸기</strong>
                <span>변경한 제목은 사이드바와 보관함 목록에 반영됩니다.</span>
              </div>
              <button
                type="button"
                className="sidebar-close"
                onClick={closeRenameDialog}
              >
                <CloseIcon size={16} strokeWidth={2} />
              </button>
            </div>

            <label className="sidebar-dialog__field">
              <span>대화 제목</span>
              <input
                type="text"
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                placeholder="제목을 입력하세요"
                autoFocus
              />
            </label>

            <div className="sidebar-dialog__actions">
              <button
                type="button"
                className="sidebar-dialog__button"
                onClick={closeRenameDialog}
              >
                취소
              </button>
              <button
                type="submit"
                className="sidebar-dialog__button sidebar-dialog__button--primary"
                disabled={!renameDraft.trim()}
              >
                저장
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export default SidebarDrawer;
