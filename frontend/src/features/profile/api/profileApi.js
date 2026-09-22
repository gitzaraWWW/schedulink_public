import { getErrorMessage, requestJson } from "../../../shared/api/http";

export async function saveMentionProfile(payload) {
  const { response, data } = await requestJson("/auth/mention-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "프로필 저장에 실패했습니다."));
  }

  return data;
}
