function InboxIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <path d="M8 17h8M9 17V10a3 3 0 0 1 6 0v7M6.5 17h11l-1.1-1.7a2.5 2.5 0 0 1-.4-1.35V10a4 4 0 1 0-8 0v3.95c0 .48-.13.95-.39 1.35L6.5 17Z" />
      <path d="M10.5 19a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}

export function buildInboxCounts({
  creatorReviewRequests = [],
  deleteApprovalTargets = [],
  deleteNotifications = [],
  invitations = [],
}) {
  const unreadDeleteNotificationCount = deleteNotifications.filter(
    (target) => !target.read_at && !target.dismissed_at
  ).length;

  const pendingInvitationCount = invitations.filter((item) => {
    const participant = item.participant || {};
    const invitation = item.invitation || {};

    return participant.status === "pending" && invitation.status === "pending";
  }).length;

  const requestItemCount =
    creatorReviewRequests.length +
    deleteApprovalTargets.length +
    deleteNotifications.length;
  const invitationItemCount = invitations.length;
  const totalBadgeCount =
    creatorReviewRequests.length +
    deleteApprovalTargets.length +
    unreadDeleteNotificationCount +
    pendingInvitationCount;

  return {
    requestItemCount,
    invitationItemCount,
    totalItemCount: requestItemCount + invitationItemCount,
    totalBadgeCount,
    unreadDeleteNotificationCount,
    pendingInvitationCount,
  };
}

function UnifiedInboxMenu({
  creatorReviewRequests = [],
  deleteApprovalTargets = [],
  deleteNotifications = [],
  invitations = [],
  onOpen,
  triggerClassName = "",
}) {
  const { totalBadgeCount } = buildInboxCounts({
    creatorReviewRequests,
    deleteApprovalTargets,
    deleteNotifications,
    invitations,
  });

  return (
    <button
      type="button"
      onClick={() => onOpen?.()}
      className={`app-header-action-trigger ${triggerClassName}`.trim()}
      aria-label="우편함"
      style={{
        position: "relative",
        cursor: "pointer",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 0,
      }}
    >
      <InboxIcon />
      {totalBadgeCount > 0 ? (
        <span
          style={{
            position: "absolute",
            top: "-2px",
            right: "-2px",
            minWidth: "20px",
            height: "20px",
            padding: "0 5px",
            borderRadius: "999px",
            backgroundColor: "#ff7b79",
            color: "var(--bw-white)",
            fontSize: "11px",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
          }}
        >
          {totalBadgeCount > 99 ? "99+" : totalBadgeCount}
        </span>
      ) : null}
    </button>
  );
}

export { InboxIcon };

export default UnifiedInboxMenu;
