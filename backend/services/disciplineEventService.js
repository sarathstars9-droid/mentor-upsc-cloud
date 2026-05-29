import { query } from '../db/index.js';

export async function createEvent(userId, eventType, severity = 'medium', channel = 'WHATSAPP', metadata = {}) {
  try {
    const res = await query(
      `INSERT INTO discipline_events (user_id, event_type, severity, channel, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, eventType, severity, channel, JSON.stringify(metadata)]
    );
    return res.rows[0].id;
  } catch (err) {
    console.error('[DisciplineEventService] createEvent error:', err);
    return null;
  }
}

export async function resolveEvent(eventId, metadataUpdate = null) {
  try {
    if (metadataUpdate) {
      await query(
        `UPDATE discipline_events 
         SET status = 'resolved', resolved_at = NOW(), metadata = metadata || $2::jsonb
         WHERE id = $1`,
        [eventId, JSON.stringify(metadataUpdate)]
      );
    } else {
      await query(
        `UPDATE discipline_events 
         SET status = 'resolved', resolved_at = NOW()
         WHERE id = $1`,
        [eventId]
      );
    }
    return true;
  } catch (err) {
    console.error('[DisciplineEventService] resolveEvent error:', err);
    return false;
  }
}

export async function getOpenEventByType(userId, eventType) {
  try {
    const res = await query(
      `SELECT * FROM discipline_events 
       WHERE user_id = $1 AND event_type = $2 AND status = 'open' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, eventType]
    );
    return res.rows[0] || null;
  } catch (err) {
    console.error('[DisciplineEventService] getOpenEventByType error:', err);
    return null;
  }
}

export async function hasEventToday(userId, eventType) {
  try {
    const res = await query(
      `SELECT id FROM discipline_events 
       WHERE user_id = $1 AND event_type = $2 AND created_at >= CURRENT_DATE`,
      [userId, eventType]
    );
    return res.rows.length > 0;
  } catch (err) {
    console.error('[DisciplineEventService] hasEventToday error:', err);
    return false;
  }
}

export async function createUntrackedStudyLog(userId, dateKey, textReply, sourceEventId = null) {
  try {
    const res = await query(
      `INSERT INTO untracked_study_logs (user_id, study_date, source_event_id, user_reply)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, dateKey, sourceEventId, textReply]
    );
    return res.rows[0].id;
  } catch (err) {
    console.error('[DisciplineEventService] createUntrackedStudyLog error:', err);
    return null;
  }
}
