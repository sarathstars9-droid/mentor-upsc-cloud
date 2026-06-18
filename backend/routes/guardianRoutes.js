// backend/routes/guardianRoutes.js
import express from 'express';
import { query } from '../db/index.js';
import { sendNotification } from '../services/notificationService.js';
import { resolveActiveBlock } from '../services/blockLifecycleService.js';

const DISTRACTION_APPS = [
  'instagram',
  'youtube',
  'whatsapp',
  'telegram',
  'chrome',
  'com.instagram.android',
  'com.google.android.youtube',
  'com.whatsapp',
  'org.telegram.messenger',
  'com.android.chrome'
];
const DISTRACTION_THRESHOLD_SECONDS = 900; // 15 minutes

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
  const userId = String(req.query.userId || req.body?.userId || '').toLowerCase().trim();
  if (!userId) {
    return res.status(400).json({ ok: false, error: 'userId is required' });
  }
  
  console.log(`[Guardian Poll] Polling current block for user: ${userId}`);
  
  try {
    const activeBlock = await resolveActiveBlock(userId);
    
    if (!activeBlock) {
      console.log(`[Guardian Poll] Received no active block for user: ${userId}`);
      return res.json({ active: false });
    }
    
    const start = new Date(activeBlock.started_at);
    const plannedMinutes = Number(activeBlock.planned_minutes || 0);
    const end = new Date(start.getTime() + plannedMinutes * 60000);
    
    console.log(`[Guardian Poll] Received active block: ${activeBlock.subject} for user: ${userId}`);
    console.log(`[Monitoring Started] Distraction monitoring started for user: ${userId}, block: ${activeBlock.subject}`);

    return res.json({
      active: true,
      blockId: activeBlock.block_id,
      subject: activeBlock.subject || activeBlock.topic || 'General Study',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: activeBlock.status === 'active' ? 'running' : 'paused'
    });
  } catch (err) {
    console.error('[GET /current-block] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/guardian/phone-usage ────────────────
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
  
  const normalizedUid = String(userId).toLowerCase().trim();
  console.log(`[Guardian Sync] Syncing distraction session for app: ${appName} (${appPackage}), duration: ${durationSeconds}s, in block: ${blockId} for user: ${normalizedUid}`);
  
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
      normalizedUid,
      blockId,
      appPackage,
      appName,
      category,
      Number(durationSeconds || 0),
      startedAt ? new Date(startedAt) : null,
      endedAt ? new Date(endedAt) : null
    ];
    
    const insertResult = await query(insertSql, insertValues);
    console.log(`[Guardian Sync] Distraction session synced successfully for app: ${appName}, block: ${blockId}`);
    
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
    const sumResult = await query(sumSql, [normalizedUid, blockId, DISTRACTION_APPS]);
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
      const topAppResult = await query(topAppSql, [normalizedUid, blockId, DISTRACTION_APPS]);
      const topAppName = topAppResult.rows[0]?.app_name || appName;
      
      // 5. Look up study block subject label
      const blockSql = `
        SELECT subject, topic 
        FROM public.study_blocks 
        WHERE user_id = $1 AND block_id = $2 
        LIMIT 1;
      `;
      const blockResult = await query(blockSql, [normalizedUid, blockId]);
      const blockSubject = blockResult.rows[0]?.subject || blockResult.rows[0]?.topic || 'Study Block';
      
      const totalMinutes = Math.floor(totalSeconds / 60);
      
      // 6. Build the formatted alert message
      const alertText = `📱 *Focus Drift Detected*
 
Active Block: ${blockSubject}
Phone Distraction: ${totalMinutes} min
Top App: ${topAppName}
 
Return to mission now.`;
      
      // 7. Dispatch via unified notificationService (prevents duplicate triggers via database index deduplication)
      // Send alerts at 15m intervals (15m, 30m, 45m, etc.) to prevent spamming while allowing follow-ups
      const intervalMinutes = Math.floor(totalMinutes / 15) * 15;
      const sourceId = `${blockId}_${intervalMinutes}m`;
      
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
