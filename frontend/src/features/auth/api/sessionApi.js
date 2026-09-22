import { API_BASE_URL } from "../../../shared/config/env";
import { getErrorMessage, request, requestJson } from "../../../shared/api/http";

export function getGoogleLoginUrl() {
  return `${API_BASE_URL}/auth/google`;
}

export async function fetchSession() {
  const { response, data } = await requestJson("/auth/me");

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "사용자 로그인 정보를 불러오지 못했습니다.")
    );
  }

  return data;
}

export async function logoutSession() {
  await request("/auth/logout");
}
