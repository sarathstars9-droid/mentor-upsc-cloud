import { query } from "../db/index.js";

/**
 * Extracts weaknesses from mains evaluation jsons and creates/updates 
 * mistakes and revision_items.
 */
export async function generateLearningLoop(attemptRow) {
  if (!attemptRow) return;

  const {
    attempt_id,
    user_id,
    paper,
    subject,
    topic,
    question_text,
    basic_review_json,
    air1_parsed_json
  } = attemptRow;

  // 1. Extract weaknesses
  const weaknesses = [];

  const addWeakness = (type, text, severity) => {
    if (!text || typeof text !== 'string') return;
    weaknesses.push({ type, text: text.trim(), severity });
  };

  if (basic_review_json) {
    (basic_review_json.topFixes || []).forEach(fix => addWeakness('basic_top_fix', fix, 'medium'));
    (basic_review_json.missingDimensions || []).forEach(dim => addWeakness('basic_missing_dimension', dim, 'medium'));
  }

  if (air1_parsed_json) {
    (air1_parsed_json.majorMistakes || []).forEach(mistake => addWeakness('air1_major_mistake', mistake, 'high'));
    (air1_parsed_json.missingDimensions || []).forEach(dim => addWeakness('air1_missing_dimension', dim, 'high'));
    (air1_parsed_json.improvementStrategy || []).forEach(strategy => addWeakness('air1_improvement_strategy', strategy, 'medium'));
    if (air1_parsed_json.finalMemoryHook) {
      addWeakness('air1_memory_hook', air1_parsed_json.finalMemoryHook, 'high');
    }
  }

  // Deduplicate weaknesses by text (case insensitive)
  const uniqueWeaknesses = [];
  const seenTexts = new Set();
  for (const w of weaknesses) {
    const key = w.text.toLowerCase();
    if (!seenTexts.has(key)) {
      seenTexts.add(key);
      uniqueWeaknesses.push(w);
    }
  }

  for (const w of uniqueWeaknesses) {
    // 2. Upsert Mistake
    const mistakeSql = `
      INSERT INTO mistakes (
        user_id, source_type, attempt_id, paper, subject, topic, 
        question_text, mistake_type, mistake_text, severity, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      ON CONFLICT (attempt_id, mistake_text) WHERE source_type = 'mains_answer'
      DO UPDATE SET
        mistake_type = EXCLUDED.mistake_type,
        severity = EXCLUDED.severity,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING id
    `;
    const mistakeValues = [
      user_id || 'user_1',
      'mains_answer',
      attempt_id,
      paper || null,
      subject || null,
      topic || null,
      question_text || null,
      w.type,
      w.text,
      w.severity,
      'open'
    ];

    try {
      await query(mistakeSql, mistakeValues);
    } catch (err) {
      console.error("[LearningLoop] Failed to upsert mistake:", err.message);
    }

    // 3. Upsert Revision Item if severity is medium or high
    if (w.severity === 'high' || w.severity === 'medium') {
      const revisionTitle = `Fix ${w.type.replace(/_/g, ' ')}: ${w.text.substring(0, 50)}...`;
      const revisionSql = `
        INSERT INTO revision_items (
          user_id, source_type, source_id, title, description, 
          revision_type, priority, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
        ON CONFLICT (source_id, title) WHERE source_type = 'mains_answer'
        DO UPDATE SET
          description = EXCLUDED.description,
          priority = EXCLUDED.priority,
          status = EXCLUDED.status,
          updated_at = NOW()
      `;
      const revisionValues = [
        user_id || 'user_1',
        'mains_answer',
        attempt_id,
        revisionTitle,
        w.text,
        'mains_rewrite', // or concept_revision based on type
        w.severity,
        'pending'
      ];

      try {
        await query(revisionSql, revisionValues);
      } catch (err) {
        console.error("[LearningLoop] Failed to upsert revision item:", err.message);
      }
    }
  }
}
