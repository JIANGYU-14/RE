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

/**
 * 日志辅助函数
 * 统一格式：[时间] [模块] [等级] [请求ID] 消息内容
 */
const log = (level, requestId, message, context = '') => {
  const ctxString = typeof context === 'object' ? JSON.stringify(context) : context;
  console.log(`[NODE-${level}] [Req:${requestId}] ${message} ${ctxString}`);
};

// ---------- 1. 创建会话 ----------
router.post('/sessions', authMiddleware, async (req, res) => {
  const requestId = `sess_${Date.now().toString().slice(-6)}`;
  const { user_id } = req.user;

  log('INFO', requestId, `Attempting to create session for user: ${user_id}`);

  try {
    const resp = await agentClient.post('/paperapi/sessions', { user_id });
    log('INFO', requestId, `Session created successfully via Python.`);
    res.json({
      success: true,
      data: resp.data
    });
  } catch (err) {
    if (err.response) {
      log('ERROR', requestId, `Python rejected session creation. Status: ${err.response.status}`, err.response.data);
    } else {
      log('ERROR', requestId, `Failed to reach Python backend: ${err.message}`);
    }
    res.status(500).json({
      success: false,
      error: 'AGENT_SESSION_CREATE_FAILED'
    });
  }
});

// ---------- 2. 获取用户会话列表 ----------
router.get('/sessions/list', authMiddleware, async (req, res) => {
  const requestId = `list_${Date.now().toString().slice(-6)}`;
  const { user_id } = req.user;

  log('INFO', requestId, `Fetching sessions for user: ${user_id}`);

  try {
    const resp = await agentClient.get('/paperapi/sessions/list', {
      params: { user_id }
    });
    log('INFO', requestId, `Successfully retrieved ${resp.data?.length || 0} sessions.`);
    res.json({
      success: true,
      data: resp.data
    });
  } catch (err) {
    log('ERROR', requestId, `Fetch session list failed: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'AGENT_SESSION_LIST_FAILED'
    });
  }
});

// ---------- 3. 修改会话标题 (PATCH) ----------
router.patch('/sessions/:sessionId/title', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;
  const { title } = req.body;
  const requestId = `ren_${Date.now().toString().slice(-6)}`;

  log('INFO', requestId, `Attempting to rename session ${sessionId} to: ${title}`);

  try {
    // 转发请求到 Python 后端
    const resp = await agentClient.patch(`/paperapi/sessions/${sessionId}/title`, { title });
    
    res.json({
      success: true,
      data: resp.data
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const errorData = err.response?.data || err.message;
    log('ERROR', requestId, `Rename session failed. Status: ${status}`, errorData);
    
    res.status(status).json({
      success: false,
      error: 'AGENT_SESSION_RENAME_FAILED',
      detail: errorData
    });
  }
});

// ---------- 4. 删除会话 (DELETE) ----------
router.delete('/sessions/:sessionId', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;
  const { hard } = req.query; // 从 URL query 中获取 ?hard=true
  const requestId = `del_${Date.now().toString().slice(-6)}`;

  log('INFO', requestId, `Attempting to delete session ${sessionId} (hard=${hard})`);

  try {
    // 转发请求到 Python 后端，注意 query 参数的传递方式
    const resp = await agentClient.delete(`/paperapi/sessions/${sessionId}`, {
      params: { hard: hard === 'true' } 
    });

    res.json({
      success: true,
      data: resp.data
    });
  } catch (err) {
    const status = err.response?.status || 500;
    log('ERROR', requestId, `Delete session failed: ${err.message}`);
    
    res.status(status).json({
      success: false,
      error: 'AGENT_SESSION_DELETE_FAILED'
    });
  }
});

// ---------- 5. 发送消息对话 (流式核心) ----------
router.post('/chat', authMiddleware, async (req, res) => {
  const requestId = `chat_${Date.now().toString().slice(-6)}`;
  const { sessionId, text } = req.body;

  log('INFO', requestId, `Chat request received. Session: ${sessionId}, Text: "${text.substring(0, 20)}..."`);

  if (!sessionId || !text) {
    log('WARN', requestId, `Validation failed: Missing sessionId or text.`);
    return res.status(400).json({ success: false, error: 'MISSING_REQUIRED_FIELDS' });
  }

  try {
    // 1. 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // 禁用 Nginx 缓存（如果前端还经过了一层 Nginx）
    res.setHeader('X-Accel-Buffering', 'no');

    log('INFO', requestId, `Forwarding stream request to Python at: ${AGENT_BASE_URL}/paperapi/chat`);

    // 2. 向 Python 发起请求
    const response = await agentClient.post('/paperapi/chat', {
      sessionId,
      text
    }, {
      responseType: 'stream' // 必须是 stream
    });

    log('INFO', requestId, `Python connection established. Status: ${response.status}. Starting pipe.`);

    // 3. 将 Python 响应流管道传输至前端 res
    response.data.pipe(res);

    // 4. 事件监听
    response.data.on('end', () => {
      log('INFO', requestId, `Stream pipe completed successfully.`);
    });

    response.data.on('error', (err) => {
      log('ERROR', requestId, `Data stream error during transmission: ${err.message}`);
      if (!res.writableEnded) res.end();
    });

    // 监听客户端断开
    req.on('close', () => {
      log('WARN', requestId, `Client connection closed (browser refresh/close). Aborting Python stream.`);
      response.data.destroy(); // 销毁流，防止 Node 内存泄漏并释放 Python 连接
    });

  } catch (err) {
    // 区分错误来源
    if (err.response) {
      // Python 返回了错误（例如 404, 422, 500）
      log('ERROR', requestId, `Python Backend Error Status: ${err.response.status}`);
      // 注意：当 responseType 为 stream 时，err.response.data 也是流，无法直接 console.log JSON
    } else if (err.request) {
      // 请求发出了但 Python 没理（超时、端口未开放、直连地址写错）
      log('ERROR', requestId, `No response from Python backend. Is ${AGENT_BASE_URL} reachable?`);
    } else {
      // Node.js 代码本身逻辑错误
      log('ERROR', requestId, `Node internal error: ${err.message}`);
    }

    if (!res.headersSent) {
      res.status(500).write(`data: ${JSON.stringify({ type: 'error', content: 'AGENT_CHAT_FAILED' })}\n\n`);
      res.end();
    } else {
      res.end();
    }
  }
});

// ---------- 6. 获取会话消息历史 ----------
router.get('/sessions/:sessionId/messages', authMiddleware, async (req, res) => {
  const requestId = `hist_${Date.now().toString().slice(-6)}`;
  const { sessionId } = req.params;

  log('INFO', requestId, `Fetching history for session: ${sessionId}`);

  try {
    const resp = await agentClient.get(`/paperapi/sessions/${sessionId}/messages`);
    log('INFO', requestId, `Successfully fetched history.`);
    res.json({
      success: true,
      data: resp.data
    });
  } catch (err) {
    log('ERROR', requestId, `Fetch history failed: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'AGENT_HISTORY_FETCH_FAILED'
    });
  }
});

router.agentClient = agentClient;
module.exports = router;