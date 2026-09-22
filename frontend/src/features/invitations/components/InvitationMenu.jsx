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
  width: "min(420px, calc(100vw - 32px))",
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

function BellIcon() {
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
      <path d="M6.25 9.75a5.75 5.75 0 1 1 11.5 0v3.05c0 .82.28 1.62.8 2.26l.7.88H4.75l.7-.88c.52-.64.8-1.44.8-2.26V9.75Z" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

function InvitationMenu({
  invitations,
  loading,
  respondingInvitationId,
  dismissingInvitationId,
  onRespond,
  onDismiss,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pendingCount = useMemo(() => {
    return invitations.filter((item) => {
      const participant = item.participant || {};
      const invitation = item.invitation || {};

      return (
        participant.status === "pending" && invitation.status === "pending"
      );
    }).length;
  }, [invitations]);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="app-header-action-trigger"
        aria-label="초대 알림 열기"
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
        <BellIcon />
        {pendingCount > 0 ? (
          <span
            style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              minWidth: "20px",
              height: "20px",
              padding: "0 5px",
              borderRadius: "999px",
              backgroundColor: "var(--bw-800)",
              color: "var(--bw-white)",
              fontSize: "11px",
              fontWeight: 700,
              display: "grid",
              placeItems: "center",
              boxSizing: "border-box",
            }}
          >
            {pendingCount > 99 ? "99+" : pendingCount}
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
                  받은 초대
                </strong>
                <span style={{ color: "var(--bw-700)", fontSize: "14px" }}>
                  전체 {invitations.length}건 · 응답 대기 {pendingCount}건
                </span>
              </div>
              <button
                type="button"
                aria-label="초대 알림 닫기"
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
              <div style={{ color: "var(--bw-700)" }}>초대 목록을 불러오는 중입니다.</div>
            ) : null}

            {!loading && invitations.length === 0 ? (
              <div style={{ color: "var(--bw-700)" }}>아직 받은 초대가 없습니다.</div>
            ) : null}

            {!loading &&
              invitations.map((item) => {
                const event = item.event || {};
                const participant = item.participant || {};
                const invitation = item.invitation || {};
                const pending =
                  participant.status === "pending" &&
                  invitation.status === "pending";
                const dismissible =
                  ["accepted", "declined"].includes(invitation.status) ||
                  (!invitation.id &&
                    ["accepted", "rejected", "withdrawn"].includes(
                      participant.status
                    ));
                const dismissKey = invitation.id || `participant:${participant.id}`;

                return (
                  <div
                    key={invitation.id || participant.id}
                    style={{
                      padding: "12px",
                      borderRadius: "14px",
                      backgroundColor: "var(--bw-white)",
                      border: "1px solid var(--bw-100)",
                      display: "grid",
                      gap: "8px",
                      position: "relative",
                    }}
                  >
                    {dismissible ? (
                      <button
                        type="button"
                        aria-label="초대 숨기기"
                        disabled={dismissingInvitationId === dismissKey}
                        onClick={() =>
                          onDismiss?.({
                            invitationId: invitation.id || null,
                            participantId: participant.id || null,
                          })
                        }
                        style={{
                          position: "absolute",
                          top: "10px",
                          right: "10px",
                          width: "28px",
                          height: "28px",
                          borderRadius: "999px",
                          border: "1px solid var(--bw-100)",
                          backgroundColor: "var(--bw-50)",
                          color: "var(--bw-600)",
                          padding: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "16px",
                          lineHeight: 0,
                        }}
                      >
                        <CloseIcon size={14} />
                      </button>
                    ) : null}
                    <strong style={{ color: "var(--bw-900)" }}>
                      {event.title || "제목 없는 일정"}
                    </strong>
                    <div>참여자: {participant.name || "-"}</div>
                    <div>날짜: {event.date || "-"}</div>
                    <div>
                      시간: {event.start_time || "-"} ~ {event.end_time || "-"}
                    </div>
                    <div>장소: {event.location || "-"}</div>
                    <div>참가 상태: {participant.status || "-"}</div>
                    <div>초대 상태: {invitation.status || "-"}</div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={!pending || respondingInvitationId === invitation.id}
                        onClick={() =>
                          onRespond({
                            participantId: participant.id,
                            invitationId: invitation.id,
                            responseStatus: "accepted",
                          })
                        }
                      >
                        수락
                      </button>
                      <button
                        type="button"
                        disabled={!pending || respondingInvitationId === invitation.id}
                        onClick={() =>
                          onRespond({
                            participantId: participant.id,
                            invitationId: invitation.id,
                            responseStatus: "rejected",
                          })
                        }
                      >
                        거절
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default InvitationMenu;
