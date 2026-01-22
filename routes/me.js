const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const pool = require('../db');

// 当前登录用户信息
router.get('/', authMiddleware, async (req, res) => {
  try {
    const internalId = req.user.id;

    const result = await pool.query(
      `
      SELECT id, username, phone, last_login_at, user_id
      FROM users
      WHERE id = $1
      `,
      [internalId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: 'USER_INFO_FETCH_FAILED'
    });
  }
});

module.exports = router;
