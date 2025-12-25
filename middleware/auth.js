const jwt = require('jsonwebtoken');

// 认证中间件
module.exports = function auth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json(
      { 
        success: false,
        error: 'No token' 
      });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json(
      { 
        success: false,
        error: 'Invalid token' 
      });
  }
};