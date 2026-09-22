import { useEffect, useMemo, useState } from "react";
import CloseIcon from "../../../shared/ui/CloseIcon";
import { buildInboxCounts, InboxIcon } from "./UnifiedInboxMenu";

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

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 3.75v3.5M16 3.75v3.5M4 9.5h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v4l2.5 1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M12 20s5-4.6 5-9a5 5 0 1 0-10 0c0 4.4 5 9 5 9Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="11" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MessageSquareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M6 7.5h12a2.5 2.5 0 0 1 2.5 2.5v5A2.5 2.5 0 0 1 18 17.5H10l-4.5 3v-3H6A2.5 2.5 0 0 1 3.5 15v-5A2.5 2.5 0 0 1 6 7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M7 7h10M7 12h10M7 17h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashNoticeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
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

function formatSnapshot(snapshot) {
  if (!snapshot) {
    return "정보 없음";
  }

  const parts = [];

  if (snapshot.title) {
    parts.push(snapshot.title);
  }

  if (snapshot.date) {
    parts.push(snapshot.date);
  }

  if (snapshot.startTime || snapshot.endTime) {
    parts.push(
      `${snapshot.startTime || "시간 미정"} ~ ${snapshot.endTime || "시간 미정"}`
    );
  }

  if (snapshot.location) {
    parts.push(snapshot.location);
  }

  return parts.join(" / ") || "정보 없음";
}

function matchesQuery(query, values) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) =>
    String(value || "").toLowerCase().includes(normalizedQuery)
  );
}

function formatInvitationState(participantStatus, invitationStatus) {
  if (participantStatus === "accepted" || invitationStatus === "accepted") {
    return {
      tone: "accepted",
      label: "수락된 초대입니다.",
    };
  }

  if (participantStatus === "rejected" || invitationStatus === "declined") {
    return {
      tone: "rejected",
      label: "거절된 초대입니다.",
    };
  }

  if (participantStatus === "withdrawn") {
    return {
      tone: "muted",
      label: "취소된 초대입니다.",
    };
  }

  return {
    tone: "pending",
    label: "",
  };
}

function getAvatarLabel(name, email) {
  const source = String(name || email || "?").trim();

  if (!source) {
    return "?";
  }

  return source.charAt(0).toUpperCase();
}

function RequestCard({
  personName,
  personEmail,
  profileImage,
  title,
  tone = "pending",
  dismissLabel = "",
  dismissing = false,
  onDismiss,
  metaRows = [],
  actions = null,
  stateLabel = "",
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className={`inbox-invitation-card inbox-invitation-card--request is-${tone}`}>
      {onDismiss ? (
        <button
          type="button"
          aria-label={dismissLabel}
          className="inbox-invitation-card__dismiss"
          disabled={dismissing}
          onClick={onDismiss}
        >
          <CloseIcon size={18} />
        </button>
      ) : null}

      <div className="inbox-invitation-card__person">
        <span className="inbox-invitation-card__avatar">
          {profileImage && !imageFailed ? (
            <img
              src={profileImage}
              alt=""
              aria-hidden="true"
              onError={() => setImageFailed(true)}
            />
          ) : (
            getAvatarLabel(personName, personEmail)
          )}
        </span>
        <div className="inbox-invitation-card__person-copy">
          <strong>{personName}</strong>
          <span>{personEmail || "이메일 정보 없음"}</span>
        </div>
      </div>

      <div className="inbox-invitation-card__event inbox-invitation-card__event--request">
        <strong className="inbox-invitation-card__event-title">{title}</strong>
        <div className="inbox-invitation-card__meta-list">
          {metaRows.map((row) => (
            <div
              key={row.id}
              className={`inbox-invitation-card__meta-row inbox-invitation-card__meta-row--request${
                row.multiline ? " is-multiline" : ""
              }`}
            >
              <span className="inbox-invitation-card__meta-icon">{row.icon}</span>
              <span className="inbox-request-card__meta-copy">
                <strong>{row.label}</strong>
                <small>{row.value}</small>
              </span>
            </div>
          ))}
        </div>
      </div>

      {actions ? (
        <div className="inbox-invitation-card__actions">{actions}</div>
      ) : stateLabel ? (
        <div
          className={`inbox-invitation-card__state inbox-invitation-card__state--${tone}`}
        >
          {stateLabel}
        </div>
      ) : null}
    </article>
  );
}

function SectionTitle({ children }) {
  return (
    <strong
      style={{
        color: "var(--bw-900)",
        fontSize: "15px",
        display: "block",
        marginBottom: "2px",
      }}
    >
      {children}
    </strong>
  );
}

function Card({ children }) {
  return (
    <div
      style={{
        padding: "12px",
        borderRadius: "18px",
        backgroundColor: "var(--bw-white)",
        border: "1px solid #e7edf5",
        display: "grid",
        gap: "8px",
        boxShadow: "0 10px 24px rgba(45, 64, 96, 0.05)",
      }}
    >
      {children}
    </div>
  );
}

function ActionRequestCard({ request, actingRequestId, onReviewProposal }) {
  return (
    <Card>
      <SectionTitle>수정 제안 검토</SectionTitle>
      <div>일정: {request.event?.title || request.before_snapshot?.title || "-"}</div>
      <div>변경 전: {formatSnapshot(request.before_snapshot)}</div>
      <div>변경 후: {formatSnapshot(request.after_snapshot)}</div>
      <div>요청 문장: {request.source_text || "-"}</div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={actingRequestId === request.id}
          onClick={() => onReviewProposal(request.id, "approved")}
        >
          승인
        </button>
        <button
          type="button"
          disabled={actingRequestId === request.id}
          onClick={() => onReviewProposal(request.id, "rejected")}
        >
          거절
        </button>
      </div>
    </Card>
  );
}

function ReceivedRequestCard({ request, actingRequestId, onReviewProposal }) {
  const [imageFailed, setImageFailed] = useState(false);
  const requester = request.requester || {};
  const requesterName = requester.name || "이름 정보 없음";
  const requesterEmail = requester.email || "";
  const requesterProfileImage = String(requester.profile_image || "").trim();
  const isActing = actingRequestId === request.id;

  return (
    <article className="inbox-request-card">
      <div className="inbox-invitation-card__person">
        <span className="inbox-invitation-card__avatar">
          {requesterProfileImage && !imageFailed ? (
            <img
              src={requesterProfileImage}
              alt=""
              aria-hidden="true"
              onError={() => setImageFailed(true)}
            />
          ) : (
            getAvatarLabel(requesterName, requesterEmail)
          )}
        </span>
        <div className="inbox-invitation-card__person-copy">
          <strong>{requesterName}</strong>
          <span>{requesterEmail || "이메일 정보 없음"}</span>
        </div>
      </div>

      <div className="inbox-request-card__body">
        <strong className="inbox-request-card__title">수정 제안 검토</strong>

        <div className="inbox-request-card__message">
          <span className="inbox-request-card__message-label">요청 문장</span>
          <p>{request.source_text || "요청 문장이 없습니다."}</p>
        </div>

        <div className="inbox-request-card__compare">
          <div className="inbox-request-card__compare-item">
            <span>변경 전</span>
            <strong>{formatSnapshot(request.before_snapshot)}</strong>
          </div>
          <div className="inbox-request-card__compare-item is-after">
            <span>변경 후</span>
            <strong>{formatSnapshot(request.after_snapshot)}</strong>
          </div>
        </div>
      </div>

      <div className="inbox-invitation-card__actions">
        <button
          type="button"
          className="inbox-invitation-card__action inbox-invitation-card__action--accept"
          disabled={isActing}
          onClick={() => onReviewProposal(request.id, "approved")}
        >
          {isActing ? "처리 중..." : "승인"}
        </button>
        <button
          type="button"
          className="inbox-invitation-card__action inbox-invitation-card__action--reject"
          disabled={isActing}
          onClick={() => onReviewProposal(request.id, "rejected")}
        >
          거절
        </button>
      </div>
    </article>
  );
}

function DeleteRequestCard({ target, actingTargetId, onRespondDelete }) {
  return (
    <Card>
      <SectionTitle>일정 삭제 요청</SectionTitle>
      <div>일정: {target.event?.title || target.request?.before_snapshot?.title || "-"}</div>
      <div>삭제 대상: {formatSnapshot(target.request?.before_snapshot)}</div>
      <div>요청 문장: {target.request?.source_text || "-"}</div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={actingTargetId === target.id}
          onClick={() => onRespondDelete(target.id, "accepted")}
        >
          수락
        </button>
        <button
          type="button"
          disabled={actingTargetId === target.id}
          onClick={() => onRespondDelete(target.id, "rejected")}
        >
          거절
        </button>
      </div>
    </Card>
  );
}

function DeleteNotificationCard({
  target,
  dismissingNotificationId,
  onDismissDeleteNotification,
}) {
  return (
    <Card>
      <SectionTitle>일정 삭제 알림</SectionTitle>
      <div>일정: {target.event?.title || target.request?.before_snapshot?.title || "-"}</div>
      <div>삭제된 일정: {formatSnapshot(target.request?.before_snapshot)}</div>
      <div>요청 문장: {target.request?.source_text || "-"}</div>
      <div style={{ color: "var(--bw-700)", fontSize: "14px" }}>
        주최자가 일정을 삭제했습니다. 확인 후 목록에서 정리할 수 있습니다.
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "10px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            color: target.read_at ? "var(--bw-600)" : "var(--bw-900)",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {target.read_at ? "읽음" : "새 알림"}
        </span>
        <button
          type="button"
          disabled={dismissingNotificationId === target.id}
          onClick={() => onDismissDeleteNotification?.(target.id)}
        >
          {dismissingNotificationId === target.id ? "지우는 중..." : "지우기"}
        </button>
      </div>
    </Card>
  );
}

function UnifiedReceivedRequestCard({
  request,
  actingRequestId,
  onReviewProposal,
}) {
  const requester = request.requester || {};
  const requesterName = requester.name || "이름 정보 없음";
  const requesterEmail = requester.email || "";
  const requesterProfileImage = String(requester.profile_image || "").trim();
  const isActing = actingRequestId === request.id;

  return (
    <RequestCard
      personName={requesterName}
      personEmail={requesterEmail}
      profileImage={requesterProfileImage}
      title={request.event?.title || request.before_snapshot?.title || "제목 없는 일정"}
      metaRows={[
        {
          id: "request-message",
          icon: <MessageSquareIcon />,
          label: "요청 문장",
          value: request.source_text || "요청 문장이 없습니다.",
          multiline: true,
        },
        {
          id: "before-snapshot",
          icon: <CompareIcon />,
          label: "변경 전",
          value: formatSnapshot(request.before_snapshot),
          multiline: true,
        },
        {
          id: "after-snapshot",
          icon: <CalendarIcon />,
          label: "변경 후",
          value: formatSnapshot(request.after_snapshot),
          multiline: true,
        },
      ]}
      actions={
        <>
          <button
            type="button"
            className="inbox-invitation-card__action inbox-invitation-card__action--accept"
            disabled={isActing}
            onClick={() => onReviewProposal(request.id, "approved")}
          >
            {isActing ? "처리 중..." : "승인"}
          </button>
          <button
            type="button"
            className="inbox-invitation-card__action inbox-invitation-card__action--reject"
            disabled={isActing}
            onClick={() => onReviewProposal(request.id, "rejected")}
          >
            거절
          </button>
        </>
      }
    />
  );
}

function UnifiedDeleteRequestCard({ target, actingTargetId, onRespondDelete }) {
  const request = target.request || {};
  const requester = request.requester || {};
  const requesterName = requester.name || request.requester_name || "요청자";
  const requesterEmail = requester.email || "";
  const requesterProfileImage = String(requester.profile_image || "").trim();
  const isActing = actingTargetId === target.id;

  return (
    <RequestCard
      personName={requesterName}
      personEmail={requesterEmail}
      profileImage={requesterProfileImage}
      title={target.event?.title || request.before_snapshot?.title || "제목 없는 일정"}
      metaRows={[
        {
          id: "delete-request-message",
          icon: <MessageSquareIcon />,
          label: "요청 문장",
          value: request.source_text || "-",
          multiline: true,
        },
        {
          id: "delete-request-target",
          icon: <TrashNoticeIcon />,
          label: "삭제 대상",
          value: formatSnapshot(request.before_snapshot),
          multiline: true,
        },
      ]}
      actions={
        <>
          <button
            type="button"
            className="inbox-invitation-card__action inbox-invitation-card__action--accept"
            disabled={isActing}
            onClick={() => onRespondDelete(target.id, "accepted")}
          >
            {isActing ? "처리 중..." : "수락"}
          </button>
          <button
            type="button"
            className="inbox-invitation-card__action inbox-invitation-card__action--reject"
            disabled={isActing}
            onClick={() => onRespondDelete(target.id, "rejected")}
          >
            거절
          </button>
        </>
      }
    />
  );
}

function UnifiedDeleteNotificationCard({
  target,
  dismissingNotificationId,
  onDismissDeleteNotification,
}) {
  const request = target.request || {};
  const requester = request.requester || {};
  const requesterName = requester.name || request.requester_name || "SCHEDULINK";
  const requesterEmail = requester.email || "";
  const requesterProfileImage = String(requester.profile_image || "").trim();
  const tone = target.read_at ? "muted" : "accepted";
  const stateLabel = target.read_at ? "읽음" : "새 알림";

  return (
    <RequestCard
      personName={requesterName}
      personEmail={requesterEmail}
      profileImage={requesterProfileImage}
      title={target.event?.title || request.before_snapshot?.title || "제목 없는 일정"}
      tone={tone}
      dismissLabel="삭제 알림 지우기"
      dismissing={dismissingNotificationId === target.id}
      onDismiss={() => onDismissDeleteNotification?.(target.id)}
      metaRows={[
        {
          id: "delete-notification-target",
          icon: <TrashNoticeIcon />,
          label: "삭제된 일정",
          value: formatSnapshot(request.before_snapshot),
          multiline: true,
        },
        {
          id: "delete-notification-message",
          icon: <MessageSquareIcon />,
          label: "요청 문장",
          value: request.source_text || "-",
          multiline: true,
        },
        {
          id: "delete-notification-status",
          icon: <CompareIcon />,
          label: "알림 내용",
          value:
            "주최자가 일정을 삭제했습니다. 확인 후 목록에서 정리할 수 있습니다.",
          multiline: true,
        },
      ]}
      stateLabel={stateLabel}
    />
  );
}

function InvitationCard({
  item,
  respondingInvitationId,
  dismissingInvitationId,
  onRespond,
  onDismiss,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const event = item.event || {};
  const participant = item.participant || {};
  const invitation = item.invitation || {};
  const pending =
    participant.status === "pending" && invitation.status === "pending";
  const dismissKey = invitation.id || `participant:${participant.id}`;
  const invitationState = formatInvitationState(participant.status, invitation.status);
  const isDismissing = dismissingInvitationId === dismissKey;
  const isResponding = respondingInvitationId === invitation.id;
  const participantName = participant.name || "이름 정보 없음";
  const participantEmail = participant.email || "";
  const participantProfileImage = String(participant.profile_image || "").trim();
  const eventTitle = event.title || "제목 없는 일정";
  const eventDate = event.date || "날짜 미정";
  const eventTime = `${event.start_time || "-"} ~ ${event.end_time || "-"}`;
  const eventLocation = event.location || "장소 미정";

  return (
    <article className={`inbox-invitation-card is-${invitationState.tone}`}>
      <button
        type="button"
        aria-label="초대 숨기기"
        className="inbox-invitation-card__dismiss"
        disabled={isDismissing}
        onClick={() =>
          onDismiss?.({
            invitationId: invitation.id || null,
            participantId: participant.id || null,
          })
        }
      >
        <CloseIcon size={18} />
      </button>

      <div className="inbox-invitation-card__person">
        <span className="inbox-invitation-card__avatar">
          {participantProfileImage && !imageFailed ? (
            <img
              src={participantProfileImage}
              alt=""
              aria-hidden="true"
              onError={() => setImageFailed(true)}
            />
          ) : (
            getAvatarLabel(participantName, participantEmail)
          )}
        </span>
        <div className="inbox-invitation-card__person-copy">
          <strong>{participantName}</strong>
          <span>{participantEmail || "이메일 정보 없음"}</span>
        </div>
      </div>

      <div className="inbox-invitation-card__event">
        <strong className="inbox-invitation-card__event-title">{eventTitle}</strong>
        <div className="inbox-invitation-card__meta-list">
          <div className="inbox-invitation-card__meta-row">
            <span className="inbox-invitation-card__meta-icon">
              <CalendarIcon />
            </span>
            <span>{eventDate}</span>
          </div>
          <div className="inbox-invitation-card__meta-row">
            <span className="inbox-invitation-card__meta-icon">
              <ClockIcon />
            </span>
            <span>{eventTime}</span>
          </div>
          <div className="inbox-invitation-card__meta-row">
            <span className="inbox-invitation-card__meta-icon">
              <MapPinIcon />
            </span>
            <span>{eventLocation}</span>
          </div>
        </div>
      </div>

      {pending ? (
        <div className="inbox-invitation-card__actions">
          <button
            type="button"
            className="inbox-invitation-card__action inbox-invitation-card__action--accept"
            disabled={isResponding}
            onClick={() =>
              onRespond({
                participantId: participant.id,
                invitationId: invitation.id,
                responseStatus: "accepted",
              })
            }
          >
            {isResponding ? "처리 중..." : "수락하기"}
          </button>
          <button
            type="button"
            className="inbox-invitation-card__action inbox-invitation-card__action--reject"
            disabled={isResponding}
            onClick={() =>
              onRespond({
                participantId: participant.id,
                invitationId: invitation.id,
                responseStatus: "rejected",
              })
            }
          >
            거절하기
          </button>
        </div>
      ) : (
        <div
          className={`inbox-invitation-card__state inbox-invitation-card__state--${invitationState.tone}`}
        >
          {invitationState.label}
        </div>
      )}
    </article>
  );
}

function FilterTab({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      className={`inbox-page__filter${active ? " is-active" : ""}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}

function InboxSection({ title, count, children }) {
  return (
    <section className="inbox-page__section">
      <div className="inbox-page__section-header">
        <strong>{title}</strong>
        <span>{count}건</span>
      </div>
      <div className="inbox-page__section-list">{children}</div>
    </section>
  );
}

function InboxView({
  onBack,
  creatorReviewRequests = [],
  deleteApprovalTargets = [],
  deleteNotifications = [],
  actionLoading,
  actingRequestId,
  actingTargetId,
  dismissingNotificationId,
  onOpenActionItems,
  onReviewProposal,
  onRespondDelete,
  onDismissDeleteNotification,
  invitations = [],
  invitationLoading,
  respondingInvitationId,
  dismissingInvitationId,
  onRespondInvitation,
  onDismissInvitation,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("invites");

  const loading = actionLoading || invitationLoading;
  const counts = buildInboxCounts({
    creatorReviewRequests,
    deleteApprovalTargets,
    deleteNotifications,
    invitations,
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    onOpenActionItems?.();
  }, [onOpenActionItems]);

  const filteredCreatorReviewRequests = useMemo(
    () =>
      creatorReviewRequests.filter((request) =>
        matchesQuery(searchQuery, [
          request.requester?.name,
          request.requester?.email,
          request.event?.title,
          request.before_snapshot?.title,
          request.after_snapshot?.title,
          request.source_text,
        ])
      ),
    [creatorReviewRequests, searchQuery]
  );

  const filteredDeleteApprovalTargets = useMemo(
    () =>
      deleteApprovalTargets.filter((target) =>
        matchesQuery(searchQuery, [
          target.event?.title,
          target.request?.before_snapshot?.title,
          target.request?.source_text,
        ])
      ),
    [deleteApprovalTargets, searchQuery]
  );

  const filteredDeleteNotifications = useMemo(
    () =>
      deleteNotifications.filter((target) =>
        matchesQuery(searchQuery, [
          target.event?.title,
          target.request?.before_snapshot?.title,
          target.request?.source_text,
        ])
      ),
    [deleteNotifications, searchQuery]
  );

  const filteredInvitations = useMemo(
    () =>
      invitations.filter((item) =>
        matchesQuery(searchQuery, [
          item.event?.title,
          item.event?.date,
          item.event?.location,
          item.participant?.name,
          item.participant?.status,
          item.invitation?.status,
        ])
      ),
    [invitations, searchQuery]
  );

  const visibleRequestCount =
    filteredCreatorReviewRequests.length +
    filteredDeleteApprovalTargets.length +
    filteredDeleteNotifications.length;
  const visibleItemCount =
    activeFilter === "requests" ? visibleRequestCount : filteredInvitations.length;

  const emptyMessage = loading
    ? {
        title: "우편함을 불러오는 중입니다",
        description: "잠시만 기다려 주세요.",
      }
    : counts.totalItemCount === 0
      ? {
          title: "처리할 항목이 없습니다",
          description: "변경 요청이나 받은 초대가 생기면 우편함에서 바로 확인할 수 있습니다.",
        }
      : {
          title: "조건에 맞는 항목이 없습니다",
          description: "검색어를 바꾸거나 다른 필터를 선택해 다시 확인해 보세요.",
        };

  return (
    <div className="inbox-page-shell">
      <div className="inbox-page">
        <section className="inbox-page__intro">
          <div className="inbox-page__header">
            <div className="inbox-page__topbar">
              <button type="button" className="inbox-page__back" onClick={onBack}>
                <ArrowLeftIcon />
              </button>
              <div className="inbox-page__title-group">
                <span className="inbox-page__badge">
                  <InboxIcon />
                </span>
                <strong className="inbox-page__title">우편함</strong>
              </div>
              <div className="inbox-page__summary-badge">
                <span className="inbox-page__summary-dot" />
                <strong>{counts.totalBadgeCount}건 처리 필요</strong>
              </div>
            </div>
          </div>

          <div className="inbox-page__panel">
            <p className="inbox-page__description">
              일정 변경 요청, 삭제 알림, 받은 초대를 이곳에서 확인하고 바로 처리할 수 있습니다.
            </p>

            <label className="inbox-page__search" aria-label="우편함 검색">
              <span className="inbox-page__search-icon">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="일정 제목이나 요청 내용을 검색해 보세요"
              />
            </label>

            <div className="inbox-page__filters" role="tablist" aria-label="우편함 필터">
              <FilterTab
                active={activeFilter === "invites"}
                label="받은 초대"
                count={counts.invitationItemCount}
                onClick={() => setActiveFilter("invites")}
              />
              <FilterTab
                active={activeFilter === "requests"}
                label="받은 요청"
                count={counts.requestItemCount}
                onClick={() => setActiveFilter("requests")}
              />
            </div>
          </div>
        </section>

        <div className="inbox-page__body">
          {loading || visibleItemCount === 0 ? (
            <div className="inbox-page__empty">
              <strong>{emptyMessage.title}</strong>
              <p>{emptyMessage.description}</p>
            </div>
          ) : (
            <div className="inbox-page__content">
              {activeFilter === "requests" && visibleRequestCount > 0 ? (
                <InboxSection title="받은 요청" count={visibleRequestCount}>
                  {filteredCreatorReviewRequests.map((request) => (
                    <UnifiedReceivedRequestCard
                      key={`review-${request.id}`}
                      request={request}
                      actingRequestId={actingRequestId}
                      onReviewProposal={onReviewProposal}
                    />
                  ))}

                  {filteredDeleteApprovalTargets.map((target) => (
                    <UnifiedDeleteRequestCard
                      key={`delete-request-${target.id}`}
                      target={target}
                      actingTargetId={actingTargetId}
                      onRespondDelete={onRespondDelete}
                    />
                  ))}

                  {filteredDeleteNotifications.map((target) => (
                    <UnifiedDeleteNotificationCard
                      key={`delete-notification-${target.id}`}
                      target={target}
                      dismissingNotificationId={dismissingNotificationId}
                      onDismissDeleteNotification={onDismissDeleteNotification}
                    />
                  ))}
                </InboxSection>
              ) : null}

              {activeFilter === "invites" && filteredInvitations.length > 0 ? (
                <InboxSection title="받은 초대" count={filteredInvitations.length}>
                  {filteredInvitations.map((item) => (
                    <InvitationCard
                      key={`invite-${item.invitation?.id || item.participant?.id}`}
                      item={item}
                      respondingInvitationId={respondingInvitationId}
                      dismissingInvitationId={dismissingInvitationId}
                      onRespond={onRespondInvitation}
                      onDismiss={onDismissInvitation}
                    />
                  ))}
                </InboxSection>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InboxView;
