const { google } = require("googleapis");

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getGoogleAuthUrl() {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  });
}

async function exchangeCodeForTokens(code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  return {
    oauth2Client,
    tokens,
  };
}

async function fetchGoogleUserProfile(oauth2Client) {
  const oauth2 = google.oauth2({
    auth: oauth2Client,
    version: "v2",
  });
  const response = await oauth2.userinfo.get();
  return response.data;
}

function getAuthorizedCalendar(tokens) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  return google.calendar({
    version: "v3",
    auth: oauth2Client,
  });
}

module.exports = {
  createOAuth2Client,
  exchangeCodeForTokens,
  fetchGoogleUserProfile,
  getAuthorizedCalendar,
  getGoogleAuthUrl,
};
