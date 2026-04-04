/**
 * detectInstitutionalSubjectBucket.js
 *
 * Classifies UPSC Prelims question text into broad subject buckets
 * using weighted keyword heuristics.
 *
 * No external APIs. No embeddings. No syllabus graph coupling.
 * This is broad subject classification only — NOT exact topic mapping.
 *
 * Returns:
 *   { subjectBucket, subjectConfidence, mappingStatus }
 *
 * mappingStatus values:
 *   "subject_only" — bucket detected above confidence threshold
 *   "unmapped"     — no question text OR confidence too low
 */

// ─── Bucket keyword definitions ────────────────────────────────────────────────
// High-weight: strongly characteristic phrases/terms (weight: 3)
// Medium-weight: general supporting terms (weight: 1)

const BUCKETS = {
    Polity: {
        high: [
            "constitution", "fundamental right", "directive principle", "parliament",
            "judiciary", "preamble", "amendment", "governor", "president",
            "impeachment", "lok sabha", "rajya sabha", "supreme court", "high court",
            "election commission", "attorney general", "article", "schedule",
            "federalism", "writ", "citizenship", "panchayat", "habeas corpus",
            "certiorari", "mandamus", "prohibition", "quo warranto", "cag",
            "comptroller", "auditor general", "dpsp", "speaker", "legislative assembly",
            "legislative council", "gram sabha", "73rd amendment", "74th amendment",
            "anti defection", "whip", "protem speaker", "zero hour", "question hour",
            "money bill", "constitutional body", "statutory body",
        ],
        medium: [
            "vote", "bill", "law", "act", "ordinance", "court", "judge", "tribunal",
            "rights", "duty", "minister", "cabinet", "chief minister", "governance",
            "policy", "state", "central", "union", "federal", "local body",
            "municipal", "election", "voter", "franchise", "evm", "vvpat",
            "public interest litigation", "pil", "suo motu",
        ],
    },

    Economy: {
        high: [
            "gdp", "gnp", "gnp", "gva", "inflation", "rbi", "reserve bank",
            "monetary policy", "fiscal policy", "sebi", "rupee", "imf", "world bank",
            "currency", "npa", "non performing asset", "current account deficit",
            "cad", "fdi", "fii", "fpi", "gst", "subsidy", "mgnrega",
            "mudra", "msme", "msp", "wholesale price index", "consumer price index",
            "repo rate", "reverse repo", "crr", "slr", "open market operation",
            "budget", "disinvestment", "privatisation", "public debt", "eci",
            "goods and services tax", "base erosion", "laffer curve",
            "phillips curve", "crowding out",
        ],
        medium: [
            "bank", "credit", "loan", "interest rate", "trade", "export", "import",
            "tax", "poverty", "unemployment", "jan dhan", "pm kisan", "pli",
            "digital payment", "upi", "insurance", "pension", "stock market",
            "bond", "debt", "economic growth", "recession", "wto", "tariff",
            "agriculture income", "industrial output", "service sector",
            "revenue deficit", "primary deficit", "fiscal deficit",
        ],
    },

    Geography: {
        high: [
            "himalaya", "plateau", "bay of bengal", "arabian sea", "strait",
            "delta", "monsoon", "alluvial soil", "black soil", "laterite",
            "iron ore", "latitude", "longitude", "ocean current", "plate tectonics",
            "earthquake", "volcano", "cyclone", "tsunami", "tidal bore",
            "rift valley", "glacier", "tributary", "watershed", "western ghats",
            "eastern ghats", "deccan plateau", "gangetic plain", "thar desert",
            "andaman", "lakshadweep", "wind pattern", "jet stream",
        ],
        medium: [
            "river", "mountain", "lake", "dam", "canal", "island", "climate",
            "rainfall", "crop", "farming", "forest", "erosion", "sediment",
            "coastal", "basin", "pass", "peak", "range", "zone", "region",
            "migration", "urban", "rural", "transport", "port", "harbour",
            "mineral", "coal", "petroleum", "natural gas",
        ],
    },

    History: {
        high: [
            "mughal", "british india", "colonial", "1857 revolt", "freedom struggle",
            "independence movement", "mahatma gandhi", "jawaharlal nehru",
            "bal gangadhar tilak", "indian national congress", "civil disobedience",
            "non cooperation movement", "khilafat", "swadeshi", "partition of india",
            "vedic age", "mauryan", "gupta empire", "delhi sultanate", "maratha",
            "east india company", "charter act", "montagu", "chelmsford",
            "rowlatt act", "jallianwala bagh", "dandi march", "quit india",
            "cabinet mission", "cripps mission", "simon commission",
        ],
        medium: [
            "ancient", "medieval", "modern india", "empire", "dynasty", "invasion",
            "treaty", "battle", "ruler", "nawab", "viceroy", "governor general",
            "reform", "nationalist", "revolution", "sufi", "bhakti movement",
            "temple", "sculpture", "inscription", "manuscript", "revolt",
            "uprising", "peasant movement", "tribal movement",
        ],
    },

    Environment: {
        high: [
            "biodiversity", "ecosystem", "iucn red list", "climate change",
            "carbon emission", "ozone layer", "cop", "wildlife protection act",
            "deforestation", "endangered species", "coral reef bleaching",
            "biosphere reserve", "tiger reserve", "wildlife sanctuary",
            "national park", "ramsar convention", "migratory bird",
            "invasive alien species", "paris agreement", "kyoto protocol",
            "unfccc", "carbon credit", "ecological sensitive zone", "esz",
            "forest rights act", "project tiger", "project elephant",
        ],
        medium: [
            "species", "flora", "fauna", "forest cover", "habitat", "conservation",
            "renewable energy", "solar energy", "wind energy", "greenhouse gas",
            "methane", "fossil fuel", "waste management", "plastic pollution",
            "recycling", "environmental clearance", "eia", "water conservation",
            "groundwater", "desertification", "land degradation", "phytoplankton",
            "wetland", "mangrove",
        ],
    },

    "Science & Tech": {
        high: [
            "satellite", "isro", "nuclear energy", "space mission", "ballistic missile",
            "orbit", "artificial intelligence", "machine learning", "quantum computing",
            "human genome", "dna sequencing", "mrna vaccine", "drdo", "barc",
            "nanotechnology", "semiconductor chip", "5g technology", "blockchain",
            "crispr", "gene editing", "stem cell therapy", "dark matter",
            "exoplanet", "chandrayaan", "mangalyaan", "gaganyaan", "aditya l1",
            "james webb telescope", "particle accelerator", "lhc",
        ],
        medium: [
            "technology", "innovation", "research", "robot", "automation",
            "cyber", "digital", "internet", "software", "hardware",
            "atom", "electron", "proton", "neutron", "radiation",
            "electromagnetic", "optical fibre", "laser", "biotechnology",
            "pharmaceutical", "clinical trial", "diagnostic", "health tech",
            "electric vehicle", "hydrogen fuel", "nuclear fusion",
        ],
    },

    "International Relations": {
        high: [
            "un security council", "unsc", "g20", "g7", "brics", "nato", "asean",
            "sco", "saarc", "nuclear test ban treaty", "npt", "ctbt", "mtcr",
            "quad", "i2u2", "indo-pacific", "belt and road initiative",
            "line of actual control", "lac", "line of control", "loc",
            "international court of justice", "icj", "icc",
            "permanent member", "veto power", "p5",
        ],
        medium: [
            "diplomacy", "bilateral", "summit", "foreign policy", "border dispute",
            "terrorism", "refugee", "who", "wto", "imf", "world bank",
            "free trade agreement", "fta", "ambassador", "embassy", "consulate",
            "treaty", "protocol", "convention", "un resolution", "peacekeeping",
            "geopolitics", "multilateral", "sanction", "extradition",
        ],
    },

    Society: {
        high: [
            "scheduled tribe", "other backward class", "obc", "scheduled caste",
            "gender equality", "women empowerment", "child marriage", "dowry prohibition",
            "malnutrition", "stunting", "nfhs", "human development index", "hdi",
            "social justice", "reservation policy", "discrimination", "untouchability",
            "dalit", "minority rights", "secularism", "composite culture",
            "protection of civil rights", "right to education",
        ],
        medium: [
            "education", "health", "welfare", "poverty", "inequality", "caste",
            "religion", "community", "ngo", "civil society", "social reform",
            "migration", "urbanisation", "slum", "housing", "sanitation",
            "nutrition", "maternal mortality", "infant mortality",
            "girl child", "national family health survey",
        ],
    },

    CSAT: {
        high: [
            "passage given below", "read the following passage", "inferring from the passage",
            "logical reasoning", "syllogism", "analogy", "series completion",
            "data sufficiency", "bar graph", "pie chart", "number series",
            "coding decoding", "blood relation", "direction sense",
            "seating arrangement", "arithmetic progression", "permutation combination",
            "data interpretation", "reading comprehension", "critical reasoning",
        ],
        medium: [
            "reading", "verbal", "numerical", "percentage", "ratio",
            "proportion", "average", "time and work", "speed distance",
            "profit loss", "simple interest", "compound interest",
            "table", "graph", "the author", "the passage states",
            "which of the following can be inferred",
        ],
    },
};

// ─── Scoring constants ─────────────────────────────────────────────────────────
const HIGH_WEIGHT    = 3;
const MEDIUM_WEIGHT  = 1;
const MIN_CONFIDENCE = 0.25;   // Below this → "General" / unmapped

// ─── Main function ─────────────────────────────────────────────────────────────

/**
 * Detect a broad subject bucket from question text.
 *
 * @param {string|null} questionText
 * @returns {{ subjectBucket: string|null, subjectConfidence: number, mappingStatus: string }}
 */
export function detectInstitutionalSubjectBucket(questionText) {
    // No question text → unmapped
    if (!questionText || typeof questionText !== "string" || questionText.trim().length < 10) {
        return { subjectBucket: null, subjectConfidence: 0, mappingStatus: "unmapped" };
    }

    const normalised = questionText.toLowerCase();
    const scores = {};

    for (const [bucket, { high, medium }] of Object.entries(BUCKETS)) {
        let score = 0;

        for (const phrase of high) {
            if (normalised.includes(phrase)) score += HIGH_WEIGHT;
        }
        for (const phrase of medium) {
            if (normalised.includes(phrase)) score += MEDIUM_WEIGHT;
        }

        scores[bucket] = score;
    }

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

    if (totalScore === 0) {
        // No keywords matched at all
        return { subjectBucket: "General", subjectConfidence: 0.1, mappingStatus: "unmapped" };
    }

    // Winner = highest-scoring bucket
    const winner = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
    const [winnerBucket, winnerScore] = winner;

    // Confidence = winner's share of total score (0–1), then clamp
    const confidence = Math.round((winnerScore / totalScore) * 100) / 100;

    if (confidence < MIN_CONFIDENCE) {
        return {
            subjectBucket:    "General",
            subjectConfidence: confidence,
            mappingStatus:    "unmapped",
        };
    }

    return {
        subjectBucket:    winnerBucket,
        subjectConfidence: confidence,
        mappingStatus:    "subject_only",
    };
}
