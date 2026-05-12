import { query } from "../db/index.js";

function toArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

export async function saveAir1ReviewIntelligence(data) {
  const extractedJson = data.extractedJson || {};

  const estimatedRaw = extractedJson?.estimatedMarks?.scored;
  const estimatedScore =
    estimatedRaw !== undefined && estimatedRaw !== null && !isNaN(Number(estimatedRaw))
      ? Number(estimatedRaw)
      : null;

  const coreWeaknesses = unique(
    toArray(
      (extractedJson?.oneAnswerWeaknessSignals || []).map(
        (item) => item?.weakness
      )
    )
  );

  const drillFocusAreas = toArray(
    (extractedJson?.suggestedDrills || []).map((item) => item?.targetWeakness)
  );
  const missingFocusAreas = toArray(
    (extractedJson?.missingDimensions || []).map((item) => item?.normalizedKey)
  );
  const focusAreas = unique([...drillFocusAreas, ...missingFocusAreas]);

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
      focus_areas
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id;
  `;

  const values = [
    data.userId || "moulika",
    data.question || null,
    data.studentAnswer || null,
    data.air1Review || null,
    data.paper || null,
    JSON.stringify(extractedJson),
    extractedJson?.overallLevel || null,
    estimatedScore,
    coreWeaknesses,
    focusAreas,
  ];

  const result = await query(sql, values);
  return result.rows[0];
}
