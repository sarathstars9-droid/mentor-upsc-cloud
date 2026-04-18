// backend/brain/pyqNodeAliasMap.js
export const PYQ_NODE_ALIAS_MAP = {
  // ── GS2 / GS3 existing aliases ───────────────────────────────────────────
  "GS2-POL-FED": "GS2-POL-CSREL",
  "GS2-POL-GOV": "GS2-GOV-GOOD-GOV",
  "GS2-POL-CONTEMP": "GS2-POL-PARL",
  "GS2-IR-CONTEMP": "GS2-IR-INSTITUTIONS",
  "GS3-ST-MATERIALS": "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
  "GS3-ST-ENERGY": "GS3-ENV-ENERGY",
  "GS3-ST-CYBERSECURITY": "GS3-SEC-CYBER-BASICS",
  "GS3-ST-QUANTUM": "GS3-ST-IT-COMM",
  "GS3-ST-AI": "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
  "GS3-ST-ENV-TECH": "GS3-ENV-CONSERVATION",
  "GS3-ST-INFRA-TRANSPORT-TECH": "GS3-ECO-SECT-INFRA",
  "GS3-ENV-MAINS": "GS3-ENV-CONSERVATION",
  "GS3-ENV-RESOURCES": "GS3-ENV-LAND-WATER",
  "GS3-SEC-CONTEMP": "GS3-SEC-TERRORISM",
  "GS1-HIS-WORLD-INDUSTRIAL": "GS1-HIS-WORLD-REV",
  "CSAT-DM": "CSAT-LR-MISC",
  "GS3-ST-BASIC-SCIENCE": "GS3-ST-GENSCI-BIO",

  // ── GS4 theory node aliases ───────────────────────────────────────────────
  // Incoming IDs from the rebuilt mains_gs4_ethics_tagged.json that don't
  // match canonical syllabusGS4.js IDs exactly. Map to nearest canonical node.
  //
  // GS4-ETH-HUM  → Human Values & Socialization (GS4-ETH-HV)
  "GS4-ETH-HUM":      "GS4-ETH-HV",
  // GS4-ETH-FOUND → Aptitude & Foundational Values for Civil Services (GS4-ETH-APT)
  "GS4-ETH-FOUND":    "GS4-ETH-APT",
  // GS4-ETH-ATTITUDE → Attitude (GS4-ETH-ATT)
  "GS4-ETH-ATTITUDE": "GS4-ETH-ATT",
  // GS4-ETH-CONFLICT → Ethics in Governance (contains ethical dilemmas/conflicts)
  "GS4-ETH-CONFLICT": "GS4-ETH-GOV",

  // ── GS4 case study node aliases ───────────────────────────────────────────
  // All GS4-CASE-* IDs from the new dataset map to the dedicated Case Studies node
  "GS4-CASE-HUM":      "GS4-ETH-CS",
  "GS4-CASE-FOUND":    "GS4-ETH-CS",
  "GS4-CASE-GOV":      "GS4-ETH-CS",
  "GS4-CASE-CONFLICT": "GS4-ETH-CS",
  "GS4-CASE-EI":       "GS4-ETH-CS",
  "GS4-CASE-PROB":     "GS4-ETH-CS",
};
