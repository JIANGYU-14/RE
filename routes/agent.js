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
      return res.status(400).json({ success: false, error: 'MISSING_REQUIRED_FIELDS' });
    }

    // 1. 设置响应头，告知前端这是一个 SSE 流
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 2. 发起请求，注意 responseType 必须为 'stream'
    const response = await agentClient.post('/paperapi/chat', {
      session_id,
      text
    }, {
      responseType: 'stream' 
    });

    // 3. 将 Python 接口的流直接管道传输给前端 res
    response.data.pipe(res);

    // 4. 监听结束和错误
    response.data.on('error', (err) => {
      console.error('Stream error:', err);
      res.end();
    });

  } catch (err) {
    console.error('Chat error:', err.message);
    
    // 如果还没开始发送流，可以返回 JSON 错误
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'AGENT_CHAT_FAILED' });
    } else {
      // 如果流已经开始了，只能强制关闭
      res.end();
    }
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