const pool = require('../db');
const tosClient = require('../tosClient');
const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// 查询单篇论文详情
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
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
      FROM papers_temp
      WHERE id = $1 AND is_delete = false
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'PAPER_NOT_FOUND'
      });
    }

    const paper = result.rows[0];

    res.json({
      success: true,
      data: {
        id: paper.id,
        title: paper.title,
        authors: paper.authors,
        abstract: paper.abstract,
        volume: paper.volume,
        issue: paper.issue,
        doi: paper.doi,
        keywords: paper.keywords,
        publish_date: paper.publish_date
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: 'PAPER_DETAIL_FETCH_FAILED'
    });
  }
});

// 查询单篇论文的下载链接
router.get('/:id/pdf-url', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    // 只查 pdf_tos_path
    const result = await pool.query(
      `
      SELECT pdf_tos_path
      FROM papers_temp
      WHERE id = $1 AND is_delete = false
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'PAPER_NOT_FOUND'
      });
    }

    const { pdf_tos_path } = result.rows[0];

    if (!pdf_tos_path) {
      return res.status(400).json({
        success: false,
        error: 'PDF_NOT_AVAILABLE'
      });
    }

    // 生成 TOS 临时访问链接（10 分钟）
    const signedUrl = await tosClient.getPreSignedUrl({
      bucket: process.env.TOS_BUCKET,
      key: pdf_tos_path,
      expires: 600
    });

    res.json({
      success: true,
      data: {
        pdf_url: signedUrl,
        expires_in: 600
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: 'PDF_URL_GENERATE_FAILED'
    });
  }
});

module.exports = router;