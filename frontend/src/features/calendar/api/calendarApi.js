import { getErrorMessage, requestJson } from "../../../shared/api/http";

export async function fetchEvents({ startDate, endDate } = {}) {
  const searchParams = new URLSearchParams();

  if (startDate) {
    searchParams.set("startDate", startDate);
  }

  if (endDate) {
    searchParams.set("endDate", endDate);
  }

  const requestPath = searchParams.size
    ? `/auth/events?${searchParams.toString()}`
    : "/auth/events";
  const { response, data } = await requestJson(requestPath);

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "캘린더 일정을 불러오지 못했습니다."));
  }

  return Array.isArray(data) ? data : [];
}

export async function saveCalendarEvent(eventId, payload) {
  const { response, data } = await requestJson(
    `/auth/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "일정 저장에 실패했습니다."));
  }

  return data;
}

export async function saveGoogleCalendarEvent(googleEventId, payload) {
  const { response, data } = await requestJson(
    `/auth/google-events/${encodeURIComponent(googleEventId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "구글 캘린더 일정 수정에 실패했습니다."));
  }

  return data;
}

export async function deleteCalendarEvent(eventId) {
  const { response, data } = await requestJson(
    `/auth/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "일정 삭제에 실패했습니다."));
  }

  return data;
}

export async function deleteGoogleCalendarEvent(googleEventId) {
  const { response, data } = await requestJson(
    `/auth/google-events/${encodeURIComponent(googleEventId)}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "구글 캘린더 일정 삭제에 실패했습니다."));
  }

  return data;
}

export async function syncCalendar() {
  const { response, data } = await requestJson("/auth/sync-calendar", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "calendarsync 테스트에 실패했습니다."));
  }

  return data;
}

export async function syncEvent() {
  const { response, data } = await requestJson("/auth/sync-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "events 테스트에 실패했습니다."));
  }

  return data;
}

export async function syncParticipant() {
  const { response, data } = await requestJson("/auth/sync-participant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "participants 테스트에 실패했습니다."));
  }

  return data;
}

export async function updateParticipantStatus(participantId, status) {
  const { response, data } = await requestJson("/auth/participant-status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId,
      status,
    }),
  });

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "participant 상태 업데이트에 실패했습니다."));
  }

  return data;
}
