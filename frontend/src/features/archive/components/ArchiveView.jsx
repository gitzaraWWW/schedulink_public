import { useEffect, useMemo, useState } from "react";
import CloseIcon from "../../../shared/ui/CloseIcon";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m16 16 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatArchiveDate(timestamp) {
  if (!timestamp) {
    return "날짜 없음";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "날짜 없음";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}. ${month}. ${day}.`;
}

function buildMetaLabel(conversation) {
  const parts = [];

  if (conversation.messagesLoaded) {
    parts.push(`메시지 ${conversation.messages.length}개`);
  }

  if (conversation.createdAt) {
    parts.push(`생성 ${formatArchiveDate(conversation.createdAt)}`);
  }

  return parts.join(" · ") || "기록 없음";
}

function buildPreview(conversation, isTrash) {
  if (conversation.lastMessagePreview?.trim()) {
    return conversation.lastMessagePreview.trim();
  }

  return isTrash
    ? "안건이 삭제되어 휴지통에 보관되었습니다."
    : "보관된 대화입니다. 내용을 다시 확인할 수 있습니다.";
}

function EmptyState({ title, description }) {
  return (
    <div className="archive-modal__empty">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function TabButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`archive-modal__tab${active ? " is-active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ArchiveItem({
  conversation,
  isTrash,
  onSelectConversation,
  onRestoreConversation,
  onDeleteConversationPermanently,
}) {
  const primaryDate = formatArchiveDate(
    isTrash ? conversation.deletedAt || conversation.updatedAt : conversation.updatedAt
  );

  return (
    <article className={`archive-modal__item${isTrash ? " is-trash" : ""}`}>
      <div className="archive-modal__item-head">
        <strong>{conversation.title || "제목 없는 대화"}</strong>
        <span>{primaryDate}</span>
      </div>

      <p className="archive-modal__item-summary">{buildPreview(conversation, isTrash)}</p>

      <div className="archive-modal__item-foot">
        <span className="archive-modal__item-meta">{buildMetaLabel(conversation)}</span>

        <div className="archive-modal__item-actions">
          {isTrash ? (
            <>
              <button
                type="button"
                className="archive-modal__action is-restore"
                onClick={() => onRestoreConversation?.(conversation.id)}
              >
                복원
              </button>
              <button
                type="button"
                className="archive-modal__action is-delete"
                onClick={() => onDeleteConversationPermanently?.(conversation.id)}
              >
                영구 삭제
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="archive-modal__action"
                onClick={() => onSelectConversation?.(conversation.id)}
              >
                내용 보기
              </button>
              <button
                type="button"
                className="archive-modal__action is-restore"
                onClick={() => onRestoreConversation?.(conversation.id)}
              >
                보관 해제
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function ArchiveView({
  isOpen,
  onClose,
  conversations,
  onSelectConversation,
  onRestoreConversation,
  onDeleteConversationPermanently,
}) {
  const [activeTab, setActiveTab] = useState("archive");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setActiveTab("archive");
      setSearchQuery("");
      return undefined;
    }

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleEscapeKey);
    return () => window.removeEventListener("keydown", handleEscapeKey);
  }, [isOpen, onClose]);

  const archivedConversations = useMemo(
    () => conversations.filter((conversation) => conversation.isArchived && !conversation.isDeleted),
    [conversations]
  );

  const trashedConversations = useMemo(
    () => conversations.filter((conversation) => conversation.isDeleted),
    [conversations]
  );

  const visibleConversations = activeTab === "trash" ? trashedConversations : archivedConversations;

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return visibleConversations;
    }

    return visibleConversations.filter((conversation) => {
      const title = (conversation.title || "").toLowerCase();
      const preview = (conversation.lastMessagePreview || "").toLowerCase();

      return title.includes(normalizedQuery) || preview.includes(normalizedQuery);
    });
  }, [searchQuery, visibleConversations]);

  if (!isOpen) {
    return null;
  }

  const currentCount =
    activeTab === "trash" ? `삭제 ${trashedConversations.length}개` : `보관 ${archivedConversations.length}개`;

  return (
    <div className="archive-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="archive-modal" onClick={(event) => event.stopPropagation()}>
        <div className="archive-modal__scroll">
          <div className="archive-modal__header">
            <div className="archive-modal__header-copy">
              <span className="archive-modal__eyebrow">SCHEDULINK</span>
              <h2>보관함</h2>
              <p>보관한 채팅을 열람하고, 삭제한 채팅을 복원하거나 영구 삭제하세요.</p>
            </div>

            <button
              type="button"
              className="archive-modal__close"
              aria-label="보관함 닫기"
              onClick={onClose}
            >
              <CloseIcon
                className="archive-modal__close-icon"
                size={null}
                strokeWidth={2.4}
              />
            </button>
          </div>

          <label className="archive-modal__search" aria-label="보관함 검색">
            <span className="archive-modal__search-icon">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="채팅 제목이나 내용으로 검색..."
            />
          </label>

          <div className="archive-modal__tab-row">
            <div className="archive-modal__tabs" role="tablist" aria-label="보관함 구분">
              <TabButton
                active={activeTab === "archive"}
                label="보관한 채팅"
                onClick={() => setActiveTab("archive")}
              />
              <TabButton
                active={activeTab === "trash"}
                label="휴지통"
                onClick={() => setActiveTab("trash")}
              />
            </div>

            <span className="archive-modal__count">{currentCount}</span>
          </div>

          {filteredConversations.length === 0 ? (
            activeTab === "archive" ? (
              <EmptyState
                title="보관한 대화가 없습니다"
                description="사이드바에서 대화를 보관하면 이곳에서 다시 확인할 수 있습니다."
              />
            ) : (
              <EmptyState
                title="휴지통이 비어 있습니다"
                description="삭제한 대화는 이곳에서 복원하거나 영구 삭제할 수 있습니다."
              />
            )
          ) : (
            <div className="archive-modal__list">
              {filteredConversations.map((conversation) => (
                <ArchiveItem
                  key={conversation.id}
                  conversation={conversation}
                  isTrash={activeTab === "trash"}
                  onSelectConversation={onSelectConversation}
                  onRestoreConversation={onRestoreConversation}
                  onDeleteConversationPermanently={onDeleteConversationPermanently}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ArchiveView;
