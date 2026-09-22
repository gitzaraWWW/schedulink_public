const { createHttpError } = require("../utils/errors");
const {
  exchangeCodeForTokens,
  fetchGoogleUserProfile,
  getGoogleAuthUrl,
} = require("../integrations/googleClient");
const { saveCalendarSync } = require("../supabase");
const { syncSessionUser } = require("./sessionUserService");

function getLoginUrl() {
  return getGoogleAuthUrl();
}

async function handleGoogleCallback(code, session) {
  if (!code) {
    throw createHttpError(400, "Google OAuth code is missing.");
  }

  const { oauth2Client, tokens } = await exchangeCodeForTokens(code);
  const user = await fetchGoogleUserProfile(oauth2Client);

  session.user = {
    name: user.name,
    email: user.email,
    picture: user.picture,
  };
  session.tokens = tokens;

  try {
    const { savedUser } = await syncSessionUser(session);

    if (savedUser?.id && tokens?.access_token) {
      const calendarRow = await saveCalendarSync({
        userId: savedUser.id,
        tokens,
      });

      session.calendarSync = {
        success: true,
        message: "Stored Google Calendar tokens.",
        row: calendarRow,
      };
    }

    session.supabaseSync = {
      success: true,
      message: "Stored Google login user in Supabase.",
    };
  } catch (syncError) {
    console.error("Supabase user sync failed:", syncError.message);
    session.supabaseUser = null;
    session.supabaseSync = {
      success: false,
      message: syncError.message,
    };
    session.calendarSync = {
      success: false,
      message: syncError.message,
      row: null,
    };
  }
  return process.env.FRONTEND_URL;
}

module.exports = {
  getLoginUrl,
  handleGoogleCallback,
};
