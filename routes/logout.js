const express = require('express');
const router = express.Router();

// 退出登录接口
router.post('/', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax'
  });

  res.json({
    success: true,
    message: 'LOGOUT_SUCCESS'
  });
});

module.exports = router;