const pool = require('../db');
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// 分页 + 关键词查询期刊
router.get('/', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 20;
    const keyword = req.query.keyword?.trim() || '';

    const limit = pageSize;
    const offset = (page - 1) * pageSize;

    // 是否启用关键词过滤
    const hasKeyword = keyword.length > 0;

    // 1. 查数据
    const dataResult = await pool.query(
      `
      SELECT 
        id,
        name,
        subject,
        description,
        impact_factor
      FROM journals
      ${hasKeyword ? `
        WHERE
          name ILIKE $3
          OR subject ILIKE $3
          OR description ILIKE $3
      ` : ''}
      ORDER BY impact_factor DESC
      LIMIT $1 OFFSET $2
      `,
      hasKeyword
        ? [limit, offset, `%${keyword}%`]
        : [limit, offset]
    );

    // 2. 查总数
    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM journals
      ${hasKeyword ? `
        WHERE
          name ILIKE $1
          OR subject ILIKE $1
          OR description ILIKE $1
      ` : ''}
      `,
      hasKeyword ? [`%${keyword}%`] : []
    );

    res.json({
      success: true,
      page,
      pageSize,
      total: parseInt(countResult.rows[0].total, 10),
      list: dataResult.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: 'JOURNAL_LIST_FETCH_FAILED'
    });
  }
});

// 分页查询期刊下的所有论文
router.get('/:journalId/papers', authMiddleware, async (req, res) => {
  try {
    const { journalId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 20;

    const limit = pageSize;
    const offset = (page - 1) * pageSize;

    // 1. 查期刊下的文献信息
    const dataResult = await pool.query(
      `
      SELECT
        p.id,
        p.title,
        p.authors,
        p.abstract,
        p.volume,
        p.issue,
        p.doi,
        p.keywords,
        p.publish_date,
        j.name AS journal_name
      FROM papers_temp p
      JOIN journals j
        ON p.journal_id = j.id
      WHERE p.journal_id = $1
        AND p.is_delete = false
      ORDER BY p.publish_date DESC
      LIMIT $2 OFFSET $3
      `,
      [journalId, limit, offset]
    );

    // 2. 查期刊下的文献总数
    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM papers_temp
      WHERE journal_id = $1
      `,
      [journalId]
    );

    // 3. 查期刊的基本信息
    const journalInfoResult = await pool.query(
      `
      SELECT
        name,
        description,
        publisher,
        issn,
        subject,
        homepage_url,
        impact_factor
      FROM journals
      WHERE id = $1
      `,
      [journalId]
    );

    const journalInfo = journalInfoResult.rows[0];

    // 返回响应
    res.json({
      success: true,
      page,
      pageSize,
      total: parseInt(countResult.rows[0].total, 10),
      journal: journalInfo, // 期刊信息
      papers: dataResult.rows // 论文列表
    });
  } catch (err) {
    console.error(err);
    res.status(500).json(
      { 
        success: false,
        error: 'PAPER_LIST_FETCH_FAILED' 
      });
  }
});

module.exports = router;