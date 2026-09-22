const invitationService = require("../services/invitationService");

async function getMyInvitations(req, res) {
  try {
    const payload = await invitationService.listMyInvitations(req.session);
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load invitations.",
      invitations: [],
    });
  }
}

async function respondToInvitation(req, res) {
  try {
    const payload = await invitationService.respondToInvitation(
      req.session,
      req.body || {}
    );
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to respond to invitation.",
    });
  }
}

async function respondToInvitationLegacy(req, res) {
  try {
    const payload = await invitationService.respondToInvitationLegacy(
      req.body || {}
    );
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to respond to invitation.",
    });
  }
}

async function dismissInvitation(req, res) {
  try {
    const payload = await invitationService.dismissInvitationForUser(
      req.session,
      req.body && Object.keys(req.body).length > 0
        ? req.body
        : req.params.invitationId
    );
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to hide invitation.",
    });
  }
}

module.exports = {
  dismissInvitation,
  getMyInvitations,
  respondToInvitation,
  respondToInvitationLegacy,
};
