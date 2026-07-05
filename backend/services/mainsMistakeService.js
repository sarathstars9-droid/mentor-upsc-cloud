import { query } from "../db/index.js";
import { ensureRevisionItemFromMistake } from "./revisionService.js";

// Helper to classify feedback text into one of the 13 canonical mistake types
export function classifyFeedbackPoint(text, paper) {
  const t = String(text || "").toLowerCase();
  const paperStr = String(paper || "").toLowerCase();
  const isEthics = paperStr.includes("ethics") || paperStr.includes("gs4") || paperStr.includes("gs paper iv") || paperStr.includes("general studies iv");
  const isEssay = paperStr.includes("essay") || paperStr.includes("gs paper i essay") || paperStr.includes("general studies i essay");
  const isGeo = paperStr.includes("geography") || paperStr.includes("optional");

  if (isEthics && (t.includes("example") || t.includes("case study"))) {
    return "ethics_example_missing";
  }
  if (isEssay && (t.includes("flow") || t.includes("transition") || t.includes("structure") || t.includes("coherence"))) {
    return "essay_flow_issue";
  }
  if (isGeo && (t.includes("concept") || t.includes("theory") || t.includes("model") || t.includes("geographer") || t.includes("perspective"))) {
    return "optional_concept_gap";
  }

  if (t.includes("demand") || t.includes("mismatch") || t.includes("core") || t.includes("off-topic") || t.includes("understanding") || t.includes("focus") || t.includes("missed")) {
    return "question_demand_mismatch";
  }
  if (t.includes("intro") || t.includes("introduction") || t.includes("start")) {
    return "weak_introduction";
  }
  if (t.includes("conclusion") || t.includes("conclude") || t.includes("way forward") || t.includes("future")) {
    return "weak_conclusion";
  }
  if (t.includes("diagram") || t.includes("map") || t.includes("flowchart") || t.includes("sketch") || t.includes("visual") || t.includes("drawing")) {
    return "diagram_or_map_missing";
  }
  if (t.includes("example") || t.includes("case study") || t.includes("illustration")) {
    return "missing_examples";
  }
  if (t.includes("data") || t.includes("report") || t.includes("committee") || t.includes("statistic") || t.includes("fact") || t.includes("percent") || t.includes("number")) {
    return "missing_data_or_reports";
  }
  if (t.includes("structure") || t.includes("heading") || t.includes("subheading") || t.includes("format") || t.includes("flow")) {
    return "weak_structure";
  }
  if (t.includes("analysis") || t.includes("critical") || t.includes("argument") || t.includes("evaluate") || t.includes("reasoning") || t.includes("depth")) {
    return "weak_analysis";
  }
  if (t.includes("presentation") || t.includes("neat") || t.includes("write") || t.includes("underlin") || t.includes("margin") || t.includes("handwriting")) {
    return "presentation_issue";
  }
  
  return "content_gap";
}

// Parse string score (e.g. "4.5/10") into numbers
export function parseScore(scoreVal) {
  if (scoreVal === null || scoreVal === undefined) return { scoreNum: null, maxScore: 10 };
  if (typeof scoreVal === 'number') return { scoreNum: scoreVal, maxScore: 10 };
  const s = String(scoreVal).trim();
  const match = s.match(/^([\d.]+)\s*\/\s*([\d.]+)$/);
  if (match) {
    return { scoreNum: parseFloat(match[1]), maxScore: parseFloat(match[2]) };
  }
  const singleNum = parseFloat(s);
  if (!isNaN(singleNum)) {
    return { scoreNum: singleNum, maxScore: 10 };
  }
  return { scoreNum: null, maxScore: 10 };
}

// Determine mistake severity
export function determineSeverity(mistakeType, text, scoreNum, maxScore, isCritical = false) {
  if (isCritical) return "high";
  if (scoreNum !== null && maxScore > 0) {
    if ((scoreNum / maxScore) < 0.4) {
      return "high";
    }
  }
  const t = String(text || "").toLowerCase();
  if (
    mistakeType === "question_demand_mismatch" ||
    mistakeType === "optional_concept_gap" ||
    t.includes("incorrect") ||
    t.includes("wrong concept") ||
    t.includes("misunderstood") ||
    t.includes("critical error")
  ) {
    return "high";
  }
  if (
    mistakeType === "weak_structure" ||
    mistakeType === "missing_examples" ||
    mistakeType === "missing_data_or_reports" ||
    mistakeType === "weak_analysis" ||
    mistakeType === "diagram_or_map_missing" ||
    mistakeType === "ethics_example_missing" ||
    mistakeType === "essay_flow_issue"
  ) {
    return "medium";
  }
  if (
    mistakeType === "presentation_issue" ||
    mistakeType === "weak_conclusion" ||
    mistakeType === "weak_introduction"
  ) {
    return "low";
  }
  return "medium";
}

// Generate unique question_id to enforce uniqueness and update on conflict
export function getQuestionIdForMistake(attemptId, mistakeType, text) {
  const cleanAttempt = String(attemptId || 'no_attempt').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanText = String(text || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
  
  let hashVal = 5381;
  for (let i = 0; i < cleanText.length; i++) {
    hashVal = (hashVal * 33 + cleanText.charCodeAt(i)) & 0xffffffff;
  }
  const hash = Math.abs(hashVal).toString(36).slice(0, 8);
  
  return `mains_${cleanAttempt}_${mistakeType}_${hash}`;
}

// Upsert a single mistake row into the database
export async function upsertMainsMistake(data) {
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
      block_id,
      attempt_id,
      paper,
      topic,
      mistake_type,
      mistake_text,
      severity,
      status,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW())
    ON CONFLICT (user_id, question_id)
    DO UPDATE SET
      source_ref = EXCLUDED.source_ref,
      subject = COALESCE(EXCLUDED.subject, mistakes.subject),
      node_id = COALESCE(EXCLUDED.node_id, mistakes.node_id),
      question_text = EXCLUDED.question_text,
      selected_answer = EXCLUDED.selected_answer,
      notes = EXCLUDED.notes,
      must_revise = CASE WHEN EXCLUDED.must_revise = true OR mistakes.must_revise = true THEN true ELSE EXCLUDED.must_revise END,
      block_id = COALESCE(EXCLUDED.block_id, mistakes.block_id),
      attempt_id = EXCLUDED.attempt_id,
      paper = EXCLUDED.paper,
      topic = EXCLUDED.topic,
      mistake_type = EXCLUDED.mistake_type,
      mistake_text = EXCLUDED.mistake_text,
      severity = CASE WHEN EXCLUDED.severity = 'high' OR mistakes.severity = 'high' THEN 'high' ELSE EXCLUDED.severity END,
      status = EXCLUDED.status,
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    data.userId || 'user_1',
    'mains',
    data.attemptId || null,
    data.questionId,
    'mains',
    data.subject || null,
    data.nodeId || null,
    data.questionText || null,
    data.candidateAnswer || null,
    null,
    data.severity === 'high' ? 'wrong' : 'average',
    data.mistakeType,
    data.notes || null,
    Boolean(data.mustRevise),
    data.blockId || null,
    data.attemptId || null,
    data.paper || null,
    data.topic || null,
    data.mistakeType,
    data.mistakeText,
    data.severity,
    data.status || 'open'
  ];

  const res = await query(sql, values);
  const savedMistake = res.rows[0];

  // Spaced repetition schedule matching requirements:
  // High severity: tomorrow (+1 day), then 3 days, then 7 days
  // Medium severity: 3 days or 7 days (defaults to +3 days)
  // Low severity: 7 to 14 days (defaults to +7 days)
  if (savedMistake && (savedMistake.must_revise || savedMistake.severity === 'high' || savedMistake.severity === 'medium' || savedMistake.severity === 'low')) {
    await ensureRevisionItemFromMistake(savedMistake);
  }

  return savedMistake;
}

/**
 * Process a basic Gemini evaluation and generate mistakes
 */
export async function generateMistakesFromBasicEvaluation({
  userId,
  attemptId,
  paper,
  subject,
  topic,
  questionText,
  candidateAnswer,
  evaluationJson,
  score,
  blockId,
  nodeId
}) {
  if (!evaluationJson) return [];
  const finalAttemptId = attemptId || `mains_basic_${Date.now()}`;
  const { scoreNum, maxScore } = parseScore(score || evaluationJson.score);

  const feedbackPoints = [];
  if (Array.isArray(evaluationJson.topFixes)) {
    evaluationJson.topFixes.forEach(fix => {
      if (fix && String(fix).trim()) feedbackPoints.push({ text: String(fix).trim(), type: 'fix' });
    });
  }
  if (Array.isArray(evaluationJson.missingDimensions)) {
    evaluationJson.missingDimensions.forEach(dim => {
      const dimStr = typeof dim === 'string' ? dim : (dim.dimension || dim.customLabel || '');
      if (dimStr && String(dimStr).trim()) feedbackPoints.push({ text: String(dimStr).trim(), type: 'dimension' });
    });
  }

  // Limit to maximum 5 mistakes
  const pointsToUse = feedbackPoints.slice(0, 5);
  const generatedMistakes = [];

  for (const point of pointsToUse) {
    const mistakeType = classifyFeedbackPoint(point.text, paper);
    const severity = determineSeverity(mistakeType, point.text, scoreNum, maxScore);
    const mustRevise = severity === 'high';
    const questionId = getQuestionIdForMistake(finalAttemptId, mistakeType, point.text);

    let baseNotes = point.text;
    let mistakeText = point.text;
    if (point.type === 'fix') {
      mistakeText = `Weakness: ${point.text}`;
    } else {
      mistakeText = `Missing dimension: ${point.text}`;
      baseNotes = `Ensure you address this dimension: ${point.text}`;
    }

    const displayScore = score || evaluationJson.score || '';
    const scoreStr = displayScore ? String(displayScore) : '—';
    const notes = `[Source: gemini_basic] [Score: ${scoreStr}]\n${baseNotes}`;

    try {
      const saved = await upsertMainsMistake({
        userId,
        attemptId: finalAttemptId,
        questionId,
        paper,
        subject,
        topic,
        questionText,
        candidateAnswer,
        mistakeType,
        mistakeText: mistakeText.slice(0, 255),
        notes,
        severity,
        mustRevise,
        status: 'open',
        blockId,
        nodeId
      });
      generatedMistakes.push(saved);
    } catch (err) {
      console.error("[BasicReviewMistakes] Failed to save mistake:", err.message);
    }
  }

  return generatedMistakes;
}

/**
 * Process a ChatGPT AIR-1 review and enrich or add mistakes
 */
export async function generateMistakesFromAir1Review({
  userId,
  attemptId,
  paper,
  subject,
  topic,
  questionText,
  candidateAnswer,
  air1ReviewJson,
  score,
  blockId,
  nodeId
}) {
  if (!air1ReviewJson) return [];
  const finalAttemptId = attemptId || `mains_air1_${Date.now()}`;
  
  // Try to find the score from AIR-1 review
  const scoredRaw = air1ReviewJson?.estimatedMarks?.scored || air1ReviewJson?.score || score;
  const { scoreNum, maxScore } = parseScore(scoredRaw);

  const feedbackPoints = [];
  
  // Extract from oneAnswerWeaknessSignals
  if (Array.isArray(air1ReviewJson.oneAnswerWeaknessSignals)) {
    air1ReviewJson.oneAnswerWeaknessSignals.forEach(sig => {
      const weaknessText = sig.weakness || sig.evidenceSnippet || '';
      if (weaknessText && String(weaknessText).trim()) {
        feedbackPoints.push({
          text: String(weaknessText).trim(),
          isCritical: sig.severity === 'high',
          type: 'weakness'
        });
      }
    });
  }

  // Extract from missingDimensions
  if (Array.isArray(air1ReviewJson.missingDimensions)) {
    air1ReviewJson.missingDimensions.forEach(dim => {
      const dimText = dim.dimension || dim.customLabel || dim.normalizedKey || '';
      if (dimText && String(dimText).trim()) {
        feedbackPoints.push({
          text: `Missing Dimension: ${String(dimText).trim()}`,
          isCritical: dim.severity === 'high',
          type: 'dimension'
        });
      }
    });
  }

  // Fallbacks if structured lists are absent
  if (feedbackPoints.length === 0) {
    if (Array.isArray(air1ReviewJson.topImprovements)) {
      air1ReviewJson.topImprovements.forEach(imp => {
        const impText = typeof imp === 'string' ? imp : (imp.fix || imp.problem || '');
        if (impText && String(impText).trim()) {
          feedbackPoints.push({ text: String(impText).trim(), isCritical: false, type: 'fix' });
        }
      });
    }
    if (Array.isArray(air1ReviewJson.lossReasons)) {
      air1ReviewJson.lossReasons.forEach(reason => {
        if (reason && String(reason).trim()) {
          feedbackPoints.push({ text: String(reason).trim(), isCritical: true, type: 'loss' });
        }
      });
    }
  }

  // Limit to maximum 5 mistakes
  const pointsToUse = feedbackPoints.slice(0, 5);
  const generatedMistakes = [];

  for (const point of pointsToUse) {
    const mistakeType = classifyFeedbackPoint(point.text, paper);
    const severity = determineSeverity(mistakeType, point.text, scoreNum, maxScore, point.isCritical);
    const mustRevise = severity === 'high' || point.isCritical;
    const questionId = getQuestionIdForMistake(finalAttemptId, mistakeType, point.text);

    const displayScore = scoreNum !== null ? `${scoreNum}/${maxScore}` : (score || '');
    const scoreStr = displayScore ? String(displayScore) : '—';
    const notes = `[Source: chatgpt_air1] [Score: ${scoreStr}]\nAIR-1 Feedback: ${point.text}`;

    try {
      const saved = await upsertMainsMistake({
        userId,
        attemptId: finalAttemptId,
        questionId,
        paper,
        subject,
        topic,
        questionText,
        candidateAnswer,
        mistakeType,
        mistakeText: point.text.slice(0, 255),
        notes,
        severity,
        mustRevise,
        status: 'open',
        blockId,
        nodeId
      });
      generatedMistakes.push(saved);
    } catch (err) {
      console.error("[Air1ReviewMistakes] Failed to save mistake:", err.message);
    }
  }

  return generatedMistakes;
}
