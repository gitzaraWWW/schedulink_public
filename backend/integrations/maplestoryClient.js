const DEFAULT_MAPLESTORY_EVENTS_API_URL =
  process.env.MAPLESTORY_EVENTS_API_URL || "https://open.api.nexon.com/maplestory/v1/notice-event";

function getMaplestoryApiConfig() {
  return {
    apiKey: process.env.NEXON_OPEN_API_KEY || "",
    eventsApiUrl: DEFAULT_MAPLESTORY_EVENTS_API_URL,
  };
}

function requireMaplestoryApiConfig() {
  const config = getMaplestoryApiConfig();

  if (!config.apiKey) {
    throw new Error("NEXON_OPEN_API_KEY is not configured.");
  }

  if (!config.eventsApiUrl) {
    throw new Error("MAPLESTORY_EVENTS_API_URL is not configured.");
  }

  return config;
}

function parseJsonResponse(responseText) {
  try {
    return responseText ? JSON.parse(responseText) : null;
  } catch {
    return null;
  }
}

async function fetchMaplestoryOngoingEvents() {
  const { apiKey, eventsApiUrl } = requireMaplestoryApiConfig();
  const response = await fetch(eventsApiUrl, {
    method: "GET",
    headers: {
      "x-nxopen-api-key": apiKey,
    },
  });
  const rawText = await response.text();
  const data = parseJsonResponse(rawText);

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error?.message || "Failed to load MapleStory events."
    );
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

module.exports = {
  fetchMaplestoryOngoingEvents,
  getMaplestoryApiConfig,
  requireMaplestoryApiConfig,
};
