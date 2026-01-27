const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Python Agent Backend 基础地址
const AGENT_BASE_URL = process.env.AGENT_BACKEND_URL; 

const agentClient = axios.create({
  baseURL: AGENT_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 创建会话
router.post('/sessions', authMiddleware, async (req, res) => {
  try {
    const user_id  = req.user.user_id;

    const resp = await agentClient.post('/paperapi/sessions', {
      user_id
    });

    res.json({
      success: true,
      data: resp.data
    });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({
      success: false,
      error: 'AGENT_SESSION_CREATE_FAILED'
    });
  }
});

// 获取用户会话列表
router.get('/sessions/list', authMiddleware, async (req, res) => {
  try {
    const { user_id } = req.user;

    const resp = await agentClient.get('/paperapi/sessions/list', {
      params: { user_id }
    });

    res.json({
      success: true,
      data: resp.data
    });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({
      success: false,
      error: 'AGENT_SESSION_LIST_FAILED'
    });
  }
});

// 发送消息对话
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { session_id, text } = req.body;

    if (!session_id || !text) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const resp = await agentClient.post('/paperapi/chat', {
      session_id,
      text
    });

    res.json({
      success: true,
      data: resp.data
    });
  } catch (err) {
    console.error(err.response?.data || err);

    if (err.response?.status === 504) {
      return res.status(504).json({
        success: false,
        error: 'AGENT_TIMEOUT'
      });
    }

    res.status(500).json({
      success: false,
      error: 'AGENT_CHAT_FAILED'
    });
  }
});

// 获取会话消息历史
router.get('/sessions/:sessionId/messages', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const resp = await agentClient.get(
      `/paperapi/sessions/${sessionId}/messages`
    );

    res.json({
      success: true,
      data: resp.data
    });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({
      success: false,
      error: 'AGENT_HISTORY_FETCH_FAILED'
    });
  }
});

router.agentClient = agentClient;
module.exports = router;