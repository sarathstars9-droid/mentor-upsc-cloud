import { query } from "../db/index.js";

export async function upsertRevisionItem(data) {
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
        source_type = EXCLUDED.source_type,
        source_id = EXCLUDED.source_id,
        source_ref = EXCLUDED.source_ref,
        subject = EXCLUDED.subject,
        node_id = EXCLUDED.node_id,
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        question_text = EXCLUDED.question_text,
        priority = EXCLUDED.priority,
        updated_at = NOW()
      RETURNING *;
    `;

  const values = [
    data.user_id,
    data.source_type || "prelims_pyq",
    data.source_ref || data.question_id || null,
    data.source_ref || null,
    data.question_id || null,
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

export async function getRevisionItemById(id) {
  const result = await query(
    `SELECT * FROM revision_items WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function updateRevisionItem(id, changes) {
  const allowed = {
    status: changes.status,
    priority: changes.priority,
    review_count: changes.review_count,
    interval_days: changes.interval_days,
    last_reviewed_at: changes.last_reviewed_at,
    next_review_at: changes.next_review_at,
    question_text: changes.question_text,
    subject: changes.subject,
    node_id: changes.node_id,
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
