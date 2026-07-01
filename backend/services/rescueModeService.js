import { query } from '../db/index.js';
import * as disciplineEventService from './disciplineEventService.js';
import crypto from 'crypto';

function generateBlockId() {
  return crypto.randomUUID();
}

/**
 * Triggers Rescue Mode.
 * Removes or marks existing pending blocks if needed (we'll just append them for now to avoid deleting user data,
 * or mark them as 'skipped_rescue'). As per requirements, we just generate 3 blocks.
 */
export async function startRescueMode(userId) {
  const kolkataStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  try {
    // Optional: Cancel remaining 'planned' blocks for today so they don't clog the schedule
    await query(
      `UPDATE study_blocks 
       SET status = 'skipped_rescue' 
       WHERE user_id = $1 AND day_key = $2 AND status = 'planned'`,
      [userId, dateKey]
    );

    // Create 3 Rescue Blocks
    const rescueBlocks = [
      {
        block_id: generateBlockId(),
        user_id: userId,
        day_key: dateKey,
        subject: 'Rescue: High ROI',
        topic: 'Highest ROI Topic',
        planned_minutes: 50,
        status: 'planned',
        rescue_mode: true
      },
      {
        block_id: generateBlockId(),
        user_id: userId,
        day_key: dateKey,
        subject: 'Rescue: PYQ/Revision',
        topic: 'PYQ or pending revision',
        planned_minutes: 50,
        status: 'planned',
        rescue_mode: true
      },
      {
        block_id: generateBlockId(),
        user_id: userId,
        day_key: dateKey,
        subject: 'Rescue: Backlog',
        topic: 'MCQ / Answer Writing / Backlog',
        planned_minutes: 50,
        status: 'planned',
        rescue_mode: true
      }
    ];

    for (const b of rescueBlocks) {
      await query(
        `INSERT INTO study_blocks (block_id, user_id, day_key, subject, topic, planned_minutes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [b.block_id, b.user_id, b.day_key, b.subject, b.topic, b.planned_minutes, b.status]
      );
    }

    // Record Event
    await disciplineEventService.createEvent(userId, 'RESCUE_MODE_TRIGGERED', 'high', 'SYSTEM');
    await disciplineEventService.createEvent(userId, 'RESCUE_MODE_ACCEPTED', 'low', 'SYSTEM');

    return { success: true, message: 'Rescue mode activated. 3 blocks generated.' };
  } catch (err) {
    console.error('[RescueModeService ERROR]', err);
    return { success: false, error: err.message };
  }
}
