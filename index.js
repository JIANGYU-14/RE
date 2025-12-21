const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello from re_local_api!');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
