import { query } from "../db/index.js";

export async function saveAir1ReviewIntelligence({
  userId,
  question,
  studentAnswer,
  air1ReviewText,
  paper,
  extractedJson,
  overallLevel,
  estimatedScore,
  coreWeaknesses,
  focusAreas
}) {
  const sql = `
    INSERT INTO air1_review_intelligence (
      user_id,
      question,
      student_answer,
      air1_review_text,
      paper,
      extracted_json,
      overall_level,
      estimated_score,
      core_weaknesses,
      focus_areas,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    RETURNING *;
  `;

  const values = [
    userId || 'moulika',
    question || null,
    studentAnswer || null,
    air1ReviewText || null,
    paper || null,
    extractedJson ? JSON.stringify(extractedJson) : null,
    overallLevel || null,
    estimatedScore !== undefined && estimatedScore !== null && !isNaN(estimatedScore) ? estimatedScore : null,
    coreWeaknesses || [],
    focusAreas || []
  ];

  try {
    const result = await query(sql, values);
    return result.rows[0];
  } catch (error) {
    console.error("[air1ReviewRepository] Error executing DB insert:", error);
    throw error;
  }
}
