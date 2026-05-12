import { query } from "../db/index.js";

export async function getWeaknessSummaryData(userId) {
  // Query 1: Overall stats
  const statsSql = `
    SELECT 
      COUNT(*) as total_evaluations, 
      ROUND(AVG(score), 2) as average_score 
    FROM mains_answer_evaluations 
    WHERE user_id = $1;
  `;
  const statsResult = await query(statsSql, [userId]);
  
  // Query 2: Weighted weakness aggregation (Gemini + AIR-1)
  const weaknessesSql = `
    WITH normalized_weaknesses AS (
      SELECT
        TRIM(tag) AS weakness,
        'basicEvaluation' AS source,
        1 AS weight,
        mae.created_at
      FROM mains_answer_evaluations mae
      CROSS JOIN LATERAL unnest(COALESCE(mae.weakness_tags, ARRAY[]::TEXT[])) AS tag
      WHERE mae.user_id = $1
        AND TRIM(tag) <> ''

      UNION ALL

      SELECT
        TRIM(tag) AS weakness,
        'air1Review' AS source,
        3 AS weight,
        ari.created_at
      FROM air1_review_intelligence ari
      CROSS JOIN LATERAL (
        SELECT DISTINCT value AS tag
        FROM unnest(
          COALESCE(ari.core_weaknesses, ARRAY[]::TEXT[]) ||
          COALESCE(ari.focus_areas, ARRAY[]::TEXT[])
        ) AS value
      ) AS air1_tags
      WHERE ari.user_id = $1
        AND TRIM(tag) <> ''
    )
    SELECT
      weakness,
      COUNT(*)::INT AS count,
      SUM(weight)::INT AS weighted_score,
      COUNT(*) FILTER (WHERE source = 'basicEvaluation')::INT AS basic_evaluation_count,
      COUNT(*) FILTER (WHERE source = 'air1Review')::INT AS air1_review_count,
      MAX(created_at) AS last_seen
    FROM normalized_weaknesses
    GROUP BY weakness
    ORDER BY weighted_score DESC, air1_review_count DESC, count DESC, last_seen DESC;
  `;
  const weaknessesResult = await query(weaknessesSql, [userId]);

  return {
    totalEvaluations: parseInt(statsResult.rows[0]?.total_evaluations || 0, 10),
    averageScore: statsResult.rows[0]?.average_score ? parseFloat(statsResult.rows[0].average_score) : null,
    weaknesses: weaknessesResult.rows
  };
}
