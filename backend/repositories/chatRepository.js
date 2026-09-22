const {
  supabaseDelete,
  supabaseGet,
  supabaseInsert,
  supabasePatch,
} = require("../supabase/client");

const CHAT_CONVERSATIONS_TABLE = "chat_conversations";
const CHAT_MESSAGES_TABLE = "chat_messages";

const CHAT_CONVERSATION_SELECT = [
  "id",
  "owner_user_id",
  "title",
  "last_message_preview",
  "last_message_at",
  "mode",
  "is_pinned",
  "is_archived",
  "is_deleted",
  "deleted_at",
  "created_at",
  "updated_at",
].join(",");

const CHAT_MESSAGE_SELECT = [
  "id",
  "conversation_id",
  "client_message_id",
  "role",
  "kind",
  "status",
  "content",
  "metadata",
  "created_at",
].join(",");

function encodeQueryValue(value) {
  return encodeURIComponent(String(value));
}

async function listChatConversationsByUserId(userId, options = {}) {
  if (!userId) {
    throw new Error("사용자 ID가 필요합니다.");
  }

  const { includeDeleted = false } = options;
  const filters = [
    `owner_user_id=eq.${encodeQueryValue(userId)}`,
    `select=${encodeURIComponent(CHAT_CONVERSATION_SELECT)}`,
    "order=is_pinned.desc,updated_at.desc",
  ];

  if (!includeDeleted) {
    filters.push("is_deleted=eq.false");
  }

  const data = await supabaseGet(
    CHAT_CONVERSATIONS_TABLE,
    filters.join("&"),
    "대화 목록을 불러오지 못했습니다."
  );

  return Array.isArray(data) ? data : [];
}

async function getChatConversationById(conversationId) {
  if (!conversationId) {
    throw new Error("대화 ID가 필요합니다.");
  }

  const data = await supabaseGet(
    CHAT_CONVERSATIONS_TABLE,
    [
      `id=eq.${encodeQueryValue(conversationId)}`,
      `select=${encodeURIComponent(CHAT_CONVERSATION_SELECT)}`,
      "limit=1",
    ].join("&"),
    "대화를 불러오지 못했습니다."
  );

  return Array.isArray(data) ? data[0] || null : data;
}

async function getChatConversationByIdAndOwner(conversationId, ownerUserId) {
  if (!conversationId || !ownerUserId) {
    throw new Error("대화 ID와 사용자 ID가 필요합니다.");
  }

  const data = await supabaseGet(
    CHAT_CONVERSATIONS_TABLE,
    [
      `id=eq.${encodeQueryValue(conversationId)}`,
      `owner_user_id=eq.${encodeQueryValue(ownerUserId)}`,
      `select=${encodeURIComponent(CHAT_CONVERSATION_SELECT)}`,
      "limit=1",
    ].join("&"),
    "대화를 불러오지 못했습니다."
  );

  return Array.isArray(data) ? data[0] || null : data;
}

async function createChatConversation(payload) {
  if (!payload?.owner_user_id) {
    throw new Error("소유자 사용자 ID가 필요합니다.");
  }

  return supabaseInsert(
    CHAT_CONVERSATIONS_TABLE,
    payload,
    "대화를 만들지 못했습니다."
  );
}

async function updateChatConversation(conversationId, payload) {
  if (!conversationId) {
    throw new Error("대화 ID가 필요합니다.");
  }

  return supabasePatch(
    CHAT_CONVERSATIONS_TABLE,
    `id=eq.${encodeQueryValue(conversationId)}`,
    payload,
    "대화를 수정하지 못했습니다."
  );
}

async function listChatMessagesByConversationId(conversationId) {
  if (!conversationId) {
    throw new Error("대화 ID가 필요합니다.");
  }

  const data = await supabaseGet(
    CHAT_MESSAGES_TABLE,
    [
      `conversation_id=eq.${encodeQueryValue(conversationId)}`,
      `select=${encodeURIComponent(CHAT_MESSAGE_SELECT)}`,
      "order=created_at.asc,id.asc",
    ].join("&"),
    "대화 메시지를 불러오지 못했습니다."
  );

  return Array.isArray(data) ? data : [];
}

async function getChatMessageByClientMessageId(conversationId, clientMessageId) {
  if (!conversationId || !clientMessageId) {
    throw new Error("대화 ID와 클라이언트 메시지 ID가 필요합니다.");
  }

  const data = await supabaseGet(
    CHAT_MESSAGES_TABLE,
    [
      `conversation_id=eq.${encodeQueryValue(conversationId)}`,
      `client_message_id=eq.${encodeQueryValue(clientMessageId)}`,
      `select=${encodeURIComponent(CHAT_MESSAGE_SELECT)}`,
      "limit=1",
    ].join("&"),
    "대화 메시지를 불러오지 못했습니다."
  );

  return Array.isArray(data) ? data[0] || null : data;
}

async function createChatMessage(payload) {
  if (!payload?.conversation_id) {
    throw new Error("대화 ID가 필요합니다.");
  }

  if (!payload?.role) {
    throw new Error("메시지 역할이 필요합니다.");
  }

  return supabaseInsert(
    CHAT_MESSAGES_TABLE,
    payload,
    "대화 메시지를 저장하지 못했습니다."
  );
}

async function deleteChatConversation(conversationId) {
  if (!conversationId) {
    throw new Error("대화 ID가 필요합니다.");
  }

  return supabaseDelete(
    CHAT_CONVERSATIONS_TABLE,
    `id=eq.${encodeQueryValue(conversationId)}`,
    "대화를 삭제하지 못했습니다."
  );
}

module.exports = {
  createChatConversation,
  createChatMessage,
  deleteChatConversation,
  getChatConversationById,
  getChatConversationByIdAndOwner,
  getChatMessageByClientMessageId,
  listChatConversationsByUserId,
  listChatMessagesByConversationId,
  updateChatConversation,
};
