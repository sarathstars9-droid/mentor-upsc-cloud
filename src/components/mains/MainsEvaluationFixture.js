/**
 * src/components/mains/MainsEvaluationFixture.js
 *
 * Local evaluation fixtures matching the V1 and Legacy schemas for frontend verification.
 */

export const FIXTURE_GS2_CA = {
  mains_eval_v1: {
    schema_version: "mains-eval-v1",
    question_intelligence: {
      paper: "GS Paper II",
      subject: "Polity",
      topic: "Federalism",
      micro_topic: "Comparison of Schemes",
      syllabus_node_id: "GS2-POL-MAINS-COMPARE-MT01",
      directive: "Critically examine",
      marks: 10,
      word_limit: 150,
      question_nature: ["ANALYTICAL", "CONTEMPORARY"]
    },
    ideal_blueprint: {
      core_demand: "Analyze cooperative federalism issues and inter-state water disputes.",
      core_argument: "Cooperative federalism requires institutional trust.",
      expected_dimensions: ["Constitutional", "Institutional", "Judicial", "Political"],
      expected_subject_terms: ["constitutional morality", "checks and balances"],
      useful_evidence_types: ["Article 262", "Supreme Court judgments"]
    },
    score: {
      awarded: 6.0,
      maximum: 10,
      reason: "Balanced understanding with clean legal citations but needs a sharper conclusion."
    },
    demand_analysis: {
      level: "PARTIALLY_MET",
      feedback: "Water disputes are addressed but interstate councils could be integrated better."
    },
    strengths: ["Clear mention of Article 262", "Excellent structural clarity"],
    dimension_coverage: {
      expected_count: 5,
      covered_count: 3,
      covered: ["Constitutional", "Judicial", "Political"],
      missing: [
        {
          dimension: "fiscal",
          how_to_add: "Show how financial sharing dependencies affect dispute resolution capacity."
        }
      ]
    },
    subject_language: {
      level: "STRONG",
      effective_terms_used: ["constitutional morality", "adjudicatory jurisdiction"],
      generic_phrases: ["states argue a lot"],
      better_replacements: [
        {
          original: "states argue a lot",
          improved: "inter-state litigation and disputes"
        }
      ],
      jargon_dumping_detected: false
    },
    factual_issues: [],
    evidence_analysis: {
      used: ["Article 262"],
      missing: ["Sarkaria Commission recommendations"],
      unverified_claims: []
    },
    structure_analysis: {
      introduction: "Direct and crisp introduction linking Article 262.",
      body: "Well structured but missing financial federalism facets.",
      headings: "Logical headings used.",
      conclusion: "Repeated the introduction points.",
      word_limit: "Perfect (148 words)."
    },
    examiner_impact: {
      level: "COMPETITIVE",
      reason: "Structured layout with core legal citations.",
      what_prevents_next_level: ["Cite Sarkaria Commission and Supreme Court rulings."]
    },
    best_value_addition: {
      needed: true,
      type: "CA",
      title: "Cite Supreme Court judgment on Cauvery dispute",
      priority: "HIGH",
      placement: "Body paragraph 2",
      content: "Under Article 262, the Supreme Court held that water is a national asset.",
      why_useful: "Adds judicial backing",
      avoid: "Drawing redundant process diagrams",
      bank_query: "water disputes judgments",
      draw_time_seconds: 35,
      visual_schema: null
    },
    model_answer: {
      word_target: 150,
      answer: "Model answer text goes here depicting structured cooperative federalism facets...",
      visual_insertion: null
    },
    mistakes: [
      {
        category: "MISSING_DIMENSION",
        skill: "multidimensionality",
        description: "Fiscal federalism aspect was omitted.",
        paper: "GS Paper II",
        subject: "Polity",
        severity: "HIGH"
      }
    ]
  }
};

export const FIXTURE_GEO_PROCESS = {
  mains_eval_v1: {
    schema_version: "mains-eval-v1",
    question_intelligence: {
      paper: "GS Paper I",
      subject: "Geography",
      topic: "Physical Geography",
      micro_topic: "Lava / Deccan Trap",
      syllabus_node_id: "OPT-P1-HG-PERSPECTIVES-MT09",
      directive: "Discuss",
      marks: 15,
      word_limit: 250,
      question_nature: ["PROCESS", "SPATIAL"]
    },
    ideal_blueprint: {
      core_demand: "Explain formation and features of Deccan trap soils.",
      core_argument: "Basaltic weathering yields black cotton soil.",
      expected_dimensions: ["Geological", "Pedological", "Agricultural"]
    },
    score: {
      awarded: 8.5,
      maximum: 15,
      reason: "Very good soil pedology description."
    },
    strengths: ["Excellent process terminology", "Accurate spatial coordinates"],
    dimension_coverage: {
      expected_count: 4,
      covered_count: 3,
      covered: ["Geological", "Agricultural"],
      missing: [
        {
          dimension: "pedological",
          how_to_add: "Detail parent rock and weathering dynamics."
        }
      ]
    },
    subject_language: {
      level: "STRONG",
      effective_terms_used: ["basaltic", "weathering", "regur"],
      generic_phrases: [],
      better_replacements: []
    },
    examiner_impact: {
      level: "STRONG",
      reason: "Rich spatial information.",
      what_prevents_next_level: []
    },
    best_value_addition: {
      needed: true,
      type: "F",
      title: "Weathering cycle of Basaltic Rock",
      priority: "HIGH",
      placement: "Page 1 - pedogenesis section",
      content: "",
      why_useful: "Visualizes rock to clay sequence",
      avoid: "Text blocks in visual zones",
      bank_query: "basalt weathering cycle",
      draw_time_seconds: 25,
      visual_schema: {
        renderer: "PROCESS_FLOW",
        nodes: ["Basalt parent", "Physical weathering", "Chemical leaching", "Regur clay"],
        edges: [[0, 1], [1, 2], [2, 3]],
        visual_asset_required: false,
        description: "Process chart representing regur soil formation"
      }
    },
    model_answer: {
      word_target: 250,
      answer: "Geography model answer content..."
    }
  }
};

export const FIXTURE_GEO_MAP = {
  mains_eval_v1: {
    schema_version: "mains-eval-v1",
    question_intelligence: {
      paper: "Optional Geography",
      subject: "Geography",
      topic: "Paper I",
      micro_topic: "Slope Development",
      syllabus_node_id: "OPT-P1-HG-PERSPECTIVES-MT09",
      directive: "Discuss",
      marks: 10,
      word_limit: 150,
      question_nature: ["SPATIAL"]
    },
    ideal_blueprint: {
      core_demand: "Discuss black soil regions",
      core_argument: ""
    },
    score: {
      awarded: 5.0,
      maximum: 10,
      reason: "Requires locational maps."
    },
    examiner_impact: {
      level: "ORDINARY",
      reason: "No map presented."
    },
    best_value_addition: {
      needed: true,
      type: "D",
      title: "Deccan Shield Shading Map",
      priority: "HIGH",
      placement: "Right-hand sidebar margins",
      content: "",
      why_useful: "Adds precise geographical coordinates",
      draw_time_seconds: 30,
      visual_schema: {
        renderer: "MAP_REQUIRED",
        description: "India Map detailing Deccan Shield distribution",
        nodes: [],
        edges: []
      }
    },
    model_answer: {
      word_target: 150,
      answer: "Model answer with spatial notes..."
    }
  }
};

export const FIXTURE_LEGACY = {
  score: "5/10",
  level: "Average",
  examinerImpression: "Very good structure and clear introduction, but lacks specific details on water tribunal rulings.",
  topFixes: ["Address legal/judicial dimension", "Cite Cauvery dispute"],
  missingDimensions: ["fiscal: Detail water sharing funding structures"],
  upscStructure: ["Intro", "Constitutional Framework", "Tribunal challenges", "Conclusion"],
  improvedIntro: "Legacy introductory model answer representation...",
  improvedConclusion: "Conclusion recommendations...",
  finalAdvice: "Incorporate Sarkaria commission rulings."
};
