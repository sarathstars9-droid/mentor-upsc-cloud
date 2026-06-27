import { query } from './db/index.js';
import * as psychologyMessageService from './services/psychologyMessageService.js';

// Helper: Atomic lock utilizing notification_events unique constraint
async function acquireAtomicLock(userId, notificationType, sourceId, dryRun) {
  if (dryRun) {
    console.log(`[DRY RUN] Would acquire atomic lock for ${notificationType}`);
    return true; // Mock success
  }
  try {
    const { rows } = await query(
      `INSERT INTO public.notification_events 
         (user_id, notification_type, source_type, source_id, channel_type, status, sent_at)
       VALUES ($1, $2, 'daily_date', $3, 'SYSTEM_LOCK', 'pending', NOW())
       ON CONFLICT (user_id, notification_type, source_type, source_id, channel_type) 
       DO UPDATE SET status = 'pending', sent_at = NOW()
       WHERE public.notification_events.status = 'failed'
       RETURNING id`,
      [userId, notificationType, sourceId]
    );
    return rows.length > 0;
  } catch (err) {
    console.error("[acquireAtomicLock Error]", err.message);
    return false;
  }
}

async function updateAtomicLockStatus(userId, notificationType, sourceId, status, dryRun) {
  if (dryRun) {
    console.log(`[DRY RUN] Would update lock status to '${status}'`);
    return;
  }
  try {
    await query(
      `UPDATE public.notification_events 
       SET status = $1 
       WHERE user_id = $2 AND notification_type = $3 AND source_id = $4 AND channel_type = 'SYSTEM_LOCK'`,
      [status, userId, notificationType, sourceId]
    );
  } catch (err) {
    console.error("[updateAtomicLockStatus Error]", err.message);
  }
}

async function runLogic(runNumber, userId, todayKey, dryRun) {
  console.log(`\n--- RUN ${runNumber} ---`);
  const userRes = await query(`SELECT name, mission_health_state, consecutive_zero_study_days FROM public.users WHERE id = $1`, [userId]);
  const user = userRes.rows[0];
  const state = user?.mission_health_state || 'HEALTHY';
  const userName = user?.name || "Moulika";
  const zeroStreak = user?.consecutive_zero_study_days || 0;

  if (!['MISSION_FAILURE', 'MISSION_RECOVERY', 'RECOVERY_WIZARD'].includes(state)) {
    const isAtRisk = ['AT_RISK', 'HIGH_RISK', 'CRITICAL'].includes(state) || zeroStreak > 0;
    
    if (isAtRisk) {
      const blocksRes = await query(`SELECT id, status, actual_minutes FROM public.study_blocks WHERE user_id = $1 AND day_key = $2`, [userId, todayKey]);
      const hasCompletedBlock = blocksRes.rows.some(b => ['completed', 'done', 'partial'].includes(b.status) || (b.actual_minutes > 0));
      const hasPlan = blocksRes.rows.length > 0;
      
      if (!hasPlan && !hasCompletedBlock) {
        if (await acquireAtomicLock(userId, 'HIGH_RISK_INTERVENTION_3PM', todayKey, dryRun)) {
          const text = psychologyMessageService.getHighRiskIntervention3PMMessage(userName);
          console.log(`[TEST] Sending HIGH_RISK_INTERVENTION_3PM to Telegram:`);
          console.log(`Payload Text:\n"${text}"\n`);
          
          // Mocking the result of sendNotification
          const sendSuccess = true; 
          
          if (sendSuccess) {
            await updateAtomicLockStatus(userId, 'HIGH_RISK_INTERVENTION_3PM', todayKey, 'sent', dryRun);
            if (!dryRun) {
              await query(
                `INSERT INTO public.plan_block_events (user_id, event_type, metadata)
                 VALUES ($1, $2, $3)`,
                [userId, 'HIGH_RISK_INTERVENTION_3PM', JSON.stringify({ source_id: todayKey, recorded_at: new Date() })]
              );
            }
            console.log(`[TEST] Event recorded via atomic lock in DB to prevent duplicates.`);
          } else {
            await updateAtomicLockStatus(userId, 'HIGH_RISK_INTERVENTION_3PM', todayKey, 'failed', dryRun);
          }
        } else {
           console.log(`[TEST] HIGH_RISK_INTERVENTION_3PM skipped because acquireAtomicLock returned false (duplicate).`);
        }
      }
    }
  }
}

async function run() {
  const writeTestEvent = process.argv.includes('--write-test-event');
  const dryRun = !writeTestEvent;
  
  const userId = 'moulika';
  const now = new Date('2026-06-27T15:00:00+05:30'); // Mocking 3 PM
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;

  console.log(`[TEST] Mocking 3 PM scenario for ${userId} on ${todayKey}. Mode: ${dryRun ? 'DRY-RUN' : 'WRITE-DB'}`);

  if (!dryRun) {
    // Setup mock data in real DB only if write-test-event is provided
    await query(`UPDATE public.users SET mission_health_state = 'AT_RISK', consecutive_zero_study_days = 5 WHERE id = $1`, [userId]);
    await query(`DELETE FROM public.study_blocks WHERE user_id = $1 AND day_key = $2`, [userId, todayKey]); 
    await query(`DELETE FROM public.notification_events WHERE user_id = $1 AND source_id = $2 AND notification_type = 'HIGH_RISK_INTERVENTION_3PM'`, [userId, todayKey]);
    await query(`DELETE FROM public.plan_block_events WHERE user_id = $1 AND (metadata->>'source_id') = $2 AND event_type = 'HIGH_RISK_INTERVENTION_3PM'`, [userId, todayKey]);
  }

  // First Run
  await runLogic(1, userId, todayKey, dryRun);
  
  if (!dryRun) {
    // Second Run (should skip if writing to DB)
    await runLogic(2, userId, todayKey, dryRun);
  }

  process.exit(0);
}

run();
