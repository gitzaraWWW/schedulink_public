const {
  getMentionProfileByUserId,
  getUserProfileById,
  searchMentionProfiles,
  updateUserProfileById,
  upsertMentionProfile,
} = require("../supabase");
const { createHttpError } = require("../utils/errors");
const {
  buildProfileChangeLimit,
  ensureSessionUser,
} = require("./sessionUserService");

const PROFILE_CHANGE_LIMIT = 2;
const PROFILE_CHANGE_WINDOW_DAYS = 30;
const PROFILE_CHANGE_WINDOW_MS =
  PROFILE_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const PROFILE_CHANGE_LIMIT_MESSAGE =
  "프로필은 최근 30일 동안 최대 2회까지 변경할 수 있습니다. 추가 변경이 필요한 경우 문의하기를 통해 요청해 주세요.";

function normalizeMentionLabel(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

function isSelfReference(value) {
  const normalized = normalizeMentionLabel(value);

  return ["me", "myself", "i", "self", "mine", "me-only"].includes(normalized);
}

async function findMentionProfileByLabel(label) {
  const normalizedLabel = normalizeMentionLabel(label);

  if (!normalizedLabel) {
    return null;
  }

  const candidates = await searchMentionProfiles(label);
  const exactMatches = candidates.filter((profile) => {
    return [profile.display_name, profile.nickname].some((value) => {
      return normalizeMentionLabel(value) === normalizedLabel;
    });
  });

  if (exactMatches.length !== 1) {
    return null;
  }

  const matchedProfile = exactMatches[0];

  if (!matchedProfile?.user_id) {
    return matchedProfile;
  }

  const matchedUser = await getUserProfileById(matchedProfile.user_id);
  return {
    ...matchedProfile,
    email: matchedUser?.email || matchedProfile.email || null,
  };
}

async function saveMentionProfile(session, input) {
  const savedUser = await ensureSessionUser(session);
  const currentUserProfile = await getUserProfileById(savedUser?.id);
  const currentMentionProfile =
    (await getMentionProfileByUserId(savedUser?.id).catch(() => null)) || null;
  const displayName =
    input?.displayName?.trim() ||
    currentMentionProfile?.display_name ||
    currentUserProfile?.name ||
    session.user?.name;
  const teamName =
    input?.teamName === undefined
      ? currentMentionProfile?.team_name || null
      : input.teamName?.trim() || null;
  const nickname =
    input?.nickname === undefined
      ? currentMentionProfile?.nickname || null
      : input.nickname?.trim() || null;
  const hasProfileChanges = Boolean(currentMentionProfile) && (
    currentMentionProfile.display_name !== displayName ||
    (currentMentionProfile.team_name || null) !== teamName ||
    (currentMentionProfile.nickname || null) !== nickname
  );

  let nextUserProfile = currentUserProfile;

  if (hasProfileChanges) {
    const currentCount = Number(currentUserProfile?.profile_change_count || 0);
    const currentStartedAt = currentUserProfile?.profile_change_started_at || null;
    const now = new Date();
    const windowExpired =
      !currentStartedAt ||
      now.getTime() - new Date(currentStartedAt).getTime() >=
        PROFILE_CHANGE_WINDOW_MS;

    if (!windowExpired && currentCount >= PROFILE_CHANGE_LIMIT) {
      throw createHttpError(409, PROFILE_CHANGE_LIMIT_MESSAGE, {
        code: "PROFILE_CHANGE_LIMIT_EXCEEDED",
      });
    }

    const userProfilePayload = {
      profile_change_count: windowExpired ? 1 : currentCount + 1,
      profile_change_started_at: windowExpired
        ? now.toISOString()
        : currentStartedAt,
    };

    if (currentUserProfile?.name !== displayName) {
      userProfilePayload.name = displayName;
    }

    nextUserProfile = await updateUserProfileById(
      savedUser?.id,
      userProfilePayload
    );
  } else if (currentUserProfile?.name !== displayName) {
    nextUserProfile = await updateUserProfileById(savedUser?.id, {
      name: displayName,
    });
  }

  const mentionProfile = await upsertMentionProfile({
    userId: savedUser?.id,
    displayName,
    teamName,
    nickname,
  });

  session.supabaseUser = nextUserProfile;
  session.mentionProfile = mentionProfile;
  return {
    mentionProfile,
    profileChangeLimit: buildProfileChangeLimit(nextUserProfile),
  };
}

async function hydrateMentionEmails(selectedMentions = []) {
  return Promise.all(
    selectedMentions.map(async (profile) => {
      if (!profile?.user_id) {
        return profile;
      }

      const matchedUser = await getUserProfileById(profile.user_id);
      return {
        ...profile,
        email: matchedUser?.email || profile.email || null,
      };
    })
  );
}

module.exports = {
  findMentionProfileByLabel,
  hydrateMentionEmails,
  isSelfReference,
  normalizeMentionLabel,
  saveMentionProfile,
};
