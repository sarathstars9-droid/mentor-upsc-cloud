// backend/routes/reportRoutes.js
//
//   GET /api/reports/daily?date=YYYY-MM-DD
//   GET /api/reports/weekly?endDate=YYYY-MM-DD
//   GET /api/reports/monthly?month=YYYY-MM

import express from 'express';
import { getDailyReport, getWeeklyReport, getMonthlyReport } from '../services/reportService.js';

const router  = express.Router();
const DEFAULT = process.env.DEFAULT_USER_ID || 'moulika';

function uid(req) {
  return req.query.userId || req.body?.userId || DEFAULT;
}

// ── GET /api/reports/daily ────────────────────────────────────────────────────

router.get('/daily', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, message: 'date must be YYYY-MM-DD' });
  }

  try {
    const report = await getDailyReport(uid(req), date);
    return res.json({ ok: true, report });
  } catch (err) {
    console.error('[GET /api/reports/daily]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── GET /api/reports/weekly ───────────────────────────────────────────────────

router.get('/weekly', async (req, res) => {
  const endDate = req.query.endDate || new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return res.status(400).json({ ok: false, message: 'endDate must be YYYY-MM-DD' });
  }

  try {
    const report = await getWeeklyReport(uid(req), endDate);
    return res.json({ ok: true, report });
  } catch (err) {
    console.error('[GET /api/reports/weekly]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── GET /api/reports/monthly ──────────────────────────────────────────────────

router.get('/monthly', async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ ok: false, message: 'month must be YYYY-MM' });
  }

  try {
    const report = await getMonthlyReport(uid(req), month);
    return res.json({ ok: true, report });
  } catch (err) {
    console.error('[GET /api/reports/monthly]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
