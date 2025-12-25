const pool = require('../db');
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// 分页搜索论文、期刊、作者
router.get('/', authMiddleware, async (req, res) => {
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
      success: true,
      query: q,
      page,
      pageSize: limit,
      data: results
    });

  } catch (err) {
    console.error(err);
    res.status(500).json(
      { 
        success: false,
        error: 'Search failed' 
      });
  }
});

module.exports = router;