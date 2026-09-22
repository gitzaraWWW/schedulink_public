const lucidService = require("../services/lucidService");

async function query(req, res) {
  try {
    const payload = await lucidService.answerLucidQuery(
      req.session,
      req.body?.text
    );
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      mode: "lucid",
      message: error.message || "캘린더 조회에 실패했습니다.",
    });
  }
}

module.exports = {
  query,
};
