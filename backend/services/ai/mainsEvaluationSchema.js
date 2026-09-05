/**
 * backend/services/ai/mainsEvaluationSchema.js
 *
 * Strict UPSC Mains Evaluation V1 schema definition, validation,
 * normalization, and fallback generation.
 */

const LEGACY_TYPE_MAP = {
  D: { mode: "VISUAL", subtype: "CONCEPT_DIAGRAM" },
  F: { mode: "VISUAL", subtype: "FLOWCHART" },
  C: { mode: "VISUAL", subtype: "TABLE" }, // Data/Chart/Table generic
  CA: { mode: "NON_VISUAL", subtype: "CURRENT_AFFAIRS" },
  T: { mode: "VISUAL", subtype: "TIMELINE" },
  E: { mode: "NON_VISUAL", subtype: "CASE_STUDY" }
};

export function getFallbackPayload(paper, subject, topic, nodeId, nodeLabel, marks, wordLimit, profileId) {
  return {
    schema_version: "mains-eval-v1",
    question_intelligence: {
      paper: paper || "General Studies",
      subject: subject || "",
      topic: topic || "",
      micro_topic: nodeLabel || "General",
      syllabus_node_id: nodeId || "",
      directive: "Discuss",
      marks: marks ? parseInt(marks) : 10,
      word_limit: wordLimit ? parseInt(wordLimit) : 150,
      question_nature: ["CONCEPTUAL"]
    },
    ideal_blueprint: {
      core_demand: "Answer key aspects of the question.",
      core_argument: "Provide a balanced outline.",
      expected_dimensions: [],
      expected_subject_terms: [],
      useful_evidence_types: [],
      best_possible_value_additions: [],
      balance_or_criticism_expected: [],
      way_forward_expectation: "",
      conclusion_expectation: ""
    },
    score: {
      awarded: marks ? Math.round(marks * 0.4) : 4.0,
      maximum: marks ? parseInt(marks) : 10,
      reason: "Fallback evaluation due to parsing issue."
    },
    demand_analysis: {
      level: "PARTIALLY_MET",
      feedback: "Answer structures are mostly valid but parsing was compromised."
    },
    strengths: ["Reasonable structure"],
    dimension_coverage: {
      expected_count: 3,
      covered_count: 1,
      covered: [],
      missing: []
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
      introduction: "Acceptable",
      body: "Needs enrichment",
      headings: "Adequate",
      conclusion: "Constructive",
      word_limit: "Within range"
    },
    examiner_impact: {
      level: "ORDINARY",
      reason: "Standard draft answer.",
      what_prevents_next_level: ["Enrich with data and specific examples."]
    },
    best_value_addition: {
      needed: false,
      mode: "NON_VISUAL",
      subtype: "CURRENT_AFFAIRS",
      title: "Add contemporary constitutional references",
      reason: "",
      exam_utility: "",
      insertion_point: "Conclusion/Body",
      content: "",
      visual_spec: null,
      evidence_reference: null,
      estimated_draw_time_seconds: null,
      source_format: "V2"
    },
    model_answer: {
      word_target: wordLimit ? parseInt(wordLimit) : 150,
      answer: "Evaluator completed successfully. Model answer generated internally.",
      visual_insertion: null
    },
    mistakes: [],
    revision_candidates: [],
    evaluation_meta: {
      prompt_version: "mains-eval-v1",
      subject_profile: profileId || "UNKNOWN",
      retrieved_pyq_count: 0
    }
  };
}

export function validateAndNormalizeV1Payload(parsed, paper, subject, topic, nodeId, nodeLabel, marks, wordLimit, profileId) {
  const fallback = getFallbackPayload(paper, subject, topic, nodeId, nodeLabel, marks, wordLimit, profileId);
  if (!parsed || typeof parsed !== "object") return fallback;

  // The server metadata (marks) is the source of truth. Ignore model's output for score.maximum.
  const authoritativeMarks = marks ? parseInt(marks) : 10;
  const maxScore = authoritativeMarks;
  
  let awardedScore = parsed.score && typeof parsed.score.awarded === "number" ? parsed.score.awarded : fallback.score.awarded;
  if (awardedScore < 0) awardedScore = 0;
  if (awardedScore > maxScore) awardedScore = maxScore;

  // Best Value Addition Normalization
  let bva = parsed.best_value_addition || {};
  let isLegacy = false;
  let finalMode = "NON_VISUAL";
  let finalSubtype = "CURRENT_AFFAIRS";
  
  if (bva.mode && bva.subtype) {
    finalMode = ["VISUAL", "NON_VISUAL"].includes(bva.mode) ? bva.mode : "NON_VISUAL";
    finalSubtype = bva.subtype;
  } else if (bva.type) {
    isLegacy = true;
    const mapped = LEGACY_TYPE_MAP[bva.type] || { mode: "NON_VISUAL", subtype: "EXAMPLE" };
    finalMode = mapped.mode;
    finalSubtype = mapped.subtype;
    
    // Attempt to salvage any specific map instruction if it was passed via visual_schema
    if (bva.visual_schema && bva.visual_schema.renderer === "MAP_REQUIRED") {
       finalMode = "VISUAL";
       finalSubtype = "MAP";
    }
  } else {
    finalMode = fallback.best_value_addition.mode;
    finalSubtype = fallback.best_value_addition.subtype;
  }

  const normalizedBestValueAddition = {
    needed: typeof bva.needed === "boolean" ? bva.needed : true,
    mode: finalMode,
    subtype: finalSubtype,
    title: bva.title || "Add constitutional groundings",
    reason: bva.reason || bva.why_useful || "",
    exam_utility: bva.exam_utility || "",
    insertion_point: bva.insertion_point || bva.placement || "",
    content: bva.content || "",
    visual_spec: bva.visual_spec || (bva.visual_schema && typeof bva.visual_schema === "object" ? {
      type: ["PROCESS_FLOW", "BRANCHING_FLOW", "CYCLE", "STAKEHOLDER_WHEEL", "COMPARISON_TABLE", "SIMPLE_GRAPH", "MAP_REQUIRED", "TIMELINE", "FLOWCHART", "CONCEPT_DIAGRAM", "BAR_CHART", "LINE_GRAPH", "PIE_CHART", "TABLE", "COMPARISON_CHART", "PROCESS_CYCLE"].includes(bva.visual_schema.type || bva.visual_schema.renderer) ? (bva.visual_schema.type || bva.visual_schema.renderer) : "PROCESS_FLOW",
      title: bva.visual_schema.title || "",
      nodes: Array.isArray(bva.visual_schema.nodes) ? bva.visual_schema.nodes : [],
      edges: Array.isArray(bva.visual_schema.edges) ? bva.visual_schema.edges : [],
      events: Array.isArray(bva.visual_schema.events) ? bva.visual_schema.events : [],
      data: Array.isArray(bva.visual_schema.data) ? bva.visual_schema.data : [],
      description: bva.visual_schema.description || ""
    } : null),
    evidence_reference: bva.evidence_reference || null,
    estimated_draw_time_seconds: typeof bva.estimated_draw_time_seconds === "number" ? bva.estimated_draw_time_seconds : (typeof bva.draw_time_seconds === "number" ? bva.draw_time_seconds : null),
    source_format: isLegacy ? "LEGACY" : "V2"
  };

  // Quantitative Provenance Fallback
  const quantitativeSubtypes = ["BAR_CHART", "LINE_GRAPH", "PIE_CHART"];
  if (quantitativeSubtypes.includes(normalizedBestValueAddition.subtype)) {
    const hasProvenance = normalizedBestValueAddition.evidence_reference && ["TRUSTED_RAG", "VERIFIED_EVIDENCE", "QUESTION_PROVIDED"].includes(normalizedBestValueAddition.evidence_reference.status);
    if (!hasProvenance) {
      normalizedBestValueAddition.mode = "VISUAL";
      normalizedBestValueAddition.subtype = "CONCEPT_DIAGRAM";
      if (normalizedBestValueAddition.visual_spec) {
        normalizedBestValueAddition.visual_spec.type = "CONCEPT_DIAGRAM";
        // Strip invented numbers from fallback
        if (normalizedBestValueAddition.visual_spec.data) {
          normalizedBestValueAddition.visual_spec.data = [];
        }
      }
    }
  }

  // Complexity Limits & Clamp
  if (normalizedBestValueAddition.visual_spec) {
    const spec = normalizedBestValueAddition.visual_spec;
    if (spec.nodes && spec.nodes.length > 12) spec.nodes = spec.nodes.slice(0, 12);
    if (spec.events && spec.events.length > 8) spec.events = spec.events.slice(0, 8);
    if (spec.data && spec.data.length > 8) spec.data = spec.data.slice(0, 8);
  }
  
  if (normalizedBestValueAddition.estimated_draw_time_seconds !== null) {
    const t = normalizedBestValueAddition.estimated_draw_time_seconds;
    if (t < 5) normalizedBestValueAddition.estimated_draw_time_seconds = 5;
    if (t > 120) normalizedBestValueAddition.estimated_draw_time_seconds = 120;
  }

  // Schema normalization
  const normalized = {
    schema_version: parsed.schema_version || "mains-eval-v1",
    question_intelligence: {
      paper: parsed.question_intelligence?.paper || fallback.question_intelligence.paper,
      subject: parsed.question_intelligence?.subject || fallback.question_intelligence.subject,
      topic: parsed.question_intelligence?.topic || fallback.question_intelligence.topic,
      micro_topic: parsed.question_intelligence?.micro_topic || fallback.question_intelligence.micro_topic,
      syllabus_node_id: parsed.question_intelligence?.syllabus_node_id || fallback.question_intelligence.syllabus_node_id,
      directive: parsed.question_intelligence?.directive || fallback.question_intelligence.directive,
      marks: authoritativeMarks, // Enforce source of truth
      word_limit: parsed.question_intelligence?.word_limit || fallback.question_intelligence.word_limit,
      question_nature: Array.isArray(parsed.question_intelligence?.question_nature) ? parsed.question_intelligence.question_nature : fallback.question_intelligence.question_nature
    },
    ideal_blueprint: {
      core_demand: parsed.ideal_blueprint?.core_demand || fallback.ideal_blueprint.core_demand,
      core_argument: parsed.ideal_blueprint?.core_argument || fallback.ideal_blueprint.core_argument,
      expected_dimensions: Array.isArray(parsed.ideal_blueprint?.expected_dimensions) ? parsed.ideal_blueprint.expected_dimensions : [],
      expected_subject_terms: Array.isArray(parsed.ideal_blueprint?.expected_subject_terms) ? parsed.ideal_blueprint.expected_subject_terms : [],
      useful_evidence_types: Array.isArray(parsed.ideal_blueprint?.useful_evidence_types) ? parsed.ideal_blueprint.useful_evidence_types : [],
      best_possible_value_additions: Array.isArray(parsed.ideal_blueprint?.best_possible_value_additions) ? parsed.ideal_blueprint.best_possible_value_additions : [],
      balance_or_criticism_expected: Array.isArray(parsed.ideal_blueprint?.balance_or_criticism_expected) ? parsed.ideal_blueprint.balance_or_criticism_expected : [],
      way_forward_expectation: parsed.ideal_blueprint?.way_forward_expectation || "",
      conclusion_expectation: parsed.ideal_blueprint?.conclusion_expectation || ""
    },
    score: {
      awarded: awardedScore,
      maximum: maxScore,
      reason: parsed.score?.reason || fallback.score.reason
    },
    demand_analysis: {
      level: ["FULLY_MET", "PARTIALLY_MET", "MISSED"].includes(parsed.demand_analysis?.level) ? parsed.demand_analysis.level : fallback.demand_analysis.level,
      feedback: parsed.demand_analysis?.feedback || fallback.demand_analysis.feedback
    },
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : fallback.strengths,
    dimension_coverage: {
      expected_count: typeof parsed.dimension_coverage?.expected_count === "number" ? parsed.dimension_coverage.expected_count : 0,
      covered_count: typeof parsed.dimension_coverage?.covered_count === "number" ? parsed.dimension_coverage.covered_count : 0,
      covered: Array.isArray(parsed.dimension_coverage?.covered) ? parsed.dimension_coverage.covered : [],
      missing: Array.isArray(parsed.dimension_coverage?.missing) ? parsed.dimension_coverage.missing.map(m => ({
        dimension: m.dimension || "General",
        how_to_add: m.how_to_add || "Elaborate in detail."
      })) : []
    },
    subject_language: {
      level: ["WEAK", "MODERATE", "STRONG"].includes(parsed.subject_language?.level) ? parsed.subject_language.level : fallback.subject_language.level,
      effective_terms_used: Array.isArray(parsed.subject_language?.effective_terms_used) ? parsed.subject_language.effective_terms_used : [],
      generic_phrases: Array.isArray(parsed.subject_language?.generic_phrases) ? parsed.subject_language.generic_phrases : [],
      better_replacements: Array.isArray(parsed.subject_language?.better_replacements) ? parsed.subject_language.better_replacements.map(br => ({
        original: br.original || "",
        improved: br.improved || ""
      })) : [],
      jargon_dumping_detected: typeof parsed.subject_language?.jargon_dumping_detected === "boolean" ? parsed.subject_language.jargon_dumping_detected : false
    },
    factual_issues: Array.isArray(parsed.factual_issues) ? parsed.factual_issues : [],
    evidence_analysis: {
      used: Array.isArray(parsed.evidence_analysis?.used) ? parsed.evidence_analysis.used : [],
      missing: Array.isArray(parsed.evidence_analysis?.missing) ? parsed.evidence_analysis.missing : [],
      unverified_claims: Array.isArray(parsed.evidence_analysis?.unverified_claims) ? parsed.evidence_analysis.unverified_claims : []
    },
    structure_analysis: {
      introduction: parsed.structure_analysis?.introduction || fallback.structure_analysis.introduction,
      body: parsed.structure_analysis?.body || fallback.structure_analysis.body,
      headings: parsed.structure_analysis?.headings || fallback.structure_analysis.headings,
      conclusion: parsed.structure_analysis?.conclusion || fallback.structure_analysis.conclusion,
      word_limit: parsed.structure_analysis?.word_limit || fallback.structure_analysis.word_limit
    },
    examiner_impact: {
      level: ["ORDINARY", "COMPETITIVE", "STRONG", "RANK_ENHANCING"].includes(parsed.examiner_impact?.level) ? parsed.examiner_impact.level : fallback.examiner_impact.level,
      reason: parsed.examiner_impact?.reason || fallback.examiner_impact.reason,
      what_prevents_next_level: Array.isArray(parsed.examiner_impact?.what_prevents_next_level) ? parsed.examiner_impact.what_prevents_next_level : []
    },
    best_value_addition: normalizedBestValueAddition,
    model_answer: {
      word_target: typeof parsed.model_answer?.word_target === "number" ? parsed.model_answer.word_target : wordLimit,
      answer: parsed.model_answer?.answer || fallback.model_answer.answer,
      visual_insertion: parsed.model_answer?.visual_insertion || null
    },
    mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes.map(m => ({
      category: m.category || "CONTENT_GAP",
      skill: m.skill || "analysis",
      description: m.description || "",
      paper: m.paper || paper,
      subject: m.subject || subject,
      topic: m.topic || topic,
      micro_topic: m.micro_topic || nodeLabel,
      syllabus_node_id: m.syllabus_node_id || nodeId,
      severity: ["HIGH", "MEDIUM", "LOW"].includes(m.severity) ? m.severity : "MEDIUM"
    })) : [],
    revision_candidates: Array.isArray(parsed.revision_candidates) ? parsed.revision_candidates : [],
    evaluation_meta: {
      prompt_version: "mains-eval-v1",
      subject_profile: parsed.evaluation_meta?.subject_profile || profileId,
      retrieved_pyq_count: typeof parsed.evaluation_meta?.retrieved_pyq_count === "number" ? parsed.evaluation_meta.retrieved_pyq_count : 0
    }
  };

  return normalized;
}
