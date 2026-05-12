/**
 * mainsPerformanceService.js
 * Step 5: Performance Intelligence Engine
 *
 * generatePerformanceSnapshot(userId):
 *   Aggregates data from all mains tables to produce a comprehensive
 *   performance intelligence report, including:
 *
 *   DESCRIPTIVE (what happened)
 *   - averageScore            (all-time normalised /10)
 *   - strongestPaper          (best avg score by paper)
 *   - weakestPaper            (worst avg score by paper)
 *   - mostFrequentWeakness    (highest evidence_count signal)
 *   - improvementTrend        (last 5 vs previous 5 avg score delta)
 *   - actionCompletionRate    (% of actions completed)
 *   - revisionEffectiveness   (% of signals remediated + severity stats)
 *   - top3PersistentWeaknesses (severity-ranked with evidence + revision info)
 *   - scoreProgressionData    (chronological array for graph)
 *   - componentAverages       (per-component score breakdown)
 *
 *   PREDICTIVE / ACTIONABLE (what will happen)
 *   - predictionLayer         (predictedScore, narrative)
 *   - focusRecommendation     (weakestPaper + topWeakness → today's focus)
 *   - confidenceScore         (reliability of analysis, 0–1)
 *   - behaviorWarning         (low execution rate alert, or null)
 */

import {
  getEvaluationHistory,
  getPaperScoreStats,
  getWeaknessSummary,
  getActionCompletionStats,
  getRevisionEffectivenessStats,
} from "../repositories/mainsIntelligenceRepository.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
const avg    = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
const round1 = v   => parseFloat(v.toFixed(1));
const round2 = v   => parseFloat(v.toFixed(2));
const pct    = (n, d) => d > 0 ? round1((n / d) * 100) : null;

/** Convert a DB evaluation row to a normalised /10 score. */
function toScore10(row) {
  const max = Number(row.max_score) || 10;
  return round1((Number(row.total_score) / max) * 10);
}

/** Trend direction from a delta value. */
function trendDirection(delta) {
  if (delta === null)  return "insufficient_data";
  if (delta > 0.3)     return "improving";
  if (delta < -0.3)    return "declining";
  return "stable";
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * generatePerformanceSnapshot(userId)
 *
 * All DB calls run in parallel via Promise.all for speed.
 */
export async function generatePerformanceSnapshot(userId) {
  if (!userId || !String(userId).trim()) throw new Error("Missing userId");

  // ── Parallel DB fetch ──────────────────────────────────────────────────────
  const [history, paperStats, weaknesses, actionStats, revisionStats] =
    await Promise.all([
      getEvaluationHistory(userId, 20),
      getPaperScoreStats(userId),
      getWeaknessSummary(userId, 10),
      getActionCompletionStats(userId),
      getRevisionEffectivenessStats(userId),
    ]);

  // ── averageScore ──────────────────────────────────────────────────────────
  const allScores   = history.map(toScore10);
  const averageScore = allScores.length ? round1(avg(allScores)) : null;

  // ── strongestPaper / weakestPaper ─────────────────────────────────────────
  // paperStats is already ordered strongest → weakest
  const strongestPaper = paperStats.length > 0
    ? { paper: paperStats[0].paper, avgScore: round1(Number(paperStats[0].avg_score_10)), attempts: Number(paperStats[0].attempt_count) }
    : null;
  const weakestPaper = paperStats.length > 1
    ? { paper: paperStats[paperStats.length - 1].paper, avgScore: round1(Number(paperStats[paperStats.length - 1].avg_score_10)), attempts: Number(paperStats[paperStats.length - 1].attempt_count) }
    : null;

  // ── mostFrequentWeakness ──────────────────────────────────────────────────
  // Sort by evidence_count DESC; weaknesses is currently severity-sorted
  const byEvidence      = [...weaknesses].sort((a, b) => Number(b.evidence_count) - Number(a.evidence_count));
  const mostFrequentWeakness = byEvidence.length > 0
    ? {
        label:         byEvidence[0].weakness_label,
        type:          byEvidence[0].weakness_type,
        evidenceCount: Number(byEvidence[0].evidence_count),
        severity:      Number(byEvidence[0].severity),
      }
    : null;

  // ── improvementTrend (last 5 vs previous 5) ───────────────────────────────
  const last5scores  = allScores.slice(0, 5);
  const prev5scores  = allScores.slice(5, 10);
  const last5Avg     = last5scores.length >= 1  ? round1(avg(last5scores))  : null;
  const prev5Avg     = prev5scores.length >= 1  ? round1(avg(prev5scores))  : null;
  const trendDelta   = last5Avg !== null && prev5Avg !== null ? round1(last5Avg - prev5Avg) : null;

  const improvementTrend = {
    last5Avg,
    prev5Avg,
    delta:     trendDelta,
    direction: trendDirection(trendDelta),
    note: history.length < 5 ? "Need at least 5 evaluations for trend" : null,
  };

  // ── actionCompletionRate ──────────────────────────────────────────────────
  const totalActions     = Number(actionStats.total_actions     || 0);
  const completedActions = Number(actionStats.completed_actions || 0);
  const skippedActions   = Number(actionStats.skipped_actions   || 0);
  const pendingActions   = Number(actionStats.pending_actions   || 0);

  const actionCompletionRate = totalActions > 0
    ? {
        rate:      pct(completedActions, totalActions),
        completed: completedActions,
        skipped:   skippedActions,
        pending:   pendingActions,
        total:     totalActions,
      }
    : null;

  // ── revisionEffectiveness ─────────────────────────────────────────────────
  const totalSignals      = Number(revisionStats.total_signals      || 0);
  const remediatedSignals = Number(revisionStats.remediated_signals || 0);
  const totalRevisionsDone = Number(revisionStats.total_revisions_done || 0);

  const revisionEffectiveness = totalSignals > 0
    ? {
        remediationRate:         pct(remediatedSignals, totalSignals),
        remediatedSignals,
        totalSignals,
        totalRevisionsDone,
        avgCurrentSeverity:      revisionStats.avg_severity_current     !== null ? round2(Number(revisionStats.avg_severity_current))     : null,
        avgRemediatedSeverity:   revisionStats.avg_severity_remediated  !== null ? round2(Number(revisionStats.avg_severity_remediated))  : null,
      }
    : null;

  // ── top3PersistentWeaknesses ──────────────────────────────────────────────
  // Already severity-sorted from DB; take top 3
  const top3PersistentWeaknesses = weaknesses.slice(0, 3).map(w => ({
    label:         w.weakness_label,
    type:          w.weakness_type,
    severity:      round1(Number(w.severity)),
    evidenceCount: Number(w.evidence_count),
    revisionCount: Number(w.revision_count || 0),
    paper:         w.paper  || null,
    subject:       w.subject || null,
    lastSeen:      w.last_seen_at,
  }));

  // ── scoreProgressionData (chronological, for graph) ───────────────────────
  const scoreProgressionData = [...history]
    .reverse()  // oldest first for graph
    .map((row, idx) => ({
      index:      idx + 1,
      date:       row.created_at,
      score:      toScore10(row),
      paper:      row.paper   || null,
      subject:    row.subject || null,
      topic:      row.topic   || null,
      wordCount:  row.word_count  || null,
      timeTaken:  row.time_taken  || null,
      diagnosis:  row.one_line_diagnosis || null,
    }));

  // ── componentAverages (breakdown for radar chart) ─────────────────────────
  // Normalise each component to /10 scale using max_score of the evaluation
  function compAvg(field) {
    if (!history.length) return null;
    const vals = history.map(r => {
      const max = Number(r.max_score) || 10;
      // Component max is proportional: each component is ~max/8
      return round1((Number(r[field]) / (max / 8)) * 10);
    });
    return round1(avg(vals));
  }

  const componentAverages = history.length > 0 ? {
    intro:        compAvg("intro_score"),
    structure:    compAvg("structure_score"),
    content:      compAvg("content_score"),
    examples:     compAvg("examples_score"),
    analysis:     compAvg("analysis_score"),
    conclusion:   compAvg("conclusion_score"),
    directive:    compAvg("directive_score"),
    presentation: compAvg("presentation_score"),
  } : null;

  // ── GAP 1: Prediction Layer ───────────────────────────────────────────────
  // predictedScore = averageScore + (trendDelta × 0.5), clamped to [0, 10]
  // Gives a forward-looking estimate for the next 5 answers.
  let predictionLayer = null;
  if (averageScore !== null) {
    const delta          = trendDelta !== null ? trendDelta : 0;
    const rawPredicted   = averageScore + delta * 0.5;
    const predictedScore = round1(Math.min(10, Math.max(0, rawPredicted)));

    const direction = trendDirection(trendDelta);
    const narrative =
      direction === "improving"
        ? `At current pace, expected score: ${predictedScore}/10 in next 5 answers`
        : direction === "declining"
        ? `Score may drop to ${predictedScore}/10 if current trend continues`
        : `Score expected to hold around ${predictedScore}/10 based on recent attempts`;

    predictionLayer = {
      predictedScore,
      basis:     `averageScore(${averageScore}) + trendDelta(${delta}) × 0.5`,
      narrative,
      confidence: history.length >= 5 ? "moderate" : "low",
    };
  }

  // ── GAP 2: Focus Recommendation ──────────────────────────────────────────
  // focusArea = weakestPaper + topWeakness (first persistent weakness by severity)
  // If no weakest paper (only 1 paper), use the only paper.
  const focusPaper    = weakestPaper?.paper  || strongestPaper?.paper  || null;
  const focusWeakness = top3PersistentWeaknesses[0]?.label               || mostFrequentWeakness?.label || null;

  const focusRecommendation = focusPaper || focusWeakness
    ? {
        paper:     focusPaper,
        weakness:  focusWeakness,
        message:
          focusPaper && focusWeakness
            ? `Focus today: ${focusPaper} + ${focusWeakness}`
            : focusPaper
            ? `Focus today: ${focusPaper} — review weak answers`
            : `Focus today: Address "${focusWeakness}" across all papers`,
      }
    : null;

  // ── GAP 3: Confidence Score ───────────────────────────────────────────────
  // confidence = min(1.0, totalAttempts / 10)
  // Communicates how reliable the analysis is based on data volume.
  const totalAttempts    = history.length;
  const confidenceRaw    = Math.min(1.0, totalAttempts / 10);
  const confidenceScore  = round2(confidenceRaw);
  const confidenceLabel  =
    confidenceScore >= 0.8 ? "high"
    : confidenceScore >= 0.5 ? "moderate"
    : "low";

  // ── GAP 4: Behavior Warning ───────────────────────────────────────────────
  // Fires when actionCompletionRate < 30% — real mentorship nudge.
  const completionPct  = actionCompletionRate?.rate ?? null;
  let behaviorWarning  = null;
  if (completionPct !== null && totalActions > 0) {
    if (completionPct < 30) {
      behaviorWarning = {
        type:    "low_execution",
        message: `Low execution: you complete only ${completionPct}% of actions. Improvement may stall.`,
        rate:    completionPct,
        advice:  "Try completing at least 1 action per study session before generating new ones.",
      };
    } else if (completionPct < 60) {
      behaviorWarning = {
        type:    "moderate_execution",
        message: `Completion rate is ${completionPct}%. Aim for 60%+ to maximise improvement.`,
        rate:    completionPct,
        advice:  "Prioritise completing high-priority actions before adding more.",
      };
    }
  }

  console.log("[MAINS INTELLIGENCE] performance snapshot generated", {
    userId,
    totalEvaluations:     history.length,
    averageScore,
    predictedScore:       predictionLayer?.predictedScore ?? "n/a",
    trend:                trendDelta !== null ? `${trendDelta > 0 ? "+" : ""}${trendDelta}` : "n/a",
    direction:            improvementTrend.direction,
    actionCompletionRate: actionCompletionRate?.rate ?? "n/a",
    confidence:           `${confidenceScore} (${confidenceLabel})`,
    focusToday:           focusRecommendation?.message ?? "n/a",
    behaviorWarning:      behaviorWarning?.type ?? null,
    top3Weaknesses:       top3PersistentWeaknesses.map(w => w.label),
  });

  return {
    // Descriptive
    averageScore,
    strongestPaper,
    weakestPaper,
    mostFrequentWeakness,
    improvementTrend,
    actionCompletionRate,
    revisionEffectiveness,
    top3PersistentWeaknesses,
    scoreProgressionData,
    componentAverages,
    // Predictive / Actionable (4 new fields)
    predictionLayer,
    focusRecommendation,
    confidenceScore: {
      score: confidenceScore,
      label: confidenceLabel,
      basis: `Based on ${totalAttempts} attempt${totalAttempts !== 1 ? "s" : ""}`,
    },
    behaviorWarning,
    meta: {
      totalEvaluations: history.length,
      totalPapers:      paperStats.length,
      totalSignals:     totalSignals,
      generatedAt:      new Date().toISOString(),
    },
  };
}
