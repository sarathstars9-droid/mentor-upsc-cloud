/**
 * blockResolveRoute.js
 * Isolated API route for plan-block classification.
 *
 * POST /api/blocks/resolve
 *   Body : { "input": "polity revision" }
 *   Returns the full BlockResolution object from resolveBlock().
 *
 * This route is ONLY for block classification.
 * It does NOT touch PYQ engines, CSAT logic, prelims builders, or analytics.
 */

import express from 'express';
import { resolveBlock } from '../blockResolution/resolveBlock.js';

const router = express.Router();

router.post('/resolve', (req, res) => {
  try {
    const { input, minutes } = req.body ?? {};

    if (!input || typeof input !== 'string' || !input.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'input is required and must be a non-empty string',
      });
    }

    const opts = {};
    if (typeof minutes === 'number' && minutes > 0) opts.minutes = minutes;

    const result = resolveBlock(input.trim(), opts);
    return res.json({ ok: true, ...result });

  } catch (err) {
    console.error('[BlockResolve] Error resolving block:', err);
    return res.status(500).json({
      ok: false,
      error: 'Failed to resolve block',
    });
  }
});

export default router;
