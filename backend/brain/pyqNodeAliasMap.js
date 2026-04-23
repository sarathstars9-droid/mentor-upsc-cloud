// backend/brain/pyqNodeAliasMap.js
//
// Maps non-canonical or legacy syllabusNodeId values to the nearest valid
// canonical node in unifiedSyllabusIndex.
//
// Rules:
//   1. Only map to nodes that expandCanonicalOrLegacyToLeafNodeIds resolves.
//   2. Prefer the most specific canonical ancestor available.
//   3. CA-xxx / CA-SPORT / CA-ABP / CA-MISC have no canonical anchor —
//      they are intentionally omitted so they fall through as raw buckets
//      (still queryable directly; just not leaf-expanded).

export const PYQ_NODE_ALIAS_MAP = {
  // ── GS2 / GS3 existing aliases ────────────────────────────────────────────
  "GS2-POL-FED":                    "GS2-POL-CSREL",
  "GS2-POL-GOV":                    "GS2-GOV-GOOD-GOV",
  "GS2-POL-CONTEMP":                "GS2-POL-PARL",
  "GS2-IR-CONTEMP":                 "GS2-IR-INSTITUTIONS",
  "GS3-ST-MATERIALS":               "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
  "GS3-ST-ENERGY":                  "GS3-ENV-ENERGY",
  "GS3-ST-CYBERSECURITY":           "GS3-SEC-CYBER-BASICS",
  "GS3-ST-QUANTUM":                 "GS3-ST-IT-COMM",
  "GS3-ST-AI":                      "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
  "GS3-ST-ENV-TECH":                "GS3-ENV-CONSERVATION",
  "GS3-ST-INFRA-TRANSPORT-TECH":    "GS3-ECO-SECT-INFRA",
  "GS3-ENV-MAINS":                  "GS3-ENV-CONSERVATION",
  "GS3-ENV-RESOURCES":              "GS3-ENV-LAND-WATER",
  "GS3-SEC-CONTEMP":                "GS3-SEC-TERRORISM",
  "GS1-HIS-WORLD-INDUSTRIAL":       "GS1-HIS-WORLD-REV",
  "CSAT-DM":                        "CSAT-LR-MISC",
  "GS3-ST-BASIC-SCIENCE":           "GS3-ST-GENSCI-BIO",

  // ── GS4 theory aliases ────────────────────────────────────────────────────
  "GS4-ETH-HUM":                    "GS4-ETH-HV",
  "GS4-ETH-FOUND":                  "GS4-ETH-APT",
  "GS4-ETH-ATTITUDE":               "GS4-ETH-ATT",
  "GS4-ETH-CONFLICT":               "GS4-ETH-GOV",

  // ── GS4 case study aliases ────────────────────────────────────────────────
  "GS4-CASE-HUM":                   "GS4-ETH-CS",
  "GS4-CASE-FOUND":                 "GS4-ETH-CS",
  "GS4-CASE-GOV":                   "GS4-ETH-CS",
  "GS4-CASE-CONFLICT":              "GS4-ETH-CS",
  "GS4-CASE-EI":                    "GS4-ETH-CS",
  "GS4-CASE-PROB":                  "GS4-ETH-CS",

  // ── CSAT LR analytical alias ──────────────────────────────────────────────
  "CSAT-LR-ANALYTICAL":             "CSAT-LR-SYL",

  // ── v2 GS2 Polity — renamed from v2 format to canonical ──────────────────
  // v2 uses GS2-POL-PARLIAMENT; canonical is GS2-POL-PARL
  "GS2-POL-PARLIAMENT":             "GS2-POL-PARL",
  // v2 uses GS2-POL-STATE-LEG; canonical parent for state legislature
  "GS2-POL-STATE-LEG":              "GS2-POL-STATE",

  // ── v2 GS2 IR / Governance current-affairs nodes ─────────────────────────
  "GS2-CA-IR":                      "GS2-IR-INSTITUTIONS",
  "GS2-CA-GOV":                     "GS2-GOV-GOOD-GOV",

  // ── v2 GS1 current-affairs history / culture / geography ─────────────────
  // CA art & culture → medieval history node (covers arts/architecture/music)
  "GS1-CA-CULT":                    "GS1-HIS-MED",
  // CA history current affairs → modern history node
  "GS1-CA-HIST":                    "GS1-HIS-MOD",
  // CA geography current affairs → Indian geography parent node
  "GS1-CA-GEO":                     "GS1-GEO-IND",

  // ── v2 GS3 Economy parent + industry alias ────────────────────────────────
  // GS3-ECO is the unmapped parent; route to the broadest valid child
  "GS3-ECO":                        "GS3-ECO-INCLUSIVE-GROWTH",
  "GS3-ECO-INDUSTRY":               "GS3-ECO-SECT-INDLAB",

  // ── v2 GS3 Economy current-affairs nodes ─────────────────────────────────
  "GS3-CA-ECO":                     "GS3-ECO-INCLUSIVE-GROWTH",

  // ── v2 GS3 Environment current-affairs nodes ─────────────────────────────
  "GS3-CA-ENV":                     "GS3-ENV-SPECIES",

  // ── v2 GS3 Science & Technology current-affairs nodes ────────────────────
  "GS3-CA-SCI":                     "GS3-ST-GENSCI-BIO",
  "GS3-CA-GENSCI":                  "GS3-ST-GENSCI-BIO",

  // ── v2 Science & Technology node format → canonical GS3-ST-* format ──────
  "GS3-SCI-TECH-SPACE":             "GS3-ST-SPACE",
  "GS3-SCI-TECH-BIOTECH":           "GS3-ST-BIOTECH",
  "GS3-SCI-TECH-IT":                "GS3-ST-IT-COMM",
  "GS3-SCI-TECH-GENERAL":           "GS3-ST-GENSCI-BIO",
  "GS3-SCI-TECH-HEALTH":            "GS3-ST-GENSCI-BIO",
  "GS3-SCI-TECH-MATERIALS":         "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
  "GS3-SCI-TECH-ROBOTICS":          "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
  // Energy in sci-tech context → environment energy node (nuclear/renewable)
  "GS3-SCI-TECH-ENERGY":            "GS3-ENV-ENERGY",

  // ── v2 Geography node format → canonical GS1-GEO-* format ────────────────
  // Dot-notation used in v2 geography folder files.
  //
  // IMPORTANT: Only alias to SPECIFIC (non-parent) canonical nodes to avoid
  // fan-out explosion. Broad "geo.xxx" tags that have no precise canonical
  // mapping are deliberately omitted — they fall through to raw node buckets
  // (still queryable, just not expanded across all leaf microthemes).
  // Aliasing geo.indian-geography → GS1-GEO-IND (20 children) would fan every
  // broad geography question into all 20 subtopic leaf nodes — the same
  // explosion pattern as the old CSAT-RC bug.
  "geo.climatology":                "GS1-GEO-IND-CLIMATE",  // 4 leaf nodes
  "geo.agriculture":                "GS1-GEO-IND-AGRI",     // 4 leaf nodes
  // geo.indian-geography, geo.geomorphology, geo.oceanography, geo.world-mapping,
  // geo.world-regions, geo.economic-geography, geo.industry-resources → raw buckets
};
