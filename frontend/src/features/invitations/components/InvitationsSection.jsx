import { useState } from "react";
import SectionCard from "../../../shared/ui/SectionCard";

function InvitationsSection({
  invitations,
  loading,
  respondingInvitationId,
  onRespond,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pendingCount = invitations.filter((item) => {
    const participant = item.participant || {};
    const invitation = item.invitation || {};

    return participant.status === "pending" && invitation.status === "pending";
  }).length;

  return (
    <SectionCard>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: "4px", textAlign: "left" }}>
          <strong>내가 받은 초대</strong>
          <span style={{ color: "var(--bw-700)", fontSize: "14px" }}>
            전체 {invitations.length}건, 응답 대기 {pendingCount}건
          </span>
        </div>
        <button type="button" onClick={() => setIsOpen((currentValue) => !currentValue)}>
          {isOpen ? "초대 닫기" : "초대 열기"}
        </button>
      </div>

      {isOpen ? (
        <>
          {loading ? (
            <div style={{ color: "var(--bw-700)", textAlign: "left" }}>
              초대 목록을 불러오는 중입니다.
            </div>
          ) : null}
          {!loading && invitations.length === 0 ? (
            <div style={{ color: "var(--bw-700)", textAlign: "left" }}>
              아직 받은 초대가 없습니다.
            </div>
          ) : null}
          {!loading &&
            invitations.map((item) => {
              const event = item.event || {};
              const participant = item.participant || {};
              const invitation = item.invitation || {};
              const pending =
                participant.status === "pending" &&
                invitation.status === "pending";

              return (
                <div
                  key={invitation.id || participant.id}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    backgroundColor: "var(--bw-white)",
                    border: "1px solid var(--bw-100)",
                    display: "grid",
                    gap: "8px",
                    textAlign: "left",
                  }}
                >
                  <strong>{event.title || "제목 없는 일정"}</strong>
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
        </>
      ) : null}
    </SectionCard>
  );
}

export default InvitationsSection;
