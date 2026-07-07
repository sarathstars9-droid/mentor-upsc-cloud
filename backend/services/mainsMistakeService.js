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
  
  return `mains:${cleanAttempt}:${mistakeType}:${hash}`;
}

// MISTAKE BOOK TEMPLATES (Why it matters, Fix)
export const MISTAKE_TEMPLATES = {
  question_demand_mismatch: {
    why: "Misunderstanding the core directive or demand leads to off-topic arguments, scoring below-average marks.",
    fix: "Read the question twice, underline the directive words (e.g. 'critically analyze'), and align every section directly with what is asked."
  },
  optional_concept_gap: {
    why: "Optional papers require academic depth. Using generic language instead of core concepts or theories loses professional authority.",
    fix: "Use precise terminologies, refer to relevant thinkers/theories, and explain the core concept explicitly."
  },
  content_gap: {
    why: "Missing key dimensions makes the answer shallow and incomplete, leaving scope for the examiner to deduct marks.",
    fix: "Brainstorm 360-degree aspects (social, economic, political, environmental) and write distinct points for each."
  },
  weak_structure: {
    why: "Poorly structured answers make it hard for the examiner to navigate, reducing the overall impression and score.",
    fix: "Divide the answer into clear sections with bold subheadings and use numbered/bullet points for readability."
  },
  weak_analysis: {
    why: "One-sided or superficial arguments without critical analysis fail to demonstrate public servant problem-solving skills.",
    fix: "Provide balanced arguments, state pros and cons, use the 'critically examine' approach, and back each point with reasoning."
  },
  essay_flow_issue: {
    why: "Essays require seamless transition and coherence between paragraphs. Abrupt shifts break the narrative flow.",
    fix: "Use logical connector sentences at the end of each paragraph to introduce the next theme smoothly."
  },
  ethics_example_missing: {
    why: "Ethics answers without real-life examples, case studies, or moral dilemmas read like dry theory and lack personal conviction.",
    fix: "Quote at least one real-life administrator example, historical incident, or case study per sub-part."
  },
  missing_examples: {
    why: "Arguments without concrete illustrations remain theoretical and fail to convince the examiner of your practical understanding.",
    fix: "Back every major argument with a real-world example, scheme, or case study."
  },
  missing_data_or_reports: {
    why: "Lack of authoritative data, committee recommendations, or reports makes arguments look like personal opinions rather than verified facts.",
    fix: "Cite relevant reports (e.g., ARC, NITI Aayog), constitutional articles, Supreme Court cases, or official statistics."
  },
  diagram_or_map_missing: {
    why: "Visual aids like maps, flowcharts, or diagrams break monotony and save the examiner's time, boosting the score by 0.5 to 1 mark.",
    fix: "Draw a neat schematic diagram, India/World map, or flowchart to illustrate spatial distributions or processes."
  },
  weak_introduction: {
    why: "A weak or generic introduction fails to capture the examiner's interest and set a positive tone for the rest of the answer.",
    fix: "Start with a precise definition, recent current affairs context, or relevant statistical data (max 30-40 words)."
  },
  weak_conclusion: {
    why: "An abrupt or repetitive conclusion fails to leave a constructive, forward-looking impression.",
    fix: "End with a positive, futuristic 'Way Forward', linking it to SDGs, national objectives, or constitutional values."
  },
  presentation_issue: {
    why: "Poor handwriting, layout, or lack of highlighting makes reading laborious for the examiner, causing subtle marks deduction.",
    fix: "Improve neatness, leave adequate margins, highlight key terms, and keep spacing uniform."
  }
};

export const MISTAKE_WEAKNESS_MAP = {
  question_demand_mismatch: "The answer does not fully address the core demand or directive of the question.",
  optional_concept_gap: "The answer lacks core optional subject concepts, models, or geographers' perspectives.",
  content_gap: "There is a gap in the coverage of essential dimensions and points.",
  weak_structure: "The answer structure, subheadings, or structural flow needs improvement.",
  weak_analysis: "The analysis lacks critical depth, balanced arguments, or detailed reasoning.",
  essay_flow_issue: "The essay lacks smooth transitions and logical coherence between paragraphs.",
  ethics_example_missing: "Ethics answer lacks relevant real-life examples or administrative case studies.",
  missing_examples: "The arguments are not backed by concrete real-world examples.",
  missing_data_or_reports: "The answer lacks authoritative data, statistics, or committee reports.",
  diagram_or_map_missing: "The answer lacks illustrative diagrams, maps, or schematic flowcharts.",
  weak_introduction: "The introduction is generic and does not set a strong context.",
  weak_conclusion: "The conclusion lacks a constructive, forward-looking Way Forward.",
  presentation_issue: "The overall presentation, neatness, margin spacing, or key terms highlighting needs improvement."
};

// Generic check
export function isGenericMistake(text) {
  if (!text) return true;
  const t = String(text).trim().toLowerCase().replace(/[.!]$/, "");
  
  const genericPhrases = [
    "improve the answer",
    "add more points",
    "choose another relevant national objective",
    "more specific examples are needed",
    "missing examples",
    "add more examples",
    "structure the answer",
    "conclusion needs work",
    "add data or facts",
    "improve structure",
    "explain better",
    "weak structure",
    "weak introduction",
    "weak conclusion",
    "missing data",
    "missing reports",
    "add examples",
    "provide examples",
    "poor analysis",
    "weak analysis",
    "more examples",
    "more context",
    "give examples",
    "improve introduction",
    "improve conclusion",
    "better examples",
    "needs better structure",
    "more examples needed"
  ];

  if (genericPhrases.includes(t)) {
    return true;
  }
  
  return false;
}

// Text normalization check
export function normalizeMistakeText(text) {
  if (!text) return "";
  let cleaned = String(text).toLowerCase();
  cleaned = cleaned.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"“”[\]]/g, "");
  const fillers = new Set([
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been", "being",
    "in", "on", "at", "to", "for", "of", "with", "by", "about", "against", "between", "into",
    "through", "during", "before", "after", "above", "below", "from", "up", "down", "out",
    "off", "over", "under", "again", "further", "then", "once", "here", "there", "when",
    "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other",
    "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "should", "would", "could", "must", "can"
  ]);
  cleaned = cleaned.split(/\s+/)
    .filter(word => !fillers.has(word))
    .join(" ");
  return cleaned.slice(0, 100).trim();
}

// Text enricher
export function enrichText(existingText, newText) {
  if (!existingText) return newText;
  if (!newText) return existingText;

  let cleanNew = newText;
  const newMatch = newText.match(/Why it matters:[\s\S]*$/i);
  if (newMatch) {
    cleanNew = newMatch[0].trim();
  }

  if (existingText.includes(cleanNew) || existingText.includes(newText)) {
    return existingText;
  }
  
  return `${existingText}\n\n${newText}`;
}

// Priority levels
export function getPriorityLevel(mistakeType) {
  switch (mistakeType) {
    case 'question_demand_mismatch':
      return 1;
    case 'optional_concept_gap':
    case 'content_gap':
      return 2;
    case 'weak_analysis':
    case 'weak_structure':
    case 'essay_flow_issue':
      return 3;
    case 'ethics_example_missing':
    case 'missing_examples':
    case 'missing_data_or_reports':
    case 'diagram_or_map_missing':
      return 4;
    case 'weak_introduction':
    case 'weak_conclusion':
    case 'presentation_issue':
      return 5;
    default:
      return 6;
  }
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

  if (savedMistake && (savedMistake.must_revise || savedMistake.severity === 'high' || savedMistake.severity === 'medium' || savedMistake.severity === 'low')) {
    await ensureRevisionItemFromMistake(savedMistake);
  }

  return savedMistake;
}

// Unified processor with quality gate & duplicate prevention
export async function processMainsMistakes({
  userId,
  attemptId,
  paper,
  subject,
  topic,
  questionText,
  candidateAnswer,
  feedbackPoints,
  score,
  blockId,
  nodeId,
  sourceLabel
}) {
  const { scoreNum, maxScore } = parseScore(score);
  const candidates = [];

  for (const point of feedbackPoints) {
    const rawText = String(point.text || "").trim();
    if (!rawText) continue;

    const mistakeType = classifyFeedbackPoint(rawText, paper);
    const severity = determineSeverity(mistakeType, rawText, scoreNum, maxScore, point.isCritical || false);
    // must_revise only for high severity or clearly critical AIR-1 feedback
    const mustRevise = (severity === 'high') || (sourceLabel === 'chatgpt_air1' && point.isCritical === true);

    let mistakeText = rawText;
    if (point.type === 'fix') {
      mistakeText = `Weakness: ${rawText}`;
    } else if (point.type === 'dimension') {
      mistakeText = `Missing dimension: ${rawText}`;
    }

    let baseNotes = rawText;
    if (point.type === 'dimension') {
      baseNotes = `Ensure you address this dimension: ${rawText}`;
    }

    // Quality gate: length checks (summary and fix must be >= 25 characters)
    if (mistakeText.length < 25 || baseNotes.length < 25) {
      console.log(`[QualityGate] Rejected point due to length (< 25): mistakeText="${mistakeText}", fix="${baseNotes}"`);
      continue;
    }

    // Quality gate: generic rejections
    if (isGenericMistake(rawText) || isGenericMistake(mistakeText) || isGenericMistake(baseNotes)) {
      console.log(`[QualityGate] Rejected generic mistake: "${rawText}"`);
      continue;
    }

    const tpl = MISTAKE_TEMPLATES[mistakeType] || MISTAKE_TEMPLATES.content_gap;
    const whyItMatters = tpl.why;
    
    const displayScore = scoreNum !== null ? `${scoreNum}/${maxScore}` : (score || '—');
    const notes = `Source: ${sourceLabel}\nScore: ${displayScore}\nWhy it matters: ${whyItMatters}\nFix: ${baseNotes}`;

    candidates.push({
      mistakeType,
      mistakeText,
      notes,
      rawText,
      baseNotes,
      severity,
      mustRevise
    });
  }

  // Deduplicate in current batch
  const uniqueCandidates = [];
  const seenTypes = new Set();
  const seenNormalizedTexts = new Set();

  for (const cand of candidates) {
    const norm = normalizeMistakeText(cand.rawText);
    
    let isDuplicate = false;
    if (seenTypes.has(cand.mistakeType)) {
      isDuplicate = true;
    } else {
      for (const seenNorm of seenNormalizedTexts) {
        if (norm && seenNorm && (norm.startsWith(seenNorm) || seenNorm.startsWith(norm) || norm === seenNorm)) {
          isDuplicate = true;
          break;
        }
      }
    }

    if (isDuplicate) {
      const existing = uniqueCandidates.find(x => {
        if (x.mistakeType === cand.mistakeType) return true;
        const xNorm = normalizeMistakeText(x.rawText);
        return norm && xNorm && (norm.startsWith(xNorm) || xNorm.startsWith(norm) || norm === xNorm);
      });
      if (existing) {
        existing.notes = enrichText(existing.notes, cand.notes);
      }
    } else {
      uniqueCandidates.push(cand);
      seenTypes.add(cand.mistakeType);
      if (norm) seenNormalizedTexts.add(norm);
    }
  }

  // Prioritize and slice to max 3 mistakes
  uniqueCandidates.sort((a, b) => getPriorityLevel(a.mistakeType) - getPriorityLevel(b.mistakeType));
  const finalCandidates = uniqueCandidates.slice(0, 3);

  const results = [];
  // Fetch all existing mistakes for this attempt to check duplicates
  const existingDbRes = await query(
    `SELECT * FROM mistakes WHERE user_id = $1 AND attempt_id = $2`,
    [userId || 'user_1', attemptId]
  );
  const existingMistakes = existingDbRes.rows;

  for (const cand of finalCandidates) {
    const normCand = normalizeMistakeText(cand.rawText);
    
    // Find duplicate in DB: same mistake_type OR matching normalized text
    const duplicateDb = existingMistakes.find(m => {
      if (m.mistake_type === cand.mistakeType || m.error_type === cand.mistakeType) {
        return true;
      }
      const normDb = normalizeMistakeText(m.mistake_text || m.notes || "");
      return normCand && normDb && (normCand.startsWith(normDb) || normDb.startsWith(normCand) || normCand === normDb);
    });

    if (duplicateDb) {
      console.log(`[DuplicatePrevention] Found existing duplicate mistake in DB (type: ${cand.mistakeType}, normalized match). Enriching...`);
      
      const enrichedNotes = enrichText(duplicateDb.notes, cand.notes);
      const updated = await query(
        `UPDATE mistakes SET notes = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [enrichedNotes, duplicateDb.id]
      );
      
      if (updated.rows[0]) {
        await ensureRevisionItemFromMistake(updated.rows[0]);
        results.push(updated.rows[0]);
      }
    } else {
      const questionId = getQuestionIdForMistake(attemptId, cand.mistakeType, cand.rawText);
      try {
        const saved = await upsertMainsMistake({
          userId,
          attemptId,
          questionId,
          paper,
          subject,
          topic,
          questionText,
          candidateAnswer,
          mistakeType: cand.mistakeType,
          mistakeText: cand.mistakeText.slice(0, 255),
          notes: cand.notes,
          severity: cand.severity,
          mustRevise: cand.mustRevise,
          status: 'open',
          blockId,
          nodeId
        });
        results.push(saved);
      } catch (err) {
        console.error(`[processMainsMistakes] Failed to save mistake:`, err.message);
      }
    }
  }

  return results;
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

  return await processMainsMistakes({
    userId,
    attemptId: finalAttemptId,
    paper,
    subject,
    topic,
    questionText,
    candidateAnswer,
    feedbackPoints,
    score: score || evaluationJson.score,
    blockId,
    nodeId,
    sourceLabel: 'gemini_basic'
  });
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
  
  const feedbackPoints = [];
  
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

  return await processMainsMistakes({
    userId,
    attemptId: finalAttemptId,
    paper,
    subject,
    topic,
    questionText,
    candidateAnswer,
    feedbackPoints,
    score,
    blockId,
    nodeId,
    sourceLabel: 'chatgpt_air1'
  });
}

