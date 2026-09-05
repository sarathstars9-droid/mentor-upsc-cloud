/**
 * src/utils/normalizeMainsEvaluationForUI.js
 *
 * Adapts raw backend answer evaluation responses (either legacy or V1)
 * into a clean, normalized structure for frontend consumption.
 */

export function normalizeMainsEvaluationForUI(evaluation) {
  if (!evaluation) return null;

  // Detect presence of V1 schema (either wrapped or direct)
  const v1 = (evaluation.mains_eval_v1 && typeof evaluation.mains_eval_v1 === "object") 
              ? evaluation.mains_eval_v1 
              : (evaluation.schema_version === "mains-eval-v1" ? evaluation : null);
              
  if (v1) {
    
    // Normalize question intelligence
    const qi = v1.question_intelligence || {};
    const normalizedQI = {
      paper: qi.paper || evaluation.paper || "GS Paper",
      subject: qi.subject || evaluation.subject || "",
      topic: qi.topic || evaluation.topic || "",
      micro_topic: qi.micro_topic || qi.topic || "",
      syllabus_node_id: qi.syllabus_node_id || "",
      directive: qi.directive || "Evaluate",
      marks: qi.marks ? parseInt(qi.marks) : 10,
      word_limit: qi.word_limit ? parseInt(qi.word_limit) : 150,
      question_nature: Array.isArray(qi.question_nature) ? qi.question_nature : ["CONCEPTUAL"]
    };

    // Normalize examiner impact
    const imp = v1.examiner_impact || {};
    const normalizedImpact = {
      level: normalizeExaminerImpactLevel(imp.level),
      reason: imp.reason || v1.score?.reason || evaluation.examinerImpression || "",
      what_prevents_next_level: Array.isArray(imp.what_prevents_next_level) ? imp.what_prevents_next_level : []
    };

    // Normalize score
    const scoreVal = v1.score || {};
    const normalizedScore = {
      awarded: typeof scoreVal.awarded === "number" ? scoreVal.awarded : 4.0,
      maximum: typeof scoreVal.maximum === "number" ? scoreVal.maximum : 10,
      reason: scoreVal.reason || ""
    };

    // Normalize ideal blueprint
    const bp = v1.ideal_blueprint || {};
    const normalizedBlueprint = {
      core_demand: bp.core_demand || "Analyze the core demands of the question.",
      core_argument: bp.core_argument || "",
      expected_dimensions: Array.isArray(bp.expected_dimensions) ? bp.expected_dimensions : [],
      expected_subject_terms: Array.isArray(bp.expected_subject_terms) ? bp.expected_subject_terms : [],
      useful_evidence_types: Array.isArray(bp.useful_evidence_types) ? bp.useful_evidence_types : []
    };

    // Normalize dimension coverage
    const dc = v1.dimension_coverage || {};
    const normalizedDC = {
      expected_count: typeof dc.expected_count === "number" ? dc.expected_count : 0,
      covered_count: typeof dc.covered_count === "number" ? dc.covered_count : 0,
      covered: Array.isArray(dc.covered) ? dc.covered : [],
      missing: Array.isArray(dc.missing) ? dc.missing.map(m => ({
        dimension: m.dimension || "General",
        how_to_add: m.how_to_add || "Include detail in rewriting."
      })) : []
    };

    // Normalize subject language
    const sl = v1.subject_language || {};
    const normalizedSL = {
      level: sl.level || "MODERATE",
      effective_terms_used: Array.isArray(sl.effective_terms_used) ? sl.effective_terms_used : [],
      generic_phrases: Array.isArray(sl.generic_phrases) ? sl.generic_phrases : [],
      better_replacements: Array.isArray(sl.better_replacements) ? sl.better_replacements.map(r => ({
        original: r.original || "",
        improved: r.improved || ""
      })) : [],
      jargon_dumping_detected: !!sl.jargon_dumping_detected
    };

    // Normalize evidence analysis
    const ea = v1.evidence_analysis || {};
    const normalizedEA = {
      used: Array.isArray(ea.used) ? ea.used : [],
      missing: Array.isArray(ea.missing) ? ea.missing : [],
      unverified_claims: Array.isArray(ea.unverified_claims) ? ea.unverified_claims : []
    };

    // Normalize structure analysis
    const sa = v1.structure_analysis || {};
    const normalizedSA = {
      introduction: sa.introduction || "Adequate introduction.",
      body: sa.body || "Adequate structure.",
      headings: sa.headings || "Clear structure.",
      conclusion: sa.conclusion || "Adequate conclusion.",
      word_limit: sa.word_limit || "Within word limit."
    };

    // Normalize best value addition
    const bva = v1.best_value_addition || {};
    const normalizedBVA = {
      needed: typeof bva.needed === "boolean" ? bva.needed : true,
      type: bva.type || "CA",
      subtype: bva.subtype || "",
      title: bva.title || "Add Value Reference",
      priority: bva.priority || "USEFUL",
      placement: bva.placement || "",
      content: bva.content || "",
      why_useful: bva.why_useful || "",
      avoid: bva.avoid || "",
      bank_query: bva.bank_query || "",
      draw_time_seconds: typeof bva.draw_time_seconds === "number" ? bva.draw_time_seconds : null,
      visual_schema: bva.visual_schema && typeof bva.visual_schema === "object" ? {
        renderer: bva.visual_schema.renderer || "PROCESS_FLOW",
        nodes: Array.isArray(bva.visual_schema.nodes) ? bva.visual_schema.nodes : [],
        edges: Array.isArray(bva.visual_schema.edges) ? bva.visual_schema.edges : [],
        visual_asset_required: !!bva.visual_schema.visual_asset_required,
        description: bva.visual_schema.description || ""
      } : null
    };

    // Normalize model answer
    const ma = v1.model_answer || {};
    const normalizedMA = {
      word_target: typeof ma.word_target === "number" ? ma.word_target : normalizedQI.word_limit,
      answer: ma.answer || "",
      visual_insertion: ma.visual_insertion || null
    };

    return {
      isV1: true,
      raw: evaluation,
      schema_version: v1.schema_version || "mains-eval-v1",
      question_intelligence: normalizedQI,
      score: normalizedScore,
      examiner_impact: normalizedImpact,
      ideal_blueprint: normalizedBlueprint,
      strengths: Array.isArray(v1.strengths) ? v1.strengths : [],
      dimension_coverage: normalizedDC,
      subject_language: normalizedSL,
      factual_issues: Array.isArray(v1.factual_issues) ? v1.factual_issues : [],
      evidence_analysis: normalizedEA,
      structure_analysis: normalizedSA,
      best_value_addition: normalizedBVA,
      model_answer: normalizedMA,
      mistakes: Array.isArray(v1.mistakes) ? v1.mistakes : [],
      revision_candidates: Array.isArray(v1.revision_candidates) ? v1.revision_candidates : [],
      evaluation_meta: v1.evaluation_meta || {}
    };
  }

  // --- LEGACY FALLBACK ADAPTER ---
  const legacyScoreParts = String(evaluation.score || "4/10").split("/");
  const awarded = parseFloat(legacyScoreParts[0]) || 4.0;
  const maximum = parseFloat(legacyScoreParts[1]) || 10.0;

  const legacyMissing = Array.isArray(evaluation.missingDimensions)
    ? evaluation.missingDimensions.map(d => {
        const idx = d.indexOf(":");
        if (idx !== -1) {
          return { dimension: d.slice(0, idx).trim(), how_to_add: d.slice(idx + 1).trim() };
        }
        return { dimension: "General", how_to_add: d };
      })
    : [];

  return {
    isV1: false,
    raw: evaluation,
    schema_version: "mains-eval-v1-legacy-compat",
    question_intelligence: {
      paper: evaluation.paper || "General Studies",
      subject: evaluation.subject || "",
      topic: "",
      micro_topic: "",
      syllabus_node_id: "",
      directive: "Evaluate",
      marks: maximum,
      word_limit: 150,
      question_nature: ["CONCEPTUAL"]
    },
    score: {
      awarded,
      maximum,
      reason: evaluation.examinerImpression || "Legacy evaluation restored."
    },
    examiner_impact: {
      level: mapLegacyLevelToImpact(evaluation.level),
      reason: evaluation.examinerImpression || "",
      what_prevents_next_level: []
    },
    ideal_blueprint: {
      core_demand: "Address the core directives of the question.",
      core_argument: "",
      expected_dimensions: Array.isArray(evaluation.upscStructure) ? evaluation.upscStructure : [],
      expected_subject_terms: [],
      useful_evidence_types: []
    },
    strengths: Array.isArray(evaluation.topFixes) ? evaluation.topFixes : [],
    dimension_coverage: {
      expected_count: legacyMissing.length + 3,
      covered_count: 3,
      covered: ["General Content"],
      missing: legacyMissing
    },
    subject_language: {
      level: "MODERATE",
      effective_terms_used: [],
      generic_phrases: [],
      better_replacements: [],
      jargon_dumping_detected: false
    },
    factual_issues: [],
    evidence_analysis: {
      used: [],
      missing: [],
      unverified_claims: []
    },
    structure_analysis: {
      introduction: "Review introduction.",
      body: "Develop structure details.",
      headings: "Use headings as guide posts.",
      conclusion: "Incorporate forward-looking ideas.",
      word_limit: "Verify word limits."
    },
    best_value_addition: {
      needed: !!evaluation.finalAdvice,
      type: "CA",
      title: "Integrate feedback advice",
      priority: "HIGH",
      placement: "Conclusion / Way Forward",
      content: evaluation.finalAdvice || "",
      why_useful: "",
      avoid: "",
      bank_query: "",
      draw_time_seconds: null,
      visual_schema: null
    },
    model_answer: {
      word_target: 150,
      answer: evaluation.improvedIntro || "",
      visual_insertion: null
    },
    mistakes: [],
    revision_candidates: [],
    evaluation_meta: {}
  };
}

function normalizeExaminerImpactLevel(level) {
  const cleaned = String(level || "").toUpperCase();
  if (cleaned === "RANK_ENHANCING") return "Rank-Enhancing";
  if (cleaned === "STRONG") return "Strong";
  if (cleaned === "COMPETITIVE") return "Competitive";
  return "Ordinary";
}

function mapLegacyLevelToImpact(legacyLevel) {
  const lvl = String(legacyLevel || "").toLowerCase();
  if (lvl.includes("excellent") || lvl.includes("elite")) return "Rank-Enhancing";
  if (lvl.includes("good") || lvl.includes("strong")) return "Strong";
  if (lvl.includes("average") || lvl.includes("usable")) return "Competitive";
  return "Ordinary";
}
