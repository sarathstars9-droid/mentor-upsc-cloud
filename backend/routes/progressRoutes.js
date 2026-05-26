import express from 'express';
import * as progressService from '../services/progressService.js';
import * as telegramService from '../services/telegramService.js';
import { query } from '../db/index.js';

const router = express.Router();

// Helper to translate subject slugs (e.g., 'geography-optional') to DB subject target names
function normalizeSubjectSlug(slug) {
  if (!slug) return "";
  const s = slug.toLowerCase().trim();
  if (s === "geography-optional") return "Geography Optional";
  if (s === "csat") return "CSAT";
  if (s === "gs4-ethics" || s === "ethics") return "GS4 Ethics";
  if (s === "essay") return "Essay";
  if (s === "mains-answer-writing") return "Mains Answer Writing";
  if (s === "current-affairs") return "Current Affairs";
  if (s === "revision-buffer") return "Revision/Buffer";
  if (s === "prelims-gs-mcq-pyq" || s === "prelims-gs") return "Prelims GS MCQ + PYQ";
  if (s === "gs1") return "GS1";
  if (s === "gs2") return "GS2";
  if (s === "gs3") return "GS3";
  
  return slug
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// 1. GET /api/progress/weekly?userId=user_1
router.get('/weekly', async (req, res) => {
  try {
    const userId = req.query.userId || 'moulika';
    const data = await progressService.getWeeklyProgressReport(userId);
    res.json({ ok: true, data });
  } catch (err) {
    console.error("[Route /weekly ERROR]", err);
    res.status(500).json({ ok: false, error: err.message || err });
  }
});

// 2. GET /api/progress/today?userId=user_1
router.get('/today', async (req, res) => {
  try {
    const userId = req.query.userId || 'moulika';
    const data = await progressService.getDailyProgressReport(userId);
    res.json({ ok: true, data });
  } catch (err) {
    console.error("[Route /today ERROR]", err);
    res.status(500).json({ ok: false, error: err.message || err });
  }
});

// 3. GET /api/progress/subject/:area?userId=user_1
router.get('/subject/:area', async (req, res) => {
  try {
    const userId = req.query.userId || 'moulika';
    const subjectName = normalizeSubjectSlug(req.params.area);
    const data = await progressService.getAreaProgress(userId, subjectName);
    
    if (!data) {
      return res.status(404).json({ ok: false, error: `Subject target not found: ${subjectName}` });
    }
    
    res.json({ ok: true, data });
  } catch (err) {
    console.error("[Route /subject/:area ERROR]", err);
    res.status(500).json({ ok: false, error: err.message || err });
  }
});

// 4. POST & GET /api/notifications/test-telegram
const testTelegramHandler = async (req, res) => {
  try {
    const userId = req.query.userId || req.body?.userId || 'moulika';
    const text = req.query.text || req.body?.text || "🔔 *MentorOS Test Alert*:\nYour Telegram progress delivery system is active!";
    
    // Check registered destinations in database
    const destRes = await query(
      `SELECT destination_id FROM public.notification_channels 
       WHERE user_id = $1 AND channel_type = 'TELEGRAM' AND is_enabled = TRUE`,
      [userId]
    );
    
    const destinations = destRes.rows.map(r => r.destination_id);
    
    // Fall back to environment variable if none registered in DB
    const envChatId = process.env.TELEGRAM_CHAT_ID;
    if (destinations.length === 0 && envChatId) {
      destinations.push(envChatId);
    }
    
    if (destinations.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "No Telegram chat ID registered. Please start the bot first or set TELEGRAM_CHAT_ID in .env"
      });
    }
    
    const results = [];
    for (const chatId of destinations) {
      const success = await telegramService.sendTelegramMessage(chatId, text);
      results.push({ chatId, success });
    }
    
    res.json({
      ok: true,
      message: "Test Telegram messages dispatched.",
      results
    });
  } catch (err) {
    console.error("[Route /test-telegram ERROR]", err);
    res.status(500).json({ ok: false, error: err.message || err });
  }
};

router.get('/test-telegram', testTelegramHandler);
router.post('/test-telegram', testTelegramHandler);

export default router;
