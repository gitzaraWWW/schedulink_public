import { getErrorMessage, requestJson } from "../../../shared/api/http";

function assertOk(response, data, fallbackMessage) {
  if (!response.ok) {
    throw new Error(getErrorMessage(data, fallbackMessage));
  }

  return data;
}

export async function fetchChatConversations() {
  const { response, data } = await requestJson("/auth/chat/conversations");
  return assertOk(response, data, "대화 목록을 불러오지 못했습니다.");
}

export async function createChatConversation(payload = {}) {
  const { response, data } = await requestJson("/auth/chat/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return assertOk(response, data, "대화를 생성하지 못했습니다.");
}

export async function updateChatConversation(conversationId, payload) {
  const { response, data } = await requestJson(
    `/auth/chat/conversations/${conversationId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  return assertOk(response, data, "대화를 수정하지 못했습니다.");
}

export async function deleteChatConversation(conversationId) {
  const { response, data } = await requestJson(
    `/auth/chat/conversations/${conversationId}`,
    {
      method: "DELETE",
    }
  );

  return assertOk(response, data, "대화를 휴지통으로 이동하지 못했습니다.");
}

export async function permanentlyDeleteChatConversation(conversationId) {
  const { response, data } = await requestJson(
    `/auth/chat/conversations/${conversationId}/permanent`,
    {
      method: "DELETE",
    }
  );

  return assertOk(response, data, "대화를 영구 삭제하지 못했습니다.");
}

export async function fetchChatMessages(conversationId) {
  const { response, data } = await requestJson(
    `/auth/chat/conversations/${conversationId}/messages`
  );

  return assertOk(response, data, "대화 메시지를 불러오지 못했습니다.");
}

export async function createChatMessage(conversationId, payload) {
  const { response, data } = await requestJson(
    `/auth/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  return assertOk(response, data, "메시지를 저장하지 못했습니다.");
}
