const {
  createChatConversation,
  createChatMessage,
  deleteChatConversation,
  getChatConversationByIdAndOwner,
  getChatMessageByClientMessageId,
  listChatConversationsByUserId,
  listChatMessagesByConversationId,
  updateChatConversation,
} = require("../repositories/chatRepository");
const { ensureSessionUser } = require("./sessionUserService");
const { createHttpError } = require("../utils/errors");

const ALLOWED_MESSAGE_ROLES = new Set(["user", "assistant", "system"]);
const ALLOWED_MESSAGE_KINDS = new Set([
  "text",
  "intro",
  "result",
  "error",
  "ownership-required",
]);
const ALLOWED_CONVERSATION_MODES = new Set(["edit", "query"]);
const ALLOWED_MESSAGE_STATUSES = new Set(["pending", "complete", "error"]);

function normalizeConversationTitle(title) {
  const trimmedTitle = typeof title === "string" ? title.trim() : "";
  return trimmedTitle || "새 대화";
}

function normalizeConversationMode(mode) {
  const trimmedMode = typeof mode === "string" ? mode.trim() : "";

  if (!trimmedMode) {
    return "edit";
  }

  if (!ALLOWED_CONVERSATION_MODES.has(trimmedMode)) {
    throw createHttpError(400, "올바르지 않은 대화 모드입니다.");
  }

  return trimmedMode;
}

function buildLastMessagePreview(content) {
  if (typeof content !== "string") {
    return "";
  }

  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 120);
}

async function getOwnedConversationOrThrow(session, conversationId) {
  const savedUser = await ensureSessionUser(session);
  const conversation = await getChatConversationByIdAndOwner(
    conversationId,
    savedUser.id
  );

  if (!conversation) {
    throw createHttpError(404, "대화를 찾지 못했습니다.");
  }

  return { savedUser, conversation };
}

function normalizeMessageInput(input = {}) {
  const role = typeof input.role === "string" ? input.role.trim() : "";
  const kind = typeof input.kind === "string" ? input.kind.trim() : "text";
  const status =
    typeof input.status === "string" ? input.status.trim() : "complete";
  const content = typeof input.content === "string" ? input.content : "";

  if (!ALLOWED_MESSAGE_ROLES.has(role)) {
    throw createHttpError(400, "메시지 역할이 올바르지 않습니다.");
  }

  if (!ALLOWED_MESSAGE_KINDS.has(kind)) {
    throw createHttpError(400, "올바르지 않은 메시지 종류입니다.");
  }

  if (!ALLOWED_MESSAGE_STATUSES.has(status)) {
    throw createHttpError(400, "올바르지 않은 메시지 상태입니다.");
  }

  if (input.metadata !== undefined && input.metadata !== null) {
    if (typeof input.metadata !== "object" || Array.isArray(input.metadata)) {
      throw createHttpError(400, "메시지 메타데이터 형식이 올바르지 않습니다.");
    }
  }

  return {
    client_message_id:
      typeof input.clientMessageId === "string" && input.clientMessageId.trim()
        ? input.clientMessageId.trim()
        : null,
    role,
    kind,
    status,
    content,
    metadata: input.metadata || {},
  };
}

async function listConversations(session) {
  const savedUser = await ensureSessionUser(session);
  const conversations = await listChatConversationsByUserId(savedUser.id, {
    includeDeleted: true,
  });

  return {
    success: true,
    conversations,
  };
}

async function createConversationForUser(session, input = {}) {
  const savedUser = await ensureSessionUser(session);
  const now = new Date().toISOString();
  const conversation = await createChatConversation({
    owner_user_id: savedUser.id,
    title: normalizeConversationTitle(input.title),
    mode: normalizeConversationMode(input.mode),
    created_at: now,
    updated_at: now,
  });

  return {
    success: true,
    conversation,
  };
}

async function updateConversationForUser(session, conversationId, input = {}) {
  const { conversation } = await getOwnedConversationOrThrow(session, conversationId);
  const nextPatch = {};

  if (input.title !== undefined) {
    nextPatch.title = normalizeConversationTitle(input.title);
  }

  if (input.mode !== undefined) {
    nextPatch.mode = normalizeConversationMode(input.mode);
  }

  if (typeof input.isPinned === "boolean") {
    nextPatch.is_pinned = input.isPinned;
  }

  if (typeof input.isArchived === "boolean") {
    nextPatch.is_archived = input.isArchived;
  }

  if (typeof input.isDeleted === "boolean") {
    nextPatch.is_deleted = input.isDeleted;
    nextPatch.deleted_at = input.isDeleted ? new Date().toISOString() : null;
  }

  if (Object.keys(nextPatch).length === 0) {
    return {
      success: true,
      conversation,
    };
  }

  nextPatch.updated_at = new Date().toISOString();

  const updatedConversation = await updateChatConversation(conversationId, nextPatch);

  return {
    success: true,
    conversation: updatedConversation,
  };
}

async function deleteConversationForUser(session, conversationId) {
  return updateConversationForUser(session, conversationId, {
    isDeleted: true,
  });
}

async function permanentlyDeleteConversationForUser(session, conversationId) {
  await getOwnedConversationOrThrow(session, conversationId);
  await deleteChatConversation(conversationId);

  return {
    success: true,
    conversationId,
  };
}

async function listMessagesForConversation(session, conversationId) {
  const { conversation } = await getOwnedConversationOrThrow(session, conversationId);
  const messages = await listChatMessagesByConversationId(conversation.id);

  return {
    success: true,
    conversation,
    messages,
  };
}

async function createMessageForConversation(session, conversationId, input = {}) {
  const { conversation } = await getOwnedConversationOrThrow(session, conversationId);
  const normalizedInput = normalizeMessageInput(input);

  if (normalizedInput.client_message_id) {
    const existingMessage = await getChatMessageByClientMessageId(
      conversation.id,
      normalizedInput.client_message_id
    );

    if (existingMessage) {
      return {
        success: true,
        message: existingMessage,
        conversation,
        deduplicated: true,
      };
    }
  }

  const now = new Date().toISOString();
  const message = await createChatMessage({
    conversation_id: conversation.id,
    client_message_id: normalizedInput.client_message_id,
    role: normalizedInput.role,
    kind: normalizedInput.kind,
    status: normalizedInput.status,
    content: normalizedInput.content,
    metadata: normalizedInput.metadata,
    created_at: now,
  });

  const updatedConversation = await updateChatConversation(conversation.id, {
    last_message_preview: buildLastMessagePreview(message.content),
    last_message_at: message.created_at || now,
    updated_at: message.created_at || now,
  });

  return {
    success: true,
    conversation: updatedConversation,
    message,
    deduplicated: false,
  };
}

module.exports = {
  createConversationForUser,
  createMessageForConversation,
  deleteConversationForUser,
  listConversations,
  listMessagesForConversation,
  permanentlyDeleteConversationForUser,
  updateConversationForUser,
};
