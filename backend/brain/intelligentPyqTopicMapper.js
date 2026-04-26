// backend/brain/intelligentPyqTopicMapper.js
import { UNIFIED_NODES_BY_ID } from "./unifiedSyllabusIndex.js";

function getSearchText(q) {
  return [
    q.question,
    q.questionText,
    q.stem,
    q.prompt,
    q.topic,
    q.topicName,
    q.microtheme,
    q.subject,
    q.section,
    q.id,
    q.options ? Object.values(q.options).join(" ") : ""
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// ── Parent-node split rules ───────────────────────────────────────────────────
// Applied ONLY when q.nodeId equals a known parent (the pre-alias raw value).
// Uses broader keyword sets than RULES; safe because they are gated on the
// specific parent nodeId so they cannot fire for other subjects.

const GEO_IND_PARENT_SPLITS = [
  // ── India geography nodes ─────────────────────────────────────────────────
  { nodeId: "GS1-GEO-IND-DRAINAGE-MT01",
    keywords: ["river", "tributary", "ganga", "brahmaputra", "yamuna", "godavari",
               "krishna", "narmada", "drainage", "watershed", "dam", "reservoir",
               "lake", "wetland", "lagoon"] },
  // "lake" restored. West Africa lake has "west africa"(2pts) in PRE-REGIONAL-PLACES
  // which outscores DRAINAGE "lake"(1pt), so no false tie.
  { nodeId: "GS1-GEO-IND-CLIMATE-MT01",
    keywords: ["monsoon", "rainfall", "climate", "el nino", "la nina", "drought",
               "cyclone", "temperature", "precipitation", "western disturbance", "jet stream",
               "isotherm", "ocean temperature", "specific heat", "wind pattern"] },
  { nodeId: "GS1-GEO-IND-SOILS-VEG-MT01",
    keywords: ["soil", "black soil", "laterite", "alluvial", "vegetation", "forest",
               "mangrove", "black cotton", "soil conservation", "terracing"] },
  { nodeId: "GS1-GEO-IND-AGRI-MT01",
    keywords: ["crop", "agriculture", "rice", "wheat", "cotton", "jute", "irrigation",
               "millet", "farming", "sugarcane", "crop rotation"] },
  // "crop rotation"(2pts) ensures AGRI always beats LATLON-MT02 "rotation"(1pt)
  { nodeId: "GS1-GEO-IND-RESOURCES-MT02",
    keywords: ["coal", "mineral", "minerals", "petroleum", "natural gas", "iron ore",
               "bauxite", "manganese", "mining", "ilmenite", "rutile", "monazite",
               "rare earth", "thorium", "zircon", "sillimanite", "tungsten",
               "titanium", "aluminium", "hydroelectric", "hydro-electric",
               "power project", "power station"] },
  // "uranium" removed — it causes ties with world-country questions
  // ── India transport / economic geography ─────────────────────────────────
  { nodeId: "GS1-GEO-HEW-TRANSPORT-TRADE-MT01",
    keywords: ["national highway", "railway zone", "konkan railway",
               "international airport", "golden quadrilateral"] },
  { nodeId: "GS1-GEO-HEW-TRANSPORT-TRADE-MT02",
    keywords: ["major port", "non-major port", "shipyard", "largest port"] },
  // ── World physical geography nodes ───────────────────────────────────────
  { nodeId: "GS1-GEO-GM-EQ-VOL-MT01",
    keywords: ["seismograph", "seismic wave", "p wave", "s wave", "shadow zone",
               "richter", "epicentre"] },
  { nodeId: "GS1-GEO-GM-EQ-VOL-MT03",
    keywords: ["pyroclastic", "lava", "caldera", "volcano", "volcanic", "magma"] },
  { nodeId: "GS1-GEO-GM-INTERIOR-MT01",
    keywords: ["mantle", "asthenosphere", "lithosphere"] },
  { nodeId: "GS1-GEO-OCE-MOTIONS-MT03",
    keywords: ["tides", "tide", "ocean current", "counter-current", "gulf stream",
               "kuroshio", "upwelling", "spring tide", "neap tide"] },
  // ── Lat-lon, time, Earth motions ─────────────────────────────────────────
  { nodeId: "GS1-GEO-GEN-LATLON-MT04",
    keywords: ["time zone", "international date line", "standard time", "local time",
               "clock time"] },
  { nodeId: "GS1-GEO-GEN-LATLON-MT02",
    keywords: ["solstice", "equinox", "longest day", "shortest day",
               "rotation", "revolution", "daytime"] },
  { nodeId: "GS1-GEO-GEN-LATLON-MT01",
    keywords: ["equator", "tropic of cancer", "tropic of capricorn", "arctic circle",
               "latitude", "longitude", "meridian", "prime meridian", "antarctic circle"] },
  // "latitude"/"longitude"/"meridian" moved here from PRE-REGIONAL-PLACES-MT01
  { nodeId: "GS1-GEO-GEN-MAGNETIC-MT01",
    keywords: ["magnetic field", "geomagnetic", "magnetic axis",
               "declination", "inclination", "magnetic pole", "magnetic"] },
  { nodeId: "GS1-GEO-GEN-UNIVERSE-MT03",
    keywords: ["solar system", "mars", "saturn", "jupiter", "asteroid",
               "comet", "uranus", "neptune", "orbit"] },
  // ── World places/facts ───────────────────────────────────────────────────
  { nodeId: "GS1-GEO-PRE-REGIONAL-PLACES-MT02",
    keywords: ["strait"] },
  { nodeId: "GS1-GEO-PRE-REGIONAL-PLACES-MT01",
    keywords: ["country", "countries", "continent", "global", "andes", "amazon",
               "nile", "sahara", "congo", "atlantic", "pacific", "europe", "africa",
               "mediterranean", "which country", "world map",
               "north sea", "red sea", "border with", "share a border",
               "west africa", "east asia", "boundary between",
               "south-east asia", "siberia", "alaska", "switzerland"] },
  // "west africa"(2pts) beats DRAINAGE "lake"(1pt) for African lake questions
];

const HIS_NATIONAL_PARENT_SPLITS = [
  // Constitutional development history (separate from national movement)
  { nodeId: "GS1-HIS-MOD-CONSTDEV-MT01",
    keywords: ["act", "constitution", "1909", "1919", "1935", "morley", "montagu",
               "dyarchy", "provincial", "legislature", "reforms act"] },
  // Social reform movements
  { nodeId: "GS1-HIS-MOD-REFORM-MT01",
    keywords: ["reform", "brahmo", "arya", "aligarh", "widow", "caste", "samaj",
               "social movement", "education", "women", "untouchab"] },
  // Last phase: INA, Cabinet Mission, Independence Act (MT06)
  { nodeId: "GS1-HIS-MOD-NATIONAL-MT06",
    keywords: ["indian national army", "azad hind", "subhas", "bose", "cabinet mission", "mountbatten",
               "indian independence act", "partition of india", "radcliffe", "interim government"] },
  // Gandhian phase: NCM, CDM, QIM (MT04)
  { nodeId: "GS1-HIS-MOD-NATIONAL-MT04",
    keywords: ["gandhi", "non-cooperation", "civil disobedience", "quit india", "salt march",
               "salt law", "dandi", "satyagraha", "hartal", "champaran", "khilafat", "rowlatt"] },
  // Swadeshi / Partition of Bengal phase (MT02)
  { nodeId: "GS1-HIS-MOD-NATIONAL-MT02",
    keywords: ["swadeshi", "partition of bengal", "1905", "boycott", "extremist",
               "lal bal pal", "surat split"] },
  // Fallback: Moderates, early congress, general national movement (MT01)
  // NOTE: "congress", "freedom struggle", "independence movement", "national movement"
  // removed — all are generic preambles that appear in every phase question, causing
  // ties with phase-specific keywords like "gandhi", "quit india", "swadeshi".
  // Questions with no phase match fall back to MT01 alias (the default).
  { nodeId: "GS1-HIS-MOD-NATIONAL-MT01",
    keywords: ["moderate", "home rule", "lucknow pact"] },
];

// Score and pick the best matching split rule. Longer keyword phrases score more.
// Returns a refinement result object if a confident winner is found, else null.
function scoreParentSplits(splits, searchText, fromNodeId) {
  let bestScore = 0;
  let secondBestScore = 0;
  let bestNode = null;
  let bestKeywords = [];

  for (const rule of splits) {
    let score = 0;
    const matched = [];
    for (const kw of rule.keywords) {
      if (searchText.includes(kw)) {
        score += kw.split(" ").length;
        matched.push(kw);
      }
    }
    if (score > bestScore) {
      secondBestScore = bestScore;
      bestScore = score;
      bestNode = rule.nodeId;
      bestKeywords = matched;
    } else if (score > secondBestScore) {
      secondBestScore = score;
    }
  }

  if (bestScore >= 1 && bestNode && UNIFIED_NODES_BY_ID[bestNode] && bestScore > secondBestScore) {
    return {
      nodeId: bestNode,
      confidence: 80 + Math.min(20, bestScore * 5),
      reason: `Parent-node splitter: refined from ${fromNodeId} based on keywords.`,
      matchedKeywords: bestKeywords,
    };
  }
  return null;
}

const RULES = [
  // GEOGRAPHY
  { nodeId: "GS1-GEO-IND-CLIMATE-MT01", keywords: ["monsoon", "rainfall", "el nino", "la nina", "climate", "western disturbance", "jet stream"], weight: 2 },
  { nodeId: "GS1-GEO-IND-DRAINAGE-MT01", keywords: ["river", "tributary", "drainage", "ganga", "brahmaputra", "godavari", "krishna", "narmada"], weight: 2 },
  { nodeId: "GS1-GEO-IND-SOILS-VEG-MT01", keywords: ["soil", "black soil", "alluvial soil", "laterite", "red soil", "forest", "vegetation", "mangrove"], weight: 2 },
  { nodeId: "GS1-GEO-IND-AGRI-MT01", keywords: ["crop", "rice", "wheat", "sugarcane", "cotton", "jute", "millet", "irrigation", "cropping pattern"], weight: 2 },
  { nodeId: "GS1-GEO-IND-RESOURCES-MT02", keywords: ["coal", "petroleum", "natural gas", "minerals", "iron ore", "bauxite", "manganese", "energy resources"], weight: 2 },
  { nodeId: "GS1-GEO-IND-PHYSIO-MT01", keywords: ["island", "coast", "himalaya", "western ghats", "eastern ghats", "plateau", "desert", "physiography"], weight: 2 },
  { nodeId: "GS1-GEO-IND-POP-URBAN-MT01", keywords: ["population", "census", "literacy", "sex ratio", "density", "urbanization"], weight: 2 },

  // ENVIRONMENT
  { nodeId: "GS3-ENV-ACTS-MT01", keywords: ["wildlife protection act", "environment protection act", "forest rights act", "biodiversity act", "ngt"], weight: 2 },
  { nodeId: "GS3-ENV-CONSERVATION-MT01", keywords: ["national park", "sanctuary", "biosphere reserve", "sacred grove", "in-situ", "ex-situ"], weight: 2 },
  { nodeId: "GS3-ENV-SPECIES-MT01", keywords: ["tiger", "elephant", "rhino", "dolphin", "snow leopard", "species", "invasive", "endemic", "keystone"], weight: 2 },
  { nodeId: "GS3-ENV-INTL-MT01", keywords: ["unfccc", "paris agreement", "kyoto", "montreal", "cbd", "cop"], weight: 2 },
  { nodeId: "GS3-ENV-GLOBALWARM-MT01", keywords: ["greenhouse", "global warming", "carbon footprint", "carbon sequestration", "heat island"], weight: 2 },
  { nodeId: "GS3-ENV-AIR-MT01", keywords: ["smog", "acid rain", "ozone", "aqi", "air quality"], weight: 2 },
  { nodeId: "GS3-ENV-ECO-ENERGY-MT01", keywords: ["food chain", "food web", "trophic", "biomagnification", "ecological pyramid"], weight: 2 },
  { nodeId: "GS3-ENV-ECO-CONCEPTS-MT01", keywords: ["habitat", "niche", "ecotone", "edge effect", "climax", "tolerance"], weight: 2 },
  { nodeId: "GS3-ENV-WASTE-MT01", keywords: ["solid waste", "e-waste", "biomedical waste", "hazardous waste"], weight: 2 },

  // POLITY
  { nodeId: "GS2-POL-AMEND-MT01", keywords: ["article 368", "amendment", "basic structure"], weight: 2 },
  { nodeId: "GS2-POL-PARL-MT01", keywords: ["parliament", "lok sabha", "rajya sabha", "speaker", "money bill"], weight: 2 },
  { nodeId: "GS2-POL-EXEC-MT01", keywords: ["president", "governor", "council of ministers", "prime minister", "chief minister"], weight: 2 },
  { nodeId: "GS2-POL-JUD-MT01", keywords: ["supreme court", "high court", "judicial review", "pil", "writ"], weight: 2 },
  { nodeId: "GS2-POL-FR-MT01", keywords: ["fundamental rights", "article 14", "article 19", "article 21", "article 32"], weight: 2 },
  { nodeId: "GS2-POL-DPSP-MT01", keywords: ["dpsp", "directive principles"], weight: 2 },
  { nodeId: "GS2-POL-CSREL-MT01", keywords: ["federalism", "centre-state", "inter-state council", "finance commission"], weight: 2 },
  { nodeId: "GS2-POL-EMER-MT01", keywords: ["emergency", "article 352", "article 356", "article 360"], weight: 2 },
  { nodeId: "GS2-POL-LOCAL-MT01", keywords: ["panchayat", "municipality", "local government", "73rd", "74th"], weight: 2 },

  // ECONOMY
  { nodeId: "GS3-ECO-MONETARY-POLICY-MT01", keywords: ["inflation", "cpi", "wpi", "monetary policy", "repo", "reverse repo"], weight: 2 },
  { nodeId: "GS3-ECO-BANKING-MT01", keywords: ["rbi", "banking", "npa", "capital adequacy", "bank rate"], weight: 2 },
  { nodeId: "GS3-ECO-PRE-BUDGET-MT01", keywords: ["budget", "fiscal deficit", "revenue deficit", "primary deficit"], weight: 2 },
  { nodeId: "GS3-ECO-TAXATION-MT01", keywords: ["tax", "gst", "direct tax", "indirect tax"], weight: 2 },
  { nodeId: "GS3-ECO-INCLUSIVE-GROWTH-MT01", keywords: ["inclusive growth", "poverty", "unemployment", "inequality"], weight: 2 },
  { nodeId: "GS3-ECO-AGR-CORE-MT01", keywords: ["agriculture", "msp", "subsidy", "procurement", "irrigation"], weight: 2 },
  { nodeId: "GS3-ECO-SECT-INDLAB-MT01", keywords: ["industry", "manufacturing", "msme", "labour"], weight: 2 },
  { nodeId: "GS3-ECO-FOREIGN-TRADE-IO-MT01", keywords: ["foreign trade", "wto", "balance of payments", "exchange rate"], weight: 2 },
  { nodeId: "GS3-ECO-PRE-FIN-MARKETS-MT01", keywords: ["financial market", "stock exchange", "sebi", "bond", "money market"], weight: 2 },

  // SCIENCE & TECH
  { nodeId: "GS3-ST-SPACE-MT01", keywords: ["space", "satellite", "launch vehicle", "pslv", "gslv", "isro"], weight: 2 },
  { nodeId: "GS3-ST-BIOTECH-MT01", keywords: ["biotechnology", "dna", "genome", "vaccine", "gene editing"], weight: 2 },
  { nodeId: "GS3-ST-HEALTH-DISEASES-MT01", keywords: ["disease", "virus", "bacteria", "health", "vaccine"], weight: 2 },
  { nodeId: "GS3-ST-DEFENCE-MT01", keywords: ["missile", "defence", "radar", "drone"], weight: 2 },
  { nodeId: "GS3-ST-ICT-MT01", keywords: ["computer", "internet", "cyber", "digital", "ai", "blockchain"], weight: 2 },
  { nodeId: "GS3-ST-GENSCI-PHY-MT01", keywords: ["physics", "light", "sound", "electricity", "magnetism"], weight: 2 },
  { nodeId: "GS3-ST-GENSCI-CHEM-MT01", keywords: ["chemistry", "acid", "base", "metal", "alloy", "polymer"], weight: 2 },
  { nodeId: "GS3-ST-GENSCI-BIO-MT01", keywords: ["biology", "cell", "tissue", "organ", "blood", "vitamin"], weight: 2 },

  // HISTORY
  { nodeId: "GS1-HIS-ANC-BUD-MT01", keywords: ["buddhism", "buddha", "sangha", "tripitaka"], weight: 2 },
  { nodeId: "GS1-HIS-ANC-JAIN-MT01", keywords: ["jainism", "mahavira"], weight: 2 },
  { nodeId: "GS1-HIS-ANC-IVC-MT01", keywords: ["indus", "harappan", "mohenjo-daro"], weight: 2 },
  { nodeId: "GS1-HIS-ANC-VEDIC-RIG-MT01", keywords: ["vedic", "rigveda", "later vedic"], weight: 2 },
  { nodeId: "GS1-HIS-ANC-MAURYA-MT01", keywords: ["maurya", "ashoka", "kautilya"], weight: 2 },
  { nodeId: "GS1-HIS-ANC-GUPTA-MT01", keywords: ["gupta"], weight: 2 },
  { nodeId: "GS1-HIS-MED-DELHI-MT01", keywords: ["delhi sultanate"], weight: 2 },
  { nodeId: "GS1-HIS-MED-MUGHAL-MT01", keywords: ["mughal", "akbar", "mansabdari"], weight: 2 },
  { nodeId: "GS1-HIS-MED-BHAKTI-MT01", keywords: ["bhakti", "sufi"], weight: 2 },
  { nodeId: "GS1-HIS-MOD-1857-MT01", keywords: ["1857", "revolt"], weight: 2 },
  { nodeId: "GS1-HIS-MOD-NATIONAL-MT01", keywords: ["congress", "swadeshi", "non-cooperation", "civil disobedience", "quit india", "gandhi"], weight: 2 },
  { nodeId: "GS1-HIS-MOD-CONSTDEV-MT01", keywords: ["constitutional development", "act 1909", "act 1919", "act 1935"], weight: 2 },
  { nodeId: "GS1-HIS-MOD-REFORM-MT01", keywords: ["social reform", "brahmo", "aryasamaj", "aligarh"], weight: 2 },

  // IR
  { nodeId: "GS2-IR-INSTITUTIONS-MT04", keywords: ["un", "imf", "world bank", "wto", "who"], weight: 2 },
  { nodeId: "GS2-IR-BILATERAL-MT01", keywords: ["india-china", "india-us", "india-russia", "india-africa", "asean", "neighbourhood"], weight: 2 },
  { nodeId: "GS2-IR-GROUPINGS-MT01", keywords: ["indo-pacific", "quad", "brics", "sco", "g20"], weight: 2 }
];

export function refinePyqNodeId(q) {
  const originalNodeId = q.syllabusNodeId || q.nodeId || "";

  if (!originalNodeId) {
    return {
      nodeId: originalNodeId,
      confidence: 0,
      reason: "No starting nodeId provided.",
      matchedKeywords: [],
    };
  }

  const searchText = getSearchText(q);
  const rawNodeId = q.nodeId || ""; // original pre-alias nodeId preserved in normalized record

  // ── Parent-node splitters (run before general isBroad logic) ─────────────
  // Only fires when the source question had a known broad parent nodeId.
  if (rawNodeId === "GS1-GEO-IND") {
    const result = scoreParentSplits(GEO_IND_PARENT_SPLITS, searchText, rawNodeId);
    if (result) return result;
  }

  if (rawNodeId === "GS1-HIS-MOD-NATIONAL") {
    const result = scoreParentSplits(HIS_NATIONAL_PARENT_SPLITS, searchText, rawNodeId);
    if (result) return result;
  }

  // ── General broad-node refinement ─────────────────────────────────────────
  const isBroad = originalNodeId.endsWith("MT01") || originalNodeId.includes("GENSCI") || originalNodeId.startsWith("ENV_");

  if (!isBroad) {
    return {
      nodeId: originalNodeId,
      confidence: 100,
      reason: "Node is already specific enough.",
      matchedKeywords: [],
    };
  }
  
  let bestScore = 0;
  let secondBestScore = 0;
  let bestNode = null;
  let bestKeywords = [];

  for (const rule of RULES) {
    // Only apply rule if it is in the same major subject area (e.g. GS1-GEO matches GS1-GEO)
    // Or if the original node is very generic
    const origPrefix = originalNodeId.split("-").slice(0, 2).join("-"); // e.g. GS1-GEO
    const rulePrefix = rule.nodeId.split("-").slice(0, 2).join("-");
    
    // We only refine within the same subject, to avoid Geography mapping to Environment accidentally, etc.
    if (origPrefix !== rulePrefix && !originalNodeId.startsWith("ENV_") && !originalNodeId.includes("UNKNOWN")) {
      continue;
    }

    let score = 0;
    const matched = [];

    for (const keyword of rule.keywords) {
      if (searchText.includes(keyword)) {
        // give slightly more weight to longer phrases
        const weight = rule.weight + (keyword.split(" ").length - 1) * 0.5;
        score += weight;
        matched.push(keyword);
      }
    }

    if (score > bestScore) {
      secondBestScore = bestScore;
      bestScore = score;
      bestNode = rule.nodeId;
      bestKeywords = matched;
    } else if (score > secondBestScore) {
      secondBestScore = score;
    }
  }

  if (bestScore >= 2 && bestNode && UNIFIED_NODES_BY_ID[bestNode] && bestScore > secondBestScore) {
    return {
      nodeId: bestNode,
      confidence: 80 + Math.min(20, bestScore * 5),
      reason: `Intelligently refined from ${originalNodeId} based on keywords.`,
      matchedKeywords: bestKeywords
    };
  }

  return {
    nodeId: originalNodeId,
    confidence: 0,
    reason: "No confident refinement found.",
    matchedKeywords: []
  };
}
