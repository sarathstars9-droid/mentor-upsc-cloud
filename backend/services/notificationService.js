import { query } from '../db/index.js';
import * as telegramService from './telegramService.js';

// Checks if current Kolkata time falls within quiet hours (e.g. "22:00" to "07:00")
export function isInQuietHours(startStr, endStr) {
  if (!startStr || !endStr) return false;
  
  const nowKolkata = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(nowKolkata);
  const nowH = d.getHours();
  const nowM = d.getMinutes();
  
  const nowMins = nowH * 60 + nowM;
  
  const [startH, startM] = startStr.split(":").map(Number);
  const [endH, endM] = endStr.split(":").map(Number);
  
  const startMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;

  if (startMins <= endMins) {
    return nowMins >= startMins && nowMins <= endMins;
  } else {
    // Quiet hours cross midnight (e.g., 22:00 to 07:00)
    return nowMins >= startMins || nowMins <= endMins;
  }
}

export async function seedDefaultPreferences(userId) {
  const defaults = [
    { type: 'BLOCK_STARTED', enabled: true },
    { type: 'BLOCK_COMPLETED', enabled: true },
    { type: 'BLOCK_STOPPED', enabled: true },
    { type: 'BLOCK_SKIPPED', enabled: true },
    { type: 'BLOCK_PAUSED_TOO_LONG', enabled: true },
    { type: 'PLAN_NOT_STARTED', enabled: true },
    { type: 'CURRENT_BLOCK_NOT_STARTED', enabled: true },
    { type: 'MISSED_BLOCK_ALERT', enabled: true },
    { type: 'GOOD_MORNING_MISSION', enabled: true },
    { type: 'PLAN_NOT_UPLOADED', enabled: true },
    { type: 'DAILY_NIGHT_REPORT', enabled: true },
    { type: 'NIGHT_MENTOR_REVIEW', enabled: true },
    { type: 'MORNING_RECALL', enabled: true },
    { type: 'PLAN_ACCEPTED_SUMMARY', enabled: true },
    { type: 'WEEKLY_MENTOR_REPORT', enabled: true },
    { type: 'MONTHLY_MENTOR_REPORT', enabled: true },
    { type: 'MONTHLY_MENTOR_REPORT_PDF', enabled: true },
    { type: 'REVISION_DUE_ALERT', enabled: true },
    { type: 'END_OF_DAY_REPORT', enabled: true },
    { type: 'SYLLABUS_TRACK_REPLY', enabled: true },
    { type: 'BACKLOG_ALERT', enabled: true },
    { type: 'DISTRACTION_ALERT', enabled: true },
    { type: 'BLOCK_PAUSED', enabled: false },
    { type: 'BLOCK_RESUMED', enabled: false }
  ];

  for (const pref of defaults) {
    await query(
      `INSERT INTO public.notification_preferences 
       (user_id, notification_type, channel_type, is_enabled) 
       VALUES ($1, $2, 'TELEGRAM', $3)
       ON CONFLICT (user_id, notification_type, channel_type) DO NOTHING`,
      [userId, pref.type, pref.enabled]
    ).catch(e => console.error('[NotificationService] Seed error:', e.message));

    // Also seed IN_APP for specific critical alerts
    if (pref.type === 'DISTRACTION_ALERT') {
      await query(
        `INSERT INTO public.notification_preferences 
         (user_id, notification_type, channel_type, is_enabled) 
         VALUES ($1, $2, 'IN_APP', $3)
         ON CONFLICT (user_id, notification_type, channel_type) DO NOTHING`,
        [userId, pref.type, pref.enabled]
      ).catch(e => console.error('[NotificationService] Seed error:', e.message));
    }
  }
}

const REMINDER_TYPES = [
  'PLAN_NOT_UPLOADED',
  'PLAN_NOT_STARTED',
  'CURRENT_BLOCK_NOT_STARTED',
  'BLOCK_PAUSED_TOO_LONG',
  'BLOCK_START_REMINDER'
];

function isReminderNotification(type) {
  return REMINDER_TYPES.includes(type) || (type && type.startsWith('DAY_NOT_STARTED'));
}

// Main notification dispatcher with preference checks, quiet hour filters, and database deduplication
export async function sendNotification(userId, notificationType, sourceType, sourceId, messageText, payload = {}, deps = null) {
  // Use injected query if provided, otherwise default to imported query
  const queryFn = deps && deps.query ? deps.query : query;
  
  try {
    const isTestUser = userId && userId.startsWith('test_');
    const isTestPayload = payload && (payload.is_test_data === true || payload.isTestData === true || payload.is_test === true);
    const isTestBlock = sourceId && String(sourceId).includes('volume_survival_test_block');
    const isTestText = messageText && (messageText.includes('Volume Survival') || messageText.includes('test_block'));

    if (process.env.SUPPRESS_TELEGRAM === 'true' || 
        sourceType === 'test' || 
        process.env.NODE_ENV === 'test' || 
        isTestUser || 
        isTestPayload || 
        isTestBlock || 
        isTestText) {
      if (process.env.ALLOW_REAL_TELEGRAM !== 'true') {
        console.log(`[NotificationService MOCK] Suppressed notification for user ${userId}, type ${notificationType} (test/mock mode active).`);
        return { ok: true, mocked: true };
      }
    }

    await seedDefaultPreferences(userId);

    // Fatigue protection check
    if (isReminderNotification(notificationType)) {
      const userRes = await query(
        `SELECT mission_health_state, notification_count_today, last_notification_date 
         FROM public.users WHERE id = $1`,
        [userId]
      );
      if (userRes.rows.length > 0) {
        const user = userRes.rows[0];
        const state = user.mission_health_state || 'HEALTHY';
        let count = user.notification_count_today || 0;

        const nowKolkata = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const d = new Date(nowKolkata);
        const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        if (user.last_notification_date !== todayKey) {
          count = 0;
        }

        let limit = 2; // Default to 2 (HEALTHY, SLIGHT_RISK, RECOVERY, MISSION_FAILURE)
        if (state === 'AT_RISK') limit = 3;
        else if (state === 'HIGH_RISK' || state === 'CRITICAL') limit = 4;
        else if (state === 'MISSION_FAILURE') limit = 2;

        const isCriticalEscalation = [
          'NO_PLAN_STRICT_9AM',
          'RECOVERY_PLAN_12PM',
          'HIGH_RISK_INTERVENTION_3PM',
          'EMERGENCY_NON_ZERO_6PM'
        ].includes(notificationType);

        if (!isCriticalEscalation && count >= limit) {
          console.log(`[NotificationService] Fatigue protection active for ${userId} (state=${state}). Count=${count}/${limit}. Skipping ${notificationType}.`);
          return { ok: false, reason: "Fatigue protection limit reached" };
        }
      }
    }

    // 1. Fetch preferences for this notification type
    const prefRes = await queryFn(
      `SELECT channel_type, is_enabled, quiet_hours_start, quiet_hours_end 
       FROM public.notification_preferences 
       WHERE user_id = $1 AND notification_type = $2`,
      [userId, notificationType]
    );

    const isCriticalEscalation = [
      'NO_PLAN_STRICT_9AM',
      'RECOVERY_PLAN_12PM',
      'HIGH_RISK_INTERVENTION_3PM',
      'EMERGENCY_NON_ZERO_6PM'
    ].includes(notificationType);

    let prefsToProcess = prefRes.rows.filter(r => r.is_enabled);

    if (prefRes.rows.length === 0) {
      // Missing row: disabled by default unless explicitly allowed
      const explicitDefaultAllowlist = [
        'BLOCK_STARTED', 'BLOCK_COMPLETED', 'BLOCK_STOPPED', 'BLOCK_SKIPPED',
        'BLOCK_PAUSED_TOO_LONG', 'PLAN_NOT_STARTED', 'CURRENT_BLOCK_NOT_STARTED',
        'MISSED_BLOCK_ALERT', 'GOOD_MORNING_MISSION', 'PLAN_NOT_UPLOADED',
        'DAILY_NIGHT_REPORT', 'NIGHT_MENTOR_REVIEW', 'MORNING_RECALL',
        'PLAN_ACCEPTED_SUMMARY', 'WEEKLY_MENTOR_REPORT', 'MONTHLY_MENTOR_REPORT',
        'MONTHLY_MENTOR_REPORT_PDF', 'REVISION_DUE_ALERT', 'END_OF_DAY_REPORT',
        'SYLLABUS_TRACK_REPLY', 'BACKLOG_ALERT', 'DISTRACTION_ALERT'
      ];
      if (explicitDefaultAllowlist.includes(notificationType)) {
        console.log(`[NotificationService] Preference missing for ${notificationType} and user ${userId}. Defaulting to TELEGRAM.`);
        prefsToProcess = [{ channel_type: 'TELEGRAM', quiet_hours_start: null, quiet_hours_end: null }];
      } else {
        console.log(`[NotificationService] Preference missing for ${notificationType} and user ${userId}. Defaulting to disabled.`);
      }
    }

    if (prefsToProcess.length === 0 && isCriticalEscalation) {
      console.log(`[NotificationService] Preference fallback active for critical escalation ${notificationType} and user ${userId}. Defaulting to TELEGRAM.`);
      prefsToProcess = [{ channel_type: 'TELEGRAM', quiet_hours_start: null, quiet_hours_end: null }];
    } else if (prefsToProcess.length === 0) {
      console.log(`[NotificationService] Preferences disabled or not configured for type ${notificationType} and user ${userId}. Skipping.`);
      return { ok: false, reason: "Preferences disabled or missing" };
    }

    const results = [];

    for (const pref of prefsToProcess) {
      const channel = pref.channel_type;
      
      // 2. Check for quiet hours
      if (isInQuietHours(pref.quiet_hours_start, pref.quiet_hours_end)) {
        console.log(`[NotificationService] Skipping delivery for user ${userId} via ${channel} due to quiet hours (${pref.quiet_hours_start}-${pref.quiet_hours_end}).`);
        
        // Log skipped event
        await queryFn(
          `INSERT INTO public.notification_events 
             (user_id, notification_type, source_type, source_id, channel_type, status, error_message, payload_json)
           VALUES ($1, $2, $3, $4, $5, 'skipped', 'Quiet hours active', $6)
           ON CONFLICT (user_id, notification_type, source_type, source_id, channel_type) DO NOTHING`,
          [userId, notificationType, sourceType, sourceId, channel, JSON.stringify(payload)]
        );
        
        results.push({ channel, status: "skipped", reason: "Quiet hours" });
        continue;
      }

      // 3. Deduplication Check & Atomic Guard
      const insertRes = await queryFn(
        `INSERT INTO public.notification_events 
           (user_id, notification_type, source_type, source_id, channel_type, status, payload_json)
         VALUES ($1, $2, $3, $4, $5, 'sending', $6)
         ON CONFLICT (user_id, notification_type, source_type, source_id, channel_type) 
         DO NOTHING
         RETURNING id`,
        [userId, notificationType, sourceType, sourceId, channel, JSON.stringify(payload)]
      );

      if (insertRes.rows.length === 0) {
        console.log(`[NotificationService] Atomic guard active: type ${notificationType}, source ${sourceType}:${sourceId} via ${channel} already exists. Skipping.`);
        results.push({ channel, status: "skipped", reason: "Deduplicated via atomic guard" });
        continue;
      }

      // 4. Fetch destination for the channel (Skip for IN_APP)
      let destinationId = null;
      if (channel !== 'IN_APP') {
        const destRes = await queryFn(
          `SELECT destination_id FROM public.notification_channels 
           WHERE user_id = $1 AND channel_type = $2 AND is_enabled = TRUE`,
          [userId, channel]
        );

        if (destRes.rows.length === 0) {
          console.log(`[NotificationService] No active destination found for user ${userId} on channel ${channel}. Skipping.`);
          
          await query(
            `INSERT INTO public.notification_events 
               (user_id, notification_type, source_type, source_id, channel_type, status, error_message, payload_json)
             VALUES ($1, $2, $3, $4, $5, 'skipped', 'No active channel destination', $6)
             ON CONFLICT (user_id, notification_type, source_type, source_id, channel_type) DO NOTHING`,
            [userId, notificationType, sourceType, sourceId, channel, JSON.stringify(payload)]
          );
          
          results.push({ channel, status: "skipped", reason: "No destination registered" });
          continue;
        }

        destinationId = destRes.rows[0].destination_id;
      }

      // 5. Deliver notification based on channel
      let success = false;
      let errorMsg = null;

      try {
        if (channel === 'TELEGRAM') {
          success = await telegramService.sendTelegramMessage(destinationId, messageText, {
            userId,
            notificationType,
            sourceType,
            sourceId
          });
          if (!success) {
            errorMsg = "Telegram delivery failed (queued for retry)";
          }
        } else if (channel === 'IN_APP') {
          success = true; // In-app notifications are "sent" by being stored in the database
        } else {
          errorMsg = `Unsupported channel type: ${channel}`;
        }
      } catch (err) {
        success = false;
        errorMsg = err.message || String(err);
      }

      if (!success) {
        console.error(`[NotificationService DELIVERY FAILURE] Failed to deliver notification type ${notificationType} to user ${userId} via channel ${channel}. Reason/Error: ${errorMsg}`);
      }

      const finalStatus = success ? 'sent' : 'failed';

      if (success && isReminderNotification(notificationType)) {
        const nowKolkata = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const d = new Date(nowKolkata);
        const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        await query(
          `UPDATE public.users 
           SET notification_count_today = CASE WHEN last_notification_date = $2 THEN notification_count_today + 1 ELSE 1 END,
               last_notification_date = $2
           WHERE id = $1`,
          [userId, todayKey]
        );
      }

      // 6. Update the event status after dispatch attempt
      await queryFn(
        `UPDATE public.notification_events 
         SET status = $1, error_message = $2, payload_json = $3, sent_at = NOW()
         WHERE user_id = $4 AND notification_type = $5 AND source_type = $6 AND source_id = $7 AND channel_type = $8`,
        [finalStatus, errorMsg, JSON.stringify(payload), userId, notificationType, sourceType, sourceId, channel]
      );

      results.push({ channel, status: finalStatus, error: errorMsg });
    }

    return { ok: true, results };

  } catch (err) {
    console.error("[NotificationService CRITICAL ERROR]", {
      message: err.message,
      stack: err.stack,
      userId,
      notificationType,
      messageText,
      sourceType,
      sourceId
    });
    return { ok: false, error: err.message || err };
  }
}
