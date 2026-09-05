import { geminiModel } from "./geminiClient.js";
import { parseGeminiUsage } from "../geminiCostTracker.js";
import { query } from "../../db/index.js";
import { resolveMainsSyllabusContext } from "../../mainsReview/resolveMainsSyllabusContext.js";
import { getQuestionsByNodeId } from "../../brain/nodeIdTopicEngine.js";
import { selectSubjectProfile } from "./subjectProfiles.js";
import { validateAndNormalizeV1Payload, getFallbackPayload } from "./mainsEvaluationSchema.js";
import { buildMainsEvaluationPrompt } from "./buildMainsEvaluationPrompt.js";
import { getMainsRagContext } from "../mainsRagContextService.js";

/**
 * Enhanced Mains Answer Evaluator (V1 Pipeline)
 * Supporting structured rubrics, ideal blueprints, examiner impact, visual schemas,
 * and mistake book candidates while preserving backward compatibility.
 */
export async function evaluateMainsAnswer({ userId = "user_1", question, answer, visualArtifacts = null, paper, subject, topic, marks, wordLimit }) {
  const finalPaper = paper || "General Studies";
  const finalSubject = subject || "";
  const finalTopic = topic || "";
  const finalMarks = marks ? parseInt(marks) : 10;
  const finalWordLimit = wordLimit ? parseInt(wordLimit) : 150;

  // --- Map Syllabus Node & Context ---
  let syllabusNodeId = "";
  let syllabusNodeLabel = "";
  let confidence = "low";
  let matchSource = "global_inference";
  let relatedPyqs = [];
  let previousRelevantMistakes = [];

  try {
    const mapping = resolveMainsSyllabusContext({
      question,
      paper: finalPaper,
      subject: finalSubject,
      topic: finalTopic
    });

    if (mapping && mapping.resolvedNodeId) {
      syllabusNodeId = mapping.resolvedNodeId;
      syllabusNodeLabel = mapping.resolvedSyllabusNode;
      confidence = mapping.confidence || "low";
      matchSource = mapping.matchSource || "global_inference";

      try {
        const pyqRes = getQuestionsByNodeId({ nodeId: syllabusNodeId, subjectId: finalSubject });
        if (pyqRes && Array.isArray(pyqRes.questions)) {
          relatedPyqs = pyqRes.questions.slice(0, 3).map(q => ({
            id: q.id,
            question: q.question,
            year: q.year,
            marks: q.marks
          }));
        }
      } catch (e) {
        console.warn("[evaluateAnswer] Failed to fetch PYQs for node:", syllabusNodeId, e.message);
      }

      try {
        const dbRes = await query(
          `SELECT id, mistake_type as "mistakeType", mistake_text as "mistakeText", notes, severity 
           FROM mistakes 
           WHERE user_id = $1 AND node_id = $2 
           ORDER BY created_at DESC 
           LIMIT 3`,
          [userId, syllabusNodeId]
        );
        previousRelevantMistakes = dbRes.rows || [];
      } catch (dbErr) {
        console.warn("[evaluateAnswer] Failed to fetch previous mistakes:", dbErr.message);
      }
    }
  } catch (err) {
    console.error("[evaluateAnswer] Error mapping & retrieving:", err);
  }

  // Get subject profile
  const profile = selectSubjectProfile(finalPaper, finalSubject || finalTopic);

  // --- RAG Knowledge Retrieval (V1.5A) ---
  // Runs non-fatally: if retrieval fails, evaluation continues without RAG context.
  let ragContext = null;
  try {
    ragContext = await getMainsRagContext({
      userId,
      questionIntelligence: {
        syllabus_node_id: syllabusNodeId,
        paper: finalPaper,
        subject: finalSubject,
        topic: finalTopic,
        micro_topic: syllabusNodeLabel
      },
      queryText: question
    });
    const itemCount = ragContext?.retrieval_meta?.knowledge_item_ids?.length || 0;
    console.log(`[evaluateAnswer] RAG context retrieved: ${itemCount} knowledge items, ${ragContext?.related_pyqs?.length || 0} PYQs`);
  } catch (ragErr) {
    console.warn("[evaluateAnswer] RAG context retrieval failed (non-fatal):", ragErr.message);
    // Emit a minimal sentinel so analytics can distinguish failure from empty-store.
    // IMPORTANT: Never expose stack traces or DB secrets here.
    ragContext = {
      syllabus_node: null,
      related_pyqs: [],
      subject_language: [], dimensions: [], evidence: [],
      value_additions: [], geography_optional: [],
      previous_relevant_mistakes: [],
      missing_categories: [],
      retrieval_meta: {
        status: 'FAILED',
        error_code: 'RAG_RETRIEVAL_ERROR',
        retrieval_version: 'mains-rag-v1',
        knowledge_item_ids: [],
        retrieved_pyq_ids: [],
        category_counts: {}
      }
    };
  }


  // pre-eval visual detection (Legacy fallback vs Structured metadata)
  const lowerAnswer = String(answer || "").toLowerCase();
  
  let hasFlowchart = false;
  let hasDiagram = false;
  let hasMap = false;
  let hasTable = false;

  if (visualArtifacts && typeof visualArtifacts === "object") {
    // New flow: Use structured metadata
    hasFlowchart = Boolean(visualArtifacts.flowchart);
    hasDiagram = Boolean(visualArtifacts.diagram) || Boolean(visualArtifacts.geographicalSketch) || Boolean(visualArtifacts.graph);
    hasMap = Boolean(visualArtifacts.map);
    hasTable = Boolean(visualArtifacts.table);
  } else {
    // Legacy fallback
    hasFlowchart = lowerAnswer.includes("flowchart") || lowerAnswer.includes("flow-chart") || lowerAnswer.includes("process flow") || lowerAnswer.includes("step-by-step");
    hasDiagram = lowerAnswer.includes("diagram") || lowerAnswer.includes("sketch") || lowerAnswer.includes("figure") || lowerAnswer.includes("illustration");
    hasMap = lowerAnswer.includes("map") || lowerAnswer.includes("india map") || lowerAnswer.includes("world map");
    hasTable = lowerAnswer.includes("table") || lowerAnswer.includes("comparison") || lowerAnswer.includes("matrix");
  }

  // Determine question nature keywords
  const lowerQuest = String(question || "").toLowerCase();
  const questionNatures = [];
  if (lowerQuest.includes("analyze") || lowerQuest.includes("critically") || lowerQuest.includes("discuss")) {
    questionNatures.push("ANALYTICAL");
  }
  if (lowerQuest.includes("how") || lowerQuest.includes("process") || lowerQuest.includes("mechanism")) {
    questionNatures.push("PROCESS");
    questionNatures.push("MECHANISM");
  }
  if (lowerQuest.includes("spatial") || lowerQuest.includes("distribution") || lowerQuest.includes("where")) {
    questionNatures.push("SPATIAL");
    questionNatures.push("DISTRIBUTIONAL");
  }
  if (lowerQuest.includes("history") || lowerQuest.includes("century") || lowerQuest.includes("evolution") || lowerQuest.includes("chronology")) {
    questionNatures.push("HISTORICAL");
    questionNatures.push("EVOLUTIONARY");
  }
  if (lowerQuest.includes("compare") || lowerQuest.includes("difference") || lowerQuest.includes("distinguish")) {
    questionNatures.push("COMPARATIVE");
  }
  if (lowerQuest.includes("data") || lowerQuest.includes("percent") || lowerQuest.includes("rate") || lowerQuest.includes("statistics")) {
    questionNatures.push("DATA_ORIENTED");
  }
  if (lowerQuest.includes("contemporary") || lowerQuest.includes("recent") || lowerQuest.includes("current") || lowerQuest.includes("judgment")) {
    questionNatures.push("CONTEMPORARY");
  }
  if (lowerQuest.includes("ethics") || lowerQuest.includes("morality") || lowerQuest.includes("values") || lowerQuest.includes("ethical")) {
    questionNatures.push("ETHICAL");
  }
  if (lowerQuest.includes("case study") || lowerQuest.includes("situation")) {
    questionNatures.push("CASE_STUDY");
  }
  if (questionNatures.length === 0) {
    questionNatures.push("CONCEPTUAL");
  }

  // Construct prompt
  const prompt = buildMainsEvaluationPrompt({
    question,
    answer,
    marks: finalMarks,
    wordLimit: finalWordLimit,
    paper: finalPaper,
    subject: finalSubject,
    topic: finalTopic,
    syllabusNodeId,
    syllabusNodeLabel,
    confidence,
    matchSource,
    relatedPyqs,
    previousRelevantMistakes,
    profile,
    questionNatures,
    hasFlowchart,
    hasDiagram,
    hasMap,
    hasTable,
    ragContext
  });

  let rawText = "";
  let result;
  
  const maxRetries = 3;
  const retryDelays = [1500, 3000, 5000];
  const retryStatuses = [429, 500, 502, 503, 504];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      result = await geminiModel.generateContent(prompt);
      break;
    } catch (error) {
      const status = error?.status || error?.response?.status;
      const msg = error?.message || "";
      const isRetryable = retryStatuses.includes(status) || retryStatuses.some(s => msg.includes(String(s)));

      if (attempt < maxRetries && isRetryable) {
        console.warn(`[evaluateMainsAnswer] Gemini API Error (status: ${status || 'unknown'}), retrying in ${retryDelays[attempt]}ms (Attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      } else {
        console.error("[evaluateMainsAnswer] Unrecoverable error generating content from Gemini.");
        throw error;
      }
    }
  }

  rawText = result.response.text();
  let parsed;

  try {
    const jsonCandidate = extractJsonObject(rawText);
    parsed = JSON.parse(jsonCandidate);
  } catch (firstErr) {
    try {
      const repairedCandidate = repairJsonCandidate(rawText);
      parsed = JSON.parse(repairedCandidate);
    } catch (secondErr) {
      console.warn("[evaluate-answer] Failed to parse Gemini JSON after repair, returning fallback structural payload", secondErr.message);
      parsed = getFallbackPayload(finalPaper, finalSubject, finalTopic, syllabusNodeId, syllabusNodeLabel, finalMarks, finalWordLimit, profile.id);
    }
  }

  // Server-side validation & normalization
  const normalized = validateAndNormalizeV1Payload(parsed, finalPaper, finalSubject, finalTopic, syllabusNodeId, syllabusNodeLabel, finalMarks, finalWordLimit, profile.id);

  if (!normalized.evaluation_meta) {
    normalized.evaluation_meta = {};
  }
  normalized.evaluation_meta.ai_usage = parseGeminiUsage(
    result?.response?.usageMetadata, 
    "MAINS_EVALUATION", 
    result?.response?.modelVersion || "gemini-2.5-flash"
  );

  // --- BACKWARD COMPATIBILITY LAYER ---
  const legacyMap = {
    score: normalized.score?.awarded !== undefined ? `${normalized.score.awarded}/${normalized.score.maximum}` : "N/A",
    level: normalized.score?.awarded !== undefined && normalized.score?.maximum > 0
      ? getLegacyLevel(normalized.score.awarded, normalized.score.maximum)
      : "Average",
    examinerImpression: normalized.examiner_impact?.reason || normalized.score?.reason || "Evaluation completed.",
    topFixes: Array.isArray(normalized.strengths) ? normalized.strengths.slice(0, 3) : [],
    missingDimensions: Array.isArray(normalized.dimension_coverage?.missing)
      ? normalized.dimension_coverage.missing.map(m => `${m.dimension || "General"}: ${m.how_to_add || ""}`)
      : [],
    upscStructure: Array.isArray(normalized.ideal_blueprint?.expected_dimensions) ? normalized.ideal_blueprint.expected_dimensions : [],
    improvedIntro: normalized.model_answer?.answer ? normalized.model_answer.answer.substring(0, 150) + "..." : "",
    improvedConclusion: normalized.ideal_blueprint?.way_forward_expectation || "",
    memoryMnemonic: "",
    finalAdvice: normalized.best_value_addition?.content || "Focus on dimensions and core demand."
  };

  return {
    ...legacyMap,
    weakness_tags: normalized.mistakes.map(m => m.category),
    mains_eval_v1: normalized,
    rag_retrieval_meta: ragContext?.retrieval_meta || null
  };
}

function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  let text = rawText.trim();
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  text = text.replace(/^Raw AI Output:\s*/i, "").trim();
  text = text.replace(/^JSON:\s*/i, "").trim();
  const firstBrace = text.indexOf("{");
  const lastBrace  = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }
  return text;
}

function repairJsonCandidate(rawText) {
  if (!rawText || typeof rawText !== "string") return rawText;
  let repaired = rawText.trim();
  repaired = repaired
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const firstBrace = repaired.indexOf("{");
  const lastBrace  = repaired.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    repaired = repaired.slice(firstBrace, lastBrace + 1);
  }
  repaired = repaired.replace(/,\s*([}\]])/g, "$1");
  repaired = repaired
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
  repaired = repaired.replace(/[\u0000-\u001F\u007F]/g, (ch) => {
    if (ch === "\n" || ch === "\r" || ch === "\t") return " ";
    return "";
  });
  return repaired;
}

function getLegacyLevel(awarded, max) {
  const pct = max > 0 ? awarded / max : 0;
  if (pct < 0.35) return "Poor";
  if (pct < 0.45) return "Below Average";
  if (pct < 0.55) return "Average";
  if (pct < 0.70) return "Good";
  return "Excellent";
}
