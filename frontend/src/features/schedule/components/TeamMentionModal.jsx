import { useEffect, useMemo, useState } from "react";
import CloseIcon from "../../../shared/ui/CloseIcon";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background:
    "radial-gradient(circle at top, rgba(255, 255, 255, 0.08), rgba(15, 23, 42, 0.36))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  zIndex: 1300,
};

const modalStyle = {
  width: "min(760px, calc(100vw - 24px))",
  maxHeight: "min(720px, calc(100vh - 24px))",
  overflow: "hidden",
  borderRadius: "28px",
  border: "1px solid rgba(217, 221, 231, 0.92)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.96) 100%)",
  boxShadow: "0 32px 80px rgba(57, 86, 105, 0.18)",
  display: "grid",
  gridTemplateRows: "auto auto minmax(0, 1fr) auto",
};

const closeButtonStyle = {
  border: "1px solid var(--bw-100)",
  backgroundColor: "rgba(255,255,255,0.92)",
  color: "var(--bw-500)",
  borderRadius: "999px",
  width: "38px",
  height: "38px",
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="4.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="m12.2 12.2 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function buildAvatarLabel(name) {
  return String(name || "?").trim().charAt(0).toUpperCase();
}

function TeamMentionModal({
  isOpen,
  teamName,
  members = [],
  loading = false,
  error = "",
  initialSelectedMemberIds = [],
  onClose,
  onSubmit,
}) {
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setMemberSearch("");
    setSelectedMemberIds(Array.isArray(initialSelectedMemberIds) ? initialSelectedMemberIds : []);
  }, [initialSelectedMemberIds, isOpen, teamName]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleEscapeKey);

    return () => {
      window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen, onClose]);

  const filteredMembers = useMemo(() => {
    const normalizedSearch = normalizeToken(memberSearch);

    if (!normalizedSearch) {
      return members;
    }

    return members.filter((member) => {
      return [member.display_name, member.nickname, member.team_name]
        .filter(Boolean)
        .some((value) => normalizeToken(value).includes(normalizedSearch));
    });
  }, [memberSearch, members]);

  const selectedMembers = members.filter(
    (member) => member.user_id && selectedMemberIds.includes(member.user_id)
  );
  const visibleMemberIds = filteredMembers.map((member) => member.user_id).filter(Boolean);
  const allVisibleSelected =
    visibleMemberIds.length > 0 &&
    visibleMemberIds.every((memberId) => selectedMemberIds.includes(memberId));

  const handleMemberToggle = (memberId) => {
    if (!memberId) {
      return;
    }

    setSelectedMemberIds((currentIds) =>
      currentIds.includes(memberId)
        ? currentIds.filter((id) => id !== memberId)
        : [...currentIds, memberId]
    );
  };

  const handleToggleAllVisible = () => {
    if (visibleMemberIds.length === 0) {
      return;
    }

    setSelectedMemberIds((currentIds) => {
      if (allVisibleSelected) {
        return currentIds.filter((id) => !visibleMemberIds.includes(id));
      }

      const nextIds = new Set(currentIds);
      visibleMemberIds.forEach((memberId) => nextIds.add(memberId));
      return [...nextIds];
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div aria-modal="true" role="dialog" style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            padding: "24px 24px 14px",
            borderBottom: "1px solid var(--bw-100)",
          }}
        >
          <div style={{ display: "grid", gap: "12px" }}>
            <span
              style={{
                width: "fit-content",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "999px",
                backgroundColor: "var(--theme-soft-96)",
                color: "var(--mint-600)",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "999px",
                  background: "var(--mint-500)",
                }}
              />
              {teamName}
            </span>

            <div style={{ display: "grid", gap: "4px" }}>
              <strong style={{ fontSize: "18px", color: "var(--bw-900)" }}>팀 멘션</strong>
              <span style={{ color: "var(--bw-600)", fontSize: "14px" }}>
                팀원을 선택해 멘션하세요.
              </span>
            </div>
          </div>

          <button
            type="button"
            aria-label="팀 멘션 모달 닫기"
            onClick={onClose}
            style={closeButtonStyle}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gap: "16px",
            padding: "18px 24px",
            borderBottom: "1px solid var(--bw-100)",
            background: "rgba(255,255,255,0.72)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "18px minmax(0, 1fr)",
              gap: "10px",
              alignItems: "center",
              borderRadius: "14px",
              border: "1px solid var(--bw-100)",
              backgroundColor: "var(--bw-white)",
              padding: "12px 14px",
              color: "var(--bw-400)",
            }}
          >
            <SearchIcon />
            <input
              className="team-mention-modal__search-input"
              type="text"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="이름 또는 닉네임 검색"
              style={{
                width: "100%",
                border: 0,
                outline: "none",
                background: "transparent",
                padding: 0,
                fontSize: "14px",
                color: "var(--bw-800)",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <strong style={{ fontSize: "14px", color: "var(--bw-800)" }}>선택된 멤버</strong>

            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "nowrap",
                overflowX: "auto",
                overflowY: "hidden",
                paddingBottom: "4px",
              }}
            >
              {selectedMembers.length > 0 ? (
                selectedMembers.map((member) => (
                  <button
                    key={`selected-${member.user_id}`}
                    type="button"
                    onClick={() => handleMemberToggle(member.user_id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "7px 10px 7px 8px",
                      borderRadius: "999px",
                      border: "1px solid var(--bw-100)",
                      backgroundColor: "var(--bw-white)",
                      color: "var(--bw-800)",
                      flex: "0 0 auto",
                    }}
                  >
                    <span
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "999px",
                        overflow: "hidden",
                        background: "var(--theme-soft-92)",
                        display: "grid",
                        placeItems: "center",
                        color: "var(--mint-600)",
                        fontSize: "12px",
                        fontWeight: 700,
                        flex: "0 0 auto",
                      }}
                    >
                      {member.profile_image ? (
                        <img
                          src={member.profile_image}
                          alt=""
                          width="28"
                          height="28"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        buildAvatarLabel(member.display_name)
                      )}
                    </span>
                    <span style={{ fontSize: "14px", fontWeight: 700 }}>{member.display_name}</span>
                    <CloseIcon size={14} />
                  </button>
                ))
              ) : (
                <span style={{ fontSize: "13px", color: "var(--bw-500)" }}>
                  아직 선택된 팀원이 없습니다.
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateRows: "auto minmax(0, 1fr)",
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              padding: "18px 24px 14px",
            }}
          >
            <strong style={{ fontSize: "14px", color: "var(--bw-800)" }}>팀 멤버 목록</strong>
            <button
              type="button"
              onClick={handleToggleAllVisible}
              disabled={loading || filteredMembers.length === 0}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                border: 0,
                background: "transparent",
                padding: 0,
                color: "var(--bw-500)",
                fontSize: "13px",
                cursor: loading || filteredMembers.length === 0 ? "default" : "pointer",
              }}
            >
              <span>전체 {members.length}명</span>
              <span
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "5px",
                  border: allVisibleSelected
                    ? "1px solid var(--mint-500)"
                    : "1px solid var(--bw-150)",
                  background: allVisibleSelected ? "var(--mint-500)" : "var(--bw-white)",
                  color: "var(--bw-white)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                  flex: "0 0 auto",
                }}
              >
                {allVisibleSelected ? "✓" : ""}
              </span>
            </button>
          </div>

          <div
            style={{
              overflowY: "auto",
              minHeight: 0,
              padding: "0 24px 24px",
              display: "grid",
              gap: "8px",
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: "26px 18px",
                  borderRadius: "18px",
                  border: "1px dashed var(--bw-150)",
                  backgroundColor: "var(--bw-white)",
                  color: "var(--bw-600)",
                  textAlign: "center",
                }}
              >
                팀 멤버를 불러오는 중입니다.
              </div>
            ) : null}

            {!loading && error ? (
              <div
                style={{
                  padding: "26px 18px",
                  borderRadius: "18px",
                  border: "1px dashed var(--bw-150)",
                  backgroundColor: "var(--bw-50)",
                  color: "var(--bw-700)",
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            ) : null}

            {!loading &&
              !error &&
              filteredMembers.map((member) => {
                const isSelected =
                  Boolean(member.user_id) && selectedMemberIds.includes(member.user_id);

                return (
                  <button
                    key={member.user_id || member.id}
                    type="button"
                    onClick={() => handleMemberToggle(member.user_id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr)",
                    gap: "12px",
                    alignItems: "center",
                    padding: "12px 15px",
                    borderRadius: "14px",
                    border: isSelected
                      ? "1px solid var(--theme-border-82)"
                        : "1px solid var(--bw-100)",
                      background: isSelected ? "var(--theme-soft-96)" : "var(--bw-white)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "6px",
                        border: isSelected
                          ? "1px solid var(--mint-500)"
                          : "1px solid var(--bw-150)",
                        background: isSelected ? "var(--mint-500)" : "var(--bw-white)",
                        color: "var(--bw-white)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "12px",
                        fontWeight: 700,
                        flex: "0 0 auto",
                      }}
                    >
                      {isSelected ? "✓" : ""}
                    </span>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "42px minmax(0, 1fr)",
                        gap: "12px",
                        alignItems: "center",
                        minWidth: 0,
                      }}
                    >
                      <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      background:
                            "linear-gradient(135deg, var(--theme-soft-92) 0%, rgba(255,255,255,0.98) 100%)",
                          border: "1px solid var(--theme-border-82)",
                          display: "grid",
                          placeItems: "center",
                          color: "var(--mint-600)",
                          fontWeight: 700,
                        }}
                      >
                      {member.profile_image ? (
                        <img
                          src={member.profile_image}
                          alt=""
                          width="38"
                          height="38"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                          <span>{buildAvatarLabel(member.display_name)}</span>
                        )}
                      </div>

                      <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
                        <strong
                      style={{
                        color: "var(--bw-900)",
                        fontSize: "14px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                          }}
                        >
                          {member.display_name}
                        </strong>
                      <span style={{ color: "var(--bw-500)", fontSize: "12px" }}>
                        {member.nickname ? `@${member.nickname}` : "@nickname"}
                      </span>
                      </div>
                    </div>
                  </button>
                );
              })}

            {!loading && !error && filteredMembers.length === 0 ? (
              <div
                style={{
                  padding: "26px 18px",
                  borderRadius: "18px",
                  border: "1px dashed var(--bw-150)",
                  backgroundColor: "var(--bw-white)",
                  color: "var(--bw-600)",
                  textAlign: "center",
                }}
              >
                조건에 맞는 팀 멤버가 없습니다.
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            alignItems: "center",
            padding: "18px 24px 20px",
            borderTop: "1px solid var(--bw-100)",
            backgroundColor: "var(--bw-white)",
          }}
        >
          <strong
            style={{
              color: "var(--bw-900)",
              fontSize: "14px",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: "var(--mint-500)" }}>{selectedMembers.length}명</span> 선택됨
          </strong>

          <button
            type="button"
            onClick={() =>
              onSubmit?.({
                teamName,
                members: selectedMembers,
              })
            }
            disabled={loading || Boolean(error) || selectedMembers.length === 0}
            style={{
              borderRadius: "10px",
              border: "1px solid transparent",
              background: "var(--theme-gradient-strong)",
              minWidth: "148px",
              padding: "12px 22px",
              color: "var(--bw-white)",
              fontSize: "14px",
              fontWeight: 700,
              boxShadow: "0 10px 24px var(--theme-shadow-20)",
              marginLeft: "auto",
            }}
          >
            멘션하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default TeamMentionModal;
