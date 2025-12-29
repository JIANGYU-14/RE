const pool = require('../db');
const tosClient = require('../tosClient');
const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// 查询单篇论文详情 
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    // 1. 查 paper
    const result = await pool.query(
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
        publish_date,
        pdf_tos_path
      FROM papers
      WHERE id = $1 AND is_delete = false
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(
        { 
          success: false,
          error: 'PAPER_NOT_FOUND' 
        });
    }

    const paper = result.rows[0];

    // 2. 生成 TOS 限时访问 URL（10 分钟）
    const signedUrl = await tosClient.getPreSignedUrl({
      bucket: process.env.TOS_BUCKET,
      key: paper.pdf_tos_path,
      expires: 600   // 秒
    });

    // 3. 返回
    res.json({
      success: true,
      ...paper,
      pdf_url: signedUrl
    });

  } catch (err) {
    console.error(err);
    res.status(500).json(
      { 
        success: false,
        error: 'PAPER_DETAIL_FETCH_FAILED' 
      });
  }
});

module.exports = router;