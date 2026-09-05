/**
 * backend/services/ai/subjectProfiles.js
 *
 * Subject-specific profiles and rubrics for UPSC Mains Evaluation V1.
 * Exposes expected language, common dimensions, priorities, preferred evidence,
 * and value-addition priors for each subject/topic.
 */

export const SUBJECT_PROFILES = {
  // --- GS1 ---
  "GS1_HISTORY": {
    id: "GS1_HISTORY",
    expectedLanguage: "chronology, causation, continuity/change, socio-economic context, historical linkage, subaltern context, colonial impact",
    commonDimensions: ["socio-economic", "cultural", "political", "ideological", "regional", "gendered"],
    evaluationPriorities: "Verify chronological sequence, causation analysis of historical events, and highlighting of continuity vs change.",
    preferredEvidence: ["historical sources", "records", "inscriptions", "literary works", "historians' arguments"],
    valueAdditionPriors: ["TIMELINE", "CAUSE_EFFECT_FLOW", "COMPARISON_TABLE", "MAP"],
    answerStructureRules: "Incorporate chronological flow or clear cause-effect structure in the body points."
  },
  "GS1_ART_CULTURE": {
    id: "GS1_ART_CULTURE",
    expectedLanguage: "architectural style, stylistic evolution, patronage, secular-religious syncretism, iconographic elements, aesthetic expression",
    commonDimensions: ["artistic features", "technique", "socio-cultural significance", "patronage", "geographical distribution"],
    evaluationPriorities: "Focus on stylistic details, structural evolution, and socio-religious contexts of art forms.",
    preferredEvidence: ["monuments", "texts", "travelogues", "inscriptions", "stylistic terms"],
    valueAdditionPriors: ["MAP", "PROCESS_DIAGRAM", "CROSS_SECTION", "COMPARISON_TABLE"],
    answerStructureRules: "Must define the art form's origin/evolution and describe structural/artistic elements separately."
  },
  "GS1_SOCIETY": {
    id: "GS1_SOCIETY",
    expectedLanguage: "social stratification, patriarchy, intersectionality, social capital, exclusion/inclusion, demographic dividend, vulnerability, assimilation, sanskritization",
    commonDimensions: ["social structure", "economic impact", "gender dynamics", "demographic", "policy/institutions", "regional variations"],
    evaluationPriorities: "Examine systemic stratification, vulnerable group impacts, and intersectional angles of societal issues.",
    preferredEvidence: ["Census statistics", "NFHS data", "sociological concepts", "recent case studies/examples", "policy reports"],
    valueAdditionPriors: ["STAKEHOLDER_MAP", "CAUSE_EFFECT_FLOW", "DATA", "CASE_STUDY", "CURRENT_EXAMPLE"],
    answerStructureRules: "Provide a balanced look at structural issues vs developmental interventions, avoiding overly descriptive writing."
  },
  "GS1_GEOGRAPHY": {
    id: "GS1_GEOGRAPHY",
    expectedLanguage: "spatial differentiation, regional disparity, carrying capacity, vulnerability, agglomeration, spatial interaction, environmental degradation, resource distribution",
    commonDimensions: ["physical factors", "human/demographic factors", "economic spatial patterns", "ecological impact", "regional development"],
    evaluationPriorities: "Prioritize spatial explanation, physical processes, regional distribution, and resource optimization dynamics.",
    preferredEvidence: ["physical geography terms", "geographic locations", "statistics on resources/disasters", "national/global indexes"],
    valueAdditionPriors: ["MAP", "PROCESS_DIAGRAM", "CROSS_SECTION", "GRAPH"],
    answerStructureRules: "Spatial patterns must be detailed, and regional/physical mechanisms clearly diagrammed."
  },

  // --- GS2 ---
  "GS2_POLITY": {
    id: "GS2_POLITY",
    expectedLanguage: "constitutionalism, constitutional morality, checks and balances, substantive equality, cooperative federalism, subsidiarity, parliamentary accountability, rule of law, separation of powers",
    commonDimensions: ["constitutional", "legal/statutory", "judicial interpretation", "executive action", "federal dynamics", "citizen interface"],
    evaluationPriorities: "Validate references to Constitutional Articles, Judgments, Commissions, and Institutional dynamics.",
    preferredEvidence: ["Articles", "Judgments", "Commissions", "Constitutional institutions", "Contemporary constitutional examples"],
    valueAdditionPriors: ["CURRENT_AFFAIRS", "JUDGMENT", "INSTITUTIONAL_FLOW", "COMPARISON"],
    answerStructureRules: "Structure arguments around constitutional provisions, legislative enactments, and Supreme Court rulings."
  },
  "GS2_GOVERNANCE": {
    id: "GS2_GOVERNANCE",
    expectedLanguage: "citizen-centric governance, institutional capacity, social accountability, decentralisation, outcome-based monitoring, last-mile delivery, inter-departmental convergence, transparency, red-tapism",
    commonDimensions: ["administrative", "policy delivery", "technological (e-gov)", "fiscal accountability", "citizen engagement"],
    evaluationPriorities: "Focus on social accountability, administrative efficiency, delivery frameworks, and grievance redressal systems.",
    preferredEvidence: ["ARC Recommendations", "NITI Aayog reports", "e-governance models", "schemes feedback", "citizen charters"],
    valueAdditionPriors: ["PROCESS_FLOW", "STAKEHOLDER_MAP", "ACCOUNTABILITY_CHAIN", "CASE_STUDY"],
    answerStructureRules: "Incorporate execution/implementation flows, highlighting delivery gaps and administrative recommendations."
  },
  "GS2_SOCIAL_JUSTICE": {
    id: "GS2_SOCIAL_JUSTICE",
    expectedLanguage: "vulnerability index, target efficiency, exclusion/inclusion errors, human development, capability approach, affirmative action, rights-based approach",
    commonDimensions: ["socio-economic", "legal protection", "programmatic implementation", "institutional support", "budgetary allocation"],
    evaluationPriorities: "Focus on vulnerable sections (women, SC/ST, children, elderly, disabled) and health/education systems.",
    preferredEvidence: ["NFHS data", "HDR reports", "welfare scheme delivery flows", "exclusion/inclusion frameworks", "social audits"],
    valueAdditionPriors: ["DATA", "CASE_STUDY", "PROCESS_FLOW", "STAKEHOLDER_MAP"],
    answerStructureRules: "Always provide current status data (NFHS/Census) and structural reasons for social vulnerability."
  },
  "GS2_IR": {
    id: "GS2_IR",
    expectedLanguage: "strategic autonomy, soft power, geopolitical realignment, line of credit, diaspora diplomacy, bilateral agreements, multilateralism, rules-based world order, strategic triangles",
    commonDimensions: ["bilateral/multilateral relationships", "geopolitics", "economic & trade relations", "security/defense interest", "diaspora & cultural factors"],
    evaluationPriorities: "Assess geopolitical contexts, strategic terminology, trade balances, and institutional mechanisms.",
    preferredEvidence: ["bilateral/multilateral summits", "joint statements", "trade data", "strategic agreements", "locator maps"],
    valueAdditionPriors: ["CURRENT_AFFAIRS", "JUDGMENT", "INSTITUTIONAL_FLOW", "COMPARISON"],
    answerStructureRules: "Avoid generic prose; analyze relationships through the lens of national interest and strategic pragmatism."
  },

  // --- GS3 ---
  "GS3_ECONOMY": {
    id: "GS3_ECONOMY",
    expectedLanguage: "productivity, formalisation, capital formation, multiplier, fiscal consolidation, employment elasticity, supply-side constraints, capital expenditure, NPA, inflation targeting",
    commonDimensions: ["macroeconomic", "structural sector (agr/ind/serv)", "employment/labour", "banking/financial", "fiscal/monetary policy", "distributional equity"],
    evaluationPriorities: "Assess focus on economic parameters, policy interventions, fiscal prudence, and supply constraints.",
    preferredEvidence: ["Economic Survey data", "Union Budget stats", "RBI reports", "NITI Aayog indexes", "global rankings (GDP, Ease of Doing Biz)"],
    valueAdditionPriors: ["DATA", "CHART", "TRANSMISSION_FLOW", "VALUE_CHAIN", "COMPARISON_TABLE"],
    answerStructureRules: "Support arguments with recent growth/inflation/fiscal deficit numbers and sector-wise contributions."
  },
  "GS3_AGRICULTURE": {
    id: "GS3_AGRICULTURE",
    expectedLanguage: "cropping pattern, farm mechanisation, farm-to-market flow, value chain, food processing, MSP, public investment, agri-logistics, crop diversification",
    commonDimensions: ["input stage (seeds, water)", "production stage", "post-harvest & processing", "marketing & trade", "sustainability/ecological impact"],
    evaluationPriorities: "Focus on irrigation efficiency, input costs, price realization, supply chains, and food security indices.",
    preferredEvidence: ["agri-census", "market arrival data", "scheme coverage (PM-KISAN, PMFBY)", "agri-tech initiatives"],
    valueAdditionPriors: ["PROCESS_FLOW", "STAKEHOLDER_MAP", "ACCOUNTABILITY_CHAIN", "CASE_STUDY"],
    answerStructureRules: "Structure answer along the agricultural value chain (inputs -> cultivation -> logistics -> markets)."
  },
  "GS3_SCIENCE_TECH": {
    id: "GS3_SCIENCE_TECH",
    expectedLanguage: "indigenisation of technology, technology lifecycle, risk-benefit framework, technology transfer, IP regime, disruptive technology (AI/quantum), dual-use technology",
    commonDimensions: ["scientific principles", "indigenisation & R&D", "socio-economic application", "ethics/governance", "global comparisons"],
    evaluationPriorities: "Assess explanation of technical principles, indigenous achievements, and regulatory frameworks.",
    preferredEvidence: ["ISRO missions", "DST initiatives", "patent statistics", "draft policies/regulations"],
    valueAdditionPriors: ["PROCESS_FLOW", "STAKEHOLDER_MAP", "ACCOUNTABILITY_CHAIN", "CASE_STUDY"],
    answerStructureRules: "Explain the underlying technology briefly before detailing applications and regulatory/ethical issues."
  },
  "GS3_ENVIRONMENT": {
    id: "GS3_ENVIRONMENT",
    expectedLanguage: "ecological resilience, ecosystem services, carrying capacity, adaptive capacity, intergenerational equity, carbon sequestration, climate mitigation, environmental footprint",
    commonDimensions: ["ecological", "socio-economic", "legal/policy framework", "international conventions", "institutional mechanisms"],
    evaluationPriorities: "Prioritize ecological resilience, carrying capacity, environmental damage valuation, and commitments (NDCs).",
    preferredEvidence: ["IPCC reports", "State of Forest Report (ISFR)", "COP declarations", "Environmental Protection Act provisions"],
    valueAdditionPriors: ["PROCESS_FLOW", "STAKEHOLDER_MAP", "ACCOUNTABILITY_CHAIN", "CASE_STUDY"],
    answerStructureRules: "Connect local environmental problems to global climate frameworks and Indian legislative frameworks."
  },
  "GS3_DISASTER_MANAGEMENT": {
    id: "GS3_DISASTER_MANAGEMENT",
    expectedLanguage: "hazard, exposure, vulnerability, risk, resilience, adaptive capacity, preparedness, mitigation, response, Sendai Framework, community-based disaster management",
    commonDimensions: ["risk assessment", "structural measures", "non-structural measures", "response mechanism", "rehabilitation/recovery"],
    evaluationPriorities: "Examine focus on risk mitigation, community resilience, structural safeguards, and policy guidelines.",
    preferredEvidence: ["NDMA guidelines", "Sendai Framework targets", "disaster maps", "lessons from past disasters (Kutch, Odisha)"],
    valueAdditionPriors: ["DISASTER_CYCLE", "RISK_FRAMEWORK", "RESPONSE_FLOW", "HAZARD_MAP"],
    answerStructureRules: "Structure response around the phases of the disaster management cycle (Pre-disaster, During, Post-disaster)."
  },
  "GS3_INTERNAL_SECURITY": {
    id: "GS3_INTERNAL_SECURITY",
    expectedLanguage: "threat vectors, intelligence coordination, radicalisation, border management, capacity building, whole-of-government response, asymmetric warfare, money laundering, cyber-defence",
    commonDimensions: ["threat vector (external/internal)", "technological aspect", "border management", "legal & agency coordination", "socio-economic drivers of unrest"],
    evaluationPriorities: "Validate threat characterization, border porosity analysis, agency coordination, and technological counters.",
    preferredEvidence: ["internal security policies", "agency frameworks (NIA, NATGRID)", "border fencing stats", "intelligence reports"],
    valueAdditionPriors: ["THREAT_CHAIN", "STAKEHOLDER_MAP", "SECURITY_ARCHITECTURE", "MAP"],
    answerStructureRules: "Identify the root cause of security threats (state vs non-state actors) and propose agency-level coordination structures."
  },

  // --- GS4 ---
  "GS4_ETHICS_THEORY": {
    id: "GS4_ETHICS_THEORY",
    expectedLanguage: "integrity, impartiality, objectivity, empathy, probity, conflict of interest, deontology, consequentialism, virtue ethics, public interest, accountability, ethical dilemma",
    commonDimensions: ["philosophical basis", "individual values", "institutional ethics", "public service code", "social/communitarian impact"],
    evaluationPriorities: "Verify usage of core values, ethical frameworks, administrative application, and clear philosophical linkages.",
    preferredEvidence: ["Nolan Committee principles", "Second ARC on Ethics", "quotes by philosophers", "real-life administrator examples"],
    valueAdditionPriors: ["VALUE_FRAMEWORK", "STAKEHOLDER_MAP", "ETHICAL_DECISION_FLOW", "EXAMPLE"],
    answerStructureRules: "Must explicitly identify the ethical dilemma/values in conflict, and substantiate with a thinker's framework."
  },
  "GS4_CASE_STUDY": {
    id: "GS4_CASE_STUDY",
    expectedLanguage: "stakeholder analysis, conflict of interest, code of conduct, public interest, fiduciary duty, whistleblowing, administrative discretion, crisis management",
    commonDimensions: ["stakeholder interests", "ethical issues", "options available (pros/cons)", "chosen course of action", "long-term systemic reform"],
    evaluationPriorities: "Check stakeholder identification, options appraisal matrix, ethical justification, and action plan viability.",
    preferredEvidence: ["Code of Conduct rules", "public interest criteria", "statutory duties", "past administrative precedents"],
    valueAdditionPriors: ["STAKEHOLDER_TABLE", "OPTIONS_MATRIX", "DECISION_TREE", "ACTION_PLAN"],
    answerStructureRules: "Structure: 1. Stakeholders -> 2. Ethical Dilemmas -> 3. Options Appraisal -> 4. Chosen Action with justification -> 5. Systemic Measures."
  },

  // --- Essay & Optionals ---
  "ESSAY": {
    id: "ESSAY",
    expectedLanguage: "thesis statement, conceptual interpretation, philosophical depth, multidimensionality, transitions, counter-view, historical/current examples, human dimension, coherence, circular conclusion",
    commonDimensions: ["philosophical/abstract", "socio-cultural", "political", "economic", "environmental", "technological", "individual/ethical"],
    evaluationPriorities: "Prioritize thesis definition, flow transition between paragraphs, philosophical depth, multi-dimensional exposition, and coherence.",
    preferredEvidence: ["historical anecdotes", "literary quotes", "philosophical paradoxes", "contemporary global/national occurrences"],
    valueAdditionPriors: ["CONCEPTUAL_DIAGRAM", "STAKEHOLDER_MAP", "VALUE_FRAMEWORK"],
    answerStructureRules: "Maintain a narrative, non-fragmented flow. Use subheadings sparingly. A circular conclusion linking back to the opening anecdote is highly valued."
  },
  "GEOGRAPHY_OPTIONAL_PAPER_1": {
    id: "GEOGRAPHY_OPTIONAL_PAPER_1",
    expectedLanguage: "spatial organisation, areal differentiation, regional synthesis, spatial interaction, environmental determinism, possibilism, scale, geomorphic cycle, thermohaline circulation, growth pole, systems approach",
    commonDimensions: ["physical process/geomorphology", "climatological/oceanographic scales", "ecological/environmental", "human/demographic spatiality", "theoretical/model linkage"],
    evaluationPriorities: "Verify disciplinary terminology, thinker references (e.g., Davis, Penck, Weber, Christaller), theories/models, and conceptual diagrams.",
    preferredEvidence: ["geographical models", "theories", "schematic landform diagrams", "global spatial datasets"],
    valueAdditionPriors: ["MAP", "PROCESS_DIAGRAM", "CROSS_SECTION", "GRAPH"],
    answerStructureRules: "Must anchor arguments in geographical theories, referencing specific geographers and drawing conceptual/spatial diagrams."
  },
  "GEOGRAPHY_OPTIONAL_PAPER_2": {
    id: "GEOGRAPHY_OPTIONAL_PAPER_2",
    expectedLanguage: "regionalisation, spatial disparity, agro-climatic zone, transport network connectivity, borderland geopolitics, tribal area development, urban agglomeration, resource conservation",
    commonDimensions: ["physical-geographical setting of India", "agricultural/economic spatiality", "demographic/settlement patterns", "regional planning and policies", "contemporary environmental/geopolitical issues"],
    evaluationPriorities: "Prioritize India map drawing, regional/spatial differentiation, credible national data, Indian case studies, and policy linkages.",
    preferredEvidence: ["Census stats", "Indian policy reports", "regional case studies", "India sketch maps (outlining states/rivers/zones)"],
    valueAdditionPriors: ["INDIA_MAP", "REGIONAL_MAP", "COMPARISON_TABLE", "PROCESS_FLOW"],
    answerStructureRules: "An illustrative India map showing relevant spatial locations is highly expected alongside current policy references."
  }
};

/**
 * Returns the best matching subject profile key based on paper and subject.
 */
export function selectSubjectProfile(paper, subject) {
  const p = String(paper || "").toUpperCase();
  const s = String(subject || "").toUpperCase();

  // Geography Optional
  if (p.includes("OPTIONAL") || p.includes("GEOGRAPHY OPTIONAL")) {
    if (p.includes("II") || s.includes("PAPER 2") || s.includes("PAPER II") || s.includes("INDIA")) {
      return SUBJECT_PROFILES.GEOGRAPHY_OPTIONAL_PAPER_2;
    }
    return SUBJECT_PROFILES.GEOGRAPHY_OPTIONAL_PAPER_1;
  }

  // Essay
  if (p.includes("ESSAY")) {
    return SUBJECT_PROFILES.ESSAY;
  }

  // GS4
  if (p.includes("GS4") || p.includes("GS 4") || p.includes("GS PAPER IV") || p.includes("PAPER IV") || p.includes("ETHICS")) {
    if (s.includes("CASE STUDY") || s.includes("CASE STUDIES")) {
      return SUBJECT_PROFILES.GS4_CASE_STUDY;
    }
    return SUBJECT_PROFILES.GS4_ETHICS_THEORY;
  }

  // GS3
  if (p.includes("GS3") || p.includes("GS 3") || p.includes("GS PAPER III") || p.includes("PAPER III")) {
    if (s.includes("ECONOMY") || s.includes("DEVELOPMENT") || s.includes("INFRASTRUCTURE")) {
      return SUBJECT_PROFILES.GS3_ECONOMY;
    }
    if (s.includes("AGRICULTURE") || s.includes("FARM") || s.includes("CROP")) {
      return SUBJECT_PROFILES.GS3_AGRICULTURE;
    }
    if (s.includes("SCIENCE") || s.includes("TECHNOLOGY") || s.includes("S&T")) {
      return SUBJECT_PROFILES.GS3_SCIENCE_TECH;
    }
    if (s.includes("ENVIRONMENT") || s.includes("ECOLOGY") || s.includes("CONSERVATION")) {
      return SUBJECT_PROFILES.GS3_ENVIRONMENT;
    }
    if (s.includes("DISASTER") || s.includes("DM")) {
      return SUBJECT_PROFILES.GS3_DISASTER_MANAGEMENT;
    }
    if (s.includes("SECURITY") || s.includes("INTERNAL SECURITY") || s.includes("THREAT")) {
      return SUBJECT_PROFILES.GS3_INTERNAL_SECURITY;
    }
    return SUBJECT_PROFILES.GS3_ECONOMY; // Fallback
  }

  // GS2
  if (p.includes("GS2") || p.includes("GS 2") || p.includes("GS PAPER II") || p.includes("PAPER II")) {
    if (s.includes("POLITY") || s.includes("CONSTITUTION")) {
      return SUBJECT_PROFILES.GS2_POLITY;
    }
    if (s.includes("GOVERNANCE") || s.includes("ADMINISTRATION")) {
      return SUBJECT_PROFILES.GS2_GOVERNANCE;
    }
    if (s.includes("SOCIAL JUSTICE") || s.includes("JUSTICE") || s.includes("WELFARE")) {
      return SUBJECT_PROFILES.GS2_SOCIAL_JUSTICE;
    }
    if (s.includes("INTERNATIONAL") || s.includes("IR") || s.includes("BILATERAL")) {
      return SUBJECT_PROFILES.GS2_IR;
    }
    return SUBJECT_PROFILES.GS2_POLITY; // Fallback
  }

  // GS1
  if (p.includes("GS1") || p.includes("GS 1") || p.includes("GS PAPER I") || p.includes("PAPER I")) {
    if (s.includes("HISTORY") || s.includes("FREEDOM") || s.includes("NATIONAL MOVEMENT")) {
      return SUBJECT_PROFILES.GS1_HISTORY;
    }
    if (s.includes("ART") || s.includes("CULTURE")) {
      return SUBJECT_PROFILES.GS1_ART_CULTURE;
    }
    if (s.includes("SOCIETY") || s.includes("SOCIAL")) {
      return SUBJECT_PROFILES.GS1_SOCIETY;
    }
    if (s.includes("GEOGRAPHY") || s.includes("PHYSICAL") || s.includes("MAP")) {
      return SUBJECT_PROFILES.GS1_GEOGRAPHY;
    }
    return SUBJECT_PROFILES.GS1_HISTORY; // Fallback
  }

  // Global default fallback
  return SUBJECT_PROFILES.GS1_HISTORY;
}
