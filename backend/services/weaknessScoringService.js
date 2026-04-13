import { query } from "../db/index.js";
import {
  upsertNodeWeaknessScore,
  getTopWeakNodes,
  getWeaknessMap,
} from "../repositories/nodeWeaknessRepository.js";

// ─────────────────────────────────────────────────────────────────────────────
// classifyRiskLevel
//
// Maps a numeric weakness score to a human-readable risk tier.
// ─────────────────────────────────────────────────────────────────────────────
function classifyRiskLevel(score) {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

// ─────────────────────────────────────────────────────────────────────────────
// computeRawScore
//
// Exact formula as specified. Result is clamped to [0, 100].
// ─────────────────────────────────────────────────────────────────────────────
function computeRawScore({
  mistake_count,
  repeat_mistake_count,
  pending_revision_count,
  overdue_revision_count,
  snooze_count,
  reviewed_count,
}) {
  const raw =
    mistake_count         * 10 +
    repeat_mistake_count  * 15 +
    pending_revision_count *  5 +
    overdue_revision_count *  8 +
    snooze_count          *  3 -
    reviewed_count        *  4;

  return Math.min(100, Math.max(0, raw));
}

// ─────────────────────────────────────────────────────────────────────────────
// computeWeaknessForUser
//
// Full pipeline:
//   1. Fetch all mistakes grouped by (node_id, stage)
//   2. Fetch all revision_items grouped by (node_id, stage)
//   3. Merge metrics per node
//   4. Score + classify each node
//   5. Upsert all results into node_weakness_scores
//
// Returns an array of the upserted rows.
// ─────────────────────────────────────────────────────────────────────────────
export async function computeWeaknessForUser(userId) {
  if (!userId) throw new Error("userId is required");

  // ── 1. Aggregate mistake metrics per (node_id, stage) ────────────────────
  //
  // mistake_count         = total distinct mistakes for this node
  // repeat_mistake_count  = questions that appear more than once (updated_at > created_at
  //                         is a reliable proxy since upsertMistake sets updated_at on
  //                         every re-submission)
  const mistakeResult = await query(
    `SELECT
       node_id,
       stage,
       subject,
       COUNT(*)                                                  AS mistake_count,
       COUNT(*) FILTER (WHERE updated_at > created_at + interval '1 second') AS repeat_mistake_count,
       MAX(GREATEST(updated_at, created_at))                    AS last_activity_at
     FROM mistakes
     WHERE user_id = $1
       AND node_id IS NOT NULL
     GROUP BY node_id, stage, subject`,
    [userId]
  );

  // ── 2. Aggregate revision metrics per (node_id, stage) ───────────────────
  const now = new Date().toISOString();
  const revisionResult = await query(
    `SELECT
       node_id,
       stage,
       COUNT(*) FILTER (WHERE status = 'pending')                        AS pending_revision_count,
       COUNT(*) FILTER (WHERE status = 'pending' AND next_review_at < $2) AS overdue_revision_count,
       COUNT(*) FILTER (WHERE status = 'reviewed')                       AS reviewed_count,
       COUNT(*) FILTER (WHERE status = 'snoozed')                        AS snooze_count,
       MAX(COALESCE(last_reviewed_at, updated_at, created_at))           AS last_revision_activity
     FROM revision_items
     WHERE user_id = $1
       AND node_id IS NOT NULL
     GROUP BY node_id, stage`,
    [userId, now]
  );

  // ── 3. Build a merged map keyed by "node_id::stage" ──────────────────────
  const nodeMap = {};

  for (const row of mistakeResult.rows) {
    const key = `${row.node_id}::${row.stage || ""}`;
    nodeMap[key] = {
      node_id:              row.node_id,
      stage:                row.stage || null,
      subject:              row.subject || null,
      mistake_count:        Number(row.mistake_count) || 0,
      repeat_mistake_count: Number(row.repeat_mistake_count) || 0,
      last_activity_at:     row.last_activity_at || null,
      // revision defaults (filled in next loop if revision data exists)
      pending_revision_count: 0,
      overdue_revision_count: 0,
      reviewed_count:         0,
      snooze_count:           0,
    };
  }

  for (const row of revisionResult.rows) {
    const key = `${row.node_id}::${row.stage || ""}`;
    if (!nodeMap[key]) {
      // Node has revision data but no mistake record — include it anyway
      nodeMap[key] = {
        node_id:              row.node_id,
        stage:                row.stage || null,
        subject:              null,
        mistake_count:        0,
        repeat_mistake_count: 0,
        last_activity_at:     row.last_revision_activity || null,
      };
    }

    nodeMap[key].pending_revision_count = Number(row.pending_revision_count) || 0;
    nodeMap[key].overdue_revision_count = Number(row.overdue_revision_count) || 0;
    nodeMap[key].reviewed_count         = Number(row.reviewed_count) || 0;
    nodeMap[key].snooze_count           = Number(row.snooze_count) || 0;

    // Keep the most recent activity timestamp across both tables
    const revTs = row.last_revision_activity;
    if (revTs && (!nodeMap[key].last_activity_at || new Date(revTs) > new Date(nodeMap[key].last_activity_at))) {
      nodeMap[key].last_activity_at = revTs;
    }
  }

  // ── 4 & 5. Score, classify, and upsert each node ─────────────────────────
  const upsertPromises = Object.values(nodeMap).map((node) => {
    const weakness_score = computeRawScore(node);
    const risk_level     = classifyRiskLevel(weakness_score);

    return upsertNodeWeaknessScore({
      user_id: userId,
      ...node,
      weakness_score,
      risk_level,
    });
  });

  const results = await Promise.allSettled(upsertPromises);

  const saved = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      saved.push(r.value);
    } else {
      console.error("[WEAKNESS] upsert failed for one node:", r.reason?.message || r.reason);
    }
  }

  console.log(`[WEAKNESS] computeWeaknessForUser(${userId}): scored ${saved.length}/${Object.keys(nodeMap).length} nodes`);
  return saved;
}

// ─────────────────────────────────────────────────────────────────────────────
// getTopWeakNodesForUser  — thin wrapper kept in service layer for route use
// ─────────────────────────────────────────────────────────────────────────────
export async function getTopWeakNodesForUser(userId, limit = 10) {
  return getTopWeakNodes(userId, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// getWeaknessMapForUser  — thin wrapper kept in service layer for route use
// ─────────────────────────────────────────────────────────────────────────────
export async function getWeaknessMapForUser(userId) {
  return getWeaknessMap(userId);
}
