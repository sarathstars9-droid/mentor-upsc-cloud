import { query } from "../db/index.js";

export async function saveBasicEvaluation(data) {
  const sql = `
    INSERT INTO mains_answer_evaluations (
      user_id, question, answer, paper, marks, word_limit, evaluation_json, score, weakness_tags
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;
  const values = [
    data.userId || 'moulika',
    data.question,
    data.answer,
    data.paper,
    data.marks,
    data.wordLimit,
    data.evaluationJson ? JSON.stringify(data.evaluationJson) : null,
    data.score !== undefined && data.score !== null && !isNaN(data.score) ? data.score : null,
    data.weaknessTags || []
  ];
  try {
    const result = await query(sql, values);
    return result.rows[0];
  } catch (error) {
    console.error("[evaluateAnswerRepository] Error executing DB insert:", error);
    throw error;
  }
}
