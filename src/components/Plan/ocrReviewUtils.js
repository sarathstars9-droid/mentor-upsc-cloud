/**
 * src/components/Plan/ocrReviewUtils.js
 *
 * Helper utilities for OcrReviewModal.jsx.
 * Pure functions — no React dependencies.
 */

// ─── Confidence → colour mapping ─────────────────────────────────────────────

/**
 * Returns a CSS color string for a confidence band.
 * Matches MentorOS palette.
 */
export function confidenceToColor(band) {
  switch (band) {
    case "high":   return "#5de3a0";   // soft green
    case "medium": return "#f0b44b";   // amber
    case "low":    return "#f07070";   // coral/red
    default:       return "#858c95";   // muted gray
  }
}

/**
 * Returns a hex badge background for a confidence band.
 */
export function confidenceToBgColor(band) {
  switch (band) {
    case "high":   return "rgba(93, 227, 160, 0.12)";
    case "medium": return "rgba(240, 180, 75, 0.12)";
    case "low":    return "rgba(240, 112, 112, 0.14)";
    default:       return "rgba(255,255,255,0.05)";
  }
}

/**
 * Returns a border colour for a confidence band.
 */
export function confidenceToBorder(band) {
  switch (band) {
    case "high":   return "rgba(93, 227, 160, 0.30)";
    case "medium": return "rgba(240, 180, 75, 0.30)";
    case "low":    return "rgba(240, 112, 112, 0.30)";
    default:       return "rgba(255,255,255,0.08)";
  }
}

/**
 * Returns a human-readable label for a confidence band.
 */
export function confidenceToLabel(band) {
  switch (band) {
    case "high":   return "High Confidence";
    case "medium": return "Medium — Review Suggested";
    case "low":    return "Low — Manual Review Required";
    default:       return "Unknown Confidence";
  }
}

/**
 * Returns an icon character for a confidence band.
 */
export function confidenceToIcon(band) {
  switch (band) {
    case "high":   return "✓";
    case "medium": return "⚠";
    case "low":    return "✕";
    default:       return "?";
  }
}

// ─── Alternatives normaliser ──────────────────────────────────────────────────

/**
 * Normalise an alternatives array from either subject or section classifier output.
 * Returns a stable array of { label, confidence } objects capped at maxItems.
 *
 * @param {Array} alternatives - Raw alternatives from classifySubject / classifySection
 * @param {"subject"|"section"} kind
 * @param {number} maxItems
 * @returns {{ label: string, confidence: number }[]}
 */
export function normalizeAlternatives(alternatives, kind = "subject", maxItems = 3) {
  if (!Array.isArray(alternatives)) return [];

  return alternatives
    .slice(0, maxItems)
    .map((alt) => {
      const label =
        kind === "subject"
          ? (alt.subject || alt.label || "Unknown")
          : (alt.normalizedSection || alt.section || alt.label || "Unknown");
      const confidence =
        typeof alt.confidence === "number" ? alt.confidence : 0;
      return { label, confidence };
    })
    .filter((a) => a.label && a.label !== "Unknown");
}

// ─── Section options (for the Edit-mode dropdown) ────────────────────────────

/**
 * Static map of subject → section names.
 * Mirrors SECTION_KEYWORDS from ocrKeywordBank.js.
 * Keep in sync if new sections are added.
 */
const SUBJECT_SECTIONS = {
  "Polity": [
    "Fundamental Rights",
    "DPSP and Fundamental Duties",
    "Preamble and Key Features",
    "Executive",
    "State Executive",
    "Parliament and Legislature",
    "Judiciary",
    "Federalism and Center-State Relations",
    "Constitutional Bodies",
    "Elections",
    "Emergency Provisions",
    "Amendments",
    "Citizenship",
    "Local Self Government",
    "Governance",
  ],
  "Economy": [
    "Banking Structure",
    "Monetary Policy and RBI",
    "Inflation and Price Indices",
    "Budget and Fiscal Policy",
    "Taxation",
    "Financial Markets and Capital Market",
    "External Sector and BOP",
    "Growth, Development and Planning",
    "Agriculture Sector",
    "Infrastructure and Energy",
    "Poverty and Inclusion",
  ],
  "Environment": [
    "Biodiversity",
    "Climate Change",
    "Ecology Concepts",
    "Environmental Pollution",
    "Conservation and Protected Areas",
    "Environmental Legislation and Acts",
    "International Environmental Conventions",
    "Species Conservation",
  ],
  "Science & Technology": [
    "Biotechnology",
    "Space",
    "Nuclear Technology",
    "AI and Emerging Technology",
    "Health and Diseases",
    "IT and Communications",
    "Defence Technology",
  ],
  "Geography": [
    "Indian Physiography",
    "Indian Climate and Monsoon",
    "Rivers and Drainage",
    "Physical Geography - Geomorphology",
    "Physical Geography - Climatology",
    "Oceanography",
    "Indian Agriculture and Resources",
    "World Geography - Maps and Locations",
  ],
  "Ancient Indian History": [
    "Prehistoric and IVC",
    "Vedic Period",
    "Mauryan Empire",
    "Post-Mauryan to Gupta",
    "Sangam Age",
    "Religion and Philosophy - Ancient",
  ],
  "Medieval Indian History": [
    "Delhi Sultanate",
    "Mughal Empire",
    "Bhakti and Sufi Movements",
    "Vijayanagara and Regional",
    "Art and Architecture - Medieval",
  ],
  "Modern Indian History": [
    "Advent of Europeans",
    "Revolt of 1857",
    "Nationalist Movement",
    "Social Reforms",
    "Governor Generals and Administration",
    "Constitutional Development",
    "Partition and Independence",
  ],
  "Art & Culture": [
    "Architecture",
    "Painting",
    "Sculpture",
    "Performing Arts",
    "Literature and Language",
    "Religion and Philosophy",
  ],
  "International Relations": [
    "International Organisations",
    "Regional Groupings",
    "India's Neighbours",
    "Major Powers",
    "Climate and Disarmament",
  ],
  "Society": [
    "Social Issues and Empowerment",
    "Women Empowerment",
    "Tribal Issues",
    "Population and Urbanization",
  ],
  "Current Affairs": [
    "Places in News",
    "Government Schemes",
    "Awards and Personalities",
    "Reports and Indices",
  ],
};

/**
 * Returns a sorted list of all known subjects.
 */
export function getAllSubjects() {
  return Object.keys(SUBJECT_SECTIONS).sort();
}

/**
 * Returns the section options for a given subject.
 * Returns an empty array for unknown subjects.
 *
 * @param {string} subject
 * @returns {string[]}
 */
export function getSectionOptionsForSubject(subject) {
  if (!subject) return [];
  return SUBJECT_SECTIONS[subject] || [];
}

// ─── Mapping status helpers ───────────────────────────────────────────────────

/**
 * Returns a human-readable label for a mappingStatus code.
 */
export function mappingStatusLabel(status) {
  switch (status) {
    case "exact":           return "Exact Match";
    case "fallback":        return "Fallback Match";
    case "subject-fallback":return "Subject Fallback";
    case "keyword-match":   return "Keyword Match";
    case "no-section":      return "No Section";
    case "empty-input":     return "Empty Input";
    case "unknown":         return "Unknown";
    default:                return status || "–";
  }
}

/**
 * Returns colour for a mapping status.
 */
export function mappingStatusColor(status) {
  switch (status) {
    case "exact":           return "#5de3a0";
    case "fallback":        return "#f0b44b";
    case "keyword-match":   return "#f0b44b";
    case "subject-fallback":return "#f07070";
    case "no-section":      return "#f07070";
    case "empty-input":     return "#858c95";
    default:                return "#858c95";
  }
}

/**
 * Formats a confidence number (0–1) as a percentage string.
 */
export function fmtPct(conf) {
  if (typeof conf !== "number") return "–";
  return `${Math.round(conf * 100)}%`;
}
