// backend/routes/guardianRoutes.js
import express from 'express';
import { query } from '../db/index.js';
import { sendNotification } from '../services/notificationService.js';

const router = express.Router();

// ── Shared Companion Validation Middleware ────────────────────────────────────
function verifyGuardianKey(req, res, next) {
  const apiKey = req.headers['x-guardian-api-key'];
  const expectedKey = process.env.GUARDIAN_API_KEY;
  
  if (!expectedKey) {
    console.warn("[Guardian API Key Warning] GUARDIAN_API_KEY is not configured in backend .env");
  }
  
  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ ok: false, error: 'Unauthorized companion client' });
  }
  next();
}

// ── GET /api/guardian/current-block ───────────────────────────────────────────
router.get('/current-block', verifyGuardianKey, async (req, res) => {
  const userId = req.query.userId || req.body?.userId;
  if (!userId) {
    return res.status(400).json({ ok: false, error: 'userId is required' });
  }
  
  try {
    const { rows } = await query(
      `SELECT id, block_id, subject, topic, started_at, planned_minutes, status
       FROM public.study_blocks
       WHERE user_id = $1 AND status IN ('active', 'paused')
       ORDER BY started_at DESC
       LIMIT 1`,
      [userId]
    );
    
    if (rows.length === 0) {
      return res.json({ active: false });
    }
    
    const row = rows[0];
    const start = new Date(row.started_at);
    const plannedMinutes = Number(row.planned_minutes || 0);
    const end = new Date(start.getTime() + plannedMinutes * 60000);
    
    return res.json({
      active: true,
      blockId: row.block_id,
      subject: row.subject || row.topic || 'General Study',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: row.status === 'active' ? 'running' : 'paused'
    });
  } catch (err) {
    console.error('[GET /current-block] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/guardian/phone-usage ────────────────────────────────────────────
const DISTRACTION_APPS = ['instagram', 'youtube', 'whatsapp', 'telegram', 'facebook', 'x', 'snapchat', 'twitter'];
const DISTRACTION_THRESHOLD_SECONDS = 900; // 15 minutes

router.post('/phone-usage', verifyGuardianKey, async (req, res) => {
  const { 
    userId, 
    blockId, 
    appPackage, 
    appName, 
    category, 
    durationSeconds, 
    startedAt, 
    endedAt 
  } = req.body || {};
  
  if (!userId || !blockId || !appPackage || !appName) {
    return res.status(400).json({ ok: false, error: 'userId, blockId, appPackage, and appName are required' });
  }
  
  try {
    // 1. Insert phone distraction usage log
    const insertSql = `
      INSERT INTO public.guardian_phone_usage_events
        (user_id, block_id, app_package, app_name, category, duration_seconds, started_at, ended_at)
      VALUES
        ($1, $2, $3, $4, COALESCE($5, 'distraction'), $6, $7, $8)
      RETURNING *;
    `;
    const insertValues = [
      userId,
      blockId,
      appPackage,
      appName,
      category,
      Number(durationSeconds || 0),
      startedAt ? new Date(startedAt) : null,
      endedAt ? new Date(endedAt) : null
    ];
    
    const insertResult = await query(insertSql, insertValues);
    
    // 2. Verify if app is considered distraction
    const isDistraction = DISTRACTION_APPS.some(app => 
      appName.toLowerCase().includes(app) || 
      appPackage.toLowerCase().includes(app)
    ) || category === 'distraction';
    
    if (!isDistraction) {
      return res.json({ 
        ok: true, 
        event: insertResult.rows[0], 
        alertTriggered: false 
      });
    }
    
    // 3. Compute current distraction seconds accumulated in this block
    const sumSql = `
      SELECT COALESCE(SUM(duration_seconds), 0) AS total_duration
      FROM public.guardian_phone_usage_events
      WHERE user_id = $1 
        AND block_id = $2 
        AND (category = 'distraction' OR LOWER(app_name) = ANY($3) OR LOWER(app_package) = ANY($3));
    `;
    const sumResult = await query(sumSql, [userId, blockId, DISTRACTION_APPS]);
    const totalSeconds = Number(sumResult.rows[0].total_duration);
    
    let alertTriggered = false;
    
    if (totalSeconds >= DISTRACTION_THRESHOLD_SECONDS) {
      // 4. Find app package with highest cumulative distraction in block
      const topAppSql = `
        SELECT app_name, SUM(duration_seconds) AS app_duration
        FROM public.guardian_phone_usage_events
        WHERE user_id = $1 
          AND block_id = $2 
          AND (category = 'distraction' OR LOWER(app_name) = ANY($3) OR LOWER(app_package) = ANY($3))
        GROUP BY app_name
        ORDER BY app_duration DESC
        LIMIT 1;
      `;
      const topAppResult = await query(topAppSql, [userId, blockId, DISTRACTION_APPS]);
      const topAppName = topAppResult.rows[0]?.app_name || appName;
      
      // 5. Look up study block subject label
      const blockSql = `
        SELECT subject, topic 
        FROM public.study_blocks 
        WHERE user_id = $1 AND block_id = $2 
        LIMIT 1;
      `;
      const blockResult = await query(blockSql, [userId, blockId]);
      const blockSubject = blockResult.rows[0]?.subject || blockResult.rows[0]?.topic || 'Study Block';
      
      const totalMinutes = Math.floor(totalSeconds / 60);
      
      // 6. Build the formatted alert message
      const alertText = `📱 *Focus Drift Detected*

Active Block: ${blockSubject}
Phone Distraction: ${totalMinutes} min
Top App: ${topAppName}

Return to mission now.`;
      
      // 7. Dispatch via unified notificationService (prevents duplicate triggers via database index deduplication)
      const sourceId = `${blockId}_15m`;
      
      const notificationRes = await sendNotification(
        userId,
        'DISTRACTION_ALERT',
        'block_distraction',
        sourceId,
        alertText,
        { blockId, totalMinutes, topApp: topAppName }
      );
      
      if (notificationRes.ok && notificationRes.results.some(r => r.status === 'sent')) {
        alertTriggered = true;
        console.log(`[Guardian Service] Telegram distraction alert sent for block ${blockId}`);
      }
    }
    
    return res.json({ 
      ok: true, 
      event: insertResult.rows[0], 
      totalDistractionSeconds: totalSeconds,
      alertTriggered 
    });
  } catch (err) {
    console.error('[POST /phone-usage] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
