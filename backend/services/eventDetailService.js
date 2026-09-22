const {
  createEventChangeRequest,
  createEventChangeRequestTargets,
  getEventById,
  getParticipantsByEventId,
  listEventChangeRequestsByEventId,
  markEventDeleted,
  updateEvent,
} = require("../supabase");
const { createHttpError } = require("../utils/errors");
const {
  deleteCalendarEventForUser,
  deleteCalendarEventsForAcceptedParticipants,
  patchCalendarEventsForAcceptedParticipants,
} = require("./calendarService");
const { ensureSessionUser } = require("./sessionUserService");
const { resolveDurationMinutes } = require("../utils/time");

function normalizeClock(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 5);
}

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function normalizeTextField(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function buildEventSnapshot(eventRow, participants) {
  return {
    id: eventRow?.id || null,
    title: eventRow?.title || null,
    date: eventRow?.date || null,
    startTime: normalizeClock(eventRow?.start_time),
    endTime: normalizeClock(eventRow?.end_time),
    durationMinutes:
      resolveDurationMinutes(
        normalizeClock(eventRow?.start_time),
        normalizeClock(eventRow?.end_time),
        eventRow?.duration_minutes || null
      ) || null,
    location: eventRow?.location || null,
    description: eventRow?.description || null,
    lifecycleStatus: eventRow?.lifecycle_status || "active",
    version: eventRow?.version || 1,
    participants: (participants || []).map((participant) => ({
      id: participant.id,
      userId: participant.user_id || null,
      name: participant.name || null,
      email: participant.email || null,
      status: participant.status || null,
    })),
  };
}

async function assertNoActiveChangeRequestForEvent(eventId) {
  const requests = await listEventChangeRequestsByEventId(eventId);
  const activeRequest = requests.find((request) =>
    ["pending_creator_review", "pending_participant_approval"].includes(
      request.request_status
    )
  );

  if (activeRequest) {
    throw createHttpError(
      409,
      "이미 처리 중인 일정 변경 요청이 있습니다. 해당 요청을 먼저 마무리해주세요."
    );
  }
}

function assertNoPendingParticipantsForSharedMutation(participants, creatorUserId) {
  const hasPendingInvitees = (participants || []).some((participant) => {
    if (!participant) {
      return false;
    }

    if (participant.user_id === creatorUserId) {
      return false;
    }

    return participant.status === "pending";
  });

  if (hasPendingInvitees) {
    throw createHttpError(
      409,
      "응답 대기 중인 참여자가 있어 지금은 이 일정을 수정하거나 삭제할 수 없습니다."
    );
  }
}

function assertEventEditable(eventRow) {
  if (!eventRow) {
    throw createHttpError(404, "일정을 찾을 수 없습니다.");
  }

  if (eventRow.lifecycle_status === "deleted") {
    throw createHttpError(404, "이미 삭제된 일정입니다.");
  }

  if (eventRow.lifecycle_status === "pending_delete") {
    throw createHttpError(409, "삭제 처리 중인 일정입니다.");
  }
}

function buildNextEventPayload(currentEvent, payload = {}) {
  const hasExplicitAllDay = Object.prototype.hasOwnProperty.call(payload, "allDay");
  const nextAllDay = hasExplicitAllDay
    ? Boolean(payload.allDay)
    : !normalizeClock(currentEvent.start_time);
  const nextTitle =
    normalizeTextField(payload.title) ?? normalizeTextField(currentEvent.title);
  const nextDate = payload.date ?? currentEvent.date;
  const nextStartTime = nextAllDay
    ? null
    : normalizeClock(payload.startTime) ?? normalizeClock(currentEvent.start_time);
  const nextEndTime = nextAllDay
    ? null
    : normalizeClock(payload.endTime) ?? normalizeClock(currentEvent.end_time);
  const nextLocation =
    normalizeTextField(payload.location) ?? currentEvent.location ?? null;
  const nextDescription =
    normalizeTextField(payload.description) ?? currentEvent.description ?? null;

  if (!nextTitle) {
    throw createHttpError(400, "일정 제목을 입력해주세요.");
  }

  if (!isValidDate(String(nextDate || ""))) {
    throw createHttpError(400, "올바른 날짜 형식이 아닙니다.");
  }

  if (
    !nextAllDay &&
    (!isValidTime(String(nextStartTime || "")) ||
      !isValidTime(String(nextEndTime || "")))
  ) {
    throw createHttpError(400, "올바른 시작/종료 시간 형식이 아닙니다.");
  }

  return {
    allDay: nextAllDay,
    title: nextTitle,
    date: nextDate,
    startTime: nextStartTime,
    endTime: nextEndTime,
    durationMinutes: nextAllDay
      ? null
      :
      resolveDurationMinutes(
        nextStartTime,
        nextEndTime,
        currentEvent.duration_minutes || null
      ) || null,
    location: nextLocation,
    description: nextDescription,
  };
}

function assertUpdateHasChanges(nextEvent, currentEvent) {
  const noMeaningfulChange =
    nextEvent.title === currentEvent.title &&
    String(nextEvent.date || "") === String(currentEvent.date || "") &&
    normalizeClock(nextEvent.startTime) === normalizeClock(currentEvent.start_time) &&
    normalizeClock(nextEvent.endTime) === normalizeClock(currentEvent.end_time) &&
    String(nextEvent.location || "") === String(currentEvent.location || "") &&
    String(nextEvent.description || "") === String(currentEvent.description || "");

  if (noMeaningfulChange) {
    throw createHttpError(400, "변경된 내용이 없습니다.");
  }
}

async function getEventContext(session, eventId) {
  const savedUser = await ensureSessionUser(session);
  const eventRow = await getEventById(eventId);

  assertEventEditable(eventRow);

  const participants = await getParticipantsByEventId(eventId);
  const ownParticipant =
    participants.find((participant) => participant.user_id === savedUser.id) || null;
  const isOwner = eventRow.creator_id === savedUser.id;

  if (!isOwner && !ownParticipant) {
    throw createHttpError(403, "이 일정을 수정하거나 삭제할 권한이 없습니다.");
  }

  if (
    !isOwner &&
    !["accepted", "pending"].includes(ownParticipant?.status || "")
  ) {
    throw createHttpError(403, "현재 상태에서는 이 일정을 수정하거나 삭제할 수 없습니다.");
  }

  return {
    savedUser,
    eventRow,
    participants,
    ownParticipant,
    isOwner,
  };
}

async function updateEventDetail(session, eventId, payload = {}) {
  const { savedUser, eventRow, participants, isOwner } = await getEventContext(
    session,
    eventId
  );

  await assertNoActiveChangeRequestForEvent(eventId);
  assertNoPendingParticipantsForSharedMutation(participants, eventRow.creator_id);

  const beforeSnapshot = buildEventSnapshot(eventRow, participants);
  const nextEvent = buildNextEventPayload(eventRow, payload);

  assertUpdateHasChanges(nextEvent, eventRow);

  if (isOwner) {
    const updatedEvent = await updateEvent({
      eventId: eventRow.id,
      title: nextEvent.title,
      date: nextEvent.date,
      startTime: nextEvent.startTime,
      endTime: nextEvent.endTime,
      durationMinutes: nextEvent.durationMinutes,
      location: nextEvent.location,
      description: nextEvent.description,
      incrementVersion: true,
    });
    const updatedParticipants = await getParticipantsByEventId(eventId);
    const syncResult = await patchCalendarEventsForAcceptedParticipants(
      updatedParticipants,
      updatedEvent
    );

    return {
      success: true,
      resultType: "updated",
      message: "일정이 수정되었습니다.",
      event: updatedEvent,
      beforeSnapshot,
      afterSnapshot: buildEventSnapshot(updatedEvent, updatedParticipants),
      syncResult,
    };
  }

  const changeRequest = await createEventChangeRequest({
    eventId: eventRow.id,
    requesterUserId: savedUser.id,
    requestType: "update_proposal",
    requestStatus: "pending_creator_review",
    creatorDecisionStatus: "pending",
    sourceText: null,
    parsedPayload: {
      action: "structured_event_update",
      changeSet: nextEvent,
    },
    beforeSnapshot,
    afterSnapshot: {
      ...beforeSnapshot,
      ...nextEvent,
    },
  });

  return {
    success: true,
    resultType: "proposal_created",
    message: "수정 제안을 전송했습니다. 주최자가 승인하면 반영됩니다.",
    changeRequest,
  };
}

async function deleteEventDetail(session, eventId) {
  const { savedUser, eventRow, participants, isOwner } = await getEventContext(
    session,
    eventId
  );

  if (!isOwner) {
    const calendarResult = await deleteCalendarEventForUser(
      savedUser.id,
      eventRow.id
    ).catch((error) => ({
      success: false,
      reason: error.message,
    }));

    return {
      success: true,
      resultType: "hidden",
      message: "내 캘린더에서만 일정이 제거됩니다.",
      calendarResult,
    };
  }

  await assertNoActiveChangeRequestForEvent(eventId);
  assertNoPendingParticipantsForSharedMutation(participants, eventRow.creator_id);

  const beforeSnapshot = buildEventSnapshot(eventRow, participants);
  const acceptedParticipants = participants.filter(
    (participant) => participant.status === "accepted"
  );
  const otherAcceptedParticipants = acceptedParticipants.filter(
    (participant) => participant.user_id && participant.user_id !== savedUser.id
  );
  const resolvedAt = new Date().toISOString();

  let changeRequest = null;
  let targets = [];

  if (otherAcceptedParticipants.length > 0) {
    changeRequest = await createEventChangeRequest({
      eventId: eventRow.id,
      requesterUserId: savedUser.id,
      requestType: "delete_request",
      requestStatus: "completed",
      creatorDecisionStatus: "auto_approved",
      creatorDecidedAt: resolvedAt,
      sourceText: null,
      parsedPayload: {
        action: "structured_event_delete",
      },
      beforeSnapshot,
      afterSnapshot: null,
      resolvedAt,
    });

    targets = await createEventChangeRequestTargets(
      otherAcceptedParticipants.map((participant) => ({
        request_id: changeRequest.id,
        participant_id: participant.id,
        target_user_id: participant.user_id,
        decision_status: "accepted",
        decision_reason: "Delete notice delivered automatically.",
        decided_at: resolvedAt,
      }))
    );
  }

  const deletedEvent = await markEventDeleted(eventRow.id);
  const syncResult = await deleteCalendarEventsForAcceptedParticipants(
    acceptedParticipants
  );

  return {
    success: true,
    resultType: "deleted",
    message:
      otherAcceptedParticipants.length > 0
        ? "일정이 삭제되었고 참여자들에게 알림이 전달되었습니다."
        : "일정이 삭제되었습니다.",
    event: deletedEvent,
    changeRequest,
    targets,
    beforeSnapshot,
    syncResult,
  };
}

module.exports = {
  deleteEventDetail,
  updateEventDetail,
};
