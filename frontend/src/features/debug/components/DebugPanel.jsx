import ResultCard from "../../../shared/ui/ResultCard";
import SectionCard from "../../../shared/ui/SectionCard";

function DebugPanel({
  user,
  isOpen,
  onToggle,
  showToggle = true,
  supabaseConfigured,
  supabaseSync,
  supabaseUser,
  calendarSyncState,
  calendarSyncRow,
  eventSyncState,
  eventSyncRow,
  participantSyncState,
  participantSyncRow,
  invitationSyncState,
  invitationSyncRow,
  syncingUser,
  syncingCalendar,
  syncingEvent,
  syncingParticipant,
  updatingParticipantStatus,
  syncingInvitation,
  updatingInvitationStatus,
  onSyncUser,
  onSyncCalendar,
  onSyncEvent,
  onSyncParticipant,
  onUpdateParticipantStatus,
  onSyncInvitation,
  onUpdateInvitationStatus,
}) {
  const panelOpen = showToggle ? isOpen : true;

  return (
    <SectionCard
      style={{
        padding: "20px",
        border: "1px solid var(--bw-150)",
        borderRadius: "24px",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255, 255, 255, 0.98) 100%)",
        boxShadow: "0 18px 38px rgba(0, 0, 0, 0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: "4px" }}>
          <strong style={{ fontSize: "20px" }}>개발 테스트</strong>
          <span style={{ color: "var(--bw-600)", fontSize: "13px" }}>
            내부 동기화와 상태 점검용 화면입니다.
          </span>
        </div>

        {showToggle ? (
          <button type="button" onClick={onToggle}>
            {panelOpen ? "접기" : "열기"}
          </button>
        ) : null}
      </div>

      {panelOpen ? (
        <>
          <div>연결 상태: {supabaseConfigured ? "설정됨" : "환경 변수 없음"}</div>
          <div>
            현재 사용자: {user?.email || "-"} / {user?.name || "-"}
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onSyncUser}
              disabled={syncingUser || !supabaseConfigured}
            >
              {syncingUser ? "처리 중..." : "users 테스트"}
            </button>
            <button
              type="button"
              onClick={onSyncCalendar}
              disabled={syncingCalendar || !supabaseConfigured}
            >
              {syncingCalendar ? "처리 중..." : "calendar sync 테스트"}
            </button>
            <button
              type="button"
              onClick={onSyncEvent}
              disabled={syncingEvent || !supabaseConfigured}
            >
              {syncingEvent ? "처리 중..." : "events 테스트"}
            </button>
            <button
              type="button"
              onClick={onSyncParticipant}
              disabled={syncingParticipant || !supabaseConfigured}
            >
              {syncingParticipant ? "처리 중..." : "participants 테스트"}
            </button>
            <button
              type="button"
              onClick={() => onUpdateParticipantStatus("accepted")}
              disabled={
                updatingParticipantStatus ||
                !supabaseConfigured ||
                !participantSyncRow?.id
              }
            >
              participant accepted 업데이트
            </button>
            <button
              type="button"
              onClick={() => onUpdateParticipantStatus("rejected")}
              disabled={
                updatingParticipantStatus ||
                !supabaseConfigured ||
                !participantSyncRow?.id
              }
            >
              participant rejected 업데이트
            </button>
            <button
              type="button"
              onClick={onSyncInvitation}
              disabled={syncingInvitation || !supabaseConfigured}
            >
              {syncingInvitation ? "처리 중..." : "invitations 테스트"}
            </button>
            <button
              type="button"
              onClick={() => onUpdateInvitationStatus("pending")}
              disabled={
                updatingInvitationStatus ||
                !supabaseConfigured ||
                !invitationSyncRow?.id
              }
            >
              invitation pending 업데이트
            </button>
            <button
              type="button"
              onClick={() => onUpdateInvitationStatus("accepted")}
              disabled={
                updatingInvitationStatus ||
                !supabaseConfigured ||
                !invitationSyncRow?.id
              }
            >
              invitation accepted 업데이트
            </button>
            <button
              type="button"
              onClick={() => onUpdateInvitationStatus("declined")}
              disabled={
                updatingInvitationStatus ||
                !supabaseConfigured ||
                !invitationSyncRow?.id
              }
            >
              invitation declined 업데이트
            </button>
          </div>

          {supabaseSync ? (
            <div style={{ color: supabaseSync.success ? "var(--bw-800)" : "var(--bw-800)" }}>
              {supabaseSync.message}
            </div>
          ) : null}
          {calendarSyncState ? (
            <div
              style={{
                color: calendarSyncState.success ? "var(--bw-800)" : "var(--bw-800)",
              }}
            >
              {calendarSyncState.message}
            </div>
          ) : null}
          {eventSyncState ? (
            <div style={{ color: eventSyncState.success ? "var(--bw-800)" : "var(--bw-800)" }}>
              {eventSyncState.message}
            </div>
          ) : null}
          {participantSyncState ? (
            <div
              style={{
                color: participantSyncState.success ? "var(--bw-800)" : "var(--bw-800)",
              }}
            >
              {participantSyncState.message}
            </div>
          ) : null}
          {invitationSyncState ? (
            <div
              style={{
                color: invitationSyncState.success ? "var(--bw-800)" : "var(--bw-800)",
              }}
            >
              {invitationSyncState.message}
            </div>
          ) : null}

          <ResultCard title="users 결과" row={supabaseUser} />
          <ResultCard title="calendar sync 결과" row={calendarSyncRow} />
          <ResultCard title="events 결과" row={eventSyncRow} />
          <ResultCard title="participants 결과" row={participantSyncRow} />
          <ResultCard title="invitations 결과" row={invitationSyncRow} />
        </>
      ) : null}
    </SectionCard>
  );
}

export default DebugPanel;
