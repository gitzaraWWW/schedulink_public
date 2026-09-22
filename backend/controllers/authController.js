// services에 인증 관련 로직이 있으니까 거기서 가져와서 시작
const authService = require("../services/authService");

// 사용자를 google 로그인 페이지로 보내는 역할
function redirectToGoogle(req, res) { // req 요청 res 답장 redirect 이동
  //service에게 google로그인 url을 요청한 후, 즉시 이동 시킴
  res.redirect(authService.getLoginUrl());
}

// google 로그인 후 돌아오는 콜백 요청을 처리하는 역할,
// 비동기(답장 오기전까진 스탑)작업 이니까 async 사용
async function handleGoogleCallback(req, res) {
  try {
    //auth.service가 해결한 뒤 이동할 url 받기 (로그인하고 돌아갈 프론트엔드)
    const redirectUrl = await authService.handleGoogleCallback(
      req.query.code,
      req.session
    );
    // 로그인 끝나면 이동
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Google login failed:", error.message);
    res.status(error.status || 500).send(
      error.message || "An error occurred during Google login."
    );
  }
}

module.exports = {
  handleGoogleCallback,
  redirectToGoogle,
};
