#!/usr/bin/env node
/**
 * mergeGs1PdfThemeLayer.js
 *
 * Purpose:
 * Merge GS1 Mains tagged JSON files with a user-facing PDF theme/sub-theme layer.
 *
 * Inputs expected in the same folder (or pass via CLI):
 *   - mains_gs1_history_tagged.json
 *   - mains_gs1_art_culture_tagged.json
 *   - mains_gs1_society_tagged.json
 *   - mains_gs1_geography_tagged.json
 *   - GS1_PYQ_Theme_Layer.json
 *
 * Outputs:
 *   - gs1_pyq_merged_with_pdf_theme.json
 *   - gs1_pyq_merge_audit.json
 *   - gs1_pyq_unmatched_questions.json
 *
 * Usage:
 *   node mergeGs1PdfThemeLayer.js
 *   node mergeGs1PdfThemeLayer.js --dir ./data
 */

import fs from "fs";
import path from "path";
import process from "process";

const argv = process.argv.slice(2);
const dirIdx = argv.indexOf("--dir");
const baseDir = dirIdx >= 0 && argv[dirIdx + 1] ? path.resolve(argv[dirIdx + 1]) : process.cwd();

const FILES = {
  history: "mains_gs1_history_tagged.json",
  art: "mains_gs1_art_culture_tagged.json",
  society: "mains_gs1_society_tagged.json",
  geography: "mains_gs1_geography_tagged.json",
  themeLayer: "GS1_PYQ_Theme_Layer.json",
};

function readJson(fileName) {
  const full = path.join(baseDir, fileName);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing file: ${full}`);
  }
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

function writeJson(fileName, data) {
  fs.writeFileSync(path.join(baseDir, fileName), JSON.stringify(data, null, 2), "utf8");
}

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[–—]/g, "-")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, arr) {
  const n = normalize(text);
  return arr.some((x) => n.includes(normalize(x)));
}

function extractDirective(question = "") {
  const q = normalize(question);
  const directives = [
    "discuss", "explain", "critically examine", "critically evaluate",
    "evaluate", "analyse", "analyze", "comment", "elucidate",
    "assess", "justify", "enumerate", "trace", "differentiate",
    "distinguish", "highlight", "account for", "mention"
  ];
  for (const d of directives) {
    if (q.startsWith(d) || q.includes(` ${d} `)) return d;
  }
  return "";
}

/**
 * -------------------------
 * Subject-wise PDF mapping rules
 * -------------------------
 * Each rule returns:
 *   { pdfTheme, pdfSubTheme, matchedBy }
 */
function mapHistory(q, section = "") {
  const text = `${q} ${section}`;

  // Theme 2: Freedom Struggle
  if (includesAny(text, ["quit india", "non cooperation", "civil disobedience", "gandhian", "gandhi during"])) {
    return { pdfTheme: "Freedom Struggle", pdfSubTheme: "Gandhian Phase", matchedBy: "keyword" };
  }
  if (includesAny(text, ["moderates", "moderate phase"])) {
    return { pdfTheme: "Freedom Struggle", pdfSubTheme: "Moderate Phase", matchedBy: "keyword" };
  }
  if (includesAny(text, ["naval mutiny", "transfer of power", "1940s", "last nail in the coffin"])) {
    return { pdfTheme: "Freedom Struggle", pdfSubTheme: "Final Phase", matchedBy: "keyword" };
  }
  if (includesAny(text, ["women in the freedom struggle", "role of social groups"])) {
    return { pdfTheme: "Freedom Struggle", pdfSubTheme: "Role of Social Groups", matchedBy: "keyword" };
  }

  // Theme 5: World History
  if (includesAny(text, ["world war", "democratic state system", "great economic depression"])) {
    return { pdfTheme: "World History", pdfSubTheme: "World Wars", matchedBy: "keyword" };
  }
  if (includesAny(text, ["industrial revolution", "railways in different countries", "latecomer industrial revolution"])) {
    return { pdfTheme: "World History", pdfSubTheme: "Industrial Revolution", matchedBy: "keyword" };
  }
  if (includesAny(text, ["decolonization", "malay peninsula", "suez crisis", "west africa"])) {
    return { pdfTheme: "World History", pdfSubTheme: "Decolonization", matchedBy: "keyword" };
  }
  if (includesAny(text, ["lenin", "new economic policy", "socialism", "communism"])) {
    return { pdfTheme: "World History", pdfSubTheme: "Socialism and Communism", matchedBy: "keyword" };
  }
  if (includesAny(text, ["american revolution", "french revolution"])) {
    return { pdfTheme: "World History", pdfSubTheme: "American and French Revolution", matchedBy: "keyword" };
  }

  // Theme 4: Post Independence
  if (includesAny(text, ["princely states", "integration process", "consolidation process"])) {
    return { pdfTheme: "Post Independence", pdfSubTheme: "Formation of States", matchedBy: "keyword" };
  }
  if (includesAny(text, ["bhoodan", "gramdan"])) {
    return { pdfTheme: "Post Independence", pdfSubTheme: "Movements", matchedBy: "keyword" };
  }
  if (includesAny(text, ["jai jawan jai kisan", "tashkent", "bangladesh"])) {
    return { pdfTheme: "Post Independence", pdfSubTheme: "Political History", matchedBy: "keyword" };
  }

  // Theme 3: Art & Culture items that may appear in history file
  if (includesAny(text, ["harappan architecture", "temple sculptures", "lion and bull", "rock-cut", "gandhara", "stupa-art", "mesolithic rock", "architecture", "sculpture"])) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Architecture and Sculpture", matchedBy: "keyword" };
  }
  if (includesAny(text, ["chola", "pallava", "gupta period", "pala period", "krishnadeva raya", "chandella"])) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Dynastic Art", matchedBy: "keyword" };
  }
  if (includesAny(text, ["bhakti", "sufi", "chaitanya"])) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Bhakti-Sufi", matchedBy: "keyword" };
  }
  if (includesAny(text, ["persian literary", "sangam literature", "literature"])) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Literature", matchedBy: "keyword" };
  }
  if (includesAny(text, ["tandava dance", "dance"])) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Dance", matchedBy: "keyword" };
  }

  // Theme 1: Modern History
  if (includesAny(text, ["gandhi", "tagore", "dalhousie", "azad", "ambedkar", "subhash", "phule", "foreigners made india their homeland"])) {
    return { pdfTheme: "Modern History", pdfSubTheme: "Personalities", matchedBy: "keyword" };
  }
  if (includesAny(text, ["british policies", "famines", "indentured labour", "government of india act", "economic policies of the british", "colonial india crippled the rural economy", "industrial revolution in england responsible"])) {
    return { pdfTheme: "Modern History", pdfSubTheme: "British Policies", matchedBy: "keyword" };
  }
  if (includesAny(text, ["brahmo samaj", "young bengal", "indian renaissance", "socio-religious reform", "women questions arose in modern india"])) {
    return { pdfTheme: "Modern History", pdfSubTheme: "Socio Religious Reform", matchedBy: "keyword" };
  }
  if (includesAny(text, ["tribals", "1857 uprising was the culmination", "tribal response", "peasant", "local rebellions"])) {
    return { pdfTheme: "Modern History", pdfSubTheme: "Peasant and Tribal Rebellions", matchedBy: "keyword" };
  }
  if (includesAny(text, ["fragmented polity", "panipat", "reorganization of states and territories", "eve of british conquest"])) {
    return { pdfTheme: "Modern History", pdfSubTheme: "Eve of British Conquest", matchedBy: "keyword" };
  }
  if (includesAny(text, ["ancient india", "sultanate period technological", "chinese and arab travellers", "taxila"])) {
    return { pdfTheme: "Miscellaneous", pdfSubTheme: "N/A", matchedBy: "keyword" };
  }

  // Section fallback
  const s = normalize(section);
  if (s.includes("freedom")) return { pdfTheme: "Freedom Struggle", pdfSubTheme: "Generic", matchedBy: "section" };
  if (s.includes("world war")) return { pdfTheme: "World History", pdfSubTheme: "World Wars", matchedBy: "section" };
  if (s.includes("industrial revolution")) return { pdfTheme: "World History", pdfSubTheme: "Industrial Revolution", matchedBy: "section" };
  if (s.includes("reform")) return { pdfTheme: "Modern History", pdfSubTheme: "Socio Religious Reform", matchedBy: "section" };
  if (s.includes("personalit")) return { pdfTheme: "Modern History", pdfSubTheme: "Personalities", matchedBy: "section" };

  return null;
}

function mapArtCulture(q, section = "") {
  const text = `${q} ${section}`;

  if (includesAny(text, ["harappan architecture", "temple sculptures", "lion and bull", "rock-cut", "gandhara", "stupa-art", "mesolithic rock", "architecture", "sculpture"])) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Architecture and Sculpture", matchedBy: "keyword" };
  }
  if (includesAny(text, ["chola", "pallava", "gupta period", "pala period", "krishnadeva raya", "chandella", "gupta numismatic"])) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Dynastic Art", matchedBy: "keyword" };
  }
  if (includesAny(text, ["bhakti", "sufi", "chaitanya"])) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Bhakti-Sufi", matchedBy: "keyword" };
  }
  if (includesAny(text, ["persian literary", "sangam literature", "art and literature of south india", "literature"])) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Literature", matchedBy: "keyword" };
  }
  if (includesAny(text, ["tandava dance", "dance forms", "dance"])) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Dance", matchedBy: "keyword" };
  }
  if (includesAny(text, ["safeguarding indian art heritage", "culture and traditions have been preserved", "contribution to indian heritage and culture"])) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Miscellaneous", matchedBy: "keyword" };
  }
  if (includesAny(text, ["rig vedic", "vedic society and religion"])) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Society", matchedBy: "keyword" };
  }

  const s = normalize(section);
  if (s.includes("architecture") || s.includes("sculpture")) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Architecture and Sculpture", matchedBy: "section" };
  }
  if (s.includes("buddhism and jainism")) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Dynastic Art", matchedBy: "section" };
  }
  if (s.includes("literature") || s.includes("bhakti") || s.includes("sufi")) {
    return { pdfTheme: "Art & Culture", pdfSubTheme: "Bhakti-Sufi", matchedBy: "section" };
  }
  return null;
}

function mapSociety(q, section = "") {
  const text = `${q} ${section}`;

  if (includesAny(text, ["diversity", "cultural pockets of small india", "tribal development in india centre around", "correlation between india cultural diversities"])) {
    return { pdfTheme: "Indian Society", pdfSubTheme: "Diversity", matchedBy: "keyword" };
  }
  if (includesAny(text, ["caste", "dalit identity"])) {
    return { pdfTheme: "Indian Society", pdfSubTheme: "Caste", matchedBy: "keyword" };
  }
  if (includesAny(text, ["marriage", "family", "joint family", "child cuddling", "intercaste marriages", "interreligious marriages"])) {
    return { pdfTheme: "Indian Society", pdfSubTheme: "Family and Marriage", matchedBy: "keyword" };
  }
  if (includesAny(text, ["tribal", "scheduled tribes", "tribe"])) {
    return { pdfTheme: "Indian Society", pdfSubTheme: "Tribe", matchedBy: "keyword" };
  }
  if (includesAny(text, ["women", "gender equality", "gender equity", "gig economy", "patriarchy", "suicide among young women", "working woman", "feminization of agriculture", "women movement"])) {
    return { pdfTheme: "Social Issues", pdfSubTheme: "Women", matchedBy: "keyword" };
  }
  if (includesAny(text, ["urban", "smart city", "cities", "migrants", "megacities", "work from home", "it industries", "mass transport", "tier 2 cities"])) {
    return { pdfTheme: "Social Issues", pdfSubTheme: "Urbanisation", matchedBy: "keyword" };
  }
  if (includesAny(text, ["population", "demographic winter", "sex ratio"])) {
    return { pdfTheme: "Social Issues", pdfSubTheme: "Population", matchedBy: "keyword" };
  }
  if (includesAny(text, ["poverty", "human development", "class inequalities", "affirmative action", "socio-economic issues of development", "social justice", "underprivileged"])) {
    return { pdfTheme: "Social Empowerment", pdfSubTheme: "Social Empowerment", matchedBy: "keyword" };
  }
  if (includesAny(text, ["globalization", "globalisation", "consumer culture"])) {
    if (includesAny(text, ["women", "unmarried women"])) {
      return { pdfTheme: "Globalisation", pdfSubTheme: "Women", matchedBy: "keyword" };
    }
    if (includesAny(text, ["technology", "cryptocurrency", "new technology"])) {
      return { pdfTheme: "Globalisation", pdfSubTheme: "Technology", matchedBy: "keyword" };
    }
    if (includesAny(text, ["ethnic", "communalism"])) {
      return { pdfTheme: "Globalisation", pdfSubTheme: "Ethnicity", matchedBy: "keyword" };
    }
    return { pdfTheme: "Globalisation", pdfSubTheme: "Culture", matchedBy: "keyword" };
  }
  if (includesAny(text, ["secularism", "tolerance", "pluralism", "obscurantism"])) {
    return { pdfTheme: "Social Empowerment", pdfSubTheme: "Secularism", matchedBy: "keyword" };
  }
  if (includesAny(text, ["regionalism", "regional disparity", "separate state", "linguistic states"])) {
    return { pdfTheme: "Social Empowerment", pdfSubTheme: "Regionalism", matchedBy: "keyword" };
  }
  if (includesAny(text, ["communalism", "religiosity", "religiousness"])) {
    return { pdfTheme: "Social Empowerment", pdfSubTheme: "Communalism", matchedBy: "keyword" };
  }

  const s = normalize(section);
  if (s.includes("women")) return { pdfTheme: "Social Issues", pdfSubTheme: "Women", matchedBy: "section" };
  if (s.includes("urban")) return { pdfTheme: "Social Issues", pdfSubTheme: "Urbanisation", matchedBy: "section" };
  if (s.includes("population")) return { pdfTheme: "Social Issues", pdfSubTheme: "Population", matchedBy: "section" };
  if (s.includes("poverty")) return { pdfTheme: "Social Empowerment", pdfSubTheme: "Social Empowerment", matchedBy: "section" };
  if (s.includes("caste")) return { pdfTheme: "Indian Society", pdfSubTheme: "Caste", matchedBy: "section" };
  if (s.includes("tribal")) return { pdfTheme: "Indian Society", pdfSubTheme: "Tribe", matchedBy: "section" };

  return null;
}

function mapGeography(q, section = "") {
  const text = `${q} ${section}`;

  // Physical Geography
  if (includesAny(text, ["fjords", "primary rocks", "fold mountain", "geomorphology", "desertification", "landforms"])) {
    return { pdfTheme: "Physical Geography", pdfSubTheme: "Landforms", matchedBy: "keyword" };
  }
  if (includesAny(text, ["major mountain ranges", "mountain ranges of the world"])) {
    return { pdfTheme: "Physical Geography", pdfSubTheme: "Geomorphology", matchedBy: "keyword" };
  }
  if (includesAny(text, ["tectonic movements", "continents and ocean basins", "circum-pacific", "continental drift", "indonesian and philippines archipelagos"])) {
    return { pdfTheme: "Physical Geography", pdfSubTheme: "Distribution of Oceans and Continents", matchedBy: "keyword" };
  }
  if (includesAny(text, ["mangroves"])) {
    return { pdfTheme: "Physical Geography", pdfSubTheme: "Natural Vegetation", matchedBy: "keyword" };
  }

  // Indian Geography
  if (includesAny(text, ["purvaiya", "monsoon", "colour-coded weather warnings", "imd"])) {
    return { pdfTheme: "Indian Geography", pdfSubTheme: "Climate and Weather", matchedBy: "keyword" };
  }
  if (includesAny(text, ["himalayan glaciers", "himalayas", "western ghats", "ecological carrying capacity"])) {
    return { pdfTheme: "Indian Geography", pdfSubTheme: "Himalayas", matchedBy: "keyword" };
  }
  if (includesAny(text, ["interlinking of rivers", "drainage system", "deltas by rivers"])) {
    return { pdfTheme: "Indian Geography", pdfSubTheme: "Drainage System", matchedBy: "keyword" };
  }
  if (includesAny(text, ["mumbai delhi and kolkata", "air pollution", "megacities"])) {
    return { pdfTheme: "Indian Geography", pdfSubTheme: "Urbanisation", matchedBy: "keyword" };
  }

  // Resources
  if (includesAny(text, ["groundwater", "freshwater", "water stress", "water bodies", "water harvesting", "blue revolution", "flood", "micro-watershed", "water scarcity", "inland water transport", "water resources"])) {
    return { pdfTheme: "Resources", pdfSubTheme: "Water", matchedBy: "keyword" };
  }
  if (includesAny(text, ["solar energy", "wind energy", "mineral oil", "atomic energy", "shale oil", "off shore oil", "energy"])) {
    return { pdfTheme: "Resources", pdfSubTheme: "Energy Resource", matchedBy: "keyword" };
  }
  if (includesAny(text, ["mining", "coal mining", "deccan trap", "mineral"])) {
    return { pdfTheme: "Resources", pdfSubTheme: "Minerals", matchedBy: "keyword" };
  }
  if (includesAny(text, ["vegetation", "forest resources", "wildlife sanctuaries", "rain forest"])) {
    return { pdfTheme: "Resources", pdfSubTheme: "Vegetation", matchedBy: "keyword" };
  }

  // Climatology
  if (includesAny(text, ["climate change", "food security in tropical countries"])) {
    return { pdfTheme: "Climatology", pdfSubTheme: "Climate Change", matchedBy: "keyword" };
  }
  if (includesAny(text, ["troposphere", "layers of atmosphere"])) {
    return { pdfTheme: "Climatology", pdfSubTheme: "Atmospheric Layers", matchedBy: "keyword" };
  }
  if (includesAny(text, ["air mass"])) {
    return { pdfTheme: "Climatology", pdfSubTheme: "Air Mass", matchedBy: "keyword" };
  }
  if (includesAny(text, ["el nino", "heat islands", "temperature inversion", "hot deserts"])) {
    return { pdfTheme: "Climatology", pdfSubTheme: "El Nino / Weather Phenomena", matchedBy: "keyword" };
  }

  // Oceanography
  if (includesAny(text, ["sea surface temperature", "ocean currents", "water masses"])) {
    return { pdfTheme: "Oceanography", pdfSubTheme: "Ocean Currents", matchedBy: "keyword" };
  }
  if (includesAny(text, ["dead zones"])) {
    return { pdfTheme: "Oceanography", pdfSubTheme: "Marine Ecosystems", matchedBy: "keyword" };
  }
  if (includesAny(text, ["salinity"])) {
    return { pdfTheme: "Oceanography", pdfSubTheme: "Salinity", matchedBy: "keyword" };
  }
  if (includesAny(text, ["resources of the oceans", "ocean resources"])) {
    return { pdfTheme: "Oceanography", pdfSubTheme: "Marine Resources", matchedBy: "keyword" };
  }

  // Industries
  if (includesAny(text, ["iron and steel", "food processing industries", "manufacturing", "industrial corridors", "petroleum refineries", "sugar mills", "cotton textile"])) {
    return { pdfTheme: "Industries", pdfSubTheme: "Industrial Location", matchedBy: "keyword" };
  }

  // Geophysical phenomena
  if (includesAny(text, ["island nations", "sea level rise"])) {
    return { pdfTheme: "Geophysical Phenomena", pdfSubTheme: "Global Warming", matchedBy: "keyword" };
  }
  if (includesAny(text, ["tsunami"])) {
    return { pdfTheme: "Geophysical Phenomena", pdfSubTheme: "Tsunami", matchedBy: "keyword" };
  }
  if (includesAny(text, ["twister", "cyclones", "tropical cyclones"])) {
    return { pdfTheme: "Geophysical Phenomena", pdfSubTheme: "Cyclones", matchedBy: "keyword" };
  }
  if (includesAny(text, ["aurora", "cloudburst"])) {
    return { pdfTheme: "Geophysical Phenomena", pdfSubTheme: "Miscellaneous", matchedBy: "keyword" };
  }
  if (includesAny(text, ["landslides"])) {
    return { pdfTheme: "Geophysical Phenomena", pdfSubTheme: "Landslides", matchedBy: "keyword" };
  }
  if (includesAny(text, ["volcanic eruptions", "volcano"])) {
    return { pdfTheme: "Geophysical Phenomena", pdfSubTheme: "Volcanoes", matchedBy: "keyword" };
  }
  if (includesAny(text, ["arctic ice", "antarctic", "cryosphere", "coral"])) {
    return { pdfTheme: "Geophysical Phenomena", pdfSubTheme: "Effects of Global Warming", matchedBy: "keyword" };
  }
  if (includesAny(text, ["urban floods", "flooding of million cities", "major cities of india are becoming vulnerable to flood"])) {
    return { pdfTheme: "Geophysical Phenomena", pdfSubTheme: "Urban Floods", matchedBy: "keyword" };
  }

  // Geopolitics
  if (includesAny(text, ["straits and isthmus"])) {
    return { pdfTheme: "Geopolitics", pdfSubTheme: "Landforms", matchedBy: "keyword" };
  }
  if (includesAny(text, ["arctic"])) {
    return { pdfTheme: "Geopolitics", pdfSubTheme: "Arctic", matchedBy: "keyword" };
  }
  if (includesAny(text, ["south china sea"])) {
    return { pdfTheme: "Geopolitics", pdfSubTheme: "South China Sea", matchedBy: "keyword" };
  }
  if (includesAny(text, ["indus water treaty"])) {
    return { pdfTheme: "Geopolitics", pdfSubTheme: "Indus Water Treaty", matchedBy: "keyword" };
  }
  if (includesAny(text, ["africa"])) {
    return { pdfTheme: "Geopolitics", pdfSubTheme: "Africa", matchedBy: "keyword" };
  }

  // Miscellaneous
  if (includesAny(text, ["artificial intelligence", "drones", "gis", "rs techniques", "sub-continent", "mountain ecosystem", "irnss", "juno mission", "new states"])) {
    return { pdfTheme: "Miscellaneous", pdfSubTheme: "N/A", matchedBy: "keyword" };
  }

  const s = normalize(section);
  if (s.includes("climatic") || s.includes("atmospheric")) return { pdfTheme: "Climatology", pdfSubTheme: "Weather Phenomena", matchedBy: "section" };
  if (s.includes("industrial location")) return { pdfTheme: "Industries", pdfSubTheme: "Industrial Location", matchedBy: "section" };
  if (s.includes("agricultural and forest resources") || s.includes("mineral and energy resources")) return { pdfTheme: "Resources", pdfSubTheme: "Generic", matchedBy: "section" };
  if (s.includes("geological phenomena")) return { pdfTheme: "Geophysical Phenomena", pdfSubTheme: "Generic", matchedBy: "section" };
  if (s.includes("oceanic")) return { pdfTheme: "Oceanography", pdfSubTheme: "Generic", matchedBy: "section" };

  return null;
}

function mapQuestion(subject, question, section) {
  switch (normalize(subject)) {
    case "history":
      return mapHistory(question, section);
    case "art and culture":
      return mapArtCulture(question, section);
    case "society":
      return mapSociety(question, section);
    case "geography":
      return mapGeography(question, section);
    default:
      return null;
  }
}

function loadTaggedQuestions() {
  const history = readJson(FILES.history);
  const art = readJson(FILES.art);
  const society = readJson(FILES.society);
  const geography = readJson(FILES.geography);

  return [
    ...(history.questions || []),
    ...(art.questions || []),
    ...(society.questions || []),
    ...(geography.questions || []),
  ];
}

function main() {
  const themeLayer = readJson(FILES.themeLayer);
  const questions = loadTaggedQuestions();

  const merged = [];
  const unmatched = [];
  const stats = {
    total: questions.length,
    matched: 0,
    unmatched: 0,
    bySubject: {},
    byTheme: {},
    byMatchedBy: {},
  };

  for (const q of questions) {
    const subject = q.subject || "";
    const mapped = mapQuestion(subject, q.question || "", q.section || "");

    const row = {
      ...q,
      directive: q.directive || extractDirective(q.question || ""),
      pdfTheme: mapped?.pdfTheme || null,
      pdfSubTheme: mapped?.pdfSubTheme || null,
      pdfMatchedBy: mapped?.matchedBy || null,
      mergeStatus: mapped ? "matched" : "unmatched",
    };

    merged.push(row);

    stats.bySubject[subject] = stats.bySubject[subject] || { total: 0, matched: 0, unmatched: 0 };
    stats.bySubject[subject].total += 1;

    if (mapped) {
      stats.matched += 1;
      stats.bySubject[subject].matched += 1;
      stats.byTheme[mapped.pdfTheme] = (stats.byTheme[mapped.pdfTheme] || 0) + 1;
      stats.byMatchedBy[mapped.matchedBy] = (stats.byMatchedBy[mapped.matchedBy] || 0) + 1;
    } else {
      stats.unmatched += 1;
      stats.bySubject[subject].unmatched += 1;
      unmatched.push({
        id: q.id,
        year: q.year,
        subject: q.subject,
        section: q.section,
        question: q.question,
        syllabusNodeId: q.syllabusNodeId || null,
      });
    }
  }

  // Theme coverage audit against provided theme layer
  const themeCoverage = {};
  if (themeLayer?.GS1) {
    for (const [subject, themes] of Object.entries(themeLayer.GS1)) {
      themeCoverage[subject] = {};
      for (const [theme, subthemes] of Object.entries(themes)) {
        if (subthemes && typeof subthemes === "object" && !Array.isArray(subthemes)) {
          themeCoverage[subject][theme] = {};
          for (const subTheme of Object.keys(subthemes)) {
            const count = merged.filter((x) => x.subject === subject || (subject === "Society" && x.subject === "Society"))
              .filter((x) => x.pdfTheme === theme && x.pdfSubTheme === subTheme).length;
            themeCoverage[subject][theme][subTheme] = count;
          }
        }
      }
    }
  }

  const audit = {
    generatedAt: new Date().toISOString(),
    inputDirectory: baseDir,
    stats,
    themeCoverage,
    notes: [
      "This script is rule-based, built to merge GS1 Mains tagged JSON with a PDF-derived theme/sub-theme layer.",
      "Always inspect gs1_pyq_unmatched_questions.json and add/adjust rules before treating the output as fully canonical.",
      "Recommended next step: use unmatched questions to refine rules or build exact text matching from a structured PDF question map."
    ]
  };

  writeJson("gs1_pyq_merged_with_pdf_theme.json", merged);
  writeJson("gs1_pyq_merge_audit.json", audit);
  writeJson("gs1_pyq_unmatched_questions.json", unmatched);

  console.log("✅ Merge complete");
  console.log(`Base directory: ${baseDir}`);
  console.log(`Total: ${stats.total}`);
  console.log(`Matched: ${stats.matched}`);
  console.log(`Unmatched: ${stats.unmatched}`);
}

main();
