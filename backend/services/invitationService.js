const {
  dismissInvitation,
  dismissParticipant,
  getInvitationsByUserId,
  getParticipantById,
  getParticipantsByEventId,
  getUserProfileByEmail,
  getUserProfileById,
  updateInvitationStatus,
  updateParticipantStatus,
} = require("../supabase");
const { createHttpError } = require("../utils/errors");
const { createCalendarEventsForAcceptedParticipants } = require("./calendarService");
const { ensureSessionUser } = require("./sessionUserService");

function normalizeInvitationCollection(invitations) {
  if (!invitations) {
    return [];
  }

  return Array.isArray(invitations) ? invitations : [invitations];
}

function mapInvitationRow(row) {
  const invitations = normalizeInvitationCollection(row.invitations);
  const primaryInvitation = invitations[0] || null;

  return {
    participant: {
      id: row.id,
      event_id: row.event_id,
      user_id: row.user_id,
      name: row.name,
      email: row.email,
      status: row.status,
      created_at: row.created_at,
      dismissed_at: row.dismissed_at || null,
    },
    event: row.events || null,
    invitation: primaryInvitation,
  };
}

async function resolveParticipantUserProfile(row) {
  if (row?.user_id) {
    return getUserProfileById(row.user_id).catch(() => null);
  }

  if (row?.email) {
    return getUserProfileByEmail(row.email).catch(() => null);
  }

  return null;
}

async function mapInvitationRowWithProfile(row) {
  const mappedItem = mapInvitationRow(row);
  const userProfile = await resolveParticipantUserProfile(row);

  return {
    ...mappedItem,
    participant: {
      ...mappedItem.participant,
      name: mappedItem.participant.name || userProfile?.name || null,
      profile_image: userProfile?.profile_image || null,
    },
  };
}

async function mapInvitationRowsWithProfiles(rows) {
  return Promise.all((Array.isArray(rows) ? rows : []).map(mapInvitationRowWithProfile));
}

function validateInvitationResponse(participantId, invitationId, responseStatus) {
  if (!participantId || !invitationId) {
    throw createHttpError(400, "participantId and invitationId are required.");
  }

  if (!["accepted", "rejected"].includes(responseStatus)) {
    throw createHttpError(400, "responseStatus must be accepted or rejected.");
  }
}

async function listMyInvitations(session) {
  const savedUser = await ensureSessionUser(session);
  const rows = await getInvitationsByUserId(savedUser?.id);
  const invitations = (await mapInvitationRowsWithProfiles(rows))
    .filter(
      (item) => !item.invitation?.dismissed_at && !item.participant?.dismissed_at
    );

  return {
    success: true,
    invitations,
    count: invitations.length,
  };
}

async function dismissInvitationForUser(session, payload = {}) {
  const savedUser = await ensureSessionUser(session);
  const invitationId =
    typeof payload === "string" || typeof payload === "number"
      ? payload
      : payload?.invitationId;
  const participantId =
    typeof payload === "object" && payload !== null ? payload.participantId : null;

  if (!invitationId && !participantId) {
    throw createHttpError(400, "invitationId or participantId is required.");
  }

  const rows = await getInvitationsByUserId(savedUser?.id);
  const invitationItems = await mapInvitationRowsWithProfiles(rows);

  if (invitationId) {
    const invitationItem =
      invitationItems.find(
        (item) => String(item.invitation?.id || "") === String(invitationId)
      ) || null;

    if (!invitationItem?.invitation) {
      throw createHttpError(404, "Invitation not found.");
    }

    if (invitationItem.invitation.dismissed_at) {
      return {
        success: true,
        message: "Invitation already hidden.",
        invitation: invitationItem.invitation,
      };
    }

    if (!["accepted", "declined"].includes(invitationItem.invitation.status)) {
      throw createHttpError(
        400,
        "Only accepted or declined invitations can be hidden."
      );
    }

    const invitation = await dismissInvitation(invitationId);

    return {
      success: true,
      message: "The invitation was hidden.",
      invitation,
    };
  }

  const participantItem =
    invitationItems.find(
      (item) => String(item.participant?.id || "") === String(participantId)
    ) || null;

  if (!participantItem?.participant) {
    throw createHttpError(404, "Participant entry not found.");
  }

  if (participantItem.participant.dismissed_at) {
    return {
      success: true,
      message: "Participant entry already hidden.",
      participant: participantItem.participant,
    };
  }

  if (participantItem.invitation) {
    throw createHttpError(
      400,
      "Participant entries with invitations should be hidden through the invitation record."
    );
  }

  if (participantItem.event?.creator_id !== savedUser?.id) {
    throw createHttpError(
      403,
      "Only the organizer can hide their own participant entry."
    );
  }

  if (
    !["accepted", "rejected", "withdrawn"].includes(participantItem.participant.status)
  ) {
    throw createHttpError(
      400,
      "Only completed participant entries can be hidden."
    );
  }

  const participant = await dismissParticipant(participantId);

  return {
    success: true,
    message: "The participant entry was hidden.",
    participant,
  };
}

async function respondToInvitation(session, payload) {
  const { participantId, invitationId, responseStatus } = payload;
  validateInvitationResponse(participantId, invitationId, responseStatus);

  const savedUser = await ensureSessionUser(session);
  const currentParticipant = await getParticipantById(participantId);

  if (!currentParticipant) {
    throw createHttpError(404, "Participant not found.");
  }

  if (currentParticipant.user_id !== savedUser?.id) {
    throw createHttpError(403, "You can only respond to your own invitation.");
  }

  const participantInvitations = normalizeInvitationCollection(
    currentParticipant.invitations
  );
  const currentInvitation =
    participantInvitations.find(
      (item) => String(item?.id) === String(invitationId)
    ) ||
    participantInvitations[0] ||
    null;

  if (!currentInvitation || String(currentInvitation.id) !== String(invitationId)) {
    throw createHttpError(400, "The invitation does not belong to the participant.");
  }

  if (currentParticipant.status !== "pending") {
    throw createHttpError(400, "This invitation has already been answered.");
  }

  const participant = await updateParticipantStatus({
    participantId,
    status: responseStatus === "accepted" ? "accepted" : "rejected",
  });
  const invitation = await updateInvitationStatus({
    invitationId,
    status: responseStatus === "accepted" ? "accepted" : "declined",
  });

  let syncResult = null;
  let message =
    responseStatus === "accepted"
      ? "Invitation accepted."
      : "Invitation rejected.";

  if (responseStatus === "accepted") {
    const eventParticipants = await getParticipantsByEventId(currentParticipant.event_id);
    const allAccepted =
      eventParticipants.length > 0 &&
      eventParticipants.every((item) => item.status === "accepted");

    if (allAccepted) {
      syncResult = await createCalendarEventsForAcceptedParticipants(eventParticipants);

      if (process.env.NODE_ENV !== "production") {
        console.log(
          "[invitationService] invitation_accept_sync_result:",
          JSON.stringify(syncResult, null, 2)
        );
      }

      message =
        syncResult.failedUsers.length > 0
          ? `Everyone accepted, but some calendars could not be synced: ${syncResult.failedUsers
              .map((item) => `${item.userId} (${item.reason})`)
              .join(", ")}`
          : "Everyone accepted and the event was added to each calendar.";
    } else {
      message = "Accepted. Waiting for the rest of the participants.";
    }
  }

  return {
    success: true,
    message,
    participant,
    invitation,
    syncResult,
  };
}

async function respondToInvitationLegacy(payload) {
  const { participantId, invitationId, responseStatus } = payload;
  validateInvitationResponse(participantId, invitationId, responseStatus);

  const participant = await updateParticipantStatus({
    participantId,
    status: responseStatus === "accepted" ? "accepted" : "rejected",
  });
  const invitation = await updateInvitationStatus({
    invitationId,
    status: responseStatus === "accepted" ? "accepted" : "declined",
  });

  return {
    success: true,
    message:
      responseStatus === "accepted"
        ? "Invitation accepted."
        : "Invitation rejected.",
    participant,
    invitation,
  };
}

module.exports = {
  dismissInvitationForUser,
  listMyInvitations,
  respondToInvitation,
  respondToInvitationLegacy,
};
