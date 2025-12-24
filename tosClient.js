// 火山引擎 TOS 客户端
const { TosClient } = require('@volcengine/tos-sdk');

const client = new TosClient({
  accessKeyId: process.env.TOS_ACCESS_KEY,
  accessKeySecret: process.env.TOS_SECRET_KEY,
  region: process.env.TOS_REGION,
  endpoint: process.env.TOS_ENDPOINT
});

module.exports = client;

