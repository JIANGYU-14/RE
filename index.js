const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./db');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 分页查询所有期刊
app.get('/api/journals', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 20;

    const limit = pageSize;
    const offset = (page - 1) * pageSize;

    // 1. 查数据
    const dataResult = await pool.query(
      `
      SELECT 
        id, 
        name, 
        subject, 
        description
      FROM journals
      ORDER BY impact_factor DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    // 2. 查总数
    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM journals
      `
    );

    res.json({
      page,
      pageSize,
      total: parseInt(countResult.rows[0].total, 10),
      list: dataResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch journals' });
  }
});

// 分页查询期刊下的所有论文
app.get('/api/journals/:journalId/papers', async (req, res) => {
  try {
    const { journalId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 20;

    const limit = pageSize;
    const offset = (page - 1) * pageSize;

    // 1. 查数据
    const dataResult = await pool.query(
      `
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
      LIMIT $2 OFFSET $3
      `, 
      [journalId, limit, offset]
    );

    // 2. 查总数
    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM papers
      WHERE journal_id = $1
      `,
      [journalId]
    );

    res.json({
      page,
      pageSize,
      total: parseInt(countResult.rows[0].total, 10),
      list: dataResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch papers' });
  }
});

// 分页搜索论文、期刊、作者
app.get('/api/search', async (req, res) => {
  const {
    q = '',
    type = 'all',
    page = 1,
    pageSize = 10
  } = req.query;

  const keyword = `%${q}%`;
  const limit = Number(pageSize);
  const offset = (page - 1) * limit;

  try {
    const results = {};

    if (type === 'journals' || type === 'all') {
      const journals = await pool.query(
        `
        SELECT id, name, subject, description
        FROM journals
        WHERE name ILIKE $1
        ORDER BY impact_factor DESC
        LIMIT $2 OFFSET $3
        `,
        [keyword, limit, offset]
      );
      results.journals = journals.rows;
    }

    if (type === 'papers' || type === 'all') {
      const papers = await pool.query(
        `
        SELECT id, title, abstract, authors, journal_id
        FROM papers
        WHERE title ILIKE $1
        ORDER BY publish_date DESC
        LIMIT $2 OFFSET $3
        `,
        [keyword, limit, offset]
      );
      results.papers = papers.rows;
    }

    if (type === 'authors' || type === 'all') {
      const authors = await pool.query(
        `
        SELECT id, title, authors
        FROM papers
        WHERE authors ILIKE $1
        ORDER BY publish_date DESC
        LIMIT $2 OFFSET $3
        `,
        [keyword, limit, offset]
      );
      results.authors = authors.rows;
    }

    res.json({
      query: q,
      page,
      pageSize: limit,
      data: results
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
