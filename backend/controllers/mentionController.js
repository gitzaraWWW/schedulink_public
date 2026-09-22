const {
  getMentionProfileByUserId,
  getMentionProfilesByTeamName,
  searchMentionProfiles,
  searchMentionTeams,
} = require("../supabase");
const { ensureSessionUser } = require("../services/sessionUserService");
const mentionService = require("../services/mentionService");

async function saveMentionProfile(req, res) {
  try {
    const { mentionProfile, profileChangeLimit } =
      await mentionService.saveMentionProfile(
      req.session,
      req.body
    );

    return res.json({
      success: true,
      message: "프로필이 저장되었습니다.",
      mentionProfile,
      profileChangeLimit,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to save mention profile.",
    });
  }
}

async function searchMentions(req, res) {
  try {
    const query = req.query.q || "";
    const sessionUser = await ensureSessionUser(req.session);
    const currentMentionProfile =
      (await getMentionProfileByUserId(sessionUser?.id).catch(() => null)) || null;
    const [results, teams] = await Promise.all([
      searchMentionProfiles(query),
      searchMentionTeams(query),
    ]);
    const normalizedCurrentTeamName = String(
      currentMentionProfile?.team_name || ""
    )
      .trim()
      .toLowerCase();
    const visibleTeams = teams
      .map((team) => {
        const normalizedTeamName = String(team?.name || "")
          .trim()
          .toLowerCase();
        const shouldExcludeSelf =
          normalizedCurrentTeamName &&
          normalizedCurrentTeamName === normalizedTeamName;

        return {
          ...team,
          memberCount: Math.max(
            0,
            Number(team?.memberCount || 0) - (shouldExcludeSelf ? 1 : 0)
          ),
        };
      })
      .filter((team) => team.memberCount > 0);

    return res.json({
      success: true,
      query,
      count: results.length,
      results,
      teams: visibleTeams,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to search mentions.",
      results: [],
      teams: [],
    });
  }
}

async function getTeamMembers(req, res) {
  try {
    const teamName = req.query.team || "";
    const sessionUser = await ensureSessionUser(req.session);
    const members = await getMentionProfilesByTeamName(teamName, {
      excludeUserId: sessionUser?.id,
    });

    return res.json({
      success: true,
      teamName,
      count: members.length,
      members,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load team members.",
      teamName: req.query.team || "",
      members: [],
    });
  }
}

module.exports = {
  getTeamMembers,
  saveMentionProfile,
  searchMentions,
};
