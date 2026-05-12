import {
  saveEvaluation,
  answerAttemptExists,
  checkExistingEvaluation,
  updateEvaluation,
  getAnswerAttemptById,
  upsertWeaknessSignal,
} from "../repositories/mainsIntelligenceRepository.js";

/**
 * Normalize score to 0-max range (clamped)
 * Prevents invalid scores like 600 or -5 from reaching DB
 */
function normalizeScore(score, max = 10) {
  if (typeof score !== "number") return 0;
  if (score < 0) return 0;
  if (score > max) return max;
  return score;
}

/**
 * Safe fallback evaluation object
 */
function getFallbackEvaluation() {
  return {
    totalScore: 0,
    maxScore: 10,
    componentScores: {
      intro: 0,
      structure: 0,
      content: 0,
      examples: 0,
      analysis: 0,
      conclusion: 0,
      directiveHandling: 0,
      presentation: 0,
    },
    strengths: [],
    weaknesses: [],
    missingDimensions: [],
    improvementActions: [],
    oneLineDiagnosis: "",
    rewriteTask: "",
  };
}

/**
 * Strict validation of parsed evaluation structure
 */
function isValidEvaluation(parsed) {
  return (
    parsed &&
    typeof parsed === "object" &&
    typeof parsed.totalScore === "number" &&
    typeof parsed.maxScore === "number" &&
    parsed.componentScores &&
    typeof parsed.componentScores === "object"
  );
}

/**
 * Parse rawEvaluation - try JSON parse first, fallback to safe defaults
 * Always returns an evaluation object (never null)
 * Sanitizes array fields to ensure they are arrays
 */
function tryParseEvaluation(rawEvaluation) {
  if (!rawEvaluation) {
    return getFallbackEvaluation();
  }

  try {
    // If it's already an object, validate and use it
    if (typeof rawEvaluation === "object") {
      if (isValidEvaluation(rawEvaluation)) {
        return normalizeEvaluation(rawEvaluation);
      } else {
        console.log(
          "[MAINS INTELLIGENCE] invalid evaluation structure, using fallback"
        );
        return getFallbackEvaluation();
      }
    }

    // Try to parse as JSON string
    const parsed = JSON.parse(rawEvaluation);

    // Validate structure after parsing
    if (isValidEvaluation(parsed)) {
      return normalizeEvaluation(parsed);
    } else {
      console.log(
        "[MAINS INTELLIGENCE] invalid evaluation structure, using fallback"
      );
      return getFallbackEvaluation();
    }
  } catch (err) {
    // JSON parsing failed - use safe fallback
    console.log("[MAINS INTELLIGENCE] invalid JSON, using fallback");
    return getFallbackEvaluation();
  }
}

/**
 * Normalize parsed evaluation object - ensure all fields are present
 * Sanitizes array fields to prevent invalid data from reaching the DB
 * Applies score normalization to clamp values to valid range
 */
function normalizeEvaluation(parsed) {
  const safeStrengths = Array.isArray(parsed?.strengths) ? parsed.strengths : [];
  const safeWeaknesses = Array.isArray(parsed?.weaknesses) ? parsed.weaknesses : [];
  const safeMissingDimensions = Array.isArray(parsed?.missingDimensions)
    ? parsed.missingDimensions
    : [];
  const safeImprovementActions = Array.isArray(parsed?.improvementActions)
    ? parsed.improvementActions
    : [];

  // Extract max score to use for normalization
  const maxScore = Number(parsed?.maxScore) || 10;

  return {
    totalScore: normalizeScore(parsed?.totalScore, maxScore),
    maxScore: normalizeScore(maxScore, 100), // max itself should not exceed 100
    componentScores: {
      intro: normalizeScore(parsed?.componentScores?.intro, maxScore),
      structure: normalizeScore(parsed?.componentScores?.structure, maxScore),
      content: normalizeScore(parsed?.componentScores?.content, maxScore),
      examples: normalizeScore(parsed?.componentScores?.examples, maxScore),
      analysis: normalizeScore(parsed?.componentScores?.analysis, maxScore),
      conclusion: normalizeScore(parsed?.componentScores?.conclusion, maxScore),
      directiveHandling: normalizeScore(parsed?.componentScores?.directiveHandling, maxScore),
      presentation: normalizeScore(parsed?.componentScores?.presentation, maxScore),
    },
    strengths: safeStrengths,
    weaknesses: safeWeaknesses,
    missingDimensions: safeMissingDimensions,
    improvementActions: safeImprovementActions,
    oneLineDiagnosis: String(parsed?.oneLineDiagnosis || "").trim(),
    rewriteTask: String(parsed?.rewriteTask || "").trim(),
  };
}

// ── Weakness label normalization map ──────────────────────────────────────────
// Maps common surface variations → canonical labels so repeated signals
// for the same conceptual weakness converge to one row (same unique key).
// Keys are lowercased; values are the canonical Title Case label stored in DB.
const WEAKNESS_NORMALIZATION_MAP = {
  // Examples
  "poor examples":           "Weak examples",
  "lack of examples":        "Weak examples",
  "no examples":             "Weak examples",
  "insufficient examples":   "Weak examples",
  "missing examples":        "Weak examples",
  "examples missing":        "Weak examples",

  // Analysis / Depth
  "shallow analysis":        "Shallow analysis",
  "weak analysis":           "Shallow analysis",
  "poor analysis":           "Shallow analysis",
  "lack of depth":           "Shallow analysis",
  "insufficient depth":      "Shallow analysis",
  "surface level analysis":  "Shallow analysis",

  // Structure
  "poor structure":          "Poor structure",
  "bad structure":           "Poor structure",
  "weak structure":          "Poor structure",
  "lack of structure":       "Poor structure",
  "disorganized":            "Poor structure",
  "unstructured":            "Poor structure",

  // Introduction
  "weak introduction":       "Weak introduction",
  "poor introduction":       "Weak introduction",
  "weak intro":              "Weak introduction",
  "poor intro":              "Weak introduction",

  // Conclusion
  "weak conclusion":         "Weak conclusion",
  "poor conclusion":         "Weak conclusion",
  "no conclusion":           "Weak conclusion",
  "missing conclusion":      "Weak conclusion",
  "abrupt conclusion":       "Weak conclusion",

  // Presentation
  "poor presentation":       "Poor presentation",
  "bad handwriting":         "Poor presentation",
  "illegible writing":       "Poor presentation",

  // Directive handling
  "directive not followed":  "Directive not addressed",
  "directive ignored":       "Directive not addressed",
  "missed directive":        "Directive not addressed",

  // Dimensions
  "economy angle":           "Economic angle",
  "economic perspective":    "Economic angle",
  "economic dimension":      "Economic angle",
  "social perspective":      "Social angle",
  "social dimension":        "Social angle",
  "environmental perspective":   "Environmental angle",
  "environmental dimension":     "Environmental angle",
  "governance perspective":      "Governance angle",
  "governance dimension":        "Governance angle",
  "constitutional perspective":  "Constitutional angle",
  "constitutional dimension":    "Constitutional angle",
  "ethical perspective":         "Ethical angle",
  "ethical dimension":           "Ethical angle",
  "historical perspective":      "Historical angle",
  "historical dimension":        "Historical angle",
  "scientific perspective":      "Scientific angle",
  "scientific dimension":        "Scientific angle",
  "international perspective":   "International angle",
  "global perspective":          "International angle",
  "gender perspective":          "Gender angle",
  "gender dimension":            "Gender angle",
};

/**
 * Normalize a raw weakness/dimension label to its canonical form.
 * Lowercases, strips punctuation, then looks up in the map.
 * Falls back to Title-casing the original if no match found.
 */
function normalizeWeaknessLabel(rawLabel) {
  const trimmed = String(rawLabel).trim();
  const key = trimmed.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
  if (WEAKNESS_NORMALIZATION_MAP[key]) {
    return WEAKNESS_NORMALIZATION_MAP[key];
  }
  // No canonical match — title-case the first letter only
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Initial severity by weakness type.
 * - "dimension" (structural/conceptual gap) starts at 1.5 — higher weight
 *   because missing analytical dimensions are harder to fix than surface issues.
 * - "component" (scoring component weakness) starts at 1.0.
 * Both increment by 0.5 on each repeat (handled in the UPSERT SQL).
 */
function severityForType(weaknessType) {
  return weaknessType === "dimension" ? 1.5 : 1.0;
}

/**
 * Update weakness signals from evaluation
 * Extract weaknesses and missingDimensions, normalize labels,
 * apply severity weighting, then upsert to mains_weakness_signals.
 *
 * Context (paper/subject/topic) comes from mains_answer_attempts.
 *
 * For each weakness item:
 *   weakness_type  = "component"
 *   initial severity = 1.0
 *
 * For each missing dimension item:
 *   weakness_type  = "dimension"
 *   initial severity = 1.5  (weighted higher — conceptual gap)
 */
async function updateWeaknessSignals(userId, answerAttemptId, parsedEvaluation) {
  try {
    // Get paper/subject/topic context from the answer attempt row
    const attempt = await getAnswerAttemptById(answerAttemptId);
    if (!attempt) {
      console.warn("[MAINS INTELLIGENCE] answer attempt not found for weakness signals", {
        answerAttemptId,
      });
      return 0;
    }

    const {
      paper   = "UNKNOWN",
      subject = "UNKNOWN",
      topic   = "UNKNOWN",
    } = attempt;

    console.log("[MAINS INTELLIGENCE] weakness context:", { paper, subject, topic });

    let signalsCreated = 0;

    // ── Process weaknesses (type: "component") ────────────────────────────────
    if (Array.isArray(parsedEvaluation.weaknesses)) {
      for (const rawWeakness of parsedEvaluation.weaknesses) {
        if (!rawWeakness || !String(rawWeakness).trim()) continue;

        const normalized = normalizeWeaknessLabel(rawWeakness);
        const severity   = severityForType("component");

        console.log("[MAINS INTELLIGENCE] normalized weakness:", {
          raw: rawWeakness, canonical: normalized, type: "component", severity,
        });

        await upsertWeaknessSignal({
          userId,
          paper,
          subject,
          topic,
          weaknessType:  "component",
          weaknessLabel: normalized.substring(0, 255),
          severity,
        });
        signalsCreated++;
      }
    }

    // ── Process missing dimensions (type: "dimension") ────────────────────────
    if (Array.isArray(parsedEvaluation.missingDimensions)) {
      for (const rawDimension of parsedEvaluation.missingDimensions) {
        if (!rawDimension || !String(rawDimension).trim()) continue;

        const normalized = normalizeWeaknessLabel(rawDimension);
        const severity   = severityForType("dimension");

        console.log("[MAINS INTELLIGENCE] normalized weakness:", {
          raw: rawDimension, canonical: normalized, type: "dimension", severity,
        });
        console.log("[MAINS INTELLIGENCE] severity weighted:", {
          type: "dimension", initialSeverity: severity, rule: "dimension > component",
        });

        await upsertWeaknessSignal({
          userId,
          paper,
          subject,
          topic,
          weaknessType:  "dimension",
          weaknessLabel: normalized.substring(0, 255),
          severity,
        });
        signalsCreated++;
      }
    }

    console.log("[MAINS INTELLIGENCE] weakness signal updated");
    console.log("[MAINS INTELLIGENCE] weakness signals complete", { signalsCreated });
    return signalsCreated;
  } catch (err) {
    console.error("[MAINS INTELLIGENCE] weakness signal update failed:", err.message);
    // Non-blocking: weakness signals are helpful but not critical
    return 0;
  }
}

/**
 * Main evaluation handler - validate, parse, save
 * Always saves rawEvaluation for debugging/reprocessing
 * FK validation is non-blocking (logged as warning)
 * Deduplication: If evaluation already exists for answer_attempt_id, updates it (no duplicates)
 * Weakness Signals: After saving evaluation, extract and upsert weakness signals
 */
export async function evaluateAnswerAttempt({
  userId,
  answerAttemptId,
  rawEvaluation,
}) {
  // Validate required fields
  if (!userId || !String(userId).trim()) {
    throw new Error("Missing or empty userId");
  }

  if (!answerAttemptId || !String(answerAttemptId).trim()) {
    throw new Error("Missing or empty answerAttemptId");
  }

  if (!rawEvaluation) {
    throw new Error("Missing rawEvaluation");
  }

  console.log("[MAINS INTELLIGENCE] evaluate called");
  console.log("[MAINS INTELLIGENCE] userId:", userId);
  console.log("[MAINS INTELLIGENCE] answerAttemptId:", answerAttemptId);

  // Verify answer attempt exists in DB (non-blocking warning)
  try {
    const attemptExists = await answerAttemptExists(answerAttemptId);
    if (!attemptExists) {
      console.warn("[MAINS INTELLIGENCE] answer attempt not found", {
        answerAttemptId,
      });
    }
  } catch (err) {
    console.warn("[MAINS INTELLIGENCE] FK validation check failed:", err.message);
  }

  // Parse evaluation - safe fallback if JSON parsing fails
  const parsedEvaluation = tryParseEvaluation(rawEvaluation);

  console.log("[MAINS INTELLIGENCE] parsed totalScore:", parsedEvaluation.totalScore);

  // Save to database - always include raw evaluation for debugging
  const evaluationData = {
    userId,
    answerAttemptId,
    rawEvaluation: String(rawEvaluation),
    ...parsedEvaluation,
  };

  // ── Deduplication: Check if evaluation already exists for this answer_attempt_id
  // If yes, update it (no duplicate rows). If no, insert new.
  let savedRow;
  try {
    const existingEvaluation = await checkExistingEvaluation(answerAttemptId);
    if (existingEvaluation) {
      console.log("[MAINS INTELLIGENCE] evaluation already exists, updating instead of duplicating");
      savedRow = await updateEvaluation(existingEvaluation.id, evaluationData);
      console.log("[MAINS INTELLIGENCE] evaluation updated, id:", savedRow.id);
    } else {
      savedRow = await saveEvaluation(evaluationData);
      console.log("[MAINS INTELLIGENCE] evaluation saved, id:", savedRow.id);
    }
  } catch (err) {
    console.error("[MAINS INTELLIGENCE] deduplication check failed, attempting insert anyway:", err.message);
    savedRow = await saveEvaluation(evaluationData);
    console.log("[MAINS INTELLIGENCE] evaluation saved (dedup check failed), id:", savedRow.id);
  }

  console.log("[MAINS INTELLIGENCE] evaluation saved");

  // ── Weakness Signals: Extract and upsert weakness signals from evaluation
  // Non-blocking: if this fails, evaluation is already saved
  const weaknessSignalsUpdated = await updateWeaknessSignals(
    userId,
    answerAttemptId,
    parsedEvaluation
  );

  return {
    savedRow,
    weaknessSignalsUpdated,
  };
}
