import { useEffect } from "react";
import CloseIcon from "../../../shared/ui/CloseIcon";
import SectionCard from "../../../shared/ui/SectionCard";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1000,
};

const modalStyle = {
  width: "100%",
  maxWidth: "520px",
  backgroundColor: "var(--bw-white)",
  borderRadius: "20px",
  boxShadow: "0 24px 48px rgba(0, 0, 0, 0.18)",
  padding: "24px",
  display: "grid",
  gap: "16px",
  textAlign: "left",
};

const closeButtonStyle = {
  border: "none",
  backgroundColor: "var(--bw-75)",
  color: "var(--bw-900)",
  borderRadius: "999px",
  width: "36px",
  height: "36px",
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "18px",
  lineHeight: 0,
};

function getProfileFallbackLabel(user, form) {
  const seed = form.displayName || user?.name || "U";

  return seed.trim().charAt(0).toUpperCase();
}

function MentionProfileSection({
  user,
  mentionProfile,
  isEditorOpen,
  form,
  saving,
  onToggleEditor,
  onFieldChange,
  onSave,
}) {
  useEffect(() => {
    if (!isEditorOpen) {
      return undefined;
    }

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        onToggleEditor?.();
      }
    };

    window.addEventListener("keydown", handleEscapeKey);

    return () => {
      window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isEditorOpen, onToggleEditor]);

  return (
    <SectionCard>
      <strong>멘션 프로필</strong>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button
            type="button"
            onClick={onToggleEditor}
            aria-label="멘션 프로필 편집 열기"
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              border: "1px solid var(--bw-200)",
              backgroundColor: "var(--bw-50)",
              padding: 0,
              cursor: "pointer",
              overflow: "hidden",
              display: "grid",
              placeItems: "center",
              color: "var(--bw-900)",
              fontWeight: 700,
              fontSize: "20px",
            }}
          >
            {user?.picture ? (
              <img
                src={user.picture}
                alt="멘션 프로필 사진"
                width="64"
                height="64"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span>{getProfileFallbackLabel(user, form)}</span>
            )}
          </button>
          <div style={{ display: "grid", gap: "4px", textAlign: "left" }}>
            <strong style={{ color: "var(--bw-900)" }}>
              {form.displayName || user?.name || "이름 없음"}
            </strong>
            <span style={{ color: "var(--bw-700)", fontSize: "14px" }}>
              프로필 사진을 누르면 멘션 정보를 수정할 수 있어요.
            </span>
          </div>
        </div>
        {mentionProfile ? (
          <span style={{ color: "var(--bw-700)", fontSize: "14px" }}>
            검색용 문자열: {mentionProfile.searchable_text || "-"}
          </span>
        ) : (
          <span style={{ color: "var(--bw-700)", fontSize: "14px" }}>
            아직 저장된 멘션 프로필이 없습니다.
          </span>
        )}
      </div>

      {isEditorOpen ? (
        <div
          aria-modal="true"
          role="dialog"
          style={overlayStyle}
          onClick={onToggleEditor}
        >
          <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div style={{ display: "grid", gap: "6px" }}>
                <strong style={{ fontSize: "20px", color: "var(--bw-900)" }}>
                  멘션 프로필 편집
                </strong>
                <span style={{ color: "var(--bw-700)", fontSize: "14px" }}>
                  이름, 소속, 닉네임을 수정하면 멘션 검색에 반영됩니다.
                </span>
              </div>
              <button
                aria-label="멘션 프로필 편집 닫기"
                style={closeButtonStyle}
                type="button"
                onClick={onToggleEditor}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <label style={{ display: "grid", gap: "6px" }}>
              <span>이름</span>
              <input
                type="text"
                value={form.displayName}
                onChange={(event) =>
                  onFieldChange("displayName", event.target.value)
                }
                style={{ padding: "10px" }}
              />
            </label>
            <label style={{ display: "grid", gap: "6px" }}>
              <span>팀 / 소속</span>
              <input
                type="text"
                value={form.teamName}
                onChange={(event) => onFieldChange("teamName", event.target.value)}
                placeholder="예: 콘텐츠기획팀"
                style={{ padding: "10px" }}
              />
            </label>
            <label style={{ display: "grid", gap: "6px" }}>
              <span>닉네임</span>
              <input
                type="text"
                value={form.nickname}
                onChange={(event) => onFieldChange("nickname", event.target.value)}
                placeholder="예: 미라"
                style={{ padding: "10px" }}
              />
            </label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button type="button" onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : "멘션 프로필 저장"}
              </button>
              <button type="button" onClick={onToggleEditor}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

export default MentionProfileSection;
