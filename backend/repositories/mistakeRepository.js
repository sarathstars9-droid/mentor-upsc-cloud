import { query } from "../db/index.js";

export async function upsertMistake(data) {
    const sql = `
    INSERT INTO mistakes (
      user_id,
      source_type,
      source_ref,
      question_id,
      stage,
      subject,
      node_id,
      question_text,
      selected_answer,
      correct_answer,
      answer_status,
      error_type,
      notes,
      must_revise,
      block_id
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
    )
    ON CONFLICT (user_id, question_id)
    DO UPDATE SET
      source_type = EXCLUDED.source_type,
      source_ref = EXCLUDED.source_ref,
      stage = EXCLUDED.stage,
      subject = EXCLUDED.subject,
      node_id = EXCLUDED.node_id,
      question_text = EXCLUDED.question_text,
      selected_answer = EXCLUDED.selected_answer,
      correct_answer = EXCLUDED.correct_answer,
      answer_status = EXCLUDED.answer_status,
      error_type = EXCLUDED.error_type,
      notes = EXCLUDED.notes,
      must_revise = EXCLUDED.must_revise,
      block_id = COALESCE(EXCLUDED.block_id, mistakes.block_id),
      updated_at = NOW()
    RETURNING *;
  `;

    const values = [
        data.user_id,
        data.source_type,
        data.source_ref || null,
        data.question_id || null,
        data.stage || null,
        data.subject || null,
        data.node_id || null,
        data.question_text || null,
        data.selected_answer || null,
        data.correct_answer || null,
        data.answer_status,
        data.error_type || null,
        data.notes || null,
        Boolean(data.must_revise),
        data.block_id || null,
    ];

    const result = await query(sql, values);
    return result.rows[0];
}

export async function createMistake(data) {
    return upsertMistake(data);
}

export async function listMistakes(userId, stage = null) {
    const values = [userId];
    let sql = `SELECT * FROM mistakes WHERE user_id = $1`;

    if (stage) {
        values.push(stage);
        sql += ` AND stage = $2`;
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await query(sql, values);
    return result.rows;
}

export async function findMistakeByUserAndQuestion(userId, questionId) {
    if (!userId || !questionId) return null;

    const result = await query(
        `SELECT * FROM mistakes
         WHERE user_id = $1 AND question_id = $2
         LIMIT 1`,
        [userId, questionId]
    );

    return result.rows[0] || null;
}

export async function updateMistake(id, changes) {
    const allowed = {
        source_type: changes.source_type,
        source_ref: changes.source_ref,
        stage: changes.stage,
        subject: changes.subject,
        node_id: changes.node_id,
        question_text: changes.question_text,
        selected_answer: changes.selected_answer,
        correct_answer: changes.correct_answer,
        answer_status: changes.answer_status,
        error_type: changes.error_type,
        notes: changes.notes,
        must_revise:
            typeof changes.must_revise === "boolean"
                ? changes.must_revise
                : undefined,
    };

    const entries = Object.entries(allowed).filter(([, value]) => value !== undefined);

    if (entries.length === 0) {
        const existing = await query(`SELECT * FROM mistakes WHERE id = $1 LIMIT 1`, [id]);
        return existing.rows[0] || null;
    }

    const setClauses = entries.map(([key], index) => `${key} = $${index + 2}`);
    const values = [id, ...entries.map(([, value]) => value)];

    const sql = `
      UPDATE mistakes
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    const result = await query(sql, values);
    return result.rows[0] || null;
}
