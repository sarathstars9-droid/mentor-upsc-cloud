// backend/brain/subjectAliasMap.js
// ──────────────────────────────────────────────────────────────────────────────
// Central, canonical subject-ID normalisation for the entire Prelims pipeline.
// Every component (builder, loader, health endpoint, frontend) MUST use this
// map to resolve frontend subject IDs to the unified-loader subject key.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Maps every known frontend / legacy subject ID to the canonical key used by
 * the unified loader (`prelimsUnifiedLoader.js`).
 *
 * Rules:
 *  - ancient_history, medieval_history, modern_history are SEPARATE subjects.
 *  - "history" as a composite is NOT allowed — callers must specify the era.
 *  - art_culture has NO dedicated unified bucket; frontend filters it from
 *    current_affairs by keyword. However, we keep it as its own alias so the
 *    builder can handle it explicitly.
 *  - CSAT modules map to their own keys (csat_quant, csat_lr, csat_rc).
 */
export const SUBJECT_ALIAS = Object.freeze({
  // ── GS History (era-separated) ──────────────────────────────────────────
  ancient_history:            "ancient_history",
  medieval_history:           "medieval_history",
  modern_history:             "modern_history",

  // ── GS Core Subjects ───────────────────────────────────────────────────
  polity:                     "indian_polity",
  indian_polity:              "indian_polity",
  polity_governance:          "indian_polity",

  economy:                    "economy",
  indian_economy:             "economy",

  geography:                  "geography",
  geography_india:            "geography",
  geography_world:            "geography",
  indian_geography:           "geography",
  world_geography:            "geography",

  environment:                "environment",
  ecology:                    "environment",
  environment_and_ecology:    "environment",

  science_tech:               "science_tech",
  sciencetech:                "science_tech",
  science_and_technology:     "science_tech",
  science_technology:         "science_tech",

  international_relations:    "international_relations",
  ir:                         "international_relations",

  current_affairs:            "current_affairs",
  current_affairs_misc:       "current_affairs",
  misc:                       "current_affairs",

  // art_culture: resolved as its own canonical key.
  // The unified loader buckets these under current_affairs but the frontend
  // keyword-filters them. The builder handles this as a special case.
  art_culture:                "art_culture",
  culture:                    "art_culture",

  // ── CSAT ────────────────────────────────────────────────────────────────
  csat_quant:                 "csat_quant",
  csat_lr:                    "csat_lr",
  csat_reasoning:             "csat_lr",
  csat_rc:                    "csat_rc",
});

/**
 * Resolve a raw subject ID to its canonical unified-loader key.
 * Returns the alias if found, otherwise returns the input lower-cased.
 */
export function resolveSubjectAlias(rawSubjectId) {
  if (!rawSubjectId) return "";
  const key = String(rawSubjectId).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SUBJECT_ALIAS[key] || key;
}

/**
 * Mapping from nodeId prefix → canonical subject key.
 * Used to reassign orphaned questions (e.g. "patches" subject) to
 * their correct production subject based on their nodeId.
 */
export const NODE_PREFIX_TO_SUBJECT = Object.freeze({
  "GS1-HIS-ANC":    "ancient_history",
  "GS1-HIS-MED":    "medieval_history",
  "GS1-HIS-MOD":    "modern_history",
  "GS1-HIS-WORLD":  "modern_history",
  "GS1-ART":        "current_affairs",    // Art & Culture lives in current_affairs bucket
  "GS1-GEO":        "geography",
  "GS2-POL":        "indian_polity",
  "GS2-GOV":        "indian_polity",
  "GS2-IR":         "international_relations",
  "GS3-ECO":        "economy",
  "GS3-ENV":        "environment",
  "GS3-ST":         "science_tech",
  "GS3-SCI":        "science_tech",
  "GS3-SEC":        "indian_polity",
  "1C":             "current_affairs",
  "CA":             "current_affairs",
  "CSAT-BN":        "csat_quant",
  "CSAT-DI":        "csat_quant",
  "CSAT-LR":        "csat_lr",
  "CSAT-DM":        "csat_lr",
  "CSAT-COMP":      "csat_rc",
  "CSAT-RC":        "csat_rc",
});

/**
 * Given a nodeId, resolve the correct production subject.
 * Matches the longest prefix first for specificity.
 */
export function resolveSubjectFromNodeId(nodeId) {
  if (!nodeId) return null;
  const clean = String(nodeId).trim();

  // Sort prefixes by length descending so longer (more specific) prefixes match first
  const prefixes = Object.keys(NODE_PREFIX_TO_SUBJECT).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (clean.startsWith(prefix)) return NODE_PREFIX_TO_SUBJECT[prefix];
  }
  return null;
}
