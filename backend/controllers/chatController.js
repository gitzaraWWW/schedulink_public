const chatService = require("../services/chatService");

async function listConversations(req, res) {
  try {
    const payload = await chatService.listConversations(req.session);
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "대화 목록을 불러오지 못했습니다.",
    });
  }
}

async function createConversation(req, res) {
  try {
    const payload = await chatService.createConversationForUser(
      req.session,
      req.body || {}
    );
    return res.status(201).json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "대화를 만들지 못했습니다.",
    });
  }
}

async function updateConversation(req, res) {
  try {
    const payload = await chatService.updateConversationForUser(
      req.session,
      req.params.conversationId,
      req.body || {}
    );
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "대화를 수정하지 못했습니다.",
    });
  }
}

async function deleteConversation(req, res) {
  try {
    const payload = await chatService.deleteConversationForUser(
      req.session,
      req.params.conversationId
    );
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "대화를 삭제하지 못했습니다.",
    });
  }
}

async function permanentlyDeleteConversation(req, res) {
  try {
    const payload = await chatService.permanentlyDeleteConversationForUser(
      req.session,
      req.params.conversationId
    );
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "대화를 영구 삭제하지 못했습니다.",
    });
  }
}

async function listMessages(req, res) {
  try {
    const payload = await chatService.listMessagesForConversation(
      req.session,
      req.params.conversationId
    );
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "대화 메시지를 불러오지 못했습니다.",
    });
  }
}

async function createMessage(req, res) {
  try {
    const payload = await chatService.createMessageForConversation(
      req.session,
      req.params.conversationId,
      req.body || {}
    );
    return res.status(payload.deduplicated ? 200 : 201).json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "대화 메시지를 저장하지 못했습니다.",
    });
  }
}

module.exports = {
  createConversation,
  createMessage,
  deleteConversation,
  listConversations,
  listMessages,
  permanentlyDeleteConversation,
  updateConversation,
};
