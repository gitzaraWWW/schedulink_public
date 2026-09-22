import { useEffect, useMemo, useState } from "react";
import CloseIcon from "../../../shared/ui/CloseIcon";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.28)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "72px 16px 16px",
  zIndex: 1100,
};

const modalStyle = {
  width: "min(460px, calc(100vw - 32px))",
  maxHeight: "calc(100vh - 88px)",
  overflowY: "auto",
  backgroundColor: "var(--bw-white)",
  border: "1px solid var(--bw-100)",
  borderRadius: "20px",
  boxShadow: "0 24px 48px rgba(0, 0, 0, 0.18)",
  padding: "20px",
  display: "grid",
  gap: "14px",
  textAlign: "left",
};

function InboxIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <path d="M4 6.75A1.75 1.75 0 0 1 5.75 5h12.5A1.75 1.75 0 0 1 20 6.75v10.5A1.75 1.75 0 0 1 18.25 19H5.75A1.75 1.75 0 0 1 4 17.25V6.75Z" />
      <path d="M4 13h4.2l1.4 2h4.8l1.4-2H20" />
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

function ActionItemMenu({
  creatorReviewRequests,
  deleteApprovalTargets,
  deleteNotifications,
  loading,
  actingRequestId,
  actingTargetId,
  dismissingNotificationId,
  onOpen,
  onReviewProposal,
  onRespondDelete,
  onDismissDeleteNotification,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadDeleteNotificationCount = useMemo(
    () =>
      deleteNotifications.filter((target) => !target.read_at && !target.dismissed_at)
        .length,
    [deleteNotifications]
  );
  const visibleItemCount = useMemo(
    () =>
      creatorReviewRequests.length +
      deleteApprovalTargets.length +
      deleteNotifications.length,
    [creatorReviewRequests, deleteApprovalTargets, deleteNotifications]
  );
  const totalCount = useMemo(
    () =>
      creatorReviewRequests.length +
      deleteApprovalTargets.length +
      unreadDeleteNotificationCount,
    [
      creatorReviewRequests,
      deleteApprovalTargets,
      unreadDeleteNotificationCount,
    ]
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscapeKey);

    return () => {
      window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    onOpen?.();
  }, [isOpen, onOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="app-header-action-trigger"
        aria-label="변경 요청 열기"
        style={{
          position: "relative",
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          border: "1px solid var(--bw-200)",
          backgroundColor: "var(--bw-white)",
          color: "var(--bw-900)",
          cursor: "pointer",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 0,
          boxShadow: isOpen ? "0 8px 24px rgba(0, 0, 0, 0.14)" : "none",
        }}
      >
        <InboxIcon />
        {totalCount > 0 ? (
          <span
            style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              minWidth: "20px",
              height: "20px",
              padding: "0 5px",
              borderRadius: "999px",
              backgroundColor: "var(--bw-900)",
              color: "var(--bw-white)",
              fontSize: "11px",
              fontWeight: 700,
              display: "grid",
              placeItems: "center",
              boxSizing: "border-box",
            }}
          >
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div style={overlayStyle} onClick={() => setIsOpen(false)}>
          <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ display: "grid", gap: "4px" }}>
                <strong style={{ color: "var(--bw-900)", fontSize: "18px" }}>
                  변경 요청
                </strong>
                <span style={{ color: "var(--bw-700)", fontSize: "14px" }}>
                  수정 검토 {creatorReviewRequests.length}건 / 삭제 확인{" "}
                  {deleteApprovalTargets.length}건 / 삭제 알림{" "}
                  {deleteNotifications.length}건
                </span>
              </div>
              <button
                type="button"
                aria-label="변경 요청 닫기"
                onClick={() => setIsOpen(false)}
                style={{
                  border: "none",
                  backgroundColor: "var(--bw-75)",
                  color: "var(--bw-900)",
                  width: "32px",
                  height: "32px",
                  borderRadius: "999px",
                  cursor: "pointer",
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  lineHeight: 0,
                  flexShrink: 0,
                }}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            {loading ? (
              <div style={{ color: "var(--bw-700)" }}>
                변경 요청 목록을 불러오는 중입니다.
              </div>
            ) : null}

            {!loading && visibleItemCount === 0 ? (
              <div style={{ color: "var(--bw-700)" }}>
                지금 처리할 변경 요청이 없습니다.
              </div>
            ) : null}

            {!loading &&
              creatorReviewRequests.map((request) => (
                <div
                  key={request.id}
                  style={{
                    padding: "12px",
                    borderRadius: "14px",
                    backgroundColor: "var(--bw-white)",
                    border: "1px solid var(--bw-100)",
                    display: "grid",
                    gap: "8px",
                  }}
                >
                  <strong style={{ color: "var(--bw-900)" }}>수정 제안 검토</strong>
                  <div>
                    일정:{" "}
                    {request.event?.title || request.before_snapshot?.title || "-"}
                  </div>
                  <div>변경 전: {formatSnapshot(request.before_snapshot)}</div>
                  <div>변경 후: {formatSnapshot(request.after_snapshot)}</div>
                  <div>요청 문장: {request.source_text || "-"}</div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={actingRequestId === request.id}
                      onClick={() => onReviewProposal(request.id, "approved")}
                    >
                      확인
                    </button>
                    <button
                      type="button"
                      disabled={actingRequestId === request.id}
                      onClick={() => onReviewProposal(request.id, "rejected")}
                    >
                      거절
                    </button>
                  </div>
                </div>
              ))}

            {!loading &&
              deleteApprovalTargets.map((target) => (
                <div
                  key={target.id}
                  style={{
                    padding: "12px",
                    borderRadius: "14px",
                    backgroundColor: "var(--bw-white)",
                    border: "1px solid var(--bw-100)",
                    display: "grid",
                    gap: "8px",
                  }}
                >
                  <strong style={{ color: "var(--bw-900)" }}>일정 삭제 요청</strong>
                  <div>
                    일정:{" "}
                    {target.event?.title || target.request?.before_snapshot?.title || "-"}
                  </div>
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
                </div>
              ))}

            {!loading &&
              deleteNotifications.map((target) => (
                <div
                  key={target.id}
                  style={{
                    padding: "12px",
                    borderRadius: "14px",
                    backgroundColor: "var(--bw-white)",
                    border: "1px solid var(--bw-100)",
                    display: "grid",
                    gap: "8px",
                  }}
                >
                  <strong style={{ color: "var(--bw-900)" }}>일정 삭제 알림</strong>
                  <div>
                    일정:{" "}
                    {target.event?.title || target.request?.before_snapshot?.title || "-"}
                  </div>
                  <div>삭제된 일정: {formatSnapshot(target.request?.before_snapshot)}</div>
                  <div>요청 문장: {target.request?.source_text || "-"}</div>
                  <div style={{ color: "var(--bw-700)", fontSize: "14px" }}>
                    주최자가 일정을 삭제했습니다. 별도 확인 없이 캘린더에서도
                    제거됩니다.
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
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default ActionItemMenu;
