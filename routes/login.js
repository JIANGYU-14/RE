const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const express = require('express');
const router = express.Router();

// 登录接口
router.post('/', async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json(
      { 
        success: false,
        error: 'PHONE_PASSWORD_REQUIRED' 
      });
  }

  try {
    // 1. 查询用户
    const result = await pool.query(
      `
      SELECT id, phone, password_hash, user_id
      FROM users
      WHERE phone = $1
      `,
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(401).json(
        { 
          success: false,
          error: 'PHONE_NOT_REGISTERED' 
        });
    }

    const user = result.rows[0];

    // 2. 校验密码
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json(
        { 
          success: false,
          error: 'INCORRECT_PASSWORD' 
        });
    }

    // 3. 更新最后登录时间
    await pool.query(
      `
      UPDATE users
      SET lastlogin_at = NOW()
      WHERE id = $1
      `,
      [user.id]
    );

    // 4. 生成 JWT
    const token = jwt.sign(
      {  
        phone: user.phone, 
        user_id: user.user_id
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '1d' 
      }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true, 
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json(
    {
      success: true,
      message: 'LOGIN_SUCCESS',
      data: {
        user_id: user.user_id
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json(
      { 
        success: false,
        error: 'LOGIN_FAILED' 
      });
  }
});

module.exports = router;