import { query } from "../db/index.js";

export async function saveBasicEvaluation(data) {
  const sql = `
    INSERT INTO mains_answer_evaluations (
      user_id, question, answer, paper, marks, word_limit, evaluation_json, score, weakness_tags,
      rag_retrieval_version, rag_knowledge_item_ids, rag_retrieved_pyq_ids, rag_missing_categories, rag_category_counts
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
    data.weaknessTags || [],
    // RAG metadata (V1.5A) — null-safe, defaults to empty
    data.ragRetrievalVersion || null,
    JSON.stringify(data.ragKnowledgeItemIds || []),
    JSON.stringify(data.ragRetrievedPyqIds || []),
    JSON.stringify(data.ragMissingCategories || []),
    JSON.stringify(data.ragCategoryCounts || {})
  ];
  try {
    const result = await query(sql, values);
    return result.rows[0];
  } catch (error) {
    console.error("[evaluateAnswerRepository] Error executing DB insert:", error);
    throw error;
  }
}
