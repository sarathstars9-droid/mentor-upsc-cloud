/**
 * backend/blockResolution/pdfResolver.js
 *
 * DETERMINISTIC PDF → SYLLABUS NODE RESOLVER
 * ─────────────────────────────────────────────────────────────────────────────
 * Pipeline:
 *   question.section → map lookup → optional keyword refinement → nodeId
 *
 * RULES:
 *  - NEVER produces "Unmapped Topic" — always returns a fallbackNodeId
 *  - NEVER produces MISC-GEN for syllabus content
 *  - NEVER searches across subjects
 *  - Keyword refinement only inside allowedPrefixes
 *  - Falls back to parent node when specific node not found
 */

import { PDF_TO_SYLLABUS_MAP } from "./pdfToSyllabusMap.js";

// All node IDs known to be valid in pyq_by_node.json / syllabus graph.
// Used for validation only — not for matching.
const VALID_NODE_PREFIXES = [
  "1C-", "GS1-", "GS2-", "GS3-", "GS4-", "CSAT-", "ESSAY-", "OPT-"
];

/**
 * Build a normalised lookup key from a question's section / microtheme.
 * The section field in the tagged JSON is the PDF classification label.
 *
 * @param {string} subject   - question.subject  e.g. "Economy"
 * @param {string} section   - question.section  e.g. "1B1: Bank Classification"
 * @returns {string}         - composite key for PDF_TO_SYLLABUS_MAP
 */
function buildLookupKey(rawSubject, section) {
  // ① Direct section key (bare section label, e.g. "Executive", "Judiciary")
  if (PDF_TO_SYLLABUS_MAP[section]) return section;

  // ② Raw "Subject > Section" composite — try BEFORE normalization
  //    Catches "History & Culture > Architecture and Sculpture" etc.
  const rawComposite = `${rawSubject} > ${section}`;
  if (PDF_TO_SYLLABUS_MAP[rawComposite]) return rawComposite;

  // ③ Strip numeric prefixes like "1B1: " then retry with raw subject
  const stripped = section.replace(/^\d+[A-Z]*\d*:\s*/, "").trim();
  if (stripped !== section) {
    const rawStripped = `${rawSubject} > ${stripped}`;
    if (PDF_TO_SYLLABUS_MAP[rawStripped]) return rawStripped;
  }

  // ④ Normalized subject composite (legacy path)
  //    e.g. "Indian Economy > Banking Structure"
  const normalizedSubj = _normalizeSubject(rawSubject);
  if (normalizedSubj !== rawSubject) {
    const normComposite = `${normalizedSubj} > ${section}`;
    if (PDF_TO_SYLLABUS_MAP[normComposite]) return normComposite;

    if (stripped !== section) {
      const normStripped = `${normalizedSubj} > ${stripped}`;
      if (PDF_TO_SYLLABUS_MAP[normStripped]) return normStripped;
    }
  }

  return null;
}

/**
 * Normalize subject name from tagged file to map key prefix.
 * @param {string} rawSubject
 * @returns {string}
 */
function _normalizeSubject(rawSubject) {
  const s = String(rawSubject || "").toLowerCase().trim();
  if (s === "economy") return "Indian Economy";
  if (s.startsWith("polity")) return "Indian Polity";
  if (s === "environment") return "Environment";
  if (s.includes("science")) return "Science and Technology";
  if (s.includes("ancient")) return "Ancient Indian History";
  if (s.includes("medieval")) return "Medieval Indian History";
  if (s.includes("modern")) return "Modern Indian History";
  if (s === "history") return "Modern Indian History"; // fallback
  if (s.includes("art") || s.includes("culture")) return "Art and Culture";
  if (s.includes("geography")) return "Geography";
  if (s.includes("international") || s.includes("ir")) return "International Relations";
  if (s.includes("society") || s.includes("social")) return "Society";
  if (s.includes("current") || s.includes("misc")) return "Current Affairs";
  return rawSubject; // pass through
}

/**
 * Validate that a nodeId has a recognized prefix.
 * @param {string} nodeId
 * @returns {boolean}
 */
function isValidNodeId(nodeId) {
  if (!nodeId) return false;
  return VALID_NODE_PREFIXES.some(prefix => nodeId.startsWith(prefix));
}

/**
 * Resolve a single question to its canonical syllabus nodeId.
 *
 * @param {object} params
 * @param {string} params.pdfSubject    - Raw subject from tagged file
 * @param {string} params.pdfSection    - Raw section from tagged file
 * @param {string} params.questionText  - Full question text (for keyword refinement)
 * @param {string} [params.existingNodeId] - Already-assigned nodeId (may be invalid)
 * @returns {{ syllabusNodeId: string, topic: string, mappingStatus: string, reason: string }}
 */
export function resolveNode({ pdfSubject, pdfSection, questionText, existingNodeId }) {
  const rawSubject = String(pdfSubject || "").trim();
  const normalizedSubject = _normalizeSubject(rawSubject);
  const text = String(questionText || "").toLowerCase();

  // ── Step 1: Map lookup (tries raw → stripped → normalized) ────────────────
  const key = buildLookupKey(rawSubject, pdfSection);

  if (!key) {
    // No direct mapping found for this section.
    // Check if existingNodeId is already valid — keep it.
    if (existingNodeId && isValidNodeId(existingNodeId)) {
      return {
        syllabusNodeId: existingNodeId,
        topic: deriveTopic(existingNodeId),
        mappingStatus: "existing-valid",
        reason: "no-section-map-but-existing-valid",
      };
    }
    // True fallback: use subject-level default
    const subjectDefault = getSubjectDefaultNode(normalizedSubject);
    return {
      syllabusNodeId: subjectDefault,
      topic: deriveTopic(subjectDefault),
      mappingStatus: "subject-fallback",
      reason: `no-mapping-for-section:${pdfSection}`,
    };
  }

  const config = PDF_TO_SYLLABUS_MAP[key];

  // ── Step 2: Keyword refinement (within allowedPrefixes only) ───────────────
  if (config.keywordsToNodeIds) {
    for (const [keyword, targetNodeId] of Object.entries(config.keywordsToNodeIds)) {
      if (text.includes(keyword.toLowerCase())) {
        // Verify it's in the allowed prefix family
        const inFamily = config.allowedPrefixes.some(p => targetNodeId.startsWith(p));
        if (inFamily && isValidNodeId(targetNodeId)) {
          return {
            syllabusNodeId: targetNodeId,
            topic: deriveTopic(targetNodeId),
            mappingStatus: "keyword-match",
            reason: `keyword:${keyword}`,
          };
        }
      }
    }
  }

  // ── Step 3: Use fallback node ──────────────────────────────────────────────
  return {
    syllabusNodeId: config.fallbackNodeId,
    topic: deriveTopic(config.fallbackNodeId),
    mappingStatus: "fallback",
    reason: `section-level-fallback:${key}`,
  };
}

/**
 * Get a safe subject-level default nodeId when section mapping fails.
 * @param {string} normalizedSubject
 * @returns {string}
 */
function getSubjectDefaultNode(normalizedSubject) {
  const defaults = {
    "Indian Economy": "GS3-ECO-PRE-BANKING-STRUCTURE",
    "Indian Polity": "GS2-POL-PARL",
    "Environment": "GS3-ENV-BIOGEO",
    "Science and Technology": "GS3-ST-GENSCI-BIO",
    "Ancient Indian History": "GS1-HIS-ANC-MAURYA",
    "Medieval Indian History": "GS1-HIS-MED-DELHI",
    "Modern Indian History": "GS1-HIS-MOD-NATIONAL",
    "Art and Culture": "1C-VA-ARCH",
    "Geography": "GS1-GEO-IND-PHYSIO",
    "International Relations": "GS2-IR-INSTITUTIONS",
    "Society": "GS1-SOC-UPSC-EMPOWER",
    "Current Affairs": "1C-MISC-INST",
  };
  return defaults[normalizedSubject] || "1C-MISC-INST";
}

/**
 * Derive a human-readable topic label from a nodeId.
 * Used to replace "Unmapped Topic" with something meaningful.
 * @param {string} nodeId
 * @returns {string}
 */
export function deriveTopic(nodeId) {
  if (!nodeId) return "General";

  const TOPIC_LABELS = {
    // Economy
    "GS3-ECO-PRE-BANKING-STRUCTURE": "Banking Structure",
    "GS3-ECO-PRE-MONEY-BASICS": "Monetary Policy",
    "GS3-ECO-PRE-INFLATION": "Inflation & Prices",
    "GS3-ECO-PRE-BUDGET": "Budget & Fiscal Policy",
    "GS3-ECO-PRE-TAX": "Taxation",
    "GS3-ECO-PRE-FIN-MARKETS": "Financial Markets",
    "GS3-ECO-PRE-BOP": "External Sector & BOP",
    "GS3-ECO-PRE-GROWTH": "Growth & Development",
    "GS3-ECO-PRE-POVERTY": "Poverty & Inclusion",
    "GS3-ECO-SECT-INFRA": "Infrastructure",
    "GS3-ECO-SECT-INDLAB": "Industry & Labour",
    "GS3-ECO-SECT-AGRI": "Agriculture",
    // Environment
    "GS3-ENV-BIOGEO": "Biodiversity & Species",
    "GS3-ENV-CLIMATEPHEN": "Climate Change",
    "GS3-ENV-CURR-CLIMATE": "Climate Conventions & COP",
    "GS3-ENV-CURR-POLLUTION": "Pollution",
    "GS3-ENV-CURR-RIVERS": "River Ecology",
    "GS3-ENV-CONSERVATION": "Conservation & Protected Areas",
    "GS3-ENV-ECO-CONCEPTS": "Ecology Concepts",
    "GS3-ENV-INTL": "International Conventions",
    "GS3-ENV-ACTS": "Environmental Legislation",
    "GS3-ENV-ENERGY": "Renewable Energy",
    "GS3-ENV-GLOBALWARM": "Global Warming",
    "GS3-ENV-SPECIES": "Species Conservation",
    "GS3-ENV-WASTE": "Waste Management",
    "GS3-ENV-AIR": "Air Pollution",
    "GS3-ENV-LAND-WATER": "Land & Water Management",
    // Polity
    "GS2-POL-FR": "Fundamental Rights",
    "GS2-POL-DPSP": "DPSP & Fundamental Duties",
    "GS2-POL-FD": "Fundamental Duties",
    "GS2-POL-EXEC": "Union Executive",
    "GS2-POL-STATE": "State Executive",
    "GS2-POL-PARL": "Parliament & Legislature",
    "GS2-POL-JUD": "Judiciary",
    "GS2-POL-ELECTIONS": "Elections",
    "GS2-POL-AMEND": "Constitutional Amendments",
    "GS2-POL-CSREL": "Centre-State Relations",
    "GS2-POL-BODIES": "Constitutional Bodies",
    "GS2-POL-LOCAL": "Local Self Government",
    "GS2-POL-PREAMBLE": "Preamble & Key Features",
    "GS2-POL-CONTEMP": "Governance & Contemporary Issues",
    "GS2-POL-EMER": "Emergency Provisions",
    "GS2-POL-CITIZEN": "Citizenship",
    "GS2-POL-UTS": "Union Territories",
    "GS2-POL-UTERR": "Special Areas",
    // History - Ancient
    "GS1-HIS-ANC-IVC": "Indus Valley Civilisation",
    "GS1-HIS-ANC-VEDIC-LATER": "Later Vedic Age",
    "GS1-HIS-ANC-VEDIC-RIG": "Rig Vedic Period",
    "GS1-HIS-ANC-MAURYA": "Mauryan Empire",
    "GS1-HIS-ANC-POSTMAURYA": "Post-Mauryan Period",
    "GS1-HIS-ANC-GUPTA": "Gupta Period",
    "GS1-HIS-ANC-HARSHA": "Harsha Period",
    "GS1-HIS-ANC-SANGAM": "Sangam Age",
    "GS1-HIS-ANC-BUD": "Buddhism",
    "GS1-HIS-ANC-JAIN": "Jainism",
    "GS1-HIS-ANC-MAHAJAN": "Mahajanapadas",
    "GS1-HIS-ANC-PREHIST": "Prehistoric India",
    // History - Medieval
    "GS1-HIS-MED-DELHI": "Delhi Sultanate",
    "GS1-HIS-MED-MUGHAL": "Mughal Empire",
    "GS1-HIS-MED-BHAKTI": "Bhakti Movement",
    "GS1-HIS-MED-SUFI": "Sufi Movement",
    "GS1-HIS-MED-VIJAYANAGARA": "Vijayanagara",
    "GS1-HIS-MED-REGIONAL": "Regional Kingdoms",
    "GS1-HIS-MED-CHOLA": "Chola Empire",
    "GS1-HIS-MED-18C": "18th Century Decline",
    // History - Modern
    "GS1-HIS-MOD-EURO": "Advent of Europeans",
    "GS1-HIS-MOD-EXPANSION": "British Expansion",
    "GS1-HIS-MOD-1857": "Revolt of 1857",
    "GS1-HIS-MOD-REFORM": "Social Reforms",
    "GS1-HIS-MOD-NATIONAL": "Nationalist Movement",
    "GS1-HIS-MOD-ADMIN": "Governor Generals & Administration",
    "GS1-HIS-MOD-CONSTDEV": "Constitutional Development",
    // Science & Tech
    "GS3-ST-BIOTECH": "Biotechnology",
    "GS3-ST-SPACE": "Space Technology",
    "GS3-ST-DEFENCE": "Defence Technology",
    "GS3-ST-IT-COMM": "IT & Communications",
    "GS3-ST-MATERIALS-NANO-ROBOTICS-AI": "AI & Emerging Tech",
    "GS3-ST-NUCLEAR": "Nuclear Technology",
    "GS3-ST-GENSCI-BIO": "Health & Biological Sciences",
    "GS3-ST-IPR": "IPR & Technology Policy",
    // Geography
    "GS1-GEO-IND-PHYSIO": "Indian Physiography",
    "GS1-GEO-IND-CLIMATE": "Indian Climate",
    "GS1-GEO-IND-DRAINAGE": "Rivers & Drainage",
    "GS1-GEO-IND-AGRI": "Indian Agriculture",
    "GS1-GEO-IND-RESOURCES": "Resources & Minerals",
    "GS1-GEO-IND-POP-URBAN": "Population & Urbanization",
    "GS1-GEO-GM-LANDFORMS": "Landforms & Geomorphology",
    "GS1-GEO-CLIM-SYSTEMS": "Climatology",
    "GS1-GEO-PRE-REGIONAL-PLACES": "Locations & Maps",
    "GS1-GEO-OCE-MOTIONS": "Oceanography",
    // IR
    "GS2-IR-INSTITUTIONS": "International Organisations",
    "GS2-IR-GROUPINGS": "Regional Groupings",
    "GS2-IR-NEIGHBOURS": "India's Neighbours",
    "GS2-IR-MAJOR-POWERS": "Major Powers",
    "GS2-IR-ASEAN-EAP": "ASEAN & East Asia",
    "GS2-IR-CLIMATE-DISARM": "Climate & Disarmament",
    "GS2-IR-WEST-ASIA": "West Asia",
    // Culture
    "1C-VA-ARCH": "Architecture",
    "1C-VA-PAINT": "Painting",
    "1C-VA-SCULP": "Sculpture",
    "1C-VA-POTTERY": "Pottery & Crafts",
    "1C-VA-NUMIS": "Numismatics",
    "1C-PA-DANCE": "Classical Dance",
    "1C-PA-MUSIC": "Music",
    "1C-PA-THEATRE": "Theatre",
    "1C-PA-PUPPET": "Puppet Arts",
    "1C-PA-SPORTS": "Sports & Games",
    "1C-RLL-LANG": "Literature & Language",
    "1C-RLL-RELIGION": "Religion & Philosophy",
    "1C-MISC-GI": "Geographical Indications",
    "1C-MISC-INST": "Institutions & Personalities",
    "1C-MISC-SCHEMES": "Government Schemes",
    "1C-MISC-UNESCO": "UNESCO Heritage",
  };

  return TOPIC_LABELS[nodeId] || nodeId.replace(/-/g, " → ");
}
