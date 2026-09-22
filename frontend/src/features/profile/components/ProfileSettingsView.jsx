import { useEffect, useState } from "react";
import springIcon from "../../../assets/themes/spring/spring_icon.png";
import {
  BACKGROUND_PRESETS,
  MANUAL_ACCENT_PRESETS,
} from "../../../shared/theme/theme";

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d="M15 18 9 12l6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d="M7.5 10.5a4.5 4.5 0 1 1 9 0v3.25L18 16H6l1.5-2.25V10.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 18.5a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <rect
        x="4.5"
        y="6"
        width="15"
        height="13"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 4.5V8M16 4.5V8M4.5 10h15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
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

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 10.5v4M12 8h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function QuestionMarkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d="M9.25 9.25a2.75 2.75 0 1 1 4.41 2.19c-.83.61-1.66 1.23-1.66 2.31v.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="17.5" r="1" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d="M12 5.5v13M5.5 12h13"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getProfileFallbackLabel(user, form) {
  const seed = form?.displayName || user?.name || "U";
  return seed.trim().charAt(0).toUpperCase();
}

function formatProfileLimitDateTime(value) {
  if (!value) {
    return "변경 가능";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatProfileResetDate(value) {
  if (!value) {
    return "지금 바로 수정 가능";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "일정을 확인해 주세요";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatProfileResetCountdown(value) {
  if (!value) {
    return "변경 가능";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return diffDays === 0 ? "오늘" : `${diffDays}일 후`;
}

function buildPaletteButtonStyle(isActive, background) {
  return {
    width: "42px",
    height: "42px",
    padding: 0,
    borderRadius: "999px",
    border: isActive ? "2px solid var(--bw-900)" : "1px solid var(--bw-200)",
    background,
    boxShadow: isActive
      ? "0 0 0 4px rgba(31, 37, 52, 0.08)"
      : "inset 0 0 0 1px rgba(31, 37, 52, 0.04)",
  };
}

function normalizeFieldValue(value) {
  return String(value || "").trim();
}

function ProfileSettingsView({
  user,
  mentionProfile,
  profileChangeLimit,
  form,
  saving,
  uiPreferences,
  onBack,
  onFieldChange,
  onSave,
  onUiPreferenceChange,
}) {
  const [activeTab, setActiveTab] = useState("profile");
  const [lastManualAccentKey, setLastManualAccentKey] = useState(() =>
    uiPreferences?.accentKey && uiPreferences.accentKey !== "spring-blossom"
      ? uiPreferences.accentKey
      : "mint"
  );

  const remainingChanges = Number(profileChangeLimit?.remainingChanges ?? 2);
  const usedChanges = Number(profileChangeLimit?.usedChanges ?? 0);
  const maxChanges = Number(profileChangeLimit?.maxChanges ?? 2);
  const isProfileEditLocked = remainingChanges <= 0;
  const nextResetAtLabel = formatProfileLimitDateTime(
    profileChangeLimit?.nextResetAt || null
  );
  const nextResetDateLabel = formatProfileResetDate(
    profileChangeLimit?.nextResetAt || null
  );
  const nextResetCountdownLabel = formatProfileResetCountdown(
    profileChangeLimit?.nextResetAt || null
  );
  const isSpringThemeActive = uiPreferences.accentKey === "spring-blossom";
  const hasProfileChanges =
    normalizeFieldValue(form.displayName) !==
      normalizeFieldValue(mentionProfile?.display_name || user?.name) ||
    normalizeFieldValue(form.teamName) !==
      normalizeFieldValue(mentionProfile?.team_name) ||
    normalizeFieldValue(form.nickname) !==
      normalizeFieldValue(mentionProfile?.nickname);

  useEffect(() => {
    if (uiPreferences?.accentKey && uiPreferences.accentKey !== "spring-blossom") {
      setLastManualAccentKey(uiPreferences.accentKey);
    }
  }, [uiPreferences?.accentKey]);

  const themeOptions = [
    {
      key: "spring",
      label: "봄",
      description: "벚꽃 포인트",
      active: isSpringThemeActive,
      onClick: () =>
        onUiPreferenceChange?.({
          themeKey: "custom",
          accentKey: isSpringThemeActive ? lastManualAccentKey : "spring-blossom",
        }),
      icon: (
        <img
          src={springIcon}
          alt="봄 테마 아이콘"
          className="profile-page__theme-option-image"
        />
      ),
    },
    {
      key: "summer",
      label: "여름",
      description: "준비 중",
      disabled: true,
      icon: <QuestionMarkIcon />,
    },
    {
      key: "autumn",
      label: "가을",
      description: "준비 중",
      disabled: true,
      icon: <QuestionMarkIcon />,
    },
    {
      key: "winter",
      label: "겨울",
      description: "준비 중",
      disabled: true,
      icon: <QuestionMarkIcon />,
    },
    {
      key: "more",
      label: "더보기",
      description: "추가 예정",
      disabled: true,
      icon: <PlusIcon />,
    },
  ];

  return (
    <div className="profile-page">
      <div className="profile-page__topbar">
        <button
          type="button"
          className="profile-page__back-button"
          onClick={onBack}
        >
          <BackIcon />
        </button>
        <strong className="profile-page__title">설정</strong>
        <div className="profile-page__topbar-spacer" />
      </div>

      <div className="profile-page__tab-rail" role="tablist" aria-label="설정 탭">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "profile"}
          className={`profile-page__tab-button${
            activeTab === "profile" ? " is-active" : ""
          }`}
          onClick={() => setActiveTab("profile")}
        >
          프로필
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "theme"}
          className={`profile-page__tab-button${
            activeTab === "theme" ? " is-active" : ""
          }`}
          onClick={() => setActiveTab("theme")}
        >
          테마
        </button>
      </div>

      {activeTab === "profile" ? (
        <>
          <section className="profile-page__summary-card">
            <div className="profile-page__summary-head">
              <div className="profile-page__avatar">
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt="사용자 프로필 사진"
                    width="64"
                    height="64"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span>{getProfileFallbackLabel(user, form)}</span>
                )}
              </div>

              <div className="profile-page__identity-copy">
                <strong>{form.displayName || user?.name || "이름 없음"}</strong>
                <span>{user?.email || "이메일 없음"}</span>
              </div>
            </div>
          </section>

          <section className="profile-page__detail-card">
            <div className="profile-page__form-grid">
              <label className="profile-page__field">
                <span>이름</span>
                <input
                  type="text"
                  value={form.displayName}
                  disabled={isProfileEditLocked || saving}
                  onChange={(event) =>
                    onFieldChange("displayName", event.target.value)
                  }
                />
              </label>

              <label className="profile-page__field">
                <span>팀 / 소속</span>
                <input
                  type="text"
                  value={form.teamName}
                  disabled={isProfileEditLocked || saving}
                  onChange={(event) => onFieldChange("teamName", event.target.value)}
                  placeholder="예: 멀티미디어공학과"
                />
              </label>

              <label className="profile-page__field">
                <span>닉네임</span>
                <input
                  type="text"
                  value={form.nickname}
                  disabled={isProfileEditLocked || saving}
                  onChange={(event) => onFieldChange("nickname", event.target.value)}
                  placeholder="예: 일하는 감자"
                />
              </label>
            </div>

            <div className="profile-page__actions">
              <button
                type="button"
                className="profile-page__primary-button"
                onClick={onSave}
                disabled={saving || isProfileEditLocked || !hasProfileChanges}
              >
                {saving
                  ? "저장 중..."
                  : isProfileEditLocked
                    ? "변경 불가"
                    : hasProfileChanges
                      ? "계정 정보 저장"
                      : "변경 사항 없음"}
              </button>
            </div>
          </section>

          <section className="profile-page__stats-section">
            <div className="profile-page__stats-heading">
              <strong>프로필 변경 안내</strong>
              <span>
                <InfoIcon />
              </span>
            </div>

            <div className="profile-page__stat-grid">
              <div className="profile-page__stat-card profile-page__stat-card--blue">
                <span className="profile-page__stat-label">
                  <CalendarIcon />
                  <em>남은 변경 횟수</em>
                </span>
                <strong>{remainingChanges}회</strong>
              </div>

              <div className="profile-page__stat-card profile-page__stat-card--pink">
                <span className="profile-page__stat-label">
                  <ClockIcon />
                  <em>다음 초기화</em>
                </span>
                <strong>{nextResetCountdownLabel}</strong>
                <small>
                  {nextResetAtLabel === "변경 가능"
                    ? "지금 바로 수정 가능"
                    : `${nextResetDateLabel} 초기화`}
                </small>
              </div>
            </div>

            <div className="profile-page__stat-note">
              <strong>프로필은 30일 기준으로 관리돼요</strong>
              <span>
                변경 횟수는 매일 초기화되지 않고, 마지막 수정일 기준 30일 후에 다시 초기화돼요.
              </span>
            </div>
          </section>

          <section className="profile-page__detail-card profile-page__detail-card--muted">
            <div className="profile-page__section-row">
              <span className="profile-page__menu-icon profile-page__menu-icon--notice">
                <BellIcon />
              </span>
              <div className="profile-page__detail-header">
                <strong>알림 설정</strong>
                <span>푸시 알림과 일정 리마인더는 다음 단계에서 연결할 예정입니다.</span>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="profile-page__theme-card">
          <div className="profile-page__detail-header">
            <strong>앱 테마</strong>
            <span>메인 배경과 포인트 컬러를 이 브라우저에 저장합니다.</span>
          </div>

          <div className="profile-page__theme-group">
            <div className="profile-page__theme-section">
              <span className="profile-page__section-label">테마 선택</span>
              <div className="profile-page__theme-option-row">
                {themeOptions.map((option) => {
                  const buttonClassName = `profile-page__theme-option${
                    option.active ? " is-active" : ""
                  }${option.key === "spring" ? " is-spring" : ""}${
                    option.active && option.key === "spring"
                      ? " is-spring-active"
                      : ""
                  }${option.disabled ? " is-disabled" : ""}`;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={buttonClassName}
                      onClick={option.onClick}
                      disabled={option.disabled}
                      aria-label={option.label}
                    >
                      <span className="profile-page__theme-option-circle">
                        {option.icon}
                      </span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="profile-page__theme-section">
              <span className="profile-page__section-label">메인 배경</span>
              <div className="profile-page__palette-row">
                {BACKGROUND_PRESETS.map((preset) => {
                  const isActive = uiPreferences.backgroundKey === preset.key;

                  return (
                    <button
                      key={preset.key}
                      type="button"
                      title={preset.label}
                      aria-label={`${preset.label} 배경 적용`}
                      onClick={() =>
                        onUiPreferenceChange?.({
                          themeKey: "custom",
                          backgroundKey: preset.key,
                        })
                      }
                      style={buildPaletteButtonStyle(
                        isActive,
                        `linear-gradient(135deg, ${preset.palette.stage} 0%, ${preset.palette.stageStrong} 100%)`
                      )}
                    />
                  );
                })}
              </div>
            </div>

            <div className="profile-page__theme-section">
              <span className="profile-page__section-label">포인트 컬러</span>
              <div className="profile-page__palette-row">
                {MANUAL_ACCENT_PRESETS.map((preset) => {
                  const isActive = uiPreferences.accentKey === preset.key;

                  return (
                    <button
                      key={preset.key}
                      type="button"
                      title={preset.label}
                      aria-label={`${preset.label} 포인트 컬러 적용`}
                      onClick={() => {
                        setLastManualAccentKey(preset.key);
                        onUiPreferenceChange?.({
                          themeKey: "custom",
                          accentKey: preset.key,
                        });
                      }}
                      style={buildPaletteButtonStyle(isActive, preset.palette[500])}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}

export default ProfileSettingsView;
