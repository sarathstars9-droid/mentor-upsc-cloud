// backend/repositories/knowledgeLinkageRepository.js
// Data access layer for the Knowledge Linkage Engine (Phase 8).
// All queries use the shared pool from db/index.js.
//
// Tables used: block_pyq_links, study_blocks, mistakes, revision_items

import { pool } from '../db/index.js';

// ── Helper: safe table check ─────────────────────────────────────────────────
// If the migration hasn't run yet, queries will fail with "relation does not exist".
// Wrap calls so the rest of the app doesn't break.

function isTableMissing(err) {
  return err?.message?.includes('does not exist') || err?.code === '42P01';
}

// ── CREATE / UPSERT a linkage row ────────────────────────────────────────────
// Idempotent: ON CONFLICT (user_id, block_id) does nothing on re-trigger.
// Returns the existing or newly created row.

export async function upsertBlockPyqLink(data) {
  try {
    const sql = `
      INSERT INTO block_pyq_links (
        user_id, block_id, node_id, stage,
        recommended_question_count, attempted_question_count,
        correct_count, wrong_count,
        status, skip_reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id, block_id)
      DO UPDATE SET
        node_id                    = COALESCE(EXCLUDED.node_id, block_pyq_links.node_id),
        stage                      = COALESCE(EXCLUDED.stage, block_pyq_links.stage),
        recommended_question_count = GREATEST(EXCLUDED.recommended_question_count, block_pyq_links.recommended_question_count),
        status                     = CASE
                                       WHEN block_pyq_links.status IN ('started','completed') THEN block_pyq_links.status
                                       ELSE EXCLUDED.status
                                     END,
        skip_reason                = EXCLUDED.skip_reason,
        updated_at                 = NOW()
      RETURNING *;
    `;
    const values = [
      data.user_id,
      data.block_id,
      data.node_id || null,
      data.stage || null,
      data.recommended_question_count ?? 0,
      data.attempted_question_count ?? 0,
      data.correct_count ?? 0,
      data.wrong_count ?? 0,
      data.status || 'pending_linkage',
      data.skip_reason || null,
    ];
    const { rows } = await pool.query(sql, values);
    return rows[0];
  } catch (err) {
    if (isTableMissing(err)) {
      console.warn('[knowledgeLinkageRepo] block_pyq_links table not found — migration pending');
      return null;
    }
    throw err;
  }
}

// ── GET linkage for a specific block ─────────────────────────────────────────

export async function getBlockPyqLink(userId, blockId) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM block_pyq_links
       WHERE user_id = $1 AND block_id = $2
       LIMIT 1`,
      [userId, blockId]
    );
    return rows[0] || null;
  } catch (err) {
    if (isTableMissing(err)) return null;
    throw err;
  }
}

// ── UPDATE linkage stats (PYQ follow-through) ────────────────────────────────

export async function updateBlockPyqLink(id, changes) {
  const allowed = {
    attempted_question_count: changes.attempted_question_count,
    correct_count:            changes.correct_count,
    wrong_count:              changes.wrong_count,
    status:                   changes.status,
    skip_reason:              changes.skip_reason,
  };

  const entries = Object.entries(allowed).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return getBlockPyqLinkById(id);

  const setClauses = entries.map(([key], i) => `${key} = $${i + 2}`);
  const values = [id, ...entries.map(([, v]) => v)];

  try {
    const { rows } = await pool.query(
      `UPDATE block_pyq_links
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values
    );
    return rows[0] || null;
  } catch (err) {
    if (isTableMissing(err)) return null;
    throw err;
  }
}

async function getBlockPyqLinkById(id) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM block_pyq_links WHERE id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  } catch (err) {
    if (isTableMissing(err)) return null;
    throw err;
  }
}

// ── GET all linkage rows for a node ──────────────────────────────────────────

export async function getLinksForNode(userId, nodeId) {
  try {
    const { rows } = await pool.query(
      `SELECT bpl.*, pb.title, pb.subject, pb.topic, pb.day_key
       FROM block_pyq_links bpl
       JOIN study_blocks pb ON pb.id = bpl.block_id
       WHERE bpl.user_id = $1 AND bpl.node_id = $2
       ORDER BY bpl.created_at DESC`,
      [userId, nodeId]
    );
    return rows;
  } catch (err) {
    if (isTableMissing(err)) return [];
    throw err;
  }
}

// ── GET unactioned links (recommended but not started/completed) ─────────────

export async function getLinksWithStatus(userId, status, limit = 20) {
  try {
    const { rows } = await pool.query(
      `SELECT bpl.*, pb.subject, pb.topic, pb.node_id AS block_node_id, pb.day_key
       FROM block_pyq_links bpl
       JOIN study_blocks pb ON pb.id = bpl.block_id
       WHERE bpl.user_id = $1 AND bpl.status = $2
       ORDER BY bpl.created_at DESC
       LIMIT $3`,
      [userId, status, limit]
    );
    return rows;
  } catch (err) {
    if (isTableMissing(err)) return [];
    throw err;
  }
}

// ── LINKAGE SUMMARY for reporting (date range) ──────────────────────────────

export async function getLinkageSummary(userId, startDate, endDate) {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)                                                          AS total_links,
         COUNT(*) FILTER (WHERE status = 'recommended')                   AS recommended_count,
         COUNT(*) FILTER (WHERE status IN ('started','completed'))         AS practiced_count,
         COUNT(*) FILTER (WHERE status = 'skipped')                       AS skipped_count,
         COUNT(*) FILTER (WHERE status = 'no_pyqs')                       AS no_pyqs_count,
         COUNT(*) FILTER (WHERE status = 'skipped_generic')               AS generic_count,
         COALESCE(SUM(attempted_question_count), 0)                       AS total_attempted,
         COALESCE(SUM(correct_count), 0)                                  AS total_correct,
         COALESCE(SUM(wrong_count), 0)                                    AS total_wrong
       FROM block_pyq_links
       WHERE user_id = $1
         AND created_at >= $2::TIMESTAMPTZ
         AND created_at <= ($3::DATE + INTERVAL '1 day')::TIMESTAMPTZ`,
      [userId, startDate, endDate]
    );
    return rows[0] || null;
  } catch (err) {
    if (isTableMissing(err)) return null;
    throw err;
  }
}

// ── GET blocks studied but PYQs never attempted (for planner) ────────────────

export async function getNoFollowThroughBlocks(userId, daysCutoff = 14) {
  try {
    const { rows } = await pool.query(
      `SELECT bpl.*, pb.subject, pb.topic, pb.day_key
       FROM block_pyq_links bpl
       JOIN study_blocks pb ON pb.id = bpl.block_id
       WHERE bpl.user_id = $1
         AND bpl.status = 'recommended'
         AND bpl.recommended_question_count > 0
         AND bpl.created_at >= NOW() - ($2 * INTERVAL '1 day')
       ORDER BY bpl.created_at DESC`,
      [userId, daysCutoff]
    );
    return rows;
  } catch (err) {
    if (isTableMissing(err)) return [];
    throw err;
  }
}

// ── GET pending linkage blocks (for durable async processing) ────────────────

export async function getPendingLinkageBlocks(userId, limit = 50) {
  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM study_blocks
       WHERE user_id = $1
         AND linkage_pending = TRUE
         AND status IN ('completed','partial')
       ORDER BY ended_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows;
  } catch (err) {
    if (isTableMissing(err)) return [];
    // linkage_pending column might not exist yet
    if (err.code === '42703') return [];
    throw err;
  }
}

// ── CLEAR pending linkage flag ──────────────────────────────────────────────

export async function clearLinkagePending(blockRowId) {
  try {
    await pool.query(
      `UPDATE study_blocks
       SET linkage_pending = FALSE, updated_at = NOW()
       WHERE id = $1`,
      [blockRowId]
    );
  } catch (err) {
    if (isTableMissing(err) || err.code === '42703') return;
    throw err;
  }
}

// ── REVISION ITEMS count by node for planner ─────────────────────────────────

export async function getOverdueRevisionCountsByNode(userId, limit = 20) {
  try {
    const { rows } = await pool.query(
      `SELECT
         node_id,
         COUNT(*) AS overdue_count
       FROM revision_items
       WHERE user_id = $1
         AND node_id IS NOT NULL
         AND status = 'pending'
         AND next_review_at <= NOW()
       GROUP BY node_id
       HAVING COUNT(*) >= 3
       ORDER BY overdue_count DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows;
  } catch (err) {
    if (isTableMissing(err)) return [];
    throw err;
  }
}

// ── MISTAKE density by node for planner ──────────────────────────────────────

export async function getHighMistakeDensityNodes(userId, daysCutoff = 30, limit = 20) {
  try {
    const { rows } = await pool.query(
      `SELECT
         node_id,
         subject,
         COUNT(*) AS mistake_count,
         COUNT(*) FILTER (WHERE answer_status = 'wrong') AS wrong_count,
         COUNT(*) FILTER (WHERE answer_status = 'correct') AS correct_count
       FROM mistakes
       WHERE user_id = $1
         AND node_id IS NOT NULL
         AND created_at >= NOW() - ($2 * INTERVAL '1 day')
       GROUP BY node_id, subject
       HAVING COUNT(*) > 3
         AND (COUNT(*) FILTER (WHERE answer_status = 'correct')::FLOAT
              / GREATEST(COUNT(*), 1)) < 0.5
       ORDER BY mistake_count DESC
       LIMIT $3`,
      [userId, daysCutoff, limit]
    );
    return rows;
  } catch (err) {
    if (isTableMissing(err)) return [];
    throw err;
  }
}
