const {
  createEvent,
  createInvitation,
  createParticipant,
  saveCalendarSync,
  updateInvitationStatus,
  updateParticipantStatus,
} = require("../supabase");
const { createHttpError } = require("../utils/errors");
const { ensureSessionUser, syncSessionUser } = require("./sessionUserService");

async function syncUser(session) {
  const { savedUser } = await syncSessionUser(session);

  session.supabaseSync = {
    success: true,
    message: "Stored the current session user in Supabase.",
  };

  return {
    success: true,
    message: session.supabaseSync.message,
    user: savedUser,
  };
}

async function syncCalendar(session) {
  if (!session?.tokens) {
    throw createHttpError(400, "Google token is missing.");
  }

  const savedUser = await ensureSessionUser(session);
  const row = await saveCalendarSync({
    userId: savedUser?.id,
    tokens: session.tokens,
  });

  session.calendarSync = {
    success: true,
    message: "Stored Google Calendar tokens.",
    row,
  };

  return {
    success: true,
    message: session.calendarSync.message,
    row,
  };
}

async function syncEvent(session, body = {}) {
  const savedUser = await ensureSessionUser(session);
  const row = await createEvent({
    creatorId: savedUser?.id,
    title: body.title || "DB test event",
    date: body.date || new Date().toISOString().slice(0, 10),
    startTime: body.start_time || "14:00",
    endTime: body.end_time || "15:00",
    location: body.location || "Schedulink Test Room",
  });

  session.eventSync = {
    success: true,
    message: "Stored a test event.",
    row,
  };

  return {
    success: true,
    message: session.eventSync.message,
    row,
  };
}

async function syncParticipant(session) {
  const savedUser = await ensureSessionUser(session);
  const event = await createEvent({
    creatorId: savedUser?.id,
    title: "Participant test event",
    date: new Date().toISOString().slice(0, 10),
    startTime: "16:00",
    endTime: "17:00",
    location: "Participant Test Room",
  });

  const row = await createParticipant({
    eventId: event?.id,
    userId: savedUser?.id,
    name: savedUser?.name || session.user?.name || "Test User",
    email: savedUser?.email || session.user?.email || null,
    status: "pending",
  });

  session.eventSync = {
    success: true,
    message: "Created a participant test event.",
    row: event,
  };
  session.participantSync = {
    success: true,
    message: "Stored a test participant.",
    row,
  };

  return {
    success: true,
    message: session.participantSync.message,
    event,
    row,
  };
}

async function updateParticipantStatusDebug(session, participantId, status) {
  if (!participantId) {
    throw createHttpError(400, "participantId is required.");
  }

  const row = await updateParticipantStatus({
    participantId,
    status,
  });

  session.participantSync = {
    success: true,
    message: `Updated participant status to ${status}.`,
    row,
  };

  return {
    success: true,
    message: session.participantSync.message,
    row,
  };
}

async function syncInvitation(session) {
  const savedUser = await ensureSessionUser(session);
  const event = await createEvent({
    creatorId: savedUser?.id,
    title: "Invitation test event",
    date: new Date().toISOString().slice(0, 10),
    startTime: "18:00",
    endTime: "19:00",
    location: "Invitation Test Room",
  });

  const participant = await createParticipant({
    eventId: event?.id,
    userId: savedUser?.id,
    name: savedUser?.name || session.user?.name || "Test User",
    email: savedUser?.email || session.user?.email || null,
    status: "pending",
  });

  const row = await createInvitation({
    participantId: participant?.id,
    status: "pending",
  });

  session.eventSync = {
    success: true,
    message: "Created an invitation test event.",
    row: event,
  };
  session.participantSync = {
    success: true,
    message: "Created an invitation test participant.",
    row: participant,
  };
  session.invitationSync = {
    success: true,
    message: "Stored a test invitation.",
    row,
  };

  return {
    success: true,
    message: session.invitationSync.message,
    event,
    participant,
    row,
  };
}

async function updateInvitationStatusDebug(session, invitationId, status) {
  if (!invitationId) {
    throw createHttpError(400, "invitationId is required.");
  }

  const row = await updateInvitationStatus({
    invitationId,
    status,
  });

  session.invitationSync = {
    success: true,
    message: `Updated invitation status to ${status}.`,
    row,
  };

  return {
    success: true,
    message: session.invitationSync.message,
    row,
  };
}

module.exports = {
  syncCalendar,
  syncEvent,
  syncInvitation,
  syncParticipant,
  syncUser,
  updateInvitationStatusDebug,
  updateParticipantStatusDebug,
};
