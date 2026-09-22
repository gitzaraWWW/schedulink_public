import { getErrorMessage, requestJson } from "../../../shared/api/http";

export async function queryLucid(payload) {
  const { response, data } = await requestJson("/auth/lucid-query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "일정 검색 요청을 처리하지 못했습니다.")
    );
  }

  return data;
}
