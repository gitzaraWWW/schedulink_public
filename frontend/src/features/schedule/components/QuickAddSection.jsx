import { useEffect, useMemo, useRef, useState } from "react";
import aiProfileImage from "../../../assets/ai_profile.png";
import WeeklyCalendarPreview from "../../lucid/components/WeeklyCalendarPreview";
import FreeTimeResultCard from "./FreeTimeResultCard";
import { fetchTeamMembers } from "../../mentions/api/mentionApi";
import {
  replaceActiveMention,
  tokenizeMentionText,
} from "../../mentions/utils/mentionUtils";
import TeamMentionModal from "./TeamMentionModal";
import ScheduleSearchPanel from "./ScheduleSearchPanel";

const INTRO_MESSAGE =
  '안녕하세요! 저는 Schedulink AI입니다. 자연어로 일정을 말씀해 주시면 바로 등록해 드릴게요. 예를 들어 "다음 주 화요일 오후 3시에 팀 회의"처럼 말씀해 주세요.';

const STARTER_GUIDES = {
  edit: {
    intro:
      "무엇을 도와드릴까요? 아래 작업을 선택하거나, 등록·수정·삭제할 일정을 바로 입력해 주세요.",
    actions: [
      {
        id: "create",
        label: "일정 등록하기",
        description:
          "등록하고 싶은 일정을 채팅창에 적어 주세요. 함께할 멤버는 @멘션으로 초대할 수 있어요.",
        example: "내일 오후 2시에 @철수와 @영희랑 카페에서 회의가 있어.",
      },
      {
        id: "update",
        label: "일정 수정하기",
        description:
          "수정하고 싶은 일정 내용을 적어 주세요. 시간, 장소, 참석자 변경도 가능합니다.",
        example: "내일 오후 2시에 있는 회의를 오후 5시로 변경해줘.",
      },
      {
        id: "delete",
        label: "일정 삭제하기",
        description: "삭제하고 싶은 일정을 적어 주세요.",
        example: "내일 오후 2시 회의를 삭제해줘.",
      },
    ],
  },
  query: {
    intro:
      "찾고 싶은 일정이 있다면 아래 예시를 눌러보세요. 날짜 기준으로 일정을 찾고, 가능한 빈 시간도 확인할 수 있어요.",
    actions: [
      {
        id: "find-date",
        label: "오늘 일정 찾기",
        description: "특정 날짜의 일정을 찾고 싶다면 날짜와 조건을 함께 적어 주세요.",
        example: "오늘 내 일정 보여줘.",
      },
      {
        id: "find-free-time",
        label: "빈 시간 찾기",
        description: "회의 가능한 시간을 찾고 싶다면 기간과 참석자를 함께 적어 주세요.",
        example: "다음 주에 @영희랑 1시간 비는 시간 찾아줘.",
      },
    ],
  },
};

function AssistantBadgeIcon() {
  return (
    <img src={aiProfileImage} alt="" aria-hidden="true" className="chat-avatar__image" />
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="6.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M10 6.9v3.6l2.4 1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M10 16.2s4.5-4.4 4.5-7.7A4.5 4.5 0 0 0 5.5 8.5c0 3.3 4.5 7.7 4.5 7.7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="8.4" r="1.5" fill="currentColor" />
    </svg>
  );
}

function SearchListIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <circle cx="8.25" cy="8.25" r="4.75" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m11.9 11.9 4.1 4.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function normalizeStoredClock(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 5);
}

function formatMessageTime(createdAt) {
  if (!createdAt) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(createdAt));
  } catch {
    return "";
  }
}

function formatDateLabel(dateValue) {
  if (!dateValue) {
    return "";
  }

  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue))) {
      const [year, month, day] = String(dateValue).split("-").map(Number);
      return new Intl.DateTimeFormat("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
      }).format(new Date(year, month - 1, day));
    }

    return new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(new Date(dateValue));
  } catch {
    return String(dateValue);
  }
}

function formatPreviewTime(lastParsed, lastDbSave) {
  const eventRow = lastDbSave?.event || null;
  const hasStoredEventTime = Boolean(eventRow?.start_time || eventRow?.end_time);
  const startTime = hasStoredEventTime
    ? normalizeStoredClock(eventRow?.start_time)
    : lastParsed?.startTime || null;
  const endTime = hasStoredEventTime
    ? normalizeStoredClock(eventRow?.end_time)
    : lastParsed?.endTime || null;

  if (!startTime && !endTime) {
    return "종일";
  }

  if (startTime && endTime) {
    return startTime === endTime ? startTime : `${startTime} - ${endTime}`;
  }

  return startTime || endTime || "종일";
}

function buildSummaryData(parsed, db) {
  const event = db?.event || null;

  return {
    title: parsed?.summary || event?.summary || event?.title || "일정 제목",
    dateLabel: formatDateLabel(parsed?.date || event?.date || event?.start),
    timeLabel: formatPreviewTime(parsed, db),
    location: parsed?.location || event?.location || "장소 미정",
  };
}

function TypingDots() {
  return (
    <span className="chat-typing-dots" aria-label="응답 생성 중">
      <span />
      <span />
      <span />
    </span>
  );
}

function ScheduleSummaryCard({ parsed, db }) {
  const summary = buildSummaryData(parsed, db);
  const dateTimeLabel = summary.dateLabel
    ? `${summary.dateLabel} · ${summary.timeLabel}`
    : summary.timeLabel;

  return (
    <div className="schedule-result-card">
      <div className="schedule-result-card__accent" aria-hidden="true" />
      <div className="schedule-result-card__body">
        <strong className="schedule-result-card__title">{summary.title}</strong>
        <div className="schedule-result-card__meta">
          <span>
            <ClockIcon />
            {dateTimeLabel}
          </span>
          <span>
            <PinIcon />
            {summary.location}
          </span>
        </div>
        <div className="schedule-result-card__actions">
          <button type="button" className="schedule-result-card__button is-primary">
            확인
          </button>
          <button type="button" className="schedule-result-card__button">
            수정
          </button>
        </div>
      </div>
    </div>
  );
}

function getDayOffset(baseDateKey, valueDateKey) {
  if (!baseDateKey || !valueDateKey) {
    return 0;
  }

  const baseDate = new Date(`${baseDateKey}T00:00:00`);
  const valueDate = new Date(`${valueDateKey}T00:00:00`);

  if (Number.isNaN(baseDate.getTime()) || Number.isNaN(valueDate.getTime())) {
    return 0;
  }

  return Math.round((valueDate.getTime() - baseDate.getTime()) / 86400000);
}

function formatTimelineTime(value, baseDateKey = null) {
  const match = String(value || "").match(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);

  if (!match) {
    return "";
  }

  const dayOffset = baseDateKey ? getDayOffset(baseDateKey, match[1]) : 0;
  const hour = Number(match[2]) + dayOffset * 24;
  const minute = Number(match[3]);

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTimeRangeLabel(item) {
  try {
    const baseDateKey = item?.date || String(item?.start || "").slice(0, 10) || null;
    const start = item?.start ? formatTimelineTime(item.start, baseDateKey) : "";
    const end = item?.end ? formatTimelineTime(item.end, baseDateKey) : "";

    if (start && end) {
      return `${start} - ${end}`;
    }

    return start || end || "시간 미정";
  } catch {
    return "시간 미정";
  }
}

function getLucidRangeDayCount(range) {
  if (!range?.startDate || !range?.endDate) {
    return 0;
  }

  const startDate = new Date(`${range.startDate}T00:00:00`);
  const endDate = new Date(`${range.endDate}T00:00:00`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
}

function LucidResultBlock({ lucid }) {
  if (lucid?.action === "find_free_time") {
    return <FreeTimeResultCard lucid={lucid} />;
  }

  const events = Array.isArray(lucid?.events) ? lucid.events : [];
  const freeSlots = Array.isArray(lucid?.freeSlots) ? lucid.freeSlots : [];
  const items = lucid?.action === "find_free_time" ? freeSlots : events;
  const itemTitleFallback =
    lucid?.action === "find_free_time" ? "빈 시간" : "추천 일정";
  const itemLimit =
    lucid?.action === "list_events" && getLucidRangeDayCount(lucid?.range) > 7
      ? items.length
      : 4;

  return (
    <div className="lucid-result-block">
      <WeeklyCalendarPreview
        events={events}
        freeSlots={freeSlots}
        range={lucid?.range}
        constraints={lucid?.constraints}
        action={lucid?.action}
      />
      <div className="lucid-result-block__list">
        {items.length === 0 ? (
          <div className="lucid-result-block__empty">표시할 일정이 없습니다.</div>
        ) : (
          items.slice(0, itemLimit).map((item, index) => (
            <div
              key={`${item.id || item.start || "item"}-${index}`}
              className="lucid-result-block__item"
            >
              <strong>{item.title || itemTitleFallback}</strong>
              <span>{formatDateLabel(item.date || item.start)}</span>
              <span>{formatTimeRangeLabel(item)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MessageBubble({ role = "assistant", children, timestamp, tone = "normal" }) {
  return (
    <div className={`chat-message chat-message--${role}`}>
      {role === "assistant" ? (
        <div className={`chat-avatar${tone === "success" ? " is-success" : ""}`}>
          <AssistantBadgeIcon />
        </div>
      ) : null}
      <div className="chat-message__stack">
        <div
          className={`chat-bubble chat-bubble--${role}${
            tone !== "normal" ? ` chat-bubble--${tone}` : ""
          }`}
        >
          {children}
        </div>
        {timestamp ? <span className="chat-message__time">{timestamp}</span> : null}
      </div>
    </div>
  );
}

function renderMentionText(text) {
  const tokens = tokenizeMentionText(text);

  if (tokens.length === 0) {
    return text || null;
  }

  return tokens.map((token, index) => (
    <span
      key={`${token.type}-${index}-${token.value}`}
      className={token.type === "mention" ? "chat-mention" : undefined}
    >
      {token.value}
    </span>
  ));
}

function StarterActions({ actions, selectedActionId, onSelectAction }) {
  return (
    <div className="chat-starter-actions">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={`chat-starter-actions__button${
            selectedActionId === action.id ? " is-active" : ""
          }`}
          onClick={() => onSelectAction(action.id)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function StarterGuideCard({ action, onApplyExample }) {
  if (!action) {
    return null;
  }

  return (
    <MessageBubble role="assistant">
      <div className="chat-starter-guide">
        <strong className="chat-starter-guide__title">{action.label}</strong>
        <p className="chat-bubble__copy">{action.description}</p>
        <p className="chat-starter-guide__example">예시: {action.example}</p>
        <button
          type="button"
          className="chat-starter-guide__cta"
          onClick={() => onApplyExample(action.example)}
        >
          예시 입력하기
        </button>
      </div>
    </MessageBubble>
  );
}

function ConversationMessage({
  message,
  starterIntro = INTRO_MESSAGE,
  starterActions = [],
  selectedStarterActionId = null,
  onSelectStarterAction,
}) {
  const timestamp = formatMessageTime(message.createdAt);

  if (message.kind === "intro") {
    return (
      <MessageBubble role="assistant" timestamp={timestamp}>
        <p className="chat-bubble__copy">{starterIntro}</p>
        {starterActions.length > 0 ? (
          <StarterActions
            actions={starterActions}
            selectedActionId={selectedStarterActionId}
            onSelectAction={onSelectStarterAction}
          />
        ) : null}
      </MessageBubble>
    );
  }

  if (message.kind === "pending") {
    return (
      <MessageBubble role="assistant" timestamp={timestamp}>
        <TypingDots />
        <p className="chat-bubble__copy">
          {message.text || "일정을 정리하고 있어요."}
        </p>
      </MessageBubble>
    );
  }

  if (message.kind === "result") {
    return (
      <MessageBubble role="assistant" timestamp={timestamp} tone="success">
        <p className="chat-bubble__copy">{message.text || "일정을 등록했습니다!"}</p>
        <ScheduleSummaryCard parsed={message.parsed} db={message.db} />
      </MessageBubble>
    );
  }

  if (message.kind === "lucid-result") {
    const lucid = message.metadata?.lucid;

    if (lucid?.action === "find_free_time") {
      return (
        <div className="chat-message chat-message--assistant chat-message--result-card">
          <div className="chat-avatar is-success">
            <AssistantBadgeIcon />
          </div>
          <div className="chat-message__stack chat-message__stack--result-card">
            <div className="chat-bubble chat-bubble--assistant chat-result-intro-bubble">
              <p className="chat-bubble__copy chat-result-intro">
                {message.text || "검색 결과를 정리했습니다."}
              </p>
            </div>
            <LucidResultBlock lucid={lucid} />
            {timestamp ? <span className="chat-message__time">{timestamp}</span> : null}
          </div>
        </div>
      );
    }

    return (
      <MessageBubble role="assistant" timestamp={timestamp} tone="success">
        <p className="chat-bubble__copy">
          {message.text || "검색 결과를 정리했습니다."}
        </p>
        <LucidResultBlock lucid={message.metadata?.lucid} />
      </MessageBubble>
    );
  }

  if (message.kind === "ownership-required") {
    return (
      <MessageBubble role="assistant" timestamp={timestamp} tone="warning">
        <p className="chat-bubble__copy">
          {message.text || "처리 방식을 선택해 주세요."}
        </p>
        <ScheduleSummaryCard parsed={message.parsed} db={message.db} />
      </MessageBubble>
    );
  }

  if (message.kind === "error") {
    return (
      <MessageBubble role="assistant" timestamp={timestamp} tone="warning">
        <p className="chat-bubble__copy">
          {message.text || "요청을 처리하지 못했습니다. 다시 시도해 주세요."}
        </p>
      </MessageBubble>
    );
  }

  if (message.role === "user") {
    return (
      <MessageBubble role="user" timestamp={timestamp}>
        <p className="chat-bubble__copy">{renderMentionText(message.text)}</p>
      </MessageBubble>
    );
  }

  return (
    <MessageBubble role="assistant" timestamp={timestamp}>
      <p className="chat-bubble__copy">{renderMentionText(message.text)}</p>
    </MessageBubble>
  );
}

function buildTeamMentionSuggestions({ mentionTeams = [] }) {
  return Array.isArray(mentionTeams) ? mentionTeams : [];
}

function MentionPanel({
  mentionQuery,
  mentionLoading,
  mentionError,
  mentionResults,
  onMentionSelect,
  teamResults,
  onTeamMentionSelect,
}) {
  if (!mentionQuery) {
    return null;
  }

  return (
    <div className="mention-sheet mention-panel-scroll">
      <div className="mention-sheet__header">
        <strong>@{mentionQuery} 검색 결과</strong>
        <span>{mentionResults.length}명</span>
      </div>

      {teamResults.length > 0 ? (
        <div className="mention-sheet__group">
          {teamResults.map((team) => (
            <button
              key={team.id}
              type="button"
              className="mention-sheet__team"
              onClick={() => onTeamMentionSelect(team)}
            >
              팀 전체 선택: {team.name}
            </button>
          ))}
        </div>
      ) : null}

      {mentionLoading ? (
        <div className="mention-sheet__empty">사용자를 검색하는 중입니다.</div>
      ) : null}

      {!mentionLoading && mentionError ? (
        <div className="mention-sheet__empty">{mentionError}</div>
      ) : null}

      {!mentionLoading && !mentionError && mentionResults.length === 0 ? (
        <div className="mention-sheet__empty">검색 결과가 없습니다.</div>
      ) : null}

      {!mentionLoading && !mentionError && mentionResults.length > 0 ? (
        <div className="mention-sheet__group">
          {mentionResults.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className="mention-sheet__person"
              onClick={() => onMentionSelect(profile)}
            >
              <span>
                <strong>{profile.display_name}</strong>
                <small>
                  {profile.nickname ? `@${profile.nickname}` : "닉네임 없음"}
                </small>
              </span>
              <small>{profile.team_name || "팀 정보 없음"}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QuickAddSection({
  events = [],
  chatMode = "edit",
  messages,
  textInput,
  onTextInputChange,
  selectedTeamMentions,
  onApplyTeamMention,
  onSubmit,
  submitting,
  mentionQuery,
  mentionLoading,
  mentionError,
  mentionResults,
  mentionTeams,
  onMentionSelect,
}) {
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const [isTeamMentionModalOpen, setIsTeamMentionModalOpen] = useState(false);
  const [selectedTeamMention, setSelectedTeamMention] = useState(null);
  const [teamMentionMembers, setTeamMentionMembers] = useState([]);
  const [teamMentionLoading, setTeamMentionLoading] = useState(false);
  const [teamMentionError, setTeamMentionError] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedStarterActionId, setSelectedStarterActionId] = useState(null);
  const starterGuide = STARTER_GUIDES[chatMode] || STARTER_GUIDES.edit;
  const hasOnlyStarterMessages =
    !Array.isArray(messages) || messages.every((message) => message.kind === "intro");
  const selectedStarterAction =
    starterGuide.actions.find((action) => action.id === selectedStarterActionId) || null;
  const transcriptMessages =
    Array.isArray(messages) && messages.length > 0
      ? messages
      : [{ id: "starter-intro", kind: "intro", role: "assistant" }];

  const teamMentionResults = useMemo(
    () => buildTeamMentionSuggestions({ mentionTeams }),
    [mentionTeams]
  );
  const selectedTeamMentionEntry = useMemo(
    () =>
      (selectedTeamMentions || []).find(
        (teamMention) => teamMention.teamName === selectedTeamMention?.name
      ) || null,
    [selectedTeamMention, selectedTeamMentions]
  );

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({
      block: "end",
      behavior: submitting ? "smooth" : "auto",
    });
  }, [messages, submitting]);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(
      textareaRef.current.scrollHeight,
      120
    )}px`;

    if (highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, [textInput]);

  useEffect(() => {
    if (!mentionQuery) {
      setIsTeamMentionModalOpen(false);
      setSelectedTeamMention(null);
      setTeamMentionMembers([]);
      setTeamMentionError("");
      setTeamMentionLoading(false);
    }
  }, [mentionQuery]);

  useEffect(() => {
    setSelectedStarterActionId(null);
  }, [chatMode, messages]);

  useEffect(() => {
    if (!isTeamMentionModalOpen || !selectedTeamMention?.name) {
      return undefined;
    }

    let cancelled = false;
    setTeamMentionLoading(true);
    setTeamMentionError("");

    fetchTeamMembers(selectedTeamMention.name)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setTeamMentionMembers(payload.members || []);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setTeamMentionMembers([]);
        setTeamMentionError(error.message);
      })
      .finally(() => {
        if (!cancelled) {
          setTeamMentionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isTeamMentionModalOpen, selectedTeamMention]);

  const handleTextareaKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent?.isComposing) {
      return;
    }

    event.preventDefault();

    if (!submitting) {
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleTextareaScroll = (event) => {
    if (!highlightRef.current) {
      return;
    }

    highlightRef.current.scrollTop = event.currentTarget.scrollTop;
    highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };

  const handleTeamMentionSelect = (team) => {
    setSelectedTeamMention(team);
    setTeamMentionMembers([]);
    setTeamMentionError("");
    setIsTeamMentionModalOpen(true);
  };

  const handleTeamMentionApply = ({ teamName, members }) => {
    const normalizedTeamName = String(teamName || "").trim();

    if (!normalizedTeamName) {
      return;
    }

    onTextInputChange(replaceActiveMention(textInput, normalizedTeamName));
    onApplyTeamMention?.({
      teamName: normalizedTeamName,
      members,
    });
    setIsTeamMentionModalOpen(false);
    setSelectedTeamMention(null);
    setTeamMentionMembers([]);
    setTeamMentionError("");
  };

  const handleStarterExampleApply = (example) => {
    onTextInputChange(example);
    textareaRef.current?.focus();
  };

  return (
    <>
      <div className="quick-chat-shell">
        <div className="quick-chat-transcript">
          {transcriptMessages.map((message) => (
            <ConversationMessage
              key={message.id}
              message={message}
              starterIntro={starterGuide.intro}
              starterActions={
                hasOnlyStarterMessages && message.kind === "intro"
                  ? starterGuide.actions
                  : []
              }
              selectedStarterActionId={selectedStarterActionId}
              onSelectStarterAction={setSelectedStarterActionId}
            />
          ))}
          {hasOnlyStarterMessages && selectedStarterAction ? (
            <StarterGuideCard
              action={selectedStarterAction}
              onApplyExample={handleStarterExampleApply}
            />
          ) : null}
          <div ref={transcriptEndRef} />
        </div>

        <div className="quick-chat-composer-wrap">
          <MentionPanel
            mentionQuery={mentionQuery}
            mentionLoading={mentionLoading}
            mentionError={mentionError}
            mentionResults={mentionResults}
            onMentionSelect={onMentionSelect}
            teamResults={teamMentionResults}
            onTeamMentionSelect={handleTeamMentionSelect}
          />

          <form onSubmit={onSubmit} className="quick-chat-composer">
            <button
              type="button"
              className="quick-chat-composer__list"
              aria-label="일정 리스트 열기"
              onClick={() => setIsSearchOpen(true)}
            >
              <SearchListIcon />
            </button>
            <div
              ref={highlightRef}
              className={`quick-chat-composer__highlight${textInput ? "" : " is-placeholder"}`}
              aria-hidden="true"
            >
              {textInput ? (
                renderMentionText(textInput)
              ) : (
                <span className="quick-chat-composer__placeholder">
                  ?쇱젙??留먰빐蹂댁꽭??.. (?? ?댁씪 ?ㅽ썑 3??
                </span>
              )}
              {"\n"}
            </div>
            <textarea
              ref={textareaRef}
              value={textInput}
              onChange={(event) => onTextInputChange(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              onScroll={handleTextareaScroll}
              placeholder="일정을 말해보세요... (예: 내일 오후 3시)"
              rows={1}
              className="quick-chat-composer__input"
            />
            <button
              type="submit"
              className="quick-chat-composer__send"
              disabled={submitting}
              aria-label="메시지 보내기"
            >
              보내기
            </button>
          </form>
        </div>
      </div>

      <TeamMentionModal
        isOpen={isTeamMentionModalOpen}
        teamName={selectedTeamMention?.name || "선택한 팀"}
        members={teamMentionMembers}
        loading={teamMentionLoading}
        error={teamMentionError}
        initialSelectedMemberIds={
          selectedTeamMentionEntry?.members?.map((member) => member.user_id) || []
        }
        onClose={() => {
          setIsTeamMentionModalOpen(false);
          setSelectedTeamMention(null);
          setTeamMentionMembers([]);
          setTeamMentionError("");
        }}
        onSubmit={handleTeamMentionApply}
      />

      <ScheduleSearchPanel
        isOpen={isSearchOpen}
        events={events}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}

export default QuickAddSection;
