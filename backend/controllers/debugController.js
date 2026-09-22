const debugService = require("../services/debugService");

async function syncUser(req, res) {
  try {
    const payload = await debugService.syncUser(req.session);
    return res.json(payload);
  } catch (error) {
    req.session.supabaseUser = null;
    req.session.supabaseSync = {
      success: false,
      message: error.message,
    };

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to sync the current user.",
      details: error.details || null,
    });
  }
}

async function syncCalendar(req, res) {
  try {
    const payload = await debugService.syncCalendar(req.session);
    return res.json(payload);
  } catch (error) {
    req.session.calendarSync = {
      success: false,
      message: error.message,
      row: null,
    };

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to sync calendar tokens.",
      details: error.details || null,
    });
  }
}

async function syncEvent(req, res) {
  try {
    const payload = await debugService.syncEvent(req.session, req.body || {});
    return res.json(payload);
  } catch (error) {
    req.session.eventSync = {
      success: false,
      message: error.message,
      row: null,
    };

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to store the test event.",
      details: error.details || null,
    });
  }
}

async function syncParticipant(req, res) {
  try {
    const payload = await debugService.syncParticipant(req.session);
    return res.json(payload);
  } catch (error) {
    req.session.participantSync = {
      success: false,
      message: error.message,
      row: null,
    };

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to store the test participant.",
      details: error.details || null,
    });
  }
}

async function updateParticipantStatus(req, res) {
  try {
    const participantId =
      req.body?.participantId || req.session.participantSync?.row?.id || null;
    const payload = await debugService.updateParticipantStatusDebug(
      req.session,
      participantId,
      req.body?.status
    );
    return res.json(payload);
  } catch (error) {
    req.session.participantSync = {
      success: false,
      message: error.message,
      row: req.session.participantSync?.row || null,
    };

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to update participant status.",
      details: error.details || null,
    });
  }
}

async function syncInvitation(req, res) {
  try {
    const payload = await debugService.syncInvitation(req.session);
    return res.json(payload);
  } catch (error) {
    req.session.invitationSync = {
      success: false,
      message: error.message,
      row: null,
    };

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to store the test invitation.",
      details: error.details || null,
    });
  }
}

async function updateInvitationStatus(req, res) {
  try {
    const invitationId =
      req.body?.invitationId || req.session.invitationSync?.row?.id || null;
    const payload = await debugService.updateInvitationStatusDebug(
      req.session,
      invitationId,
      req.body?.status
    );
    return res.json(payload);
  } catch (error) {
    req.session.invitationSync = {
      success: false,
      message: error.message,
      row: req.session.invitationSync?.row || null,
    };

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to update invitation status.",
      details: error.details || null,
    });
  }
}

module.exports = {
  syncCalendar,
  syncEvent,
  syncInvitation,
  syncParticipant,
  syncUser,
  updateInvitationStatus,
  updateParticipantStatus,
};
