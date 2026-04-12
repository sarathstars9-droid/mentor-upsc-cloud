import { query } from "../db/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA RESILIENCE NOTES
//
// The original schema.sql created revision_items WITHOUT these columns:
//   source_ref, question_id, question_text, review_count, interval_days
//
// The production_migration.sql adds them. Until that migration is run on
// Railway, any INSERT referencing those columns fails with pg error 42703
// (undefined_column), and any ON CONFLICT using a not-yet-created unique index
// fails with 42P10.
//
// Strategy: try the full (migrated) query first; catch schema-mismatch errors
// by code; fall back to the original-schema path that is always safe.
//
// pg error codes used here:
//   42703 – undefined_column    (column does not exist)
//   42P10 – invalid_column_ref  (ON CONFLICT references a non-existent index)
// ─────────────────────────────────────────────────────────────────────────────

function isSchemaError(err) {
  return err.code === "42703" || err.code === "42P10";
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: full upsert — requires migrated schema
// ─────────────────────────────────────────────────────────────────────────────
async function _upsertRevisionItemFull(data) {
  const sql = `
    INSERT INTO revision_items (
      user_id,
      source_type,
      source_id,
      source_ref,
      question_id,
      stage,
      subject,
      node_id,
      title,
      content,
      question_text,
      status,
      priority,
      revision_count,
      review_count,
      interval_days,
      last_reviewed_at,
      next_review_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
    )
    ON CONFLICT (user_id, question_id, stage)
    DO UPDATE SET
      source_type     = EXCLUDED.source_type,
      source_id       = EXCLUDED.source_id,
      source_ref      = EXCLUDED.source_ref,
      subject         = EXCLUDED.subject,
      node_id         = EXCLUDED.node_id,
      title           = EXCLUDED.title,
      content         = EXCLUDED.content,
      question_text   = EXCLUDED.question_text,
      priority        = EXCLUDED.priority,
      updated_at      = NOW()
    RETURNING *;
  `;

  const values = [
    data.user_id,
    data.source_type || "prelims_pyq",
    data.source_ref || data.question_id || null,          // source_id
    data.source_ref || null,                               // source_ref
    data.question_id || null,                              // question_id
    data.stage || null,
    data.subject || null,
    data.node_id || null,
    data.title || data.question_text || data.question_id || "Revision Item",
    data.content || data.question_text || null,
    data.question_text || null,
    data.status || "pending",
    data.priority || "medium",
    data.revision_count ?? 0,
    data.review_count ?? 0,
    data.interval_days ?? 1,
    data.last_reviewed_at || null,
    data.next_review_at || new Date().toISOString(),
  ];

  const result = await query(sql, values);
  return result.rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: minimal insert — works with original schema.sql (no migration)
//
// Original revision_items columns:
//   id, user_id, source_type (NOT NULL), source_id, stage, subject, node_id,
//   title (NOT NULL), content, priority, status, due_date,
//   last_reviewed_at, next_review_at, revision_count
//
// No ON CONFLICT here (original schema has no unique index on revision_items).
// Duplicate prevention is handled upstream by findRevisionItemForMistake().
// ─────────────────────────────────────────────────────────────────────────────
async function _insertRevisionItemOriginalSchema(data) {
  const sql = `
    INSERT INTO revision_items (
      user_id,
      source_type,
      source_id,
      stage,
      subject,
      node_id,
      title,
      content,
      priority,
      status,
      last_reviewed_at,
      next_review_at,
      revision_count
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
    )
    RETURNING *;
  `;

  const values = [
    data.user_id,
    data.source_type || "prelims_pyq",                    // NOT NULL in original schema
    data.source_ref || data.question_id || null,          // source_id — nearest equivalent
    data.stage || null,
    data.subject || null,
    data.node_id || null,
    data.title || data.question_text || data.question_id || "Revision Item", // NOT NULL
    data.content || data.question_text || null,
    data.priority || "medium",
    data.status || "pending",
    data.last_reviewed_at || null,
    data.next_review_at || new Date().toISOString(),
    data.revision_count ?? 0,
  ];

  const result = await query(sql, values);
  return result.rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: upsertRevisionItem
// Tries the full migrated-schema INSERT first.
// Falls back to the minimal original-schema INSERT on any schema-mismatch error.
// ─────────────────────────────────────────────────────────────────────────────
export async function upsertRevisionItem(data) {
  try {
    return await _upsertRevisionItemFull(data);
  } catch (err) {
    if (isSchemaError(err)) {
      console.warn(
        "[REVISION REPO] Full upsert failed (migration not yet applied) — " +
        "falling back to original-schema insert. Error:",
        err.message
      );
      return await _insertRevisionItemOriginalSchema(data);
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: findRevisionItemForMistake
//
// Deduplication key (in priority order):
//   1. user_id + question_id + stage        ← always preferred when question_id present
//   2. user_id + source_id + stage          ← original-schema fallback (only when no question_id)
//
// IMPORTANT: source_ref is intentionally NOT used for dedup.
// A single source_ref (e.g. "practice_gs_subject_economy_na") belongs to one
// sectional test and can produce many distinct wrong questions. Matching on
// source_ref alone would collapse all of them into a single revision item.
//
// Gracefully handles columns that do not yet exist in the DB (schema errors
// 42703 / 42P10 are caught and the next path is tried).
// ─────────────────────────────────────────────────────────────────────────────
export async function findRevisionItemForMistake(userId, questionId, _sourceType, sourceRef, stage) {
  // 1. By question_id + stage  (requires migrated schema — column question_id)
  //    This is the only correct key when question_id is present; do NOT fall
  //    through to source_ref matching after this succeeds or finds nothing.
  if (questionId) {
    try {
      const result = await query(
        `SELECT * FROM revision_items
         WHERE user_id = $1
           AND question_id = $2
           AND (stage = $3 OR ($3::text IS NULL AND stage IS NULL))
         LIMIT 1`,
        [userId, questionId, stage || null]
      );
      // Row found → it's a true duplicate for this question.
      if (result.rows[0]) return result.rows[0];
      // Row NOT found → this question has no revision item yet; return null
      // immediately. Do NOT continue to source_ref — that would incorrectly
      // treat another question from the same test as a duplicate.
      return null;
    } catch (err) {
      if (!isSchemaError(err)) throw err;
      // column question_id doesn't exist yet — fall through to source_id check
    }
  }

  // 2. By source_id + stage  (original schema — always exists)
  //    Only reached when question_id is absent OR the question_id column
  //    doesn't exist yet in the DB.
  //    source_id stores source_ref || question_id (set during insert).
  const sourceIdVal = sourceRef || questionId || null;
  if (sourceIdVal) {
    const result = await query(
      `SELECT * FROM revision_items
       WHERE user_id = $1
         AND source_id = $2
         AND (stage = $3 OR ($3::text IS NULL AND stage IS NULL))
       LIMIT 1`,
      [userId, sourceIdVal, stage || null]
    );
    return result.rows[0] || null;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// listRevisionItems — unchanged
// ─────────────────────────────────────────────────────────────────────────────
export async function listRevisionItems(userId, options = {}) {
  const values = [userId];
  const where = [`user_id = $1`];

  if (options.stage) {
    values.push(options.stage);
    where.push(`stage = $${values.length}`);
  }

  if (options.status) {
    values.push(options.status);
    where.push(`status = $${values.length}`);
  }

  if (options.dueOnly) {
    where.push(`next_review_at <= NOW()`);
  }

  const sql = `
    SELECT *
    FROM revision_items
    WHERE ${where.join(" AND ")}
    ORDER BY next_review_at ASC, created_at DESC
  `;

  const result = await query(sql, values);
  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// getRevisionItemById — unchanged
// ─────────────────────────────────────────────────────────────────────────────
export async function getRevisionItemById(id) {
  const result = await query(
    `SELECT * FROM revision_items WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// updateRevisionItem — unchanged
// ─────────────────────────────────────────────────────────────────────────────
export async function updateRevisionItem(id, changes) {
  const allowed = {
    status:           changes.status,
    priority:         changes.priority,
    review_count:     changes.review_count,
    revision_count:   changes.revision_count,   // kept in sync with review_count
    interval_days:    changes.interval_days,
    last_reviewed_at: changes.last_reviewed_at,
    next_review_at:   changes.next_review_at,
    question_text:    changes.question_text,
    subject:          changes.subject,
    node_id:          changes.node_id,
  };

  const entries = Object.entries(allowed).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return await getRevisionItemById(id);
  }

  const setClauses = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = [id, ...entries.map(([, value]) => value)];

  const sql = `
    UPDATE revision_items
    SET ${setClauses.join(", ")}, updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const result = await query(sql, values);
  return result.rows[0] || null;
}
