import { API_BASE_URL } from "../config/env";

export async function request(path, options = {}) {
  const { headers, ...rest } = options;

  return fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...rest,
    headers,
  });
}

export async function requestJson(path, options = {}) {
  const response = await request(path, options);
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { response, data };
}

export function getErrorMessage(data, fallbackMessage) {
  if (data && typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  return fallbackMessage;
}
