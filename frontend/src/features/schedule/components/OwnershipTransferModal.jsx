const overlayStyle = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.32)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1200,
};

const modalStyle = {
  width: "min(520px, calc(100vw - 32px))",
  backgroundColor: "var(--bw-white)",
  borderRadius: "20px",
  border: "1px solid var(--bw-100)",
  boxShadow: "0 24px 48px rgba(0, 0, 0, 0.18)",
  padding: "24px",
  display: "grid",
  gap: "16px",
  textAlign: "left",
};

function formatTargetEvent(targetEvent) {
  if (!targetEvent) {
    return "-";
  }

  const parts = [
    targetEvent.title,
    targetEvent.date,
    targetEvent.startTime
      ? `${targetEvent.startTime}${targetEvent.endTime ? ` ~ ${targetEvent.endTime}` : ""}`
      : null,
    targetEvent.location,
  ].filter(Boolean);

  return parts.join(" / ") || "-";
}

function OwnershipTransferModal({
  prompt,
  submitting,
  onClose,
  onSubmit,
}) {
  if (!prompt) {
    return null;
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "grid", gap: "6px" }}>
          <strong style={{ fontSize: "20px", color: "var(--bw-900)" }}>
            새 주최자 선택
          </strong>
          <div style={{ color: "var(--bw-700)", fontSize: "14px" }}>
            주최자가 일정을 비우면 다른 참여자에게 주최 권한을 넘겨야 합니다.
          </div>
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: "14px",
            backgroundColor: "var(--bw-50)",
            border: "1px solid var(--bw-100)",
            color: "var(--bw-700)",
            fontSize: "14px",
          }}
        >
          대상 일정: {formatTargetEvent(prompt.targetEvent)}
        </div>

        <div style={{ display: "grid", gap: "10px" }}>
          {(prompt.candidates || []).map((candidate) => (
            <button
              key={candidate.participantId || candidate.userId}
              type="button"
              disabled={submitting}
              onClick={() =>
                onSubmit({
                  mode: "specific",
                  userId: candidate.userId,
                })
              }
              style={{
                border: "1px solid var(--bw-200)",
                borderRadius: "14px",
                backgroundColor: "var(--bw-white)",
                padding: "12px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                textAlign: "left",
              }}
            >
              <span>
                <strong>{candidate.name || candidate.email || candidate.userId}</strong>
                {candidate.email ? ` (${candidate.email})` : ""}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button type="button" disabled={submitting} onClick={onClose}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

export default OwnershipTransferModal;
