const { parseScheduleText } = require("../scheduleParser");

function testOpenAI(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      message: "OPENAI_API_KEY is not configured.",
    });
  }

  return res.json({
    success: true,
    message: "OpenAI API is reachable.",
  });
}

async function parseText(req, res) {
  try {
    const result = await parseScheduleText(req.body?.text);
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("AI parse failed:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to parse natural language.",
      parsed: error.parsed || null,
    });
  }
}

module.exports = {
  parseText,
  testOpenAI,
};
