import { getErrorMessage, requestJson } from "../../../shared/api/http";

export async function quickAddSchedule(payload) {
  const { response, data } = await requestJson("/auth/quick-add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = new Error(
      getErrorMessage(data, "일정 처리에 실패했습니다.")
    );
    error.details = data || null;
    throw error;
  }

  return data;
}
