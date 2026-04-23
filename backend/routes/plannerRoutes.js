// backend/routes/plannerRoutes.js
//
//   POST /api/planner/suggest
//   Body (optional): { userId, endDate }

import express from 'express';
import { generateSuggestions } from '../services/plannerService.js';

const router  = express.Router();
const DEFAULT = process.env.DEFAULT_USER_ID || 'moulika';

function uid(req) {
  return req.body?.userId || req.query.userId || DEFAULT;
}

router.post('/suggest', async (req, res) => {
  const endDate = req.body?.endDate || req.query.endDate;

  try {
    const suggestions = await generateSuggestions(uid(req), { endDate });
    return res.json({ ok: true, suggestions });
  } catch (err) {
    console.error('[POST /api/planner/suggest]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
