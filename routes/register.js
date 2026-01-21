const pool = require('../db');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// 注册接口
router.post('/', async (req, res) => {
  const { inviteCode, username, password, phone } = req.body;

  if (!inviteCode || !username || !password || !phone) {
    return res.status(400).json(
      { 
        success: false,
        error: 'MISSING_REQUIRED_FIELDS' 
      });
  }

  try {
    // 1. 校验邀请码
    const inviteResult = await pool.query(
      `
      SELECT id, is_used, expired_at
      FROM invite_codes
      WHERE code = $1
      `,
      [inviteCode]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(400).json(
        { 
          success: false,
          error: 'INVALID_INVITE_CODE' 
        });
    }

    const invite = inviteResult.rows[0];

    if (invite.is_used) {
      return res.status(400).json(
        { 
          success: false,
          error: 'INVITE_CODE_ALREADY_USED' 
        });
    }

    if (invite.expired_at && new Date(invite.expired_at) < new Date()) {
      return res.status(400).json(
        { 
          success: false,
          error: 'INVITE_CODE_EXPIRED' 
        });
    }

    // 2. 校验用户名是否存在
    const userExist = await pool.query(
      `SELECT id FROM users WHERE username = $1`,
      [username]
    );

    if (userExist.rows.length > 0) {
      return res.status(400).json(
        { 
          success: false,
          error: 'USERNAME_ALREADY_EXISTS' 
        });
    }

    // 3. 校验手机号是否注册过
    const phoneExist = await pool.query(
      `SELECT id FROM users WHERE phone = $1`,
      [phone]
    );

    if (phoneExist.rows.length > 0) {
      return res.status(400).json(
        { 
          success: false,
          error: 'PHONE_ALREADY_REGISTERED' 
        });
    }

    // 4. 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 5. 生成业务 user_id（保证唯一）
    let userId;
    while (true) {
      userId = generateUserId();
      const check = await pool.query(
        `SELECT id FROM users WHERE user_id = $1`,
        [userId]
      );
      if (check.rows.length === 0) break;
    }

    // 6. 创建用户
    const userResult = await pool.query(
      `
      INSERT INTO users (user_id, username, password_hash, phone)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id
      `,
      [userId, username, passwordHash, phone]
    );

    const internalId = userResult.rows[0].id;

    // 7. 标记邀请码已使用
    await pool.query(
      `
      UPDATE invite_codes
      SET is_used = true,
          used_by = $1
      WHERE id = $2
      `,
      [internalId, invite.id]
    );

    res.json({
      success: true,
      message: 'REGISTER_SUCCESS' 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json(
      { 
        success: false,
        error: 'REGISTER_FAILED' 
      });
  }
});

// 生成 8 位小写字母 + 数字的 user_id
function generateUserId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

module.exports = router;