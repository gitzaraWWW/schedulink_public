import { getErrorMessage, requestJson } from "../../../shared/api/http";

export async function fetchActionItems() {
  const { response, data } = await requestJson("/auth/action-items");

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "변경 요청 목록을 불러오지 못했습니다.")
    );
  }

  return {
    creatorReviewRequests: data.creatorReviewRequests || [],
    deleteApprovalTargets: data.deleteApprovalTargets || [],
    deleteNotifications: data.deleteNotifications || [],
  };
}

export async function markDeleteNotificationsRead(targetIds) {
  const { response, data } = await requestJson("/auth/delete-notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetIds: Array.isArray(targetIds) ? targetIds : [],
    }),
  });

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "삭제 알림 읽음 처리에 실패했습니다.")
    );
  }

  return data;
}

export async function dismissDeleteNotification(targetId) {
  const { response, data } = await requestJson(
    `/auth/delete-notifications/${targetId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "삭제 알림 삭제에 실패했습니다.")
    );
  }

  return data;
}

export async function reviewUpdateProposal(
  requestId,
  decision,
  decisionReason = ""
) {
  const { response, data } = await requestJson(
    `/auth/change-requests/${requestId}/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        decisionReason: decisionReason || null,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "수정 제안 처리에 실패했습니다.")
    );
  }

  return data;
}

export async function respondToDeleteRequest(
  targetId,
  decision,
  decisionReason = ""
) {
  const { response, data } = await requestJson(
    `/auth/change-request-targets/${targetId}/respond`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        decisionReason: decisionReason || null,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "삭제 요청 처리에 실패했습니다.")
    );
  }

  return data;
}
