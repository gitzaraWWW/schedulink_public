import { getErrorMessage, requestJson } from "../../../shared/api/http";

export async function syncUser() {
  const { response, data } = await requestJson("/auth/sync-user", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "users 저장 테스트에 실패했습니다."));
  }

  return data;
}
