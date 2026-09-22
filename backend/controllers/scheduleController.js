const scheduleService = require("../services/scheduleService");

async function quickAdd(req, res) {
  try {
    const payload = await scheduleService.quickAdd(
      req.session,
      req.body?.text,
      Array.isArray(req.body?.mentions) ? req.body.mentions : [],
      Array.isArray(req.body?.teamMentions) ? req.body.teamMentions : [],
      req.body?.ownershipSelection || null
    );
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "일정 요청을 처리하지 못했습니다.",
      parsed: error.parsed || null,
      code: error.code || null,
      ownershipSelectionRequired: Boolean(error.ownershipSelectionRequired),
      ownershipCandidates: error.ownershipCandidates || [],
      targetEvent: error.targetEvent || null,
    });
  }
}

async function getActionItems(req, res) {
  try {
    const payload = await scheduleService.listActionItems(req.session);
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "확인할 요청 목록을 불러오지 못했습니다.",
    });
  }
}

async function reviewUpdateProposal(req, res) {
  try {
    const payload = await scheduleService.reviewUpdateProposal(
      req.session,
      req.params.requestId,
      req.body?.decision,
      req.body?.decisionReason || null
    );
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "수정 제안을 검토하지 못했습니다.",
    });
  }
}

async function respondToDeleteRequest(req, res) {
  try {
    const payload = await scheduleService.respondToDeleteRequest(
      req.session,
      req.params.targetId,
      req.body?.decision,
      req.body?.decisionReason || null
    );
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "삭제 요청에 응답하지 못했습니다.",
    });
  }
}

async function markDeleteNotificationsRead(req, res) {
  try {
    const payload = await scheduleService.markDeleteNotificationsRead(
      req.session,
      Array.isArray(req.body?.targetIds) ? req.body.targetIds : []
    );
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "삭제 알림을 읽음 처리하지 못했습니다.",
    });
  }
}

async function dismissDeleteNotification(req, res) {
  try {
    const payload = await scheduleService.dismissDeleteNotification(
      req.session,
      req.params.targetId
    );
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "삭제 알림을 숨기지 못했습니다.",
    });
  }
}

async function quickAddLegacy(req, res) {
  try {
    const payload = await scheduleService.quickAddLegacy(
      req.session,
      req.body?.text,
      Array.isArray(req.body?.mentions) ? req.body.mentions : [],
      Array.isArray(req.body?.teamMentions) ? req.body.teamMentions : [],
      req.body?.ownershipSelection || null
    );
    return res.status(201).json(payload);
  } catch (error) {
    console.error("Natural language DB save failed:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "일정 요청을 처리하지 못했습니다.",
      parsed: error.parsed || null,
      code: error.code || null,
      ownershipSelectionRequired: Boolean(error.ownershipSelectionRequired),
      ownershipCandidates: error.ownershipCandidates || [],
      targetEvent: error.targetEvent || null,
    });
  }
}

module.exports = {
  dismissDeleteNotification,
  getActionItems,
  markDeleteNotificationsRead,
  quickAdd,
  quickAddLegacy,
  respondToDeleteRequest,
  reviewUpdateProposal,
};
