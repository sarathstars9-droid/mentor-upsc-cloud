import { query } from '../db/index.js';
import { recalculateSyllabusNodeProgress } from './trackingFoundationService.js';

/**
 * Log a study event in the study_events table and trigger node progress update.
 */
export async function logStudyEvent({
  userId,
  eventType,
  subject = null,
  paper = null,
  topic = null,
  syllabusNodeId = null,
  blockId = null,
  metadata = {},
  client = null,
  occurrenceTimestamp = null
}) {
  // Defensive normalization: map numeric priority/confidence to text, or normalize text
  if (metadata) {
    if (metadata.priority) {
      if (metadata.priority === 3) metadata.priority = 'high';
      else if (metadata.priority === 2) metadata.priority = 'medium';
      else if (metadata.priority === 1) metadata.priority = 'low';
      else metadata.priority = String(metadata.priority).toLowerCase();
    }
    if (metadata.confidence) {
      if (metadata.confidence === 3) metadata.confidence = 'high';
      else if (metadata.confidence === 2) metadata.confidence = 'medium';
      else if (metadata.confidence === 1) metadata.confidence = 'low';
      else metadata.confidence = String(metadata.confidence).toLowerCase();
    }
  }
  if (!userId || !eventType) {
    throw new Error('userId and eventType are required to log a study event');
  }

  const runQuery = client ? client.query.bind(client) : query;

  const sql = occurrenceTimestamp
    ? `
      INSERT INTO public.study_events (
        user_id, event_type, subject, paper, topic, syllabus_node_id, block_id, metadata_json, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `
    : `
      INSERT INTO public.study_events (
        user_id, event_type, subject, paper, topic, syllabus_node_id, block_id, metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

  // Ensure blockId is a valid UUID or null
  let dbBlockId = blockId;
  if (dbBlockId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dbBlockId)) {
    // If it's a string block_id like 'B1', lookup actual study_blocks.id first
    try {
      const blockRes = await runQuery(
        `SELECT id FROM public.study_blocks WHERE user_id = $1 AND block_id = $2 LIMIT 1`,
        [userId, dbBlockId]
      );
      dbBlockId = blockRes.rows[0]?.id || null;
    } catch (e) {
      console.error('[logStudyEvent] Block ID resolution failed:', e.message);
      dbBlockId = null;
    }
  }

  const values = [
    userId,
    eventType,
    subject || null,
    paper || null,
    topic || null,
    syllabusNodeId || null,
    dbBlockId,
    JSON.stringify(metadata)
  ];
  if (occurrenceTimestamp) {
    values.push(occurrenceTimestamp);
  }

  try {
    const res = await runQuery(sql, values);
    const event = res.rows[0];

    // Trigger progress recalculation for this syllabus node
    if (syllabusNodeId) {
      if (client) {
        await recalculateSyllabusNodeProgress(userId, syllabusNodeId, client);
      } else {
        recalculateSyllabusNodeProgress(userId, syllabusNodeId).catch(err => {
          console.error(`[eventService] Failed to recalculate progress for ${syllabusNodeId}:`, err.message);
        });
      }
    }

    return event;
  } catch (err) {
    console.error('[eventService] Error inserting study event:', err.message);
    throw err;
  }
}
