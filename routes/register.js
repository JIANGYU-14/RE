const pool = require('../db');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// 注册接口
router.post('/', async (req, res) => {
  const { inviteCode, username, password, phone } = req.body;

  if (!inviteCode || !username || !password || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
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
          error: 'Invalid invite code' 
        });
    }

    const invite = inviteResult.rows[0];

    if (invite.is_used) {
      return res.status(400).json(
        { 
          success: false,
          error: 'Invite code already used' 
        });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(400).json(
        { 
          success: false,
          error: 'Invite code expired' 
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
          error: 'Username already exists' 
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
          error: 'Phone number already registered' 
        });
    }

    // 4. 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 5. 创建用户
    const userResult = await pool.query(
      `
      INSERT INTO users (username, password_hash, phone)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [username, passwordHash, phone]
    );

    const userId = userResult.rows[0].id;

    // 5. 标记邀请码已使用
    await pool.query(
      `
      UPDATE invite_codes
      SET is_used = true,
          used_by = $1
      WHERE id = $2
      `,
      [userId, invite.id]
    );

    res.json({
      success: true,
      message: 'Register success' 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json(
      { 
        success: false,
        error: 'Register failed' 
      });
  }
});

module.exports = router;