import { useEffect, useRef, useState } from "react";
import { useSchedulinkApp } from "./app/useSchedulinkApp";
import ArchiveView from "./features/archive/components/ArchiveView";
import LoginPrompt from "./features/auth/components/LoginPrompt";
import CalendarSection from "./features/calendar/components/CalendarSection";
import DayScheduleModal from "./features/calendar/components/DayScheduleModal";
import InboxView from "./features/inbox/components/InboxView";
import UnifiedInboxMenu from "./features/inbox/components/UnifiedInboxMenu";
import ProfileSettingsView from "./features/profile/components/ProfileSettingsView";
import OwnershipTransferModal from "./features/schedule/components/OwnershipTransferModal";
import QuickAddSection from "./features/schedule/components/QuickAddSection";
import SidebarDrawer from "./features/sidebar/components/SidebarDrawer";
import SubscriptionView from "./features/subscription/components/SubscriptionView";
import loginScreenImage from "./assets/loginsceen.jpg";
import logoIcon from "./assets/logo_icon.jpg";
import {
  DEFAULT_UI_PREFERENCES,
  applyUiTheme,
  loadUiPreferences,
  saveUiPreferences,
} from "./shared/theme/theme";

const chatModes = [
  {
    id: "schedule-edit",
    mode: "edit",
    label: "일정 추가/수정/삭제 모드",
    badge: "관리",
  },
  {
    id: "calendar-search",
    mode: "query",
    label: "일정 검색 모드",
    badge: "검색",
  },
];

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BrandIcon() {
  return (
    <img className="toolbar-brand-image" src={logoIcon} alt="" aria-hidden="true" />
  );
}

function ScheduleModeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M15.9 4.15a2.1 2.1 0 0 1 2.97 0l1 1a2.1 2.1 0 0 1 0 2.97l-1.32 1.31-3.96-3.96 1.31-1.32Z"
        fill="currentColor"
      />
      <path
        d="m13.65 6.37 3.98 3.98-6.94 6.94-4.31 1.19 1.19-4.31 6.08-7.8Z"
        fill="currentColor"
      />
      <path d="m8.2 17.98 1.72-.48-1.24-1.24-.48 1.72Z" fill="var(--bw-white)" />
      <path
        d="M11.15 8.86 8.46 12.3"
        stroke="var(--bw-white)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M13.18 10.89 10.5 14.33"
        stroke="var(--bw-white)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchModeIcon() {
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

function CalendarSwitchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2.8"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M8 4v3.5M16 4v3.5M4 9.5h16"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function App() {
  const app = useSchedulinkApp();
  const toastTimerRef = useRef(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState("workspace");
  const [activeWorkspace, setActiveWorkspace] = useState("chat");
  const [toastMessage, setToastMessage] = useState("");
  const [uiPreferences, setUiPreferences] = useState(loadUiPreferences);

  const currentConversation = app.conversations.items.find(
    (conversation) => conversation.id === app.conversations.currentConversationId
  );
  const isCalendarWorkspace =
    activeView === "workspace" && activeWorkspace === "calendar";
  const selectedChatMode =
    chatModes.find((mode) => mode.mode === currentConversation?.mode) || chatModes[0];

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    applyUiTheme(uiPreferences);
  }, [uiPreferences]);

  const showToast = (message) => {
    setToastMessage(message);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
      toastTimerRef.current = null;
    }, 2200);
  };

  const handleModeChange = (modeId) => {
    const nextMode = chatModes.find((item) => item.id === modeId);
    if (!nextMode) {
      return;
    }

    setActiveView("workspace");
    setActiveWorkspace("chat");

    if (currentConversation?.id) {
      app.conversations.onChangeMode(currentConversation.id, nextMode.mode);
    }
  };

  const handleUiPreferenceChange = (patch) => {
    setUiPreferences((currentPreferences) =>
      saveUiPreferences({
        ...currentPreferences,
        ...patch,
      })
    );
  };

  const handleUiPreferenceReset = () => {
    setUiPreferences(saveUiPreferences(DEFAULT_UI_PREFERENCES));
  };

  const handleOpenProfilePage = () => {
    setActiveView("profile");
  };

  const handleSaveProfile = async () => {
    const data = await app.profile.onSave();

    if (data) {
      showToast(data.message || "프로필이 저장되었습니다.");
    }
  };

  if (app.loadingUser) {
    return <div style={{ padding: "20px" }}>작업 공간을 불러오는 중입니다.</div>;
  }

  return (
    <div
      className={`app-shell app-shell--mockup${
        isCalendarWorkspace ? " app-shell--calendar" : ""
      }`}
    >
      {!app.user ? (
        <div
          className="app-auth-shell"
          style={{ "--auth-hero-image": `url(${loginScreenImage})` }}
        >
          <h1 className="app-auth-title">schedulink</h1>
          <LoginPrompt onLogin={app.auth.handleLogin} />
        </div>
      ) : (
        <>
          {activeView !== "profile" &&
          activeView !== "subscription" &&
          activeView !== "inbox" ? (
            <div className="app-header app-header--split">
            <div className="app-header__left">
              <button
                type="button"
                className="toolbar-icon-button toolbar-icon-button--ghost"
                aria-label="사이드바 열기"
                onClick={() => setIsSidebarOpen(true)}
              >
                <MenuIcon />
              </button>

              <button
                type="button"
                className="toolbar-icon-button toolbar-icon-button--mint"
                hidden
                aria-label="워크스페이스 홈"
                onClick={() => {
                  setActiveView("workspace");
                  setActiveWorkspace("chat");
                }}
              >
                <BrandIcon />
              </button>
            </div>

            <div className="app-header__right">
              <UnifiedInboxMenu
                creatorReviewRequests={app.actionItems.creatorReviewRequests}
                deleteApprovalTargets={app.actionItems.deleteApprovalTargets}
                deleteNotifications={app.actionItems.deleteNotifications}
                invitations={app.invitations.items}
                onOpen={() => setActiveView("inbox")}
                triggerClassName="toolbar-icon-button toolbar-icon-button--mail"
              />

              <button
                type="button"
                className={`toolbar-calendar-button${
                  activeWorkspace === "calendar" ? " is-current" : ""
                }`}
                aria-label={activeWorkspace === "calendar" ? "일정비서 화면 전환" : "캘린더 화면 전환"}
                onClick={() => {
                  setActiveView("workspace");
                  setActiveWorkspace((currentValue) =>
                    currentValue === "calendar" ? "chat" : "calendar"
                  );
                }}
              >
                <CalendarSwitchIcon />
                <span>{activeWorkspace === "calendar" ? "일정비서" : "캘린더"}</span>
              </button>
            </div>
            </div>
          ) : null}

          {activeView === "profile" ? (

            <ProfileSettingsView
              user={app.user}
              mentionProfile={app.profile.mentionProfile}
              profileChangeLimit={app.profile.profileChangeLimit}
              form={app.profile.form}
              saving={app.profile.saving}
              uiPreferences={uiPreferences}
              onBack={() => setActiveView("workspace")}
              onLogout={app.auth.handleLogout}
              onFieldChange={app.profile.onFieldChange}
              onSave={handleSaveProfile}
              onUiPreferenceChange={handleUiPreferenceChange}
              onUiPreferenceReset={handleUiPreferenceReset}
            />
          ) : activeView === "subscription" ? (
            <SubscriptionView
              onBack={() => setActiveView("workspace")}
              onSubscriptionChanged={() => app.calendar.onRefresh?.()}
            />
          ) : activeView === "inbox" ? (
            <InboxView
              onBack={() => setActiveView("workspace")}
              creatorReviewRequests={app.actionItems.creatorReviewRequests}
              deleteApprovalTargets={app.actionItems.deleteApprovalTargets}
              deleteNotifications={app.actionItems.deleteNotifications}
              actionLoading={app.actionItems.loading}
              actingRequestId={app.actionItems.actingChangeRequestId}
              actingTargetId={app.actionItems.actingDeleteTargetId}
              dismissingNotificationId={app.actionItems.dismissingDeleteNotificationId}
              onOpenActionItems={app.actionItems.onOpen}
              onReviewProposal={app.actionItems.onReviewProposal}
              onRespondDelete={app.actionItems.onRespondDelete}
              onDismissDeleteNotification={app.actionItems.onDismissDeleteNotification}
              invitations={app.invitations.items}
              invitationLoading={app.invitations.loading}
              respondingInvitationId={app.invitations.respondingInvitationId}
              dismissingInvitationId={app.invitations.dismissingInvitationId}
              onRespondInvitation={app.invitations.onRespond}
              onDismissInvitation={app.invitations.onDismiss}
            />
          ) : (
            <div className="workspace-shell workspace-shell--mockup">
              {activeWorkspace !== "calendar" ? (
                <div className="workspace-summary workspace-summary--split">
                  <div className="workspace-summary__main">
                    <div className="workspace-summary__copy">
                      <h1 className="workspace-summary__title">AI 일정 비서 뭉고미</h1>
                      <p className="workspace-summary__subtitle">{selectedChatMode.label}</p>
                    </div>

                    <div
                      className={`workspace-summary__status${
                        selectedChatMode.mode === "query" ? " is-search" : ""
                      }`}
                    >
                      <span className="workspace-summary__dot" />
                      <span>{selectedChatMode.badge}</span>
                    </div>
                  </div>

                  <div className="toolbar-mode-switch" aria-label="채팅 모드 전환">
                    <button
                      type="button"
                      className={`toolbar-mode-switch__button${
                        selectedChatMode.mode === "edit" ? " is-active" : ""
                      }`}
                      aria-label="일정 추가 모드"
                      onClick={() => handleModeChange("schedule-edit")}
                    >
                      <ScheduleModeIcon />
                    </button>
                    <button
                      type="button"
                      className={`toolbar-mode-switch__button${
                        selectedChatMode.mode === "query" ? " is-active" : ""
                      }`}
                      aria-label="검색 모드"
                      onClick={() => handleModeChange("calendar-search")}
                    >
                      <SearchModeIcon />
                    </button>
                  </div>
                </div>
              ) : null}

              <div
                className={`workspace-stage${
                  activeWorkspace === "calendar" ? " workspace-stage--calendar" : ""
                }`}
              >
                {activeWorkspace === "calendar" ? (
                      <CalendarSection
                        events={app.events}
                        onRangeChange={app.calendar.onRangeChange}
                      onDateClick={app.calendar.onDateSelect}
                      onEventClick={app.calendar.onEventSelect}
                      />
                ) : (
                  <QuickAddSection
                    events={app.events}
                    chatMode={selectedChatMode.mode}
                    messages={app.schedule.messages}
                    textInput={app.schedule.textInput}
                    onTextInputChange={app.schedule.setTextInput}
                    selectedTeamMentions={app.schedule.selectedTeamMentions}
                    onApplyTeamMention={app.schedule.applyTeamMention}
                    onSubmit={(event) =>
                      app.schedule.handleSubmit(event, selectedChatMode.id)
                    }
                    submitting={app.schedule.submitting}
                    mentionQuery={app.mentions.query}
                    mentionLoading={app.mentions.loading}
                    mentionError={app.mentions.error}
                    mentionResults={app.mentions.results}
                    mentionTeams={app.mentions.teams}
                    onMentionSelect={app.mentions.onSelect}
                  />
                )}
              </div>
            </div>
          )}

          <div className="stack-grid">
            <SidebarDrawer
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              conversations={app.conversations.sidebarItems}
              currentConversationId={app.conversations.currentConversationId}
              onCreateConversation={() => {
                app.conversations.onCreate();
                setActiveView("workspace");
                setActiveWorkspace("chat");
              }}
              onSelectConversation={(conversationId) => {
                app.conversations.onSelect(conversationId);
                setActiveView("workspace");
                setActiveWorkspace("chat");
              }}
              onRenameConversation={(conversationId, title) => {
                app.conversations.onRename(conversationId, title);
                showToast("대화 제목을 변경했습니다.");
              }}
              onTogglePin={(conversationId) => {
                const conversation = app.conversations.items.find(
                  (item) => item.id === conversationId
                );

                app.conversations.onTogglePin(conversationId);
                showToast(
                  conversation?.isPinned
                    ? "상단 고정을 해제했습니다."
                    : "상단에 고정했습니다."
                );
              }}
              onToggleArchive={(conversationId) => {
                const conversation = app.conversations.items.find(
                  (item) => item.id === conversationId
                );

                app.conversations.onToggleArchive(conversationId);
                showToast(
                  conversation?.isArchived
                    ? "보관함에서 꺼냈습니다."
                    : "보관함으로 이동했습니다."
                );
              }}
              onMoveToTrash={(conversationId) => {
                app.conversations.onMoveToTrash(conversationId);
                showToast("휴지통으로 이동했습니다.");
              }}
              onOpenArchive={() => setActiveView("archive")}
              onOpenSubscription={() => setActiveView("subscription")}
              onOpenProfilePage={handleOpenProfilePage}
              user={app.user}
              profileForm={app.profile.form}
              onLogout={app.auth.handleLogout}
            />

            <ArchiveView
              isOpen={activeView === "archive"}
              onClose={() => setActiveView("workspace")}
              conversations={app.conversations.items}
              onRestoreConversation={(conversationId) => {
                app.conversations.onRestore(conversationId);
                showToast("대화를 복원했습니다.");
              }}
              onDeleteConversationPermanently={(conversationId) => {
                app.conversations.onDeletePermanently(conversationId);
                showToast("대화를 영구 삭제했습니다.");
              }}
              onSelectConversation={(conversationId) => {
                app.conversations.onSelect(conversationId);
                setActiveView("workspace");
                setActiveWorkspace("chat");
              }}
            />
            <OwnershipTransferModal
              prompt={app.schedule.ownershipTransferPrompt}
              submitting={app.schedule.submitting}
              onClose={app.schedule.handleOwnershipTransferClose}
              onSubmit={app.schedule.handleOwnershipTransferSubmit}
            />

            <DayScheduleModal
              isOpen={app.calendar.isDayScheduleOpen}
              selectedDate={app.calendar.selectedDate}
              events={app.calendar.selectedDateEvents}
              selectedEventId={app.calendar.selectedEventId}
              savingEventId={app.calendar.savingCalendarEventId}
              deletingEventId={app.calendar.deletingCalendarEventId}
              detailStatus={app.calendar.detailStatus}
              onSelectEvent={app.calendar.onSelectEventInModal}
              onClearSelectedEvent={app.calendar.onClearSelectedEvent}
              onClose={app.calendar.onCloseDaySchedule}
              onSaveEvent={app.calendar.onSaveEvent}
              onDeleteEvent={app.calendar.onDeleteEvent}
            />
          </div>

          {toastMessage ? (
            <div className="app-toast" role="status" aria-live="polite">
              {toastMessage}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default App;
