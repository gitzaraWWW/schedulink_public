import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dismissDeleteNotification,
  fetchActionItems,
  markDeleteNotificationsRead,
  respondToDeleteRequest,
  reviewUpdateProposal,
} from "../features/actions/api/actionItemApi";
import {
  fetchSession,
  getGoogleLoginUrl,
  logoutSession,
} from "../features/auth/api/sessionApi";
import {
  deleteCalendarEvent,
  deleteGoogleCalendarEvent,
  fetchEvents,
  saveCalendarEvent,
  saveGoogleCalendarEvent,
  syncCalendar,
  syncEvent,
  syncParticipant,
  updateParticipantStatus,
} from "../features/calendar/api/calendarApi";
import {
  normalizeEvent,
  getEventsForDate,
  sortEvents,
  upsertEvent,
} from "../features/calendar/utils/eventUtils";
import {
  createChatConversation as createChatConversationRequest,
  createChatMessage as createChatMessageRequest,
  deleteChatConversation as deleteChatConversationRequest,
  fetchChatConversations,
  fetchChatMessages,
  permanentlyDeleteChatConversation,
  updateChatConversation as updateChatConversationRequest,
} from "../features/chat/api/chatApi";
import { syncUser } from "../features/debug/api/debugApi";
import {
  dismissInvitation,
  fetchMyInvitations,
  respondToInvitation,
  syncInvitation,
  updateInvitationStatus,
} from "../features/invitations/api/invitationApi";
import { queryLucid } from "../features/lucid/api/lucidApi";
import { searchMentions } from "../features/mentions/api/mentionApi";
import {
  getActiveMentionQuery,
  replaceActiveMention,
} from "../features/mentions/utils/mentionUtils";
import { saveMentionProfile } from "../features/profile/api/profileApi";
import { quickAddSchedule } from "../features/schedule/api/scheduleApi";

function createEmptyProfileForm() {
  return {
    displayName: "",
    teamName: "",
    nickname: "",
  };
}

function buildProfileForm(mentionProfile, user) {
  return {
    displayName: mentionProfile?.display_name || user?.name || "",
    teamName: mentionProfile?.team_name || "",
    nickname: mentionProfile?.nickname || "",
  };
}

function createEmptyProfileChangeLimit() {
  return {
    maxChanges: 2,
    windowDays: 30,
    usedChanges: 0,
    remainingChanges: 2,
    startedAt: null,
    nextResetAt: null,
  };
}

const DEFAULT_CONVERSATION_TITLE = "새 대화";
const LIVE_REFRESH_INTERVAL_MS = 30_000;

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function buildCalendarFetchRange(anchorDate = new Date()) {
  const currentMonth = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    1
  );
  const startDate = toDateKey(addMonths(currentMonth, -1));
  const endDate = toDateKey(addMonths(currentMonth, 2));

  return {
    startDate,
    endDate,
    key: `${startDate}:${endDate}`,
  };
}

function createEmptyConversationState() {
  return {
    conversations: [],
    currentConversationId: null,
  };
}

function normalizeConversationRecord(record = {}) {
  return {
    id: record.id,
    title: record.title || DEFAULT_CONVERSATION_TITLE,
    lastMessagePreview: record.last_message_preview || "",
    lastMessageAt: record.last_message_at || null,
    mode: record.mode || "edit",
    createdAt: record.created_at || null,
    updatedAt: record.updated_at || record.created_at || null,
    deletedAt: record.deleted_at || null,
    isPinned: Boolean(record.is_pinned),
    isArchived: Boolean(record.is_archived),
    isDeleted: Boolean(record.is_deleted),
    messages: [],
    messagesLoaded: false,
    textInput: "",
    selectedMentions: [],
    selectedTeamMentions: [],
    ownershipTransferPrompt: null,
  };
}

function normalizeMessageRecord(record = {}) {
  const metadata =
    record.metadata &&
    typeof record.metadata === "object" &&
    !Array.isArray(record.metadata)
      ? record.metadata
      : {};

  return {
    id: record.id,
    clientMessageId: record.client_message_id || null,
    role: record.role,
    kind:
      record.kind === "result" && metadata.lucid
        ? "lucid-result"
        : record.kind || "text",
    text: record.content || "",
    status: record.status || "complete",
    parsed: metadata.parsed || null,
    db: metadata.db || null,
    suggestions: Array.isArray(metadata.suggestions) ? metadata.suggestions : [],
    metadata,
    createdAt: record.created_at || null,
  };
}

function normalizeScheduleDbPayload(data = {}) {
  if (data?.db) {
    return data.db;
  }

  if (data?.event) {
    return {
      event: data.event,
      participants: [],
      invitations: [],
    };
  }

  return null;
}

function normalizeLucidPayload(data = {}) {
  return {
    action: data.action || "unknown",
    message: data.message || "",
    range: data.range || null,
    constraints: data.constraints || null,
    events: Array.isArray(data.events) ? data.events : [],
    freeSlots: Array.isArray(data.freeSlots) ? data.freeSlots : [],
  };
}

function mergeConversationRecord(currentConversation, serverRecord) {
  const normalizedConversation = normalizeConversationRecord(serverRecord);

  if (!currentConversation) {
    return normalizedConversation;
  }

  return {
    ...currentConversation,
    ...normalizedConversation,
    messages: Array.isArray(currentConversation.messages)
      ? currentConversation.messages
      : [],
    messagesLoaded: Boolean(currentConversation.messagesLoaded),
    textInput: currentConversation.textInput || "",
    selectedMentions: currentConversation.selectedMentions || [],
    selectedTeamMentions: currentConversation.selectedTeamMentions || [],
    ownershipTransferPrompt: currentConversation.ownershipTransferPrompt || null,
  };
}

function normalizeEventList(eventList = []) {
  return sortEvents((eventList || []).map(normalizeEvent));
}

function buildMessageMetadata(message) {
  const nextMetadata =
    message.metadata &&
    typeof message.metadata === "object" &&
    !Array.isArray(message.metadata)
      ? { ...message.metadata }
      : {};

  if (message.parsed !== undefined && message.parsed !== null) {
    nextMetadata.parsed = message.parsed;
  }

  if (message.db !== undefined && message.db !== null) {
    nextMetadata.db = message.db;
  }

  if (Array.isArray(message.suggestions) && message.suggestions.length > 0) {
    nextMetadata.suggestions = message.suggestions;
  }

  return nextMetadata;
}

let conversationSequence = 0;
let messageSequence = 0;

function createMessage({
  role,
  kind = "text",
  text = "",
  status = "complete",
  parsed = null,
  db = null,
  suggestions = [],
  createdAt = new Date().toISOString(),
  clientMessageId = null,
}) {
  messageSequence += 1;
  const nextMessageId = clientMessageId || `message-${Date.now()}-${messageSequence}`;

  return {
    id: nextMessageId,
    clientMessageId: nextMessageId,
    role,
    kind,
    text,
    status,
    parsed,
    db,
    suggestions,
    createdAt,
  };
}

function createIntroMessage() {
  return createMessage({
    role: "assistant",
    kind: "intro",
    text: "문장으로 입력하면 일정을 초안으로 정리하고 캘린더까지 반영합니다.",
    suggestions: [
      "다음 주 목요일 미나와 점심",
      "내일 오후 3시 팀 리뷰",
      "@alex 금요일 주간 싱크",
    ],
  });
}

function createConversation(overrides = {}) {
  conversationSequence += 1;
  const timestamp = new Date().toISOString();

  return {
    id: `conversation-${Date.now()}-${conversationSequence}`,
    title: "새 일정",
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    messages: [createIntroMessage()],
    textInput: "",
    selectedMentions: [],
    selectedTeamMentions: [],
    ownershipTransferPrompt: null,
    ...overrides,
  };
}

function _createConversationState() {
  const initialConversation = createConversation();

  return {
    conversations: [initialConversation],
    currentConversationId: initialConversation.id,
  };
}

function sortConversations(conversations) {
  return [...conversations].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();

    return rightTime - leftTime;
  });
}

function _buildConversationTitleLegacy(currentTitle, parsed, sourceText = "") {
  if (currentTitle && currentTitle !== "새 일정") {
    return currentTitle;
  }

  if (parsed?.summary?.trim()) {
    return parsed.summary.trim();
  }

  const trimmedText = sourceText.trim();

  if (!trimmedText) {
    return "새 일정";
  }

  return trimmedText.slice(0, 30);
}

function buildConversationTitle(currentTitle, parsed, sourceText = "") {
  if (currentTitle && currentTitle !== DEFAULT_CONVERSATION_TITLE) {
    return currentTitle;
  }

  if (parsed?.summary?.trim()) {
    return parsed.summary.trim();
  }

  const trimmedText = sourceText.trim();

  if (!trimmedText) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  return trimmedText.slice(0, 30);
}

export function useSchedulinkApp() {
  const initialConversationStateRef = useRef(createEmptyConversationState());
  const skipConversationSyncRef = useRef(false);
  const hydratedConversationIdRef = useRef(null);
  const liveRefreshInFlightRef = useRef(false);
  const calendarRangeCacheRef = useRef(new Map());
  const calendarRangeInFlightRef = useRef(new Map());
  const currentCalendarRangeRef = useRef(buildCalendarFetchRange(new Date()));
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [events, setEvents] = useState([]);
  const [conversations, setConversations] = useState(
    initialConversationStateRef.current.conversations
  );
  const [currentConversationId, setCurrentConversationId] = useState(
    initialConversationStateRef.current.currentConversationId
  );
  const [textInput, setTextInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [lastParsed, setLastParsed] = useState(null);
  const [lastDbSave, setLastDbSave] = useState(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionTeams, setMentionTeams] = useState([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionError, setMentionError] = useState("");
  const [selectedMentions, setSelectedMentions] = useState([]);
  const [selectedTeamMentions, setSelectedTeamMentions] = useState([]);
  const [mentionProfile, setMentionProfile] = useState(null);
  const [profileChangeLimit, setProfileChangeLimit] = useState(
    createEmptyProfileChangeLimit
  );
  const [profileForm, setProfileForm] = useState(createEmptyProfileForm);
  const [savingMentionProfile, setSavingMentionProfile] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [supabaseSync, setSupabaseSync] = useState(null);
  const [supabaseUser, setSupabaseUser] = useState(null);
  const [calendarSyncState, setCalendarSyncState] = useState(null);
  const [calendarSyncRow, setCalendarSyncRow] = useState(null);
  const [eventSyncState, setEventSyncState] = useState(null);
  const [eventSyncRow, setEventSyncRow] = useState(null);
  const [participantSyncState, setParticipantSyncState] = useState(null);
  const [participantSyncRow, setParticipantSyncRow] = useState(null);
  const [invitationSyncState, setInvitationSyncState] = useState(null);
  const [invitationSyncRow, setInvitationSyncRow] = useState(null);
  const [syncingUser, setSyncingUser] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [syncingEvent, setSyncingEvent] = useState(false);
  const [syncingParticipant, setSyncingParticipant] = useState(false);
  const [updatingParticipantStatus, setUpdatingParticipantStatus] =
    useState(false);
  const [syncingInvitation, setSyncingInvitation] = useState(false);
  const [updatingInvitationStatus, setUpdatingInvitationStatus] =
    useState(false);
  const [myInvitations, setMyInvitations] = useState([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [respondingInvitationId, setRespondingInvitationId] = useState(null);
  const [dismissingInvitationId, setDismissingInvitationId] = useState(null);
  const [actionItems, setActionItems] = useState({
    creatorReviewRequests: [],
    deleteApprovalTargets: [],
    deleteNotifications: [],
  });
  const [loadingActionItems, setLoadingActionItems] = useState(false);
  const [actingChangeRequestId, setActingChangeRequestId] = useState(null);
  const [actingDeleteTargetId, setActingDeleteTargetId] = useState(null);
  const [dismissingDeleteNotificationId, setDismissingDeleteNotificationId] =
    useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDayScheduleOpen, setIsDayScheduleOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [savingCalendarEventId, setSavingCalendarEventId] = useState(null);
  const [deletingCalendarEventId, setDeletingCalendarEventId] = useState(null);
  const [calendarDetailStatus, setCalendarDetailStatus] = useState(null);
  const [ownershipTransferPrompt, setOwnershipTransferPrompt] = useState(null);

  const currentConversation = useMemo(
    () =>
      conversations.find(
        (conversation) =>
          conversation.id === currentConversationId && !conversation.isDeleted
      ) || null,
    [conversations, currentConversationId]
  );
  const sortedConversations = useMemo(
    () => sortConversations(conversations),
    [conversations]
  );
  const sidebarConversations = useMemo(
    () => sortedConversations.filter((conversation) => !conversation.isDeleted),
    [sortedConversations]
  );

  const updateConversation = useCallback((conversationId, updater) => {
    setConversations((currentConversations) =>
      currentConversations.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation;
        }

        const patch =
          typeof updater === "function" ? updater(conversation) : updater;

        if (!patch) {
          return conversation;
        }

        return {
          ...conversation,
          ...patch,
          updatedAt: patch.updatedAt || conversation.updatedAt,
        };
      })
    );
  }, []);

  const mergeServerConversation = useCallback((serverConversation) => {
    if (!serverConversation?.id) {
      return;
    }

    setConversations((currentConversations) => {
      let foundConversation = false;
      const nextConversations = currentConversations.map((conversation) => {
        if (conversation.id !== serverConversation.id) {
          return conversation;
        }

        foundConversation = true;
        return mergeConversationRecord(conversation, serverConversation);
      });

      if (foundConversation) {
        return nextConversations;
      }

      return [normalizeConversationRecord(serverConversation), ...nextConversations];
    });
  }, []);

  const loadConversationMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      return [];
    }

    const data = await fetchChatMessages(conversationId);
    const nextMessages = Array.isArray(data.messages)
      ? data.messages.map(normalizeMessageRecord)
      : [];

    setConversations((currentConversations) =>
      currentConversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...mergeConversationRecord(conversation, data.conversation || {}),
              messages: nextMessages,
              messagesLoaded: true,
            }
          : conversation
      )
    );

    return nextMessages;
  }, []);

  const syncConversationPatch = useCallback(async (conversationId, payload) => {
    const data = await updateChatConversationRequest(conversationId, payload);
    if (data?.conversation) {
      mergeServerConversation(data.conversation);
    }

    return data?.conversation || null;
  }, [mergeServerConversation]);

  const persistMessagesForConversation = useCallback(
    async (conversationId, messages) => {
      let latestConversation = null;

      for (const message of messages) {
        const data = await createChatMessageRequest(conversationId, {
          clientMessageId: message.clientMessageId || message.id,
          role: message.role,
          kind: message.kind === "lucid-result" ? "result" : message.kind,
          status: message.status,
          content: message.text,
          metadata: buildMessageMetadata(message),
        });

        latestConversation = data?.conversation || latestConversation;
      }

      if (latestConversation) {
        mergeServerConversation(latestConversation);
      }

      await loadConversationMessages(conversationId);
    },
    [loadConversationMessages, mergeServerConversation]
  );

  const clearFeedback = useCallback(() => {
    setErrorMessage("");
    setSuccessMessage("");
  }, []);

  const resetMentionSearchState = useCallback(() => {
    setMentionQuery("");
    setMentionResults([]);
    setMentionTeams([]);
    setMentionLoading(false);
    setMentionError("");
  }, []);

  const replaceConversationMessage = useCallback(
    (conversationId, messageId, updater) => {
      updateConversation(conversationId, (conversation) => ({
        messages: (conversation.messages || []).map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          const patch =
            typeof updater === "function" ? updater(message) : updater;

          return {
            ...message,
            ...patch,
          };
        }),
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateConversation]
  );

  useEffect(() => {
    if (!currentConversation && sidebarConversations.length > 0) {
      setCurrentConversationId(sidebarConversations[0].id);
    }
  }, [currentConversation, sidebarConversations]);

  useEffect(() => {
    if (!user || !currentConversationId || !currentConversation) {
      return;
    }

    if (currentConversation.messagesLoaded) {
      return;
    }

    loadConversationMessages(currentConversationId).catch((error) => {
      setErrorMessage(error.message);
    });
  }, [
    currentConversation,
    currentConversationId,
    loadConversationMessages,
    user,
  ]);

  useEffect(() => {
    if (!currentConversationId) {
      hydratedConversationIdRef.current = null;
      return;
    }

    if (hydratedConversationIdRef.current === currentConversationId) {
      return;
    }

    if (!currentConversation) {
      return;
    }

    hydratedConversationIdRef.current = currentConversationId;
    skipConversationSyncRef.current = true;
    setTextInput(currentConversation.textInput || "");
    setSelectedMentions(currentConversation.selectedMentions || []);
    setSelectedTeamMentions(currentConversation.selectedTeamMentions || []);
    setOwnershipTransferPrompt(currentConversation.ownershipTransferPrompt || null);
  }, [currentConversation, currentConversationId]);

  useEffect(() => {
    if (!currentConversationId) {
      return;
    }

    if (skipConversationSyncRef.current) {
      skipConversationSyncRef.current = false;
      return;
    }

    updateConversation(currentConversationId, {
      textInput,
      selectedMentions,
      selectedTeamMentions,
      ownershipTransferPrompt,
    });
  }, [
    currentConversationId,
    ownershipTransferPrompt,
    selectedMentions,
    selectedTeamMentions,
    textInput,
    updateConversation,
  ]);

  const resetSignedInState = useCallback(() => {
    liveRefreshInFlightRef.current = false;
    calendarRangeCacheRef.current = new Map();
    calendarRangeInFlightRef.current = new Map();
    currentCalendarRangeRef.current = buildCalendarFetchRange(new Date());
    setEvents([]);
    setConversations([]);
    setCurrentConversationId(null);
    setTextInput("");
    clearFeedback();
    setLastParsed(null);
    setLastDbSave(null);
    resetMentionSearchState();
    setSelectedMentions([]);
    setSelectedTeamMentions([]);
    setMentionProfile(null);
    setProfileChangeLimit(createEmptyProfileChangeLimit());
    setProfileForm(createEmptyProfileForm());
    setSavingMentionProfile(false);
    setShowDebugPanel(false);
    setSupabaseConfigured(false);
    setSupabaseSync(null);
    setSupabaseUser(null);
    setCalendarSyncState(null);
    setCalendarSyncRow(null);
    setEventSyncState(null);
    setEventSyncRow(null);
    setParticipantSyncState(null);
    setParticipantSyncRow(null);
    setInvitationSyncState(null);
    setInvitationSyncRow(null);
    setSyncingUser(false);
    setSyncingCalendar(false);
    setSyncingEvent(false);
    setSyncingParticipant(false);
    setUpdatingParticipantStatus(false);
    setSyncingInvitation(false);
    setUpdatingInvitationStatus(false);
    setMyInvitations([]);
    setLoadingInvitations(false);
    setRespondingInvitationId(null);
    setDismissingInvitationId(null);
    setActionItems({
      creatorReviewRequests: [],
      deleteApprovalTargets: [],
      deleteNotifications: [],
    });
    setLoadingActionItems(false);
    setActingChangeRequestId(null);
    setActingDeleteTargetId(null);
    setDismissingDeleteNotificationId(null);
    setSelectedDate(null);
    setIsDayScheduleOpen(false);
    setSelectedEventId(null);
    setSavingCalendarEventId(null);
    setDeletingCalendarEventId(null);
    setCalendarDetailStatus(null);
    setOwnershipTransferPrompt(null);
  }, [clearFeedback, resetMentionSearchState]);

  const upsertCurrentCalendarEvent = useCallback((event) => {
    setEvents((currentEvents) => {
      const nextEvents = upsertEvent(currentEvents, event);
      const currentRangeKey = currentCalendarRangeRef.current.key;

      if (currentRangeKey) {
        calendarRangeCacheRef.current.set(currentRangeKey, nextEvents);
      }

      return nextEvents;
    });
  }, []);

  const applyInvitationItems = useCallback((items) => {
    setMyInvitations(Array.isArray(items) ? items : []);
  }, []);

  const applyActionItems = useCallback((data) => {
    setActionItems({
      creatorReviewRequests: data?.creatorReviewRequests || [],
      deleteApprovalTargets: data?.deleteApprovalTargets || [],
      deleteNotifications: data?.deleteNotifications || [],
    });
  }, []);

  const fetchCalendarRange = useCallback(
    async (range, { force = false, apply = false } = {}) => {
      if (!range?.key) {
        return [];
      }

      if (!force) {
        const cachedEvents = calendarRangeCacheRef.current.get(range.key);

        if (cachedEvents) {
          if (apply && currentCalendarRangeRef.current.key === range.key) {
            setEvents(cachedEvents);
          }

          return cachedEvents;
        }
      }

      let requestPromise =
        !force && calendarRangeInFlightRef.current.has(range.key)
          ? calendarRangeInFlightRef.current.get(range.key)
          : null;

      if (!requestPromise) {
        requestPromise = fetchEvents({
          startDate: range.startDate,
          endDate: range.endDate,
        })
          .then((eventList) => {
            const normalizedEvents = normalizeEventList(eventList);
            calendarRangeCacheRef.current.set(range.key, normalizedEvents);
            return normalizedEvents;
          })
          .finally(() => {
            calendarRangeInFlightRef.current.delete(range.key);
          });

        calendarRangeInFlightRef.current.set(range.key, requestPromise);
      }

      const nextEvents = await requestPromise;

      if (apply && currentCalendarRangeRef.current.key === range.key) {
        setEvents(nextEvents);
      }

      return nextEvents;
    },
    []
  );

  const prefetchCalendarRange = useCallback(
    async (anchorDate, monthOffset) => {
      const baseDate = anchorDate instanceof Date ? anchorDate : new Date(anchorDate);
      const range = buildCalendarFetchRange(addMonths(baseDate, monthOffset));

      if (
        calendarRangeCacheRef.current.has(range.key) ||
        calendarRangeInFlightRef.current.has(range.key)
      ) {
        return;
      }

      try {
        await fetchCalendarRange(range);
      } catch {
        // Ignore prefetch failures; the active month load will surface errors.
      }
    },
    [fetchCalendarRange]
  );

  const loadEvents = useCallback(
    async ({ range = currentCalendarRangeRef.current, force = false, apply = true } = {}) => {
      return fetchCalendarRange(range, { force, apply });
    },
    [fetchCalendarRange]
  );

  const handleCalendarRangeChange = useCallback(
    (anchorDate) => {
      const nextAnchorDate =
        anchorDate instanceof Date ? anchorDate : new Date(anchorDate);
      const nextRange = buildCalendarFetchRange(nextAnchorDate);

      currentCalendarRangeRef.current = nextRange;

      loadEvents({
        range: nextRange,
        apply: true,
      }).catch((error) => {
        setErrorMessage(error.message);
      });

      void prefetchCalendarRange(nextAnchorDate, -1);
      void prefetchCalendarRange(nextAnchorDate, 1);
    },
    [loadEvents, prefetchCalendarRange]
  );

  const loadMyInvitations = useCallback(async () => {
    setLoadingInvitations(true);

    try {
      const invitations = await fetchMyInvitations();
      applyInvitationItems(invitations);
    } catch (error) {
      applyInvitationItems([]);
      setErrorMessage(error.message);
    } finally {
      setLoadingInvitations(false);
    }
  }, [applyInvitationItems]);

  const loadActionItems = useCallback(async () => {
    setLoadingActionItems(true);

    try {
      const data = await fetchActionItems();
      applyActionItems(data);
    } catch (error) {
      applyActionItems({
        creatorReviewRequests: [],
        deleteApprovalTargets: [],
        deleteNotifications: [],
      });
      setErrorMessage(error.message);
    } finally {
      setLoadingActionItems(false);
    }
  }, [applyActionItems]);

  const refreshLiveData = useCallback(
    async ({ silent = false } = {}) => {
      if (!user || liveRefreshInFlightRef.current) {
        return;
      }

      liveRefreshInFlightRef.current = true;

      if (!silent) {
        setLoadingInvitations(true);
        setLoadingActionItems(true);
      }

      try {
        const [eventsResult, invitationsResult, actionItemsResult] =
          await Promise.allSettled([
            loadEvents({
              range: currentCalendarRangeRef.current,
              force: true,
              apply: true,
            }),
            fetchMyInvitations(),
            fetchActionItems(),
          ]);

        if (eventsResult.status === "fulfilled") {
          if (currentCalendarRangeRef.current.key) {
            calendarRangeCacheRef.current.set(
              currentCalendarRangeRef.current.key,
              eventsResult.value
            );
          }
        }

        if (invitationsResult.status === "fulfilled") {
          applyInvitationItems(invitationsResult.value);
        }

        if (actionItemsResult.status === "fulfilled") {
          applyActionItems(actionItemsResult.value);
        }

        if (silent) {
          return;
        }

        const firstRejected = [
          eventsResult,
          invitationsResult,
          actionItemsResult,
        ].find((result) => result.status === "rejected");

        if (firstRejected) {
          setErrorMessage(
            firstRejected.reason?.message || "실시간 데이터를 새로고침하지 못했습니다."
          );
        }
      } finally {
        liveRefreshInFlightRef.current = false;

        if (!silent) {
          setLoadingInvitations(false);
          setLoadingActionItems(false);
        }
      }
    },
    [applyActionItems, applyInvitationItems, loadEvents, user]
  );

  const createServerConversation = useCallback(
    async ({ title = DEFAULT_CONVERSATION_TITLE, shouldSelect = true } = {}) => {
      const data = await createChatConversationRequest({ title });
      const nextConversation = normalizeConversationRecord(data.conversation || {});

      setConversations((currentConversations) => [nextConversation, ...currentConversations]);

      if (shouldSelect) {
        setCurrentConversationId(nextConversation.id);
        resetMentionSearchState();
      }

      return nextConversation;
    },
    [resetMentionSearchState]
  );

  const loadChatConversations = useCallback(async () => {
    const data = await fetchChatConversations();
    const fetchedConversations = Array.isArray(data.conversations)
      ? data.conversations.map(normalizeConversationRecord)
      : [];

    let nextConversations = fetchedConversations;

    if (
      fetchedConversations.length === 0 ||
      !fetchedConversations.some((conversation) => !conversation.isDeleted)
    ) {
      const createdConversation = await createServerConversation();
      nextConversations = [...fetchedConversations, createdConversation];
    }

    setConversations(nextConversations);
    setCurrentConversationId((currentId) => {
      const nextCurrentConversation = nextConversations.find(
        (conversation) => conversation.id === currentId && !conversation.isDeleted
      );

      if (nextCurrentConversation) {
        return nextCurrentConversation.id;
      }

      const firstVisibleConversation = nextConversations.find(
        (conversation) => !conversation.isDeleted
      );

      return firstVisibleConversation?.id || nextConversations[0]?.id || null;
    });
  }, [createServerConversation]);

  const getActiveMentionsForText = useCallback(
    (text) => {
      const activeProfiles = [];
      const seenKeys = new Set();

      const appendProfile = (profile) => {
        if (!profile) {
          return;
        }

        const key =
          profile.user_id || profile.id || profile.email || profile.display_name || null;

        if (!key || seenKeys.has(key)) {
          return;
        }

        seenKeys.add(key);
        activeProfiles.push(profile);
      };

      selectedMentions.forEach((profile) => {
        const labels = [profile.nickname, profile.display_name].filter(Boolean);

        if (labels.some((label) => text.includes(`@${label}`))) {
          appendProfile(profile);
        }
      });

      selectedTeamMentions.forEach((teamMention) => {
        if (!teamMention?.teamName || !text.includes(`@${teamMention.teamName}`)) {
          return;
        }

        (teamMention.members || []).forEach(appendProfile);
      });

      return activeProfiles;
    },
    [selectedMentions, selectedTeamMentions]
  );

  const getActiveTeamMentionsForText = useCallback(
    (text) => {
      return selectedTeamMentions
        .filter(
          (teamMention) =>
            teamMention?.teamName && text.includes(`@${teamMention.teamName}`)
        )
        .map((teamMention) => teamMention.teamName);
    },
    [selectedTeamMentions]
  );

  const _submitQuickAddRequest = useCallback(
    async ({ text, ownershipSelection = null }) => {
      const trimmedText = text.trim();
      const conversationId = currentConversationId;
      const createdAt = new Date().toISOString();
      const userMessage =
        ownershipSelection === null
          ? createMessage({
              role: "user",
              text: trimmedText,
              createdAt,
            })
          : null;
      const pendingMessage = createMessage({
        role: "assistant",
        kind: "pending",
        text: "일정을 정리하는 중입니다...",
        status: "pending",
        createdAt,
      });

      if (conversationId) {
        updateConversation(conversationId, (conversation) => ({
          title:
            ownershipSelection === null
              ? buildConversationTitle(conversation.title, null, trimmedText)
              : conversation.title,
          messages: ownershipSelection === null
            ? [...(conversation.messages || []), userMessage, pendingMessage]
            : [...(conversation.messages || []), pendingMessage],
          updatedAt: createdAt,
        }));
      }

      try {
        const data = await quickAddSchedule({
          text,
          mentions: getActiveMentionsForText(text),
          teamMentions: getActiveTeamMentionsForText(text),
          ownershipSelection,
        });

        setSuccessMessage(data.message || "일정이 처리되었습니다.");
        setLastParsed(data.parsed || null);
        setLastDbSave(normalizeScheduleDbPayload(data));
        setTextInput("");
        resetMentionSearchState();
        setSelectedMentions([]);
        setOwnershipTransferPrompt(null);
        if (conversationId) {
          replaceConversationMessage(conversationId, pendingMessage.id, {
            kind: "result",
            status: "complete",
            text: data.message || "일정을 처리했습니다.",
            parsed: data.parsed || null,
            db: normalizeScheduleDbPayload(data),
          });
          updateConversation(conversationId, (conversation) => ({
            title: buildConversationTitle(
              conversation.title,
              data.parsed || null,
              trimmedText
            ),
            updatedAt: new Date().toISOString(),
          }));
        }
        await Promise.all([loadMyInvitations(), loadActionItems()]);

        if (data.calendarEvent) {
          upsertCurrentCalendarEvent(data.calendarEvent);
        } else {
          await loadEvents({ force: true });
        }
      } catch (error) {
        if (error.details?.ownershipSelectionRequired) {
          setOwnershipTransferPrompt({
            text,
            parsed: error.details?.parsed || null,
            targetEvent: error.details?.targetEvent || null,
            candidates: error.details?.ownershipCandidates || [],
          });
          setErrorMessage("");
          if (conversationId) {
            replaceConversationMessage(conversationId, pendingMessage.id, {
              kind: "ownership-required",
              status: "complete",
              text:
                error.details?.message ||
                "기존 일정과 겹치는 부분이 있어 처리 방식을 선택해야 합니다.",
              parsed: error.details?.parsed || null,
            });
          }
        } else {
          if (conversationId) {
            replaceConversationMessage(conversationId, pendingMessage.id, {
              kind: "error",
              status: "complete",
              text: error.message,
            });
          }
          throw error;
        }
      }

      return true;
    },
    [
      currentConversationId,
      getActiveMentionsForText,
      getActiveTeamMentionsForText,
      loadActionItems,
      loadEvents,
      loadMyInvitations,
      replaceConversationMessage,
      resetMentionSearchState,
      upsertCurrentCalendarEvent,
      updateConversation,
    ]
  );

  const submitQuickAddRequestPersisted = useCallback(
    async ({ text, ownershipSelection = null }) => {
      const trimmedText = text.trim();
      const conversationId = currentConversationId;
      const createdAt = new Date().toISOString();
      const currentConversationTitle =
        conversations.find((conversation) => conversation.id === conversationId)?.title ||
        DEFAULT_CONVERSATION_TITLE;
      const userMessage =
        ownershipSelection === null
          ? createMessage({
              role: "user",
              text: trimmedText,
              createdAt,
            })
          : null;
      const pendingMessage = createMessage({
        role: "assistant",
        kind: "pending",
        text: "일정을 정리하는 중입니다...",
        status: "pending",
        createdAt,
      });

      if (conversationId) {
        updateConversation(conversationId, (conversation) => ({
          title:
            ownershipSelection === null
              ? buildConversationTitle(conversation.title, null, trimmedText)
              : conversation.title,
          messages:
            ownershipSelection === null
              ? [...(conversation.messages || []), userMessage, pendingMessage]
              : [...(conversation.messages || []), pendingMessage],
          updatedAt: createdAt,
        }));
      }

      try {
        const data = await quickAddSchedule({
          text,
          mentions: getActiveMentionsForText(text),
          teamMentions: getActiveTeamMentionsForText(text),
          ownershipSelection,
        });

        setSuccessMessage(data.message || "일정을 처리했습니다.");
        setLastParsed(data.parsed || null);
        setLastDbSave(normalizeScheduleDbPayload(data));
        setTextInput("");
        resetMentionSearchState();
        setSelectedMentions([]);
        setOwnershipTransferPrompt(null);

        if (conversationId) {
          const resultMessage = {
            ...pendingMessage,
            kind: "result",
            status: "complete",
            text: data.message || "일정을 처리했습니다.",
            parsed: data.parsed || null,
            db: normalizeScheduleDbPayload(data),
          };
          const nextTitle = buildConversationTitle(
            currentConversationTitle,
            data.parsed || null,
            trimmedText
          );

          replaceConversationMessage(conversationId, pendingMessage.id, resultMessage);
          updateConversation(conversationId, {
            title: nextTitle,
            updatedAt: new Date().toISOString(),
          });
          await persistMessagesForConversation(
            conversationId,
            ownershipSelection === null
              ? [userMessage, resultMessage]
              : [resultMessage]
          );

          if (nextTitle !== currentConversationTitle) {
            await syncConversationPatch(conversationId, { title: nextTitle });
          }
        }

        await Promise.all([loadMyInvitations(), loadActionItems()]);

        if (data.calendarEvent) {
          upsertCurrentCalendarEvent(data.calendarEvent);
        } else {
          await loadEvents({ force: true });
        }
      } catch (error) {
        if (error.details?.ownershipSelectionRequired) {
          setOwnershipTransferPrompt({
            text,
            parsed: error.details?.parsed || null,
            targetEvent: error.details?.targetEvent || null,
            candidates: error.details?.ownershipCandidates || [],
          });
          setErrorMessage("");

          if (conversationId) {
            const ownershipRequiredMessage = {
              ...pendingMessage,
              kind: "ownership-required",
              status: "complete",
              text:
                error.details?.message ||
                "기존 일정과 겹치는 부분이 있어 처리 방식을 선택해야 합니다.",
              parsed: error.details?.parsed || null,
            };

            replaceConversationMessage(
              conversationId,
              pendingMessage.id,
              ownershipRequiredMessage
            );
            await persistMessagesForConversation(
              conversationId,
              ownershipSelection === null
                ? [userMessage, ownershipRequiredMessage]
                : [ownershipRequiredMessage]
            );
          }
        } else {
          if (conversationId) {
            const errorResultMessage = {
              ...pendingMessage,
              kind: "error",
              status: "complete",
              text: error.message,
            };

            replaceConversationMessage(conversationId, pendingMessage.id, errorResultMessage);
            await persistMessagesForConversation(
              conversationId,
              ownershipSelection === null
                ? [userMessage, errorResultMessage]
                : [errorResultMessage]
            );
          }

          throw error;
        }
      }

      return true;
    },
    [
      conversations,
      currentConversationId,
      getActiveMentionsForText,
      getActiveTeamMentionsForText,
      loadActionItems,
      loadEvents,
      loadMyInvitations,
      persistMessagesForConversation,
      replaceConversationMessage,
      resetMentionSearchState,
      syncConversationPatch,
      upsertCurrentCalendarEvent,
      updateConversation,
    ]
  );

  const submitLucidQueryPersisted = useCallback(
    async ({ text }) => {
      const trimmedText = text.trim();
      const conversationId = currentConversationId;
      const createdAt = new Date().toISOString();
      const currentConversationTitle =
        conversations.find((conversation) => conversation.id === conversationId)?.title ||
        DEFAULT_CONVERSATION_TITLE;
      const userMessage = createMessage({
        role: "user",
        text: trimmedText,
        createdAt,
      });
      const pendingMessage = createMessage({
        role: "assistant",
        kind: "pending",
        text: "캘린더를 확인하는 중입니다...",
        status: "pending",
        createdAt,
      });

      if (conversationId) {
        updateConversation(conversationId, (conversation) => ({
          title: buildConversationTitle(conversation.title, null, trimmedText),
          messages: [...(conversation.messages || []), userMessage, pendingMessage],
          updatedAt: createdAt,
        }));
      }

      try {
        const data = await queryLucid({
          text: trimmedText,
        });
        const lucid = normalizeLucidPayload(data);
        const resultMessage = {
          ...pendingMessage,
          kind: data.success === false ? "error" : "lucid-result",
          status: "complete",
          text: data.message || "캘린더 검색 결과입니다.",
          metadata: {
            lucid,
          },
        };

        setSuccessMessage(data.message || "캘린더 검색을 완료했습니다.");
        setTextInput("");
        resetMentionSearchState();
        setSelectedMentions([]);
        setOwnershipTransferPrompt(null);

        if (conversationId) {
          const nextTitle = buildConversationTitle(
            currentConversationTitle,
            null,
            trimmedText
          );

          replaceConversationMessage(conversationId, pendingMessage.id, resultMessage);
          updateConversation(conversationId, {
            title: nextTitle,
            updatedAt: new Date().toISOString(),
          });
          await persistMessagesForConversation(conversationId, [
            userMessage,
            resultMessage,
          ]);

          if (nextTitle !== currentConversationTitle) {
            await syncConversationPatch(conversationId, { title: nextTitle });
          }
        }
      } catch (error) {
        if (conversationId) {
          const errorResultMessage = {
            ...pendingMessage,
            kind: "error",
            status: "complete",
            text: error.message,
          };

          replaceConversationMessage(conversationId, pendingMessage.id, errorResultMessage);
          await persistMessagesForConversation(conversationId, [
            userMessage,
            errorResultMessage,
          ]);
        }

        throw error;
      }

      return true;
    },
    [
      conversations,
      currentConversationId,
      persistMessagesForConversation,
      replaceConversationMessage,
      resetMentionSearchState,
      syncConversationPatch,
      updateConversation,
    ]
  );

  useEffect(() => {
    let cancelled = false;

    fetchSession()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setUser(data.user || null);
        setSupabaseConfigured(Boolean(data.supabaseConfigured));
        setSupabaseSync(data.supabaseSync || null);
        setSupabaseUser(data.supabaseUser || null);
        setMentionProfile(data.mentionProfile || null);
        setProfileChangeLimit(
          data.profileChangeLimit || createEmptyProfileChangeLimit()
        );
        setProfileForm(buildProfileForm(data.mentionProfile, data.user));
        setCalendarSyncState(data.calendarSync || null);
        setCalendarSyncRow(data.calendarSync?.row || null);
        setEventSyncState(data.eventSync || null);
        setEventSyncRow(data.eventSync?.row || null);
        setParticipantSyncState(data.participantSync || null);
        setParticipantSyncRow(data.participantSync?.row || null);
        setInvitationSyncState(data.invitationSync || null);
        setInvitationSyncRow(data.invitationSync?.row || null);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setUser(null);
        resetSignedInState();
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingUser(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resetSignedInState]);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      setMyInvitations([]);
      setConversations([]);
      setCurrentConversationId(null);
      return;
    }

    refreshLiveData();
    loadChatConversations().catch((error) => {
      setErrorMessage(error.message);
    });
  }, [loadChatConversations, refreshLiveData, user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const triggerSilentRefresh = () => {
      refreshLiveData({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerSilentRefresh();
      }
    };

    const handleWindowFocus = () => {
      triggerSilentRefresh();
    };

    const handleOnline = () => {
      triggerSilentRefresh();
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        triggerSilentRefresh();
      }
    }, LIVE_REFRESH_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("online", handleOnline);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, [refreshLiveData, user]);

  useEffect(() => {
    const activeMentionQuery = getActiveMentionQuery(textInput);

    if (!user || activeMentionQuery === null) {
      resetMentionSearchState();
      return;
    }

    const trimmedQuery = activeMentionQuery.trim();
    setMentionQuery(trimmedQuery);

    if (!trimmedQuery) {
      setMentionResults([]);
      setMentionTeams([]);
      setMentionLoading(false);
      setMentionError("");
      return;
    }

    let cancelled = false;
    setMentionLoading(true);
    setMentionError("");

    searchMentions(trimmedQuery)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setMentionResults(payload.results || []);
        setMentionTeams(payload.teams || []);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setMentionResults([]);
        setMentionTeams([]);
        setMentionError(error.message);
      })
      .finally(() => {
        if (!cancelled) {
          setMentionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resetMentionSearchState, textInput, user]);

  const handleLogin = () => {
    window.location.href = getGoogleLoginUrl();
  };

  const handleCreateConversation = useCallback(() => {
    clearFeedback();
    createServerConversation().catch((error) => {
      setErrorMessage(error.message);
    });
  }, [clearFeedback, createServerConversation]);

  const handleSelectConversation = useCallback(
    (conversationId) => {
      setCurrentConversationId(conversationId);
      resetMentionSearchState();
    },
    [resetMentionSearchState]
  );

  const handleRenameConversation = useCallback(
    (conversationId, title) => {
      const trimmedTitle = title.trim();

      if (!trimmedTitle) {
        return;
      }

      clearFeedback();
      syncConversationPatch(conversationId, { title: trimmedTitle }).catch((error) => {
        setErrorMessage(error.message);
      });
    },
    [clearFeedback, syncConversationPatch]
  );

  const handleToggleConversationPin = useCallback(
    (conversationId) => {
      const conversation = conversations.find((item) => item.id === conversationId);
      if (!conversation) {
        return;
      }

      clearFeedback();
      syncConversationPatch(conversationId, {
        isPinned: !conversation.isPinned,
      }).catch((error) => {
        setErrorMessage(error.message);
      });
    },
    [clearFeedback, conversations, syncConversationPatch]
  );

  const handleToggleConversationArchive = useCallback(
    (conversationId) => {
      const conversation = conversations.find((item) => item.id === conversationId);
      if (!conversation) {
        return;
      }

      clearFeedback();
      syncConversationPatch(conversationId, {
        isArchived: !conversation.isArchived,
      }).catch((error) => {
        setErrorMessage(error.message);
      });
    },
    [clearFeedback, conversations, syncConversationPatch]
  );

  const handleMoveConversationToTrash = useCallback(
    async (conversationId) => {
      clearFeedback();

      try {
        const data = await deleteChatConversationRequest(conversationId);

        if (data?.conversation) {
          mergeServerConversation(data.conversation);
        }

        setConversations((currentConversations) =>
          currentConversations.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  isDeleted: true,
                  deletedAt: data?.conversation?.deleted_at || new Date().toISOString(),
                }
              : conversation
          )
        );

        if (currentConversationId !== conversationId) {
          return;
        }

        const remainingConversations = sortConversations(
          conversations.map((conversation) =>
            conversation.id === conversationId
              ? { ...conversation, isDeleted: true }
              : conversation
          )
        ).filter((conversation) => !conversation.isDeleted);

        if (remainingConversations.length > 0) {
          setCurrentConversationId(remainingConversations[0].id);
          resetMentionSearchState();
          return;
        }

        const fallbackConversation = await createServerConversation();
        setCurrentConversationId(fallbackConversation.id);
      } catch (error) {
        setErrorMessage(error.message);
      }
    },
    [
      clearFeedback,
      conversations,
      createServerConversation,
      currentConversationId,
      mergeServerConversation,
      resetMentionSearchState,
    ]
  );

  const handleRestoreConversation = useCallback(
    (conversationId) => {
      clearFeedback();
      syncConversationPatch(conversationId, {
        isDeleted: false,
      }).catch((error) => {
        setErrorMessage(error.message);
      });
    },
    [clearFeedback, syncConversationPatch]
  );

  const handleDeleteConversationPermanently = useCallback(
    async (conversationId) => {
      clearFeedback();

      try {
        await permanentlyDeleteChatConversation(conversationId);
        const nextConversations = conversations.filter(
          (conversation) => conversation.id !== conversationId
        );

        setConversations(nextConversations);

        if (currentConversationId !== conversationId) {
          return;
        }

        const remainingConversations = sortConversations(nextConversations).filter(
          (conversation) => !conversation.isDeleted
        );

        if (remainingConversations.length > 0) {
          setCurrentConversationId(remainingConversations[0].id);
          resetMentionSearchState();
          return;
        }

        const fallbackConversation = await createServerConversation();
        setCurrentConversationId(fallbackConversation.id);
      } catch (error) {
        setErrorMessage(error.message);
      }
    },
    [
      clearFeedback,
      conversations,
      createServerConversation,
      currentConversationId,
      resetMentionSearchState,
    ]
  );

  const handleConversationModeChange = useCallback(
    (conversationId, mode) => {
      if (!conversationId || !["edit", "query"].includes(mode)) {
        return;
      }

      const updatedAt = new Date().toISOString();

      updateConversation(conversationId, {
        mode,
        updatedAt,
      });

      syncConversationPatch(conversationId, {
        mode,
      }).catch((error) => {
        setErrorMessage(error.message);
      });
    },
    [syncConversationPatch, updateConversation]
  );

  const handleMentionSelect = (profile) => {
    const mentionLabel = profile.nickname || profile.display_name;

    setTextInput((currentText) =>
      replaceActiveMention(currentText, mentionLabel)
    );
    setSelectedMentions((currentMentions) => {
      const nextMentions = currentMentions.filter(
        (item) => item.user_id !== profile.user_id
      );

      return [...nextMentions, profile];
    });
    resetMentionSearchState();
  };

  const handleTeamMentionApply = useCallback(({ teamName, members = [] }) => {
    const normalizedTeamName = String(teamName || "").trim();

    if (!normalizedTeamName) {
      return;
    }

    setSelectedTeamMentions((currentTeamMentions) => {
      const nextTeamMentions = currentTeamMentions.filter(
        (item) => item.teamName !== normalizedTeamName
      );

      return [
        ...nextTeamMentions,
        {
          teamName: normalizedTeamName,
          members: Array.isArray(members) ? members : [],
        },
      ];
    });
  }, []);

  const handleLogout = async () => {
    try {
      await logoutSession();
    } finally {
      setUser(null);
      resetSignedInState();
    }
  };

  const handleProfileFieldChange = (field, value) => {
    setProfileForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSyncUser = async () => {
    setSyncingUser(true);
    clearFeedback();

    try {
      const data = await syncUser();
      setSupabaseSync({ success: true, message: data.message });
      setSupabaseUser(data.user || null);
      setSuccessMessage(data.message);
    } catch (error) {
      setSupabaseSync({
        success: false,
        message: error.message,
      });
      setErrorMessage(error.message);
    } finally {
      setSyncingUser(false);
    }
  };

  const handleSyncCalendar = async () => {
    setSyncingCalendar(true);
    clearFeedback();

    try {
      const data = await syncCalendar();
      setCalendarSyncState({
        success: true,
        message: data.message,
        row: data.row || null,
      });
      setCalendarSyncRow(data.row || null);
      setSuccessMessage(data.message);
    } catch (error) {
      setCalendarSyncState({
        success: false,
        message: error.message,
        row: null,
      });
      setErrorMessage(error.message);
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleSyncEvent = async () => {
    setSyncingEvent(true);
    clearFeedback();

    try {
      const data = await syncEvent();
      setEventSyncState({
        success: true,
        message: data.message,
        row: data.row || null,
      });
      setEventSyncRow(data.row || null);
      setSuccessMessage(data.message);
    } catch (error) {
      setEventSyncState({
        success: false,
        message: error.message,
        row: null,
      });
      setErrorMessage(error.message);
    } finally {
      setSyncingEvent(false);
    }
  };

  const handleSyncParticipant = async () => {
    setSyncingParticipant(true);
    clearFeedback();

    try {
      const data = await syncParticipant();
      setEventSyncState({
        success: true,
        message: "participants 저장으로 event도 함께 동기화했습니다.",
        row: data.event || null,
      });
      setEventSyncRow(data.event || null);
      setParticipantSyncState({
        success: true,
        message: data.message,
        row: data.row || null,
      });
      setParticipantSyncRow(data.row || null);
      setSuccessMessage(data.message);
    } catch (error) {
      setParticipantSyncState({
        success: false,
        message: error.message,
        row: null,
      });
      setErrorMessage(error.message);
    } finally {
      setSyncingParticipant(false);
    }
  };

  const handleParticipantStatusUpdate = async (status) => {
    setUpdatingParticipantStatus(true);
    clearFeedback();

    try {
      const data = await updateParticipantStatus(
        participantSyncRow?.id || null,
        status
      );
      setParticipantSyncState({
        success: true,
        message: data.message,
        row: data.row || null,
      });
      setParticipantSyncRow(data.row || null);
      setSuccessMessage(data.message);
    } catch (error) {
      setParticipantSyncState({
        success: false,
        message: error.message,
        row: participantSyncRow,
      });
      setErrorMessage(error.message);
    } finally {
      setUpdatingParticipantStatus(false);
    }
  };

  const handleSyncInvitation = async () => {
    setSyncingInvitation(true);
    clearFeedback();

    try {
      const data = await syncInvitation();
      setEventSyncState({
        success: true,
        message: "invitations 저장으로 event도 함께 동기화했습니다.",
        row: data.event || null,
      });
      setEventSyncRow(data.event || null);
      setParticipantSyncState({
        success: true,
        message: "invitations 저장으로 participant도 함께 동기화했습니다.",
        row: data.participant || null,
      });
      setParticipantSyncRow(data.participant || null);
      setInvitationSyncState({
        success: true,
        message: data.message,
        row: data.row || null,
      });
      setInvitationSyncRow(data.row || null);
      setSuccessMessage(data.message);
    } catch (error) {
      setInvitationSyncState({
        success: false,
        message: error.message,
        row: null,
      });
      setErrorMessage(error.message);
    } finally {
      setSyncingInvitation(false);
    }
  };

  const handleInvitationStatusUpdate = async (status) => {
    setUpdatingInvitationStatus(true);
    clearFeedback();

    try {
      const data = await updateInvitationStatus(
        invitationSyncRow?.id || null,
        status
      );
      setInvitationSyncState({
        success: true,
        message: data.message,
        row: data.row || null,
      });
      setInvitationSyncRow(data.row || null);
      setSuccessMessage(data.message);
    } catch (error) {
      setInvitationSyncState({
        success: false,
        message: error.message,
        row: invitationSyncRow,
      });
      setErrorMessage(error.message);
    } finally {
      setUpdatingInvitationStatus(false);
    }
  };

  const handleQuickAdd = async (event, chatModeId = "schedule-edit") => {
    event.preventDefault();

    if (!textInput.trim()) {
      setErrorMessage("일정 내용을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    clearFeedback();

    try {
      if (chatModeId === "calendar-search") {
        await submitLucidQueryPersisted({ text: textInput });
        return;
      }

      await submitQuickAddRequestPersisted({ text: textInput });
      if (Math.random() < 0) {

      const activeMentions = selectedMentions.filter((profile) => {
        const labels = [profile.nickname, profile.display_name].filter(Boolean);

        return labels.some((label) => textInput.includes(`@${label}`));
      });

      const data = await quickAddSchedule({
        text: textInput,
        mentions: activeMentions,
      });

      setSuccessMessage(data.message || "일정을 저장했습니다.");
      setLastParsed(data.parsed || null);
      setLastDbSave(normalizeScheduleDbPayload(data));
      setTextInput("");
      resetMentionSearchState();
      setSelectedMentions([]);
      await Promise.all([loadMyInvitations(), loadActionItems()]);

      if (data.calendarEvent) {
        upsertCurrentCalendarEvent(data.calendarEvent);
      } else {
        await loadEvents({ force: true });
      }
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOwnershipTransferClose = () => {
    setOwnershipTransferPrompt(null);
  };

  const handleOwnershipTransferSubmit = async (ownershipSelection) => {
    if (!ownershipTransferPrompt?.text) {
      return;
    }

    setSubmitting(true);
    clearFeedback();

    try {
      await submitQuickAddRequestPersisted({
        text: ownershipTransferPrompt.text,
        ownershipSelection,
      });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveMentionProfile = async () => {
    setSavingMentionProfile(true);
    clearFeedback();

    try {
      const data = await saveMentionProfile({
        displayName: profileForm.displayName,
        teamName: profileForm.teamName,
        nickname: profileForm.nickname,
      });

      setMentionProfile(data.mentionProfile || null);
      setProfileChangeLimit(
        data.profileChangeLimit || createEmptyProfileChangeLimit()
      );
      setProfileForm(buildProfileForm(data.mentionProfile, user));
      setSuccessMessage(data.message || "멘션 프로필을 저장했습니다.");
      return data;
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSavingMentionProfile(false);
    }
  };

  const handleRespondInvitation = async ({
    participantId,
    invitationId,
    responseStatus,
  }) => {
    setRespondingInvitationId(invitationId);
    clearFeedback();

    try {
      const data = await respondToInvitation({
        participantId,
        invitationId,
        responseStatus,
      });

      setSuccessMessage(data.message);
      await Promise.all([loadMyInvitations(), loadActionItems()]);
      await loadEvents({ force: true });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setRespondingInvitationId(null);
    }
  };

  const handleDismissInvitation = async ({
    invitationId = null,
    participantId = null,
  }) => {
    const dismissKey = invitationId || `participant:${participantId}`;
    setDismissingInvitationId(dismissKey);
    clearFeedback();

    const previousInvitations = myInvitations;

    setMyInvitations((currentInvitations) =>
      currentInvitations.filter(
        (item) =>
          item.invitation?.id !== invitationId &&
          item.participant?.id !== participantId
      )
    );

    try {
      const data = await dismissInvitation({
        invitationId,
        participantId,
      });
      setSuccessMessage(data.message);
    } catch (error) {
      setMyInvitations(previousInvitations);
      setErrorMessage(error.message);
    } finally {
      setDismissingInvitationId(null);
    }
  };

  const handleReviewProposal = async (requestId, decision) => {
    setActingChangeRequestId(requestId);
    clearFeedback();

    try {
      const data = await reviewUpdateProposal(requestId, decision);
      setSuccessMessage(data.message);
      await Promise.all([loadActionItems(), loadMyInvitations()]);
      await loadEvents({ force: true });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setActingChangeRequestId(null);
    }
  };

  const handleRespondDeleteRequest = async (targetId, decision) => {
    setActingDeleteTargetId(targetId);
    clearFeedback();

    try {
      const data = await respondToDeleteRequest(targetId, decision);
      setSuccessMessage(data.message);
      await Promise.all([loadActionItems(), loadMyInvitations()]);
      await loadEvents({ force: true });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setActingDeleteTargetId(null);
    }
  };

  const handleOpenActionItems = useCallback(async () => {
    const unreadTargetIds = actionItems.deleteNotifications
      .filter((target) => !target.read_at)
      .map((target) => target.id)
      .filter(Boolean);

    if (unreadTargetIds.length === 0) {
      return;
    }

    setActionItems((currentActionItems) => ({
      ...currentActionItems,
      deleteNotifications: currentActionItems.deleteNotifications.map((target) =>
        unreadTargetIds.includes(target.id)
          ? {
              ...target,
              read_at: new Date().toISOString(),
            }
          : target
      ),
    }));

    try {
      await markDeleteNotificationsRead(unreadTargetIds);
    } catch (error) {
      setErrorMessage(error.message);
      await loadActionItems();
    }
  }, [actionItems.deleteNotifications, loadActionItems]);

  const handleDismissDeleteNotification = useCallback(
    async (targetId) => {
      setDismissingDeleteNotificationId(targetId);
      clearFeedback();

      const previousNotifications = actionItems.deleteNotifications;

      setActionItems((currentActionItems) => ({
        ...currentActionItems,
        deleteNotifications: currentActionItems.deleteNotifications.filter(
          (target) => target.id !== targetId
        ),
      }));

      try {
        const data = await dismissDeleteNotification(targetId);
        setSuccessMessage(data.message);
      } catch (error) {
        setActionItems((currentActionItems) => ({
          ...currentActionItems,
          deleteNotifications: previousNotifications,
        }));
        setErrorMessage(error.message);
      } finally {
        setDismissingDeleteNotificationId(null);
      }
    },
    [actionItems.deleteNotifications, clearFeedback]
  );

  const handleDateSelect = (dateString) => {
    setSelectedDate(dateString);
    setSelectedEventId(null);
    setCalendarDetailStatus(null);
    setIsDayScheduleOpen(true);
  };

  const handleEventSelect = ({ eventId, dateString }) => {
    setSelectedDate(dateString);
    setSelectedEventId(null);
    setCalendarDetailStatus(null);
    setIsDayScheduleOpen(true);
  };

  const handleEventSelectInModal = (eventId) => {
    setSelectedEventId(eventId);
    setCalendarDetailStatus(null);
  };

  const handleSelectedEventClear = () => {
    setSelectedEventId(null);
    setCalendarDetailStatus(null);
  };

  const handleDayScheduleClose = () => {
    setIsDayScheduleOpen(false);
    setSelectedEventId(null);
    setSavingCalendarEventId(null);
    setDeletingCalendarEventId(null);
    setCalendarDetailStatus(null);
  };

  const handleSaveCalendarEvent = async (event, draft) => {
    const metadata = event?.schedulink || null;
    const internalEventId = metadata?.internalEventId || null;
    const googleEventId = event?.id || null;
    const isManagedSave = Boolean(
      metadata?.isManaged && internalEventId && metadata?.canSave
    );
    const isExternalSave = Boolean(!metadata?.isManaged && googleEventId);

    if (!isManagedSave && !isExternalSave) {
      setCalendarDetailStatus({
        tone: "error",
        text: "이 일정은 여기에서 수정할 수 없습니다.",
        lockSave: false,
      });
      return;
    }

    setSavingCalendarEventId(event.id);
    clearFeedback();
    setCalendarDetailStatus(null);

    try {
      const savePayload = {
        allDay: Boolean(draft?.allDay),
        title: draft?.title || "",
        date: draft?.date || "",
        startTime: draft?.allDay ? null : draft?.startTime || "",
        endTime: draft?.allDay ? null : draft?.endTime || "",
        location: draft?.location || "",
        description: draft?.description || "",
      };
      const data = isManagedSave
        ? await saveCalendarEvent(internalEventId, savePayload)
        : await saveGoogleCalendarEvent(googleEventId, savePayload);

      if (data.resultType === "proposal_created") {
        setCalendarDetailStatus({
          tone: "success",
          text:
            data.message || "수정 제안을 전송했습니다. 주최자가 승인하면 반영됩니다.",
          lockSave: true,
        });
        await loadActionItems();
        return;
      }

      setSuccessMessage(
        data.message ||
          (isExternalSave
            ? "Google Calendar 일정이 수정되었습니다."
            : "일정이 수정되었습니다.")
      );
      await Promise.all([loadEvents({ force: true }), loadActionItems()]);
      handleDayScheduleClose();
    } catch (error) {
      setCalendarDetailStatus({
        tone: "error",
        text: error.message,
        lockSave: false,
      });
    } finally {
      setSavingCalendarEventId(null);
    }
  };

  const handleDeleteCalendarEvent = async (event) => {
    const metadata = event?.schedulink || null;
    const internalEventId = metadata?.internalEventId || null;
    const googleEventId = event?.id || null;
    const isManagedDelete = Boolean(
      metadata?.isManaged && internalEventId && metadata?.canDelete
    );
    const isExternalDelete = Boolean(!metadata?.isManaged && googleEventId);

    if (!isManagedDelete && !isExternalDelete) {
      setCalendarDetailStatus({
        tone: "error",
        text: "이 일정은 여기에서 삭제할 수 없습니다.",
        lockSave: false,
      });
      return;
    }

    const confirmMessage =
      isExternalDelete
        ? "Google Calendar에서 이 일정을 삭제할까요?"
        : metadata.deleteMode === "hide_only"
        ? "내 캘린더에서만 일정이 제거됩니다.\n삭제할까요?"
        : "이 일정을 삭제할까요?";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeletingCalendarEventId(event.id);
    clearFeedback();
    setCalendarDetailStatus(null);

    try {
      const data = isManagedDelete
        ? await deleteCalendarEvent(internalEventId)
        : await deleteGoogleCalendarEvent(googleEventId);
      setSuccessMessage(
        data.message ||
          (isExternalDelete
            ? "Google Calendar 일정이 삭제되었습니다."
            : "일정이 삭제되었습니다.")
      );
      await Promise.all([loadEvents({ force: true }), loadActionItems()]);
      handleDayScheduleClose();
    } catch (error) {
      setCalendarDetailStatus({
        tone: "error",
        text: error.message,
        lockSave: false,
      });
    } finally {
      setDeletingCalendarEventId(null);
    }
  };

  return {
    loadingUser,
    user,
    events,
    auth: {
      handleLogin,
      handleLogout,
    },
    feedback: {
      errorMessage,
      successMessage,
      lastParsed,
      lastDbSave,
    },
    profile: {
      mentionProfile,
      profileChangeLimit,
      form: profileForm,
      saving: savingMentionProfile,
      onFieldChange: handleProfileFieldChange,
      onSave: handleSaveMentionProfile,
    },
    conversations: {
      items: sortedConversations,
      sidebarItems: sidebarConversations,
      currentConversationId,
      onCreate: handleCreateConversation,
      onSelect: handleSelectConversation,
      onRename: handleRenameConversation,
      onTogglePin: handleToggleConversationPin,
      onToggleArchive: handleToggleConversationArchive,
      onMoveToTrash: handleMoveConversationToTrash,
      onRestore: handleRestoreConversation,
      onDeletePermanently: handleDeleteConversationPermanently,
      onChangeMode: handleConversationModeChange,
    },
    schedule: {
      messages: currentConversation?.messages || [],
      textInput,
      setTextInput,
      selectedTeamMentions,
      applyTeamMention: handleTeamMentionApply,
      submitting,
      handleSubmit: handleQuickAdd,
      ownershipTransferPrompt,
      handleOwnershipTransferClose,
      handleOwnershipTransferSubmit,
    },
    mentions: {
      query: mentionQuery,
      results: mentionResults,
      teams: mentionTeams,
      loading: mentionLoading,
      error: mentionError,
      onSelect: handleMentionSelect,
    },
    invitations: {
      items: myInvitations,
      loading: loadingInvitations,
      respondingInvitationId,
      dismissingInvitationId,
      onRespond: handleRespondInvitation,
      onDismiss: handleDismissInvitation,
    },
    actionItems: {
      creatorReviewRequests: actionItems.creatorReviewRequests,
      deleteApprovalTargets: actionItems.deleteApprovalTargets,
      deleteNotifications: actionItems.deleteNotifications,
      loading: loadingActionItems,
      actingChangeRequestId,
      actingDeleteTargetId,
      dismissingDeleteNotificationId,
      onOpen: handleOpenActionItems,
      onReviewProposal: handleReviewProposal,
      onRespondDelete: handleRespondDeleteRequest,
      onDismissDeleteNotification: handleDismissDeleteNotification,
    },
    calendar: {
      selectedDate,
      selectedEventId,
      isDayScheduleOpen,
      savingCalendarEventId,
      deletingCalendarEventId,
      detailStatus: calendarDetailStatus,
      selectedDateEvents: selectedDate ? getEventsForDate(events, selectedDate) : [],
      onRefresh: () => loadEvents({ force: true }),
      onRangeChange: handleCalendarRangeChange,
      onDateSelect: handleDateSelect,
      onEventSelect: handleEventSelect,
      onSelectEventInModal: handleEventSelectInModal,
      onClearSelectedEvent: handleSelectedEventClear,
      onCloseDaySchedule: handleDayScheduleClose,
      onSaveEvent: handleSaveCalendarEvent,
      onDeleteEvent: handleDeleteCalendarEvent,
    },
    debug: {
      isOpen: showDebugPanel,
      toggle: () => setShowDebugPanel((currentValue) => !currentValue),
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
      handleSyncUser,
      handleSyncCalendar,
      handleSyncEvent,
      handleSyncParticipant,
      handleParticipantStatusUpdate,
      handleSyncInvitation,
      handleInvitationStatusUpdate,
    },
  };
}
