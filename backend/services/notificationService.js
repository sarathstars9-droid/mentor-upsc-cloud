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
  }
}

// Main notification dispatcher with preference checks, quiet hour filters, and database deduplication
export async function sendNotification(userId, notificationType, sourceType, sourceId, messageText, payload = {}) {
  try {
    await seedDefaultPreferences(userId);

    // 1. Fetch enabled preferences for this notification type
    const prefRes = await query(
      `SELECT channel_type, quiet_hours_start, quiet_hours_end 
       FROM public.notification_preferences 
       WHERE user_id = $1 AND notification_type = $2 AND is_enabled = TRUE`,
      [userId, notificationType]
    );

    if (prefRes.rows.length === 0) {
      console.log(`[NotificationService] Preferences disabled or not configured for type ${notificationType} and user ${userId}. Skipping.`);
      return { ok: false, reason: "Preferences disabled or missing" };
    }

    const results = [];

    for (const pref of prefRes.rows) {
      const channel = pref.channel_type;
      
      // 2. Check for quiet hours
      if (isInQuietHours(pref.quiet_hours_start, pref.quiet_hours_end)) {
        console.log(`[NotificationService] Skipping delivery for user ${userId} via ${channel} due to quiet hours (${pref.quiet_hours_start}-${pref.quiet_hours_end}).`);
        
        // Log skipped event
        await query(
          `INSERT INTO public.notification_events 
             (user_id, notification_type, source_type, source_id, channel_type, status, error_message, payload_json)
           VALUES ($1, $2, $3, $4, $5, 'skipped', 'Quiet hours active', $6)
           ON CONFLICT (user_id, notification_type, source_type, source_id, channel_type) DO NOTHING`,
          [userId, notificationType, sourceType, sourceId, channel, JSON.stringify(payload)]
        );
        
        results.push({ channel, status: "skipped", reason: "Quiet hours" });
        continue;
      }

      // 3. Deduplication Check
      const dupRes = await query(
        `SELECT id, status FROM public.notification_events 
         WHERE user_id = $1 AND notification_type = $2 AND source_type = $3 AND source_id = $4 AND channel_type = $5`,
        [userId, notificationType, sourceType, sourceId, channel]
      );
      
      if (dupRes.rows.length > 0) {
        console.log(`[NotificationService] Deduplication match for type ${notificationType}, source ${sourceType}:${sourceId} via ${channel}. Skipping.`);
        results.push({ channel, status: "skipped", reason: "Deduplicated" });
        continue;
      }

      // 4. Fetch destination for the channel
      const destRes = await query(
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

      const destinationId = destRes.rows[0].destination_id;

      // 5. Deliver notification based on channel
      let success = false;
      let errorMsg = null;

      try {
        if (channel === 'TELEGRAM') {
          success = await telegramService.sendTelegramMessage(destinationId, messageText);
        } else {
          errorMsg = `Unsupported channel type: ${channel}`;
        }
      } catch (err) {
        success = false;
        errorMsg = err.message || String(err);
      }

      const finalStatus = success ? 'sent' : 'failed';

      // 6. Record the event
      await query(
        `INSERT INTO public.notification_events 
           (user_id, notification_type, source_type, source_id, channel_type, status, error_message, payload_json, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (user_id, notification_type, source_type, source_id, channel_type) 
         DO UPDATE SET 
           status = EXCLUDED.status,
           error_message = EXCLUDED.error_message,
           payload_json = EXCLUDED.payload_json,
           sent_at = NOW()`,
        [userId, notificationType, sourceType, sourceId, channel, finalStatus, errorMsg, JSON.stringify(payload)]
      );

      results.push({ channel, status: finalStatus, error: errorMsg });
    }

    return { ok: true, results };

  } catch (err) {
    console.error("[NotificationService ERROR]", err);
    return { ok: false, error: err.message || err };
  }
}
