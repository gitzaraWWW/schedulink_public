import { getErrorMessage, requestJson } from "../../../shared/api/http";

export async function fetchMyInvitations() {
  const { response, data } = await requestJson("/auth/my-invitations");

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "받은 초대 목록을 불러오지 못했습니다.")
    );
  }

  return data.invitations || [];
}

export async function syncInvitation() {
  const { response, data } = await requestJson("/auth/sync-invitation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "invitations 저장 테스트에 실패했습니다.")
    );
  }

  return data;
}

export async function updateInvitationStatus(invitationId, status) {
  const { response, data } = await requestJson("/auth/invitation-status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      invitationId,
      status,
    }),
  });

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "invitation 상태 업데이트에 실패했습니다.")
    );
  }

  return data;
}

export async function respondToInvitation(payload) {
  const { response, data } = await requestJson("/auth/respond-invitation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "초대 응답 처리에 실패했습니다."));
  }

  return data;
}

export async function dismissInvitation({ invitationId, participantId }) {
  const { response, data } = await requestJson("/auth/invitations/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      invitationId: invitationId || null,
      participantId: participantId || null,
    }),
  });

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "초대 숨기기에 실패했습니다."));
  }

  return data;
}
