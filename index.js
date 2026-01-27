const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'http://www.xiyaokeji.cn',
    'https://www.xiyaokeji.cn'
  ],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// 路由挂载
app.use('/api/register', require('./routes/register'));
app.use('/api/login', require('./routes/login'));
app.use('/api/logout', require('./routes/logout'));
app.use('/api/me', require('./routes/me'));

app.use('/api/journals', require('./routes/journals'));
app.use('/api/papers', require('./routes/papers'));
app.use('/api/search', require('./routes/search'));

app.use('/api/agent', require('./routes/agent'));

// 启动服务器
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
