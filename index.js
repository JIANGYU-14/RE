const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db');

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

app.get('/api/journals', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, subject, description
      FROM journals
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch journals' });
  }
});

app.get('/api/journals/:journalId/papers', async (req, res) => {
  const { journalId } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        authors,
        abstract,
        volume,
        issue,
        doi,
        keywords,
        publish_date
      FROM papers
      WHERE journal_id = $1
      ORDER BY publish_date DESC
    `, [journalId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch papers' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
