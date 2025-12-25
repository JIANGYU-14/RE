const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 路由挂载
app.use('/api/register', require('./routes/register'));
app.use('/api/login', require('./routes/login'));

app.use('/api/journals', require('./routes/journals'));
app.use('/api/papers', require('./routes/papers'));
app.use('/api/search', require('./routes/search'));

// 启动服务器
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
