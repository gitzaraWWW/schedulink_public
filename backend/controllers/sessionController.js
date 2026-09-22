const { buildSessionPayload } = require("../services/sessionUserService");

function getMe(req, res) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Login session is not active.",
    });
  }

  return res.json(buildSessionPayload(req.session));
}

function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({
      success: true,
      message: "Logged out successfully.",
    });
  });
}

module.exports = {
  getMe,
  logout,
};
