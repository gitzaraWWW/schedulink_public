const {
  isSupabaseConfigured,
  upsertMentionProfile,
  upsertUserProfile,
} = require("../supabase");
const { createHttpError } = require("../utils/errors");

const PROFILE_CHANGE_LIMIT = 2;
const PROFILE_CHANGE_WINDOW_DAYS = 30;
const PROFILE_CHANGE_WINDOW_MS =
  PROFILE_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

async function syncSessionUser(session) {
  if (!session?.user) {
    throw createHttpError(401, "로그인이 필요합니다.");
  }

  const savedUser = await upsertUserProfile(session.user);
  const mentionProfile = await upsertMentionProfile({
    userId: savedUser?.id,
    displayName: savedUser?.name || session.user?.name,
  });

  session.supabaseUser = savedUser;
  session.mentionProfile = mentionProfile;

  return {
    savedUser,
    mentionProfile,
  };
}

async function ensureSessionUser(session) {
  if (!session?.user) {
    throw createHttpError(401, "로그인이 필요합니다.");
  }

  if (session.supabaseUser && session.mentionProfile) {
    return session.supabaseUser;
  }

  const { savedUser } = await syncSessionUser(session);
  return savedUser;
}

function buildProfileChangeLimit(userProfile) {
  const startedAt = userProfile?.profile_change_started_at || null;
  const count = Number(userProfile?.profile_change_count || 0);

  if (!startedAt) {
    return {
      maxChanges: PROFILE_CHANGE_LIMIT,
      windowDays: PROFILE_CHANGE_WINDOW_DAYS,
      usedChanges: 0,
      remainingChanges: PROFILE_CHANGE_LIMIT,
      startedAt: null,
      nextResetAt: null,
    };
  }

  const startedTime = new Date(startedAt).getTime();

  if (!Number.isFinite(startedTime)) {
    return {
      maxChanges: PROFILE_CHANGE_LIMIT,
      windowDays: PROFILE_CHANGE_WINDOW_DAYS,
      usedChanges: 0,
      remainingChanges: PROFILE_CHANGE_LIMIT,
      startedAt: null,
      nextResetAt: null,
    };
  }

  const nextResetTime = startedTime + PROFILE_CHANGE_WINDOW_MS;

  if (Date.now() >= nextResetTime) {
    return {
      maxChanges: PROFILE_CHANGE_LIMIT,
      windowDays: PROFILE_CHANGE_WINDOW_DAYS,
      usedChanges: 0,
      remainingChanges: PROFILE_CHANGE_LIMIT,
      startedAt: null,
      nextResetAt: null,
    };
  }

  return {
    maxChanges: PROFILE_CHANGE_LIMIT,
    windowDays: PROFILE_CHANGE_WINDOW_DAYS,
    usedChanges: Math.min(PROFILE_CHANGE_LIMIT, Math.max(0, count)),
    remainingChanges: Math.max(0, PROFILE_CHANGE_LIMIT - count),
    startedAt,
    nextResetAt: new Date(nextResetTime).toISOString(),
  };
}

function buildSessionPayload(session) {
  return {
    success: true,
    user: session.user,
    supabaseConfigured: isSupabaseConfigured(),
    supabaseSync: session.supabaseSync || null,
    supabaseUser: session.supabaseUser || null,
    mentionProfile: session.mentionProfile || null,
    profileChangeLimit: buildProfileChangeLimit(session.supabaseUser || null),
    calendarSync: session.calendarSync || null,
    eventSync: session.eventSync || null,
    participantSync: session.participantSync || null,
    invitationSync: session.invitationSync || null,
  };
}

module.exports = {
  buildSessionPayload,
  buildProfileChangeLimit,
  ensureSessionUser,
  syncSessionUser,
};
