import { getErrorMessage, requestJson } from "../../../shared/api/http";

function assertOk(response, data, fallbackMessage) {
  if (!response.ok) {
    throw new Error(getErrorMessage(data, fallbackMessage));
  }

  return data;
}

export async function fetchSubscriptions() {
  const { response, data } = await requestJson("/auth/subscriptions");
  const result = assertOk(response, data, "구독 항목을 불러오지 못했습니다.");

  return {
    items: Array.isArray(result.items) ? result.items : [],
  };
}

export async function fetchSubscriptionEvents(code) {
  const { response, data } = await requestJson(
    `/auth/subscriptions/${encodeURIComponent(code)}/events`
  );
  const result = assertOk(response, data, "구독 이벤트 목록을 불러오지 못했습니다.");

  return {
    item: result.item || null,
    events: Array.isArray(result.events) ? result.events : [],
  };
}

export async function updateSubscription(code, subscribed) {
  const { response, data } = await requestJson(
    `/auth/subscriptions/${encodeURIComponent(code)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscribed }),
    }
  );
  const result = assertOk(response, data, "구독 상태를 변경하지 못했습니다.");

  return {
    item: result.item || null,
    message: result.message || "",
  };
}

export async function updateSubscriptionEventPreferences(
  code,
  excludedExternalEventIds
) {
  const { response, data } = await requestJson(
    `/auth/subscriptions/${encodeURIComponent(code)}/event-preferences`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excludedExternalEventIds }),
    }
  );
  const result = assertOk(
    response,
    data,
    "구독 이벤트 선택 상태를 저장하지 못했습니다."
  );

  return {
    item: result.item || null,
    events: Array.isArray(result.events) ? result.events : [],
    message: result.message || "",
  };
}
