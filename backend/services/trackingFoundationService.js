import { query } from '../db/index.js';

/**
 * Recalculate and update the syllabus_node_progress for a given user and syllabus node.
 */
export async function recalculateSyllabusNodeProgress(userId, syllabusNodeId, client = null) {
  if (!userId || !syllabusNodeId) return;

  const runQuery = client ? client.query.bind(client) : query;

  try {
    // 1. Fetch study blocks for this node
    const blocksRes = await runQuery(
      `SELECT 
         COALESCE(SUM(planned_minutes), 0) as planned,
         COALESCE(SUM(actual_minutes), 0) as actual
       FROM public.study_blocks 
       WHERE user_id = $1 AND (node_id = $2 OR syllabus_node_id = $2)`,
      [userId, syllabusNodeId]
    );
    const planned = Number(blocksRes.rows[0]?.planned || 0);
    const actual = Number(blocksRes.rows[0]?.actual || 0);

    // 2. Fetch study event counts
    const eventsRes = await runQuery(
      `SELECT event_type, COUNT(*) as count 
       FROM public.study_events 
       WHERE user_id = $1 AND syllabus_node_id = $2
       GROUP BY event_type`,
      [userId, syllabusNodeId]
    );

    let pyqSeenCount = 0;
    let practiceCount = 0;
    let revisionCount = 0;
    let mistakeCount = 0;

    for (const row of eventsRes.rows) {
      const type = row.event_type;
      const count = Number(row.count || 0);
      if (type === 'PYQ_SEEN') {
        pyqSeenCount += count;
      } else if (['PYQ_ATTEMPTED', 'MCQ_ATTEMPTED', 'MAINS_ANSWER_SUBMITTED'].includes(type)) {
        practiceCount += count;
      } else if (type === 'REVISION_COMPLETED') {
        revisionCount += count;
      } else if (type === 'MISTAKE_LOGGED') {
        mistakeCount += count;
      }
    }

    // Secondary count verification from raw tables
    // Mistakes count
    const mistakesRes = await runQuery(
      `SELECT COUNT(*) as count FROM public.mistakes WHERE user_id = $1 AND node_id = $2`,
      [userId, syllabusNodeId]
    );
    const dbMistakeCount = Number(mistakesRes.rows[0]?.count || 0);
    mistakeCount = Math.max(mistakeCount, dbMistakeCount);

    // Completed revisions
    const revisionsRes = await runQuery(
      `SELECT COUNT(*) as count FROM public.revision_items WHERE user_id = $1 AND node_id = $2 AND status = 'reviewed'`,
      [userId, syllabusNodeId]
    );
    const dbRevisionCount = Number(revisionsRes.rows[0]?.count || 0);
    revisionCount = Math.max(revisionCount, dbRevisionCount);

    // 3. Fetch practice accuracy and score from block_logs
    const logsRes = await runQuery(
      `SELECT 
         AVG(accuracy) as avg_accuracy, 
         AVG(score) as avg_score
       FROM public.block_logs bl
       JOIN public.study_blocks sb ON bl.block_id = sb.id
       WHERE bl.user_id = $1 AND (sb.node_id = $2 OR sb.syllabus_node_id = $2)`,
      [userId, syllabusNodeId]
    );
    const avgAccuracy = logsRes.rows[0]?.avg_accuracy != null ? Number(logsRes.rows[0].avg_accuracy) : null;
    const avgScore = logsRes.rows[0]?.avg_score != null ? Number(logsRes.rows[0].avg_score) : null;

    // 4. Calculate Readiness Score components
    // Hour completion (35%)
    let hourCompletionPct = 0;
    if (planned > 0) {
      hourCompletionPct = Math.min(1.0, actual / planned);
    } else if (actual > 0) {
      hourCompletionPct = actual >= 60 ? 1.0 : actual / 60.0;
    }

    // PYQ exposure (20%)
    const pyqExposurePct = pyqSeenCount >= 1 ? 1.0 : 0.0;

    // Practice output (20%)
    const practiceOutputPct = practiceCount >= 1 ? 1.0 : 0.0;

    // Revision completion (15%)
    const revisionCompletionPct = revisionCount >= 1 ? 1.0 : 0.0;

    // Quality score (10%)
    let qualityScorePct = 0;
    const scores = [];
    if (avgAccuracy != null) scores.push(avgAccuracy / 100.0);
    if (avgScore != null) scores.push(avgScore / 100.0);
    if (scores.length > 0) {
      qualityScorePct = scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    const readinessScore = (
      (35.0 * hourCompletionPct) +
      (20.0 * pyqExposurePct) +
      (20.0 * practiceOutputPct) +
      (15.0 * revisionCompletionPct) +
      (10.0 * qualityScorePct)
    );

    // 5. Determine status ladder position
    let status = 'UNTOUCHED';
    if (revisionCount >= 2 && qualityScorePct >= 0.85) {
      status = 'MASTERED';
    } else if (revisionCount >= 1) {
      status = 'REVISED';
    } else if (practiceCount >= 1) {
      status = 'PRACTICED';
    } else if (pyqSeenCount >= 1) {
      status = 'PYQ_SEEN';
    } else if (actual > 0) {
      status = 'STUDIED';
    } else if (planned > 0) {
      status = 'PLANNED';
    }

    // 6. Get last touched timestamp
    const touchRes = await runQuery(
      `SELECT MAX(event_time) as last_touch FROM (
         SELECT event_time FROM public.plan_block_events WHERE user_id = $1 AND block_id IN (
           SELECT id FROM public.study_blocks WHERE user_id = $1 AND (node_id = $2 OR syllabus_node_id = $2)
         )
         UNION ALL
         SELECT created_at FROM public.study_events WHERE user_id = $1 AND syllabus_node_id = $2
         UNION ALL
         SELECT created_at FROM public.mistakes WHERE user_id = $1 AND node_id = $2
       ) t`,
      [userId, syllabusNodeId]
    );
    const lastTouchedAt = touchRes.rows[0]?.last_touch || new Date().toISOString();

    // 7. Determine next action prescription
    let nextAction = 'Plan study block';
    if (status === 'PLANNED') {
      nextAction = 'Start and complete planned study block';
    } else if (status === 'STUDIED') {
      nextAction = 'Review related PYQs (exposure revision)';
    } else if (status === 'PYQ_SEEN') {
      nextAction = 'Attempt MCQs / Mains answer writing practice';
    } else if (status === 'PRACTICED') {
      nextAction = 'Schedule first revision session';
    } else if (status === 'REVISED') {
      nextAction = 'Log weak points and do final mastery drill';
    } else if (status === 'MASTERED') {
      nextAction = 'Maintain mastery with scheduled spaced review';
    }

    // 8. Upsert progress record
    await runQuery(
      `INSERT INTO public.syllabus_node_progress (
         user_id, syllabus_node_id, status, planned_minutes, actual_minutes,
         pyq_seen_count, practice_count, revision_count, mistake_count,
         readiness_score, last_touched_at, next_action, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (user_id, syllabus_node_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         planned_minutes = EXCLUDED.planned_minutes,
         actual_minutes = EXCLUDED.actual_minutes,
         pyq_seen_count = EXCLUDED.pyq_seen_count,
         practice_count = EXCLUDED.practice_count,
         revision_count = EXCLUDED.revision_count,
         mistake_count = EXCLUDED.mistake_count,
         readiness_score = EXCLUDED.readiness_score,
         last_touched_at = EXCLUDED.last_touched_at,
         next_action = EXCLUDED.next_action,
         updated_at = NOW();`,
      [
        userId, syllabusNodeId, status, planned, actual,
        pyqSeenCount, practiceCount, revisionCount, mistakeCount,
        Number(readinessScore.toFixed(2)), lastTouchedAt, nextAction
      ]
    );

  } catch (err) {
    console.error(`[recalculateSyllabusNodeProgress] Error for node ${syllabusNodeId}:`, err.message);
  }
}

/**
 * Generate Backlog Rescue items based on missed blocks, overdue revisions, weak nodes,
 * target deficits, and untouched high-priority syllabus nodes.
 */
export async function generateBacklogRescue(userId) {
  if (!userId) return [];

  const createdBacklogs = [];
  const todayKey = new Date().toISOString().slice(0, 10);

  try {
    // Helper to log a backlog item
    const addBacklogItem = async (subject, topic, syllabusNodeId, reason, riskLevel, rescueAction, dueDate = null) => {
      const sql = `
        INSERT INTO public.backlog_items (
          user_id, subject, topic, syllabus_node_id, reason, risk_level, rescue_action, status, due_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
        ON CONFLICT DO NOTHING
        RETURNING *;
      `;
      const res = await query(sql, [
        userId, subject, topic || 'Unspecified Topic', syllabusNodeId || null,
        reason, riskLevel, rescueAction, dueDate || todayKey
      ]);
      if (res.rows[0]) {
        createdBacklogs.push(res.rows[0]);
        // Write event study log
        await query(
          `INSERT INTO public.study_events (user_id, event_type, subject, topic, syllabus_node_id, metadata_json)
           VALUES ($1, 'BACKLOG_CREATED', $2, $3, $4, $5)`,
          [userId, subject, topic, syllabusNodeId, JSON.stringify({ backlog_id: res.rows[0].id, reason, riskLevel })]
        );
      }
    };

    // ── 1. Missed Blocks ──
    const missedBlocks = await query(
      `SELECT * FROM public.study_blocks 
       WHERE user_id = $1 
         AND day_key < $2 
         AND (started_at IS NULL OR status IN ('missed', 'skipped', 'planned'))
       ORDER BY day_key DESC`,
      [userId, todayKey]
    );

    for (const block of missedBlocks.rows) {
      await addBacklogItem(
        block.subject || 'GS',
        block.topic || 'Missed study block',
        block.node_id || null,
        `Missed planned block from ${block.day_key}`,
        'medium',
        `Schedule a 90-minute core recovery session to cover this block`,
        block.day_key
      );
    }

    // ── 2. Overdue Revisions ──
    const overdueRevisions = await query(
      `SELECT * FROM public.revision_items 
       WHERE user_id = $1 
         AND next_review_at <= NOW() 
         AND status = 'pending'`,
      [userId]
    );

    for (const item of overdueRevisions.rows) {
      await addBacklogItem(
        item.subject || 'General',
        item.title || 'Overdue Revision',
        item.node_id || null,
        `Revision overdue since ${new Date(item.next_review_at).toLocaleDateString()}`,
        'high',
        `Spend 15 minutes reviewing mistakes / revision sheets for: ${item.title}`
      );
    }

    // ── 3. Repeated Mistakes ──
    const repeatedMistakes = await query(
      `SELECT node_id, subject, COUNT(*) as m_count 
       FROM public.mistakes 
       WHERE user_id = $1 
       GROUP BY node_id, subject
       HAVING COUNT(*) >= 3`,
      [userId]
    );

    for (const m of repeatedMistakes.rows) {
      await addBacklogItem(
        m.subject || 'GS',
        `Repeated Mistakes Recovery`,
        m.node_id,
        `Accumulated ${m.m_count} mistakes on this node`,
        'critical',
        `Review mistake logs, correct understanding of core concepts and attempt 5 practice MCQs`
      );
    }

    // ── 4. Subject Target Deficits ──
    // Get target hours and actual minutes in current week
    const mondayStr = getMondayOfCurrentWeek();
    const targetsRes = await query(
      `SELECT subject, weekly_target_minutes, target_hours 
       FROM public.subject_targets 
       WHERE user_id = $1`,
      [userId]
    );

    for (const t of targetsRes.rows) {
      const actualMinutesRes = await query(
        `SELECT COALESCE(SUM(actual_minutes), 0) as mins 
         FROM public.study_blocks 
         WHERE user_id = $1 
           AND status IN ('completed', 'partial')
           AND day_key >= $2`,
        [userId, mondayStr]
      );
      const actualMins = Number(actualMinutesRes.rows[0]?.mins || 0);
      const targetMins = Number(t.weekly_target_minutes || 0);

      // If we are significantly behind (deficit > 120 mins)
      if (targetMins > 0 && (targetMins - actualMins) > 120) {
        await addBacklogItem(
          t.subject,
          'Subject Weekly Target Pace Rescue',
          null,
          `Pace Deficit: ${Math.round((targetMins - actualMins) / 60)} hours behind weekly target`,
          'high',
          `Add an extra 2-hour buffer block to make up for subject target deficit`
        );
      }
    }

    // ── 5. Untouched High-Priority Nodes ──
    // Query untouched zones (readiness = 0, but listed under high-priority subjects)
    // For simplicity, we can fetch all nodes in syllabus_node_progress that are UNTOUCHED or have 0 readiness score
    const untouchedNodes = await query(
      `SELECT * FROM public.syllabus_node_progress 
       WHERE user_id = $1 AND status = 'UNTOUCHED' 
       ORDER BY last_touched_at ASC LIMIT 5`,
      [userId]
    );

    for (const node of untouchedNodes.rows) {
      await addBacklogItem(
        'Syllabus',
        `Untouched Node: ${node.syllabus_node_id}`,
        node.syllabus_node_id,
        `Node has never been studied or planned`,
        'medium',
        `Schedule a 60-minute introductory learning block for this node`
      );
    }

  } catch (err) {
    console.error('[generateBacklogRescue] Error:', err.message);
  }

  return createdBacklogs;
}

// Helper to determine Monday of the current week in Asia/Kolkata timezone
function getMondayOfCurrentWeek() {
  const now = new Date();
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
