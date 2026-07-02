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
const DISTRACTION_THRESHOLD_SECONDS = 300; // 5 minutes (minimum threshold)

function getDistractionThreshold(totalMinutes) {
  if (totalMinutes < 5) return null;
  if (totalMinutes < 10) return 5;
  if (totalMinutes < 15) return 10;
  if (totalMinutes < 30) return 15;
  return Math.floor(totalMinutes / 15) * 15;
}

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
    const totalMinutes = Math.floor(totalSeconds / 60);
    const matchedThreshold = getDistractionThreshold(totalMinutes);
    
    if (matchedThreshold !== null) {
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
      
      // 6. Build the formatted alert message
      const alertText = `📱 *Focus Drift Detected*

You crossed the ${matchedThreshold}-minute distraction threshold.
Top distraction: ${topAppName}.
Return to mission now.`;
      
      // 7. Dispatch via unified notificationService (prevents duplicate triggers via database index deduplication)
      // Send alerts at specified progressive thresholds: 5m, 10m, 15m, 30m, 45m, 60m...
      const sourceId = `${blockId}_${matchedThreshold}m`;
      
      const notificationRes = await sendNotification(
        userId,
        'DISTRACTION_ALERT',
        'block_distraction',
        sourceId,
        alertText,
        { blockId, totalMinutes, topApp: topAppName, threshold: matchedThreshold }
      );
      
      if (notificationRes.ok && notificationRes.results.some(r => r.status === 'sent')) {
        alertTriggered = true;
        console.log(`[Guardian Service] Telegram distraction alert sent for block ${blockId} at threshold ${matchedThreshold}m`);
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

// ── POST /api/guardian/daily-phone-usage ────────────────
router.post('/daily-phone-usage', verifyGuardianKey, async (req, res) => {
  const { userId, deviceId, device_id, date, localDate, timezone, todayStartMillis, queryEndMillis, apps, totalDistractionSeconds } = req.body || {};

  const usageDate = date || localDate;
  if (!userId || !usageDate || !Array.isArray(apps)) {
    return res.status(400).json({ ok: false, error: 'userId, date/localDate, and apps array are required' });
  }

  const normalizedUid = String(userId).toLowerCase().trim();
  const normalizedDeviceId = String(deviceId || device_id || 'default_device').trim();
  console.log(`[Guardian Daily Sync] Syncing daily phone usage for user: ${normalizedUid}, device: ${normalizedDeviceId}, date: ${usageDate}, distraction: ${totalDistractionSeconds}s`);

  try {
    // 1. Upsert each app package into guardian_daily_phone_usage
    for (const app of apps) {
      const { appPackage, appName, durationSeconds } = app;
      if (!appPackage || !appName) continue;

      const upsertSql = `
        INSERT INTO public.guardian_daily_phone_usage (user_id, device_id, date, app_package, app_name, duration_seconds, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id, device_id, date, app_package) 
        DO UPDATE SET 
          duration_seconds = EXCLUDED.duration_seconds,
          app_name = EXCLUDED.app_name,
          updated_at = NOW();
      `;
      await query(upsertSql, [normalizedUid, normalizedDeviceId, date, appPackage, appName, Number(durationSeconds || 0)]);
    }

    // 2. Perform distraction threshold alert check (45m, 60m, 90m)
    const distMinutes = Math.floor(Number(totalDistractionSeconds || 0) / 60);
    const thresholds = [45, 60, 90];
    let triggeredThreshold = null;
    let alertText = null;

    // Check thresholds
    for (const threshold of thresholds) {
      if (distMinutes >= threshold) {
        // Check if alert already sent today for this threshold
        const alertType = `distraction_${threshold}`;
        const checkLedgerSql = `
          SELECT id FROM public.guardian_alert_ledger 
          WHERE user_id = $1 AND date = $2 AND alert_type = $3;
        `;
        const ledgerCheck = await query(checkLedgerSql, [normalizedUid, date, alertType]);

        if (ledgerCheck.rows.length === 0) {
          // Record to ledger first to prevent race condition
          const recordLedgerSql = `
            INSERT INTO public.guardian_alert_ledger (user_id, date, alert_type)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, date, alert_type) DO NOTHING
            RETURNING id;
          `;
          const recordResult = await query(recordLedgerSql, [normalizedUid, date, alertType]);

          // If successfully inserted (i.e. did not exist), send notification
          if (recordResult.rows.length > 0) {
            triggeredThreshold = threshold;
            alertText = `📱 *Distraction Limit Crossed* (${threshold}m)
            
User Moulika has used distraction apps for *${distMinutes} minutes* today.
Please resume your UPSC study mission.`;

            await sendNotification(
              normalizedUid,
              'DISTRACTION_ALERT',
              'daily_distraction',
              `${date}_${threshold}`,
              alertText,
              { date, totalMinutes: distMinutes, threshold }
            );
            console.log(`[Guardian Daily Sync] Distraction alert sent for ${normalizedUid} at threshold ${threshold}m`);
          }
        }
      }
    }

    return res.json({
      ok: true,
      userId: normalizedUid,
      date,
      totalDistractionMinutes: distMinutes,
      alertTriggered: triggeredThreshold !== null,
      triggeredThreshold
    });
  } catch (err) {
    console.error('[POST /daily-phone-usage] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/guardian/action/i-am-studying ────────────────
router.post('/action/i-am-studying', verifyGuardianKey, async (req, res) => {
  const userId = String(req.query.userId || req.body?.userId || '').toLowerCase().trim();
  if (!userId) {
    return res.status(400).json({ ok: false, error: 'userId is required' });
  }

  try {
    // 1. Log discipline event
    const { createEvent } = await import('../services/disciplineEventService.js');
    await createEvent(userId, 'I_AM_STUDYING', 'low', 'GUARDIAN');
    await createEvent(userId, 'DAY_NOT_STARTED_USER_STUDYING_WITHOUT_PLAN', 'medium', 'GUARDIAN');

    console.log(`[Guardian Action] Logged I_AM_STUDYING and studying without plan events for ${userId}`);

    return res.json({
      ok: true,
      message: 'Student marked as active. Escalations will be paused for 45 minutes.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[POST /action/i-am-studying] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/guardian/action/upload-plan-now ──────────────
router.post('/action/upload-plan-now', verifyGuardianKey, async (req, res) => {
  const userId = String(req.query.userId || req.body?.userId || '').toLowerCase().trim();
  if (!userId) {
    return res.status(400).json({ ok: false, error: 'userId is required' });
  }

  try {
    // 1. Log discipline event
    const { createEvent } = await import('../services/disciplineEventService.js');
    await createEvent(userId, 'DAY_UNTRACKED_STUDY_LOG_REQUESTED', 'medium', 'GUARDIAN');

    console.log(`[Guardian Action] Logged UPLOAD_PLAN request event for ${userId}`);

    return res.json({
      ok: true,
      message: 'Upload plan request processed.',
      instruction: 'Please open the MentorOS app and upload your plan now.'
    });
  } catch (err) {
    console.error('[POST /action/upload-plan-now] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/guardian/action/start-rescue-mode ────────────
router.post('/action/start-rescue-mode', verifyGuardianKey, async (req, res) => {
  const userId = String(req.query.userId || req.body?.userId || '').toLowerCase().trim();
  if (!userId) {
    return res.status(400).json({ ok: false, error: 'userId is required' });
  }

  try {
    // 1. Start Rescue Mode using existing rescueModeService
    const { startRescueMode } = await import('../services/rescueModeService.js');
    const result = await startRescueMode(userId);

    if (!result.success) {
      return res.status(500).json({ ok: false, error: result.error || 'Failed to start Rescue Mode' });
    }

    // 2. Also log a confirmation event I_AM_STUDYING to pause alerts immediately
    const { createEvent } = await import('../services/disciplineEventService.js');
    await createEvent(userId, 'I_AM_STUDYING', 'low', 'GUARDIAN');

    // Get dateKey in Kolkata time
    const kolkataStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const d = new Date(kolkataStr);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // 3. Query the created rescue blocks
    const { rows: blocks } = await query(
      `SELECT id, block_id, day_key, subject, topic, planned_minutes, status 
       FROM public.study_blocks 
       WHERE user_id = $1 AND day_key = $2 AND subject LIKE 'Rescue:%'`,
      [userId, dateKey]
    );

    return res.json({
      ok: true,
      message: 'Rescue Mode started. 3 focused blocks generated.',
      blocks
    });
  } catch (err) {
    console.error('[POST /action/start-rescue-mode] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
