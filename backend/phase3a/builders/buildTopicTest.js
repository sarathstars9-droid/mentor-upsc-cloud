import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../../..");

const PYQ_BY_NODE_PATH = path.join(
    ROOT,
    "backend",
    "data",
    "pyq_index",
    "pyq_by_node.json"
);

const PYQ_MASTER_INDEX_PATH = path.join(
    ROOT,
    "backend",
    "data",
    "pyq_index",
    "pyq_master_index.json"
);

const PRELIMS_QUESTION_DIR = path.join(
    ROOT,
    "backend",
    "data",
    "pyq_questions",
    "prelims"
);

let pyqByNodeCache = null;
let pyqMasterIndexCache = null;
let questionBankCache = null;

function safeReadJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function ensurePyqByNode() {
    if (!pyqByNodeCache) {
        pyqByNodeCache = safeReadJson(PYQ_BY_NODE_PATH);
    }
    return pyqByNodeCache;
}

function ensurePyqMasterIndex() {
    if (!pyqMasterIndexCache) {
        pyqMasterIndexCache = safeReadJson(PYQ_MASTER_INDEX_PATH);
    }
    return pyqMasterIndexCache;
}

function walkJsonFiles(dirPath) {
    if (!fs.existsSync(dirPath)) return [];

    const results = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            results.push(...walkJsonFiles(fullPath));
            continue;
        }

        if (!entry.isFile()) continue;
        if (!entry.name.endsWith(".json")) continue;
        if (!entry.name.includes("_tagged")) continue;

        results.push(fullPath);
    }

    return results;
}

function extractQuestionsFromJson(json, filePath) {
    let questions = [];

    if (Array.isArray(json)) {
        questions = json;
    } else if (Array.isArray(json?.questions)) {
        questions = json.questions;
    } else if (Array.isArray(json?.data)) {
        questions = json.data;
    } else {
        console.log("⚠ Unknown JSON format:", filePath);
    }

    return questions;
}

function normalizeQuestionRecord(q, qid, masterMeta = {}) {
    const normalizedQuestionText =
        q?.question ||
        q?.question_text ||
        q?.questionText ||
        q?.ques ||
        q?.statement ||
        "";

    const normalizedOptions =
        q?.options ||
        q?.choices ||
        q?.mcqOptions ||
        q?.optionMap ||
        [];

    return {
        ...q,
        id: q?.id || qid,
        year: q?.year ?? masterMeta?.year ?? null,
        question: normalizedQuestionText,
        questionText: normalizedQuestionText,
        options: normalizedOptions,
        answer:
            q?.answer ||
            q?.correctAnswer ||
            q?.correct_option ||
            q?.correctOption ||
            "",
        explanation:
            q?.explanation ||
            q?.solution ||
            q?.answer_explanation ||
            "",
        subject: q?.subject || "",
        topic: q?.topic || q?.section || "",
        subtopic: q?.subtopic || q?.microtheme || q?.microTheme || "",
    };
}

function ensureQuestionBank() {
    if (questionBankCache) return questionBankCache;

    const files = walkJsonFiles(PRELIMS_QUESTION_DIR);
    const bank = new Map();

    for (const filePath of files) {
        const json = safeReadJson(filePath);
        const questions = extractQuestionsFromJson(json, filePath);

        for (const q of questions) {
            if (!q?.id) continue;

            if (
                !q.question &&
                !q.question_text &&
                !q.questionText &&
                !q.ques &&
                !q.statement
            ) {
                console.log("⚠ Missing question text:", q.id, "in", filePath);
            }

            bank.set(q.id, q);
        }
    }

    console.log("✅ Question bank loaded:", bank.size);
    questionBankCache = bank;
    return questionBankCache;
}

function normalizeCount(count, fallback = 10) {
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.floor(n);
}

function shuffleArray(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function collectDescendantNodeIds(topicNodeId, pyqByNode) {
    const allNodeIds = Object.keys(pyqByNode);
    const prefix = `${topicNodeId}-`;

    return allNodeIds.filter(
        (nodeId) => nodeId === topicNodeId || nodeId.startsWith(prefix)
    );
}

function getPrelimsOrCsatQuestionIdsForNodes(nodeIds, pyqByNode, includeCsat = false) {
    const ids = [];

    for (const nodeId of nodeIds) {
        const bucket = pyqByNode[nodeId];
        if (!bucket) continue;

        const prelimsIds = Array.isArray(bucket.prelims) ? bucket.prelims : [];
        ids.push(...prelimsIds);

        if (includeCsat) {
            const csatIds = Array.isArray(bucket.csat) ? bucket.csat : [];
            ids.push(...csatIds);
        }
    }

    return [...new Set(ids)];
}

function hydrateQuestions(questionIds, masterIndex, questionBank) {
    const hydrated = [];

    for (const qid of questionIds) {
        const question = questionBank.get(qid);
        const masterMeta = masterIndex[qid] || {};

        if (!question) {
            console.log(
                "❌ Missing question for ID:",
                qid,
                "source:",
                masterMeta.sourceFile || "unknown"
            );
            continue;
        }

        const normalized = normalizeQuestionRecord(question, qid, masterMeta);

        hydrated.push({
            ...normalized,
            _meta: {
                id: qid,
                year: normalized.year ?? null,
                sourceFile: masterMeta.sourceFile ?? null,
                nodeIds:
                    masterMeta.syllabus_node_ids ??
                    masterMeta.syllabusNodeIds ??
                    [],
            },
        });
    }

    return hydrated;
}

function sortQuestions(questions, sortMode = "latest") {
    const arr = [...questions];

    if (sortMode === "random") {
        return shuffleArray(arr);
    }

    if (sortMode === "oldest") {
        return arr.sort((a, b) => {
            const yearA = Number(a?.year ?? 0);
            const yearB = Number(b?.year ?? 0);
            if (yearA !== yearB) return yearA - yearB;
            return String(a.id).localeCompare(String(b.id));
        });
    }

    return arr.sort((a, b) => {
        const yearA = Number(a?.year ?? 0);
        const yearB = Number(b?.year ?? 0);
        if (yearA !== yearB) return yearB - yearA;
        return String(a.id).localeCompare(String(b.id));
    });
}

function normalizeText(value = "") {
    return String(value)
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/\//g, " ")
        .replace(/[_-]+/g, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const SLUG_ALIASES = {
    ivc: ["indus valley civilization", "harappan civilization", "indus valley"],
    gdp_gnp: ["gdp gnp", "gross domestic product", "gross national product"],
    bop: ["balance of payments", "bop"],
    forex: ["foreign exchange", "forex"],
    gst: ["goods and services tax", "gst"],
    sebi: ["sebi", "securities exchange board india", "securities and exchange board of india"],
    rbi: ["reserve bank of india", "rbi"],
    nbfc: ["nbfc", "non banking financial company", "non banking finance company"],
    mpc: ["monetary policy committee", "mpc"],
    repo_reverse_repo: ["repo reverse repo", "repo rate", "reverse repo"],
    cag_fc: ["cag", "finance commission", "cag finance commission"],
    upsc: ["upsc", "union public service commission"],
    ec: ["election commission", "ec"],
    nhrc: ["nhrc", "national human rights commission"],
    niti: ["niti aayog", "niti"],
    dpsp: ["directive principles", "dpsp"],
    article_14_18: ["equality", "article 14", "article 18"],
    article_19_22: ["freedom", "article 19", "article 22"],
    cop: ["conference of parties", "cop"],
    ghg: ["greenhouse gases", "ghg"],
    cbd: ["convention on biological diversity", "cbd"],
    unfccc: ["unfccc", "un framework convention on climate change", "climate change convention"],
    ramsar_cites: ["ramsar", "cites"],
    un: ["united nations", "un"],
    wto_imf_wb: ["wto", "imf", "world bank", "wto imf wb"],
    g20: ["g20"],
    quad: ["quad"],
    brics: ["brics"],
    pm_com: ["prime minister", "council of ministers", "pm council of ministers"],
    governor_cm: ["governor", "chief minister", "cm"],
    ai_ml: ["ai", "artificial intelligence", "machine learning", "ai ml"],
    vaccines_bio: ["vaccines", "vaccine"],
    vaccines_health: ["vaccines", "vaccine"],
    mitigation_adaptation: ["mitigation", "adaptation"],
    bhakti_sufi: ["bhakti", "sufi", "bhakti sufi"],
    bhakti_sufi_history: ["bhakti", "sufi", "bhakti sufi"],
    locations_maps: ["locations", "maps", "map locations"],
    map_locations: ["map locations", "maps"],
    isro_missions: ["isro", "isro missions"],
    launch_vehicles: ["launch vehicles", "launch vehicle"],
    reptiles_aquatic: ["reptiles", "aquatic"],
    ecological_succession: ["ecological succession", "succession"],
    mitigation_adaptation: ["mitigation and adaptation", "mitigation", "adaptation"],
    british_expansion: ["british expansion"],
    freedom_movement: ["freedom movement", "freedom struggle"],
    governor_general_acts: ["governor general", "acts"],
};

function getSearchVariants(value) {
    const raw = String(value || "").trim();
    if (!raw) return [];

    const normalized = normalizeText(raw);
    const variants = new Set([normalized]);

    if (SLUG_ALIASES[raw]) {
        for (const alias of SLUG_ALIASES[raw]) {
            variants.add(normalizeText(alias));
        }
    }

    if (SLUG_ALIASES[normalized]) {
        for (const alias of SLUG_ALIASES[normalized]) {
            variants.add(normalizeText(alias));
        }
    }

    const parts = normalized.split(" ").filter(Boolean);
    if (parts.length > 1) {
        variants.add(parts.join(" "));
    }

    return [...variants].filter(Boolean);
}

function fieldMatchesVariants(fieldValue, variants) {
    const field = normalizeText(fieldValue);
    if (!field || !variants.length) return false;

    return variants.some((variant) => {
        if (!variant) return false;
        if (field === variant) return true;
        if (field.includes(variant)) return true;

        const tokens = variant.split(" ").filter(Boolean);
        if (tokens.length >= 2) {
            return tokens.every((token) => field.includes(token));
        }

        return false;
    });
}

function normalizeSubject(value = "") {
    return normalizeText(value);
}

// CSAT questions have empty subject field; they use module instead.
// Maps selectedSubjectId (e.g. "csat_quant") → set of normalized module values.
function getCSATModuleSet(subjectId) {
    const s = normalizeSubject(subjectId);
    const set = new Set();
    if (s.includes("quant") || s.includes("di")) {
        set.add("quant");
        set.add("di");
    }
    if (s.includes("reasoning") || s.includes("logic") || s.includes("lr") || s.includes("decision")) {
        set.add("reasoning");
        set.add("decision");
    }
    if (s.includes("rc") || s.includes("comprehension") || s.includes("reading")) {
        set.add("comprehension");
    }
    return set;
}

function getSubjectMatchSet(subjectId, subjectAliases = []) {
    const set = new Set(
        [subjectId, ...subjectAliases]
            .filter(Boolean)
            .map((s) => normalizeSubject(s))
    );

    if (normalizeSubject(subjectId) === "history") {
        set.add("ancient history");
        set.add("medieval history");
        set.add("modern history");
    }

    if (normalizeSubject(subjectId) === "culture") {
        set.add("art culture");
        set.add("art and culture");
        set.add("culture");
    }

    // Raw file: "Polity and Governance"
    if (normalizeSubject(subjectId) === "polity") {
        set.add("polity and governance");
        set.add("polity governance");
        set.add("polity");
    }

    // Raw files: "Indian Geography", "World Geography"
    if (normalizeSubject(subjectId) === "geography") {
        set.add("indian geography");
        set.add("world geography");
        set.add("geography");
    }

    // Raw file: "Current Affairs and Miscellaneous"
    if (normalizeSubject(subjectId) === "current affairs misc") {
        set.add("current affairs misc");
        set.add("current affairs");
        set.add("miscellaneous");
        set.add("current affairs and misc");
        set.add("current affairs and miscellaneous");
        set.add("current affairs miscellaneous");
    }

    if (normalizeSubject(subjectId) === "science tech") {
        set.add("science tech");
        set.add("science and technology");
        set.add("science technology");
    }

    if (normalizeSubject(subjectId) === "ir") {
        set.add("international relations");
        set.add("ir");
    }

    return set;
}

function questionMatchesSubject(question, subjectMatchSet) {
    if (!subjectMatchSet || subjectMatchSet.size === 0) return true;
    const subject = normalizeSubject(question.subject);
    return subjectMatchSet.has(subject);
}

function dedupeQuestions(questions) {
    const seen = new Set();
    const result = [];
    for (const q of questions) {
        const key = q?.id || q?.questionId;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(q);
    }
    return result;
}

function buildTopicModeQuestions({
    questionBank,
    subjectMatchSet,
    selectedTopicId,
    selectedMicroThemeIds = [],
}) {
    const topicVariants = getSearchVariants(selectedTopicId);
    const subtopicVariants = (selectedMicroThemeIds || []).flatMap(getSearchVariants);

    const allQuestions = Array.from(questionBank.values()).map((q) =>
        normalizeQuestionRecord(q, q.id)
    );

    const matched = allQuestions.filter((q) => {
        if (!questionMatchesSubject(q, subjectMatchSet)) return false;

        const topicMatch = fieldMatchesVariants(q.topic, topicVariants);
        const subtopicMatch = subtopicVariants.length
            ? fieldMatchesVariants(q.subtopic, subtopicVariants)
            : false;
        if (subtopicVariants.length) {
            return topicMatch && subtopicMatch;
        }

        return topicMatch;
    });

    console.log("🔥 TOPIC MODE ACTIVE", {
        selectedTopicId,
        selectedMicroThemeIds,
        matchedCount: matched.length,
        sampleTopics: matched.slice(0, 10).map((q) => q.topic),
        sampleSubtopics: matched.slice(0, 10).map((q) => q.subtopic),
    });

    return dedupeQuestions(matched);
}

function buildSubtopicModeQuestions({
    questionBank,
    subjectMatchSet,
    selectedTopicId,
    selectedMicroThemeIds = [],
}) {
    const topicVariants = getSearchVariants(selectedTopicId);
    const subtopicVariants = (selectedMicroThemeIds || []).flatMap(getSearchVariants);

    const allQuestions = Array.from(questionBank.values()).map((q) =>
        normalizeQuestionRecord(q, q.id)
    );

    const matched = allQuestions.filter((q) => {
        if (!questionMatchesSubject(q, subjectMatchSet)) return false;

        const subtopicMatch = fieldMatchesVariants(q.subtopic, subtopicVariants);
        const topicMatch = fieldMatchesVariants(q.topic, topicVariants);

        if (subtopicVariants.length) {
            return subtopicMatch;
        }
        return topicMatch;
    });
    console.log("🧠 FINAL FILTER RESULT", {
        selectedTopicId,
        selectedMicroThemeIds,
        finalCount: matched.length,
    });
    console.log("🔥 SUBTOPIC MODE ACTIVE", {
        selectedTopicId,
        selectedMicroThemeIds,
        matchedCount: matched.length,
        sampleTopics: matched.slice(0, 10).map((q) => q.topic),
        sampleSubtopics: matched.slice(0, 10).map((q) => q.subtopic),
    });

    return dedupeQuestions(matched);
}

function buildTopicTest(input = {}) {
    const {
        topicNodeId,
        count = 10,
        sort = "latest",
        includeDescendants = true,
        subjectId = "",
        subjectAliases = [],
        practiceScope = "subject",

        // 🔥 ADD THESE (CRITICAL FIX)
        selectedSubjectId = "",
        selectedTopicId = "",
        selectedMicroThemeIds = [],
        practicePaper = "GS",

        resolvedNodeIds = [],
    } = input;

    const pyqByNode = ensurePyqByNode();
    const masterIndex = ensurePyqMasterIndex();
    const questionBank = ensureQuestionBank();

    let hydrated = [];
    let matchedNodes = 0;
    let mode = "topic";

    const subjectMatchSet = getSubjectMatchSet(
        selectedSubjectId || subjectId,
        subjectAliases
    );

    // ── SUBJECT SCOPE ─────────────────────────────────────────────────────────
    // Always scan raw files directly for full accuracy. Node-based lookup is
    // NOT used here because pyq_by_node can be stale / incomplete relative to
    // the raw _tagged.json files (the authoritative source).
    if (practiceScope === "subject") {
        mode = "subject";
        const allQuestions = Array.from(questionBank.values()).map((q) =>
            normalizeQuestionRecord(q, q.id)
        );

        const isCsatPaper = String(practicePaper || "").toUpperCase() === "CSAT";

        if (isCsatPaper) {
            // CSAT questions have subject:"" — match by module field instead
            const csatModules = getCSATModuleSet(selectedSubjectId || subjectId);
            hydrated = allQuestions.filter((q) => {
                const id = String(q.id || "").toUpperCase();
                if (!id.startsWith("PRE_CSAT")) return false;
                if (csatModules.size === 0) return true;
                return csatModules.has(normalizeText(q.module || ""));
            });
        } else {
            hydrated = allQuestions.filter((q) => questionMatchesSubject(q, subjectMatchSet));
        }

        console.log("🔥 SUBJECT MODE ACTIVE", {
            subjectId: selectedSubjectId || subjectId,
            isCsatPaper,
            matchedCount: hydrated.length,
        });
    }

    // ── TOPIC / SUBTOPIC SCOPE ────────────────────────────────────────────────
    // Priority: resolvedNodeIds → topicNodeId → text-matching fallback
    if (!hydrated.length) {
        // 1) resolvedNodeIds: explicit list of nodes from the resolver
        if (Array.isArray(resolvedNodeIds) && resolvedNodeIds.length > 0) {
            mode = "resolved-node";
            const isCsat = String(practicePaper || "").toUpperCase() === "CSAT";
            const mergedIds = new Set();

            for (const nodeId of resolvedNodeIds) {
                const nodeIds = includeDescendants
                    ? collectDescendantNodeIds(nodeId, pyqByNode)
                    : pyqByNode[nodeId]
                        ? [nodeId]
                        : [];
                for (const nid of nodeIds) {
                    for (const qid of getPrelimsOrCsatQuestionIdsForNodes([nid], pyqByNode, isCsat)) {
                        mergedIds.add(qid);
                    }
                }
            }

            hydrated = hydrateQuestions(Array.from(mergedIds), masterIndex, questionBank);
            matchedNodes = resolvedNodeIds.length;
            console.log("🔥 RESOLVED NODE MODE ACTIVE", {
                resolvedNodeIds,
                isCsat,
                matchedCount: hydrated.length,
            });

            // For subtopic scope: apply text-filtering so each subtopic returns distinct questions.
            // Without this, multiple subtopics mapped to the same coarse node return identical sets.
            if (
                practiceScope === "subtopic" &&
                Array.isArray(selectedMicroThemeIds) &&
                selectedMicroThemeIds.length > 0 &&
                hydrated.length > 0
            ) {
                const subtopicVariants = selectedMicroThemeIds.flatMap(getSearchVariants);
                if (subtopicVariants.length > 0) {
                    const textFiltered = hydrated.filter((q) => {
                        const norm = normalizeQuestionRecord(q, q.id);
                        return (
                            fieldMatchesVariants(norm.subtopic, subtopicVariants) ||
                            fieldMatchesVariants(norm.topic, subtopicVariants)
                        );
                    });
                    if (textFiltered.length > 0) {
                        hydrated = textFiltered;
                        console.log("🎯 SUBTOPIC TEXT-FILTER applied", {
                            selectedMicroThemeIds,
                            beforeCount: Array.from(mergedIds).length,
                            afterCount: textFiltered.length,
                        });
                    }
                }
            }
        }

        // 2) topicNodeId: single node (descendants included)
        if (!hydrated.length && topicNodeId && typeof topicNodeId === "string") {
            const nodeIds = includeDescendants
                ? collectDescendantNodeIds(topicNodeId, pyqByNode)
                : pyqByNode[topicNodeId]
                    ? [topicNodeId]
                    : [];
            matchedNodes = nodeIds.length;
            if (nodeIds.length > 0) {
                const isCsat = String(practicePaper || "").toUpperCase() === "CSAT";
                const prelimsIds = getPrelimsOrCsatQuestionIdsForNodes(nodeIds, pyqByNode, isCsat);
                hydrated = hydrateQuestions(prelimsIds, masterIndex, questionBank);
                mode = "node";
            }
        }

        // 3) Text-matching fallback (topic / subtopic)
        if (!hydrated.length) {
            if (practiceScope === "topic") {
                mode = "topic";
                hydrated = buildTopicModeQuestions({
                    questionBank,
                    subjectMatchSet,
                    selectedTopicId,
                    selectedMicroThemeIds,
                });
            } else if (practiceScope === "subtopic") {
                mode = "subtopic";
                hydrated = buildSubtopicModeQuestions({
                    questionBank,
                    subjectMatchSet,
                    selectedTopicId,
                    selectedMicroThemeIds,
                });
            }
        }
    }

    // Filter by paper where relevant.
    if (practicePaper === "GS") {
        // GS: exclude any CSAT-prefixed IDs
        hydrated = hydrated.filter((q) => !String(q.id || "").toUpperCase().startsWith("PRE_CSAT"));
    } else if (practicePaper === "CSAT") {
        // CSAT: keep only CSAT questions (by id prefix OR by csat subject field)
        hydrated = hydrated.filter((q) => {
            const id = String(q.id || "").toUpperCase();
            const subject = String(q.subject || "").toLowerCase();
            return (
                id.startsWith("PRE_CSAT") ||
                id.startsWith("CSAT_") ||
                subject.includes("csat") ||
                subject.includes("reading comprehension") ||
                subject.includes("logical reasoning") ||
                subject.includes("basic numeracy")
            );
        });
    }

    const sorted = sortQuestions(dedupeQuestions(hydrated), sort);
    const finalQuestions = sorted.slice(0, normalizeCount(count));

    return {
        ok: true,
        meta: {
            mode,
            topicNodeId,
            subjectId,
            subjectAliases,
            practiceScope,
            selectedSubjectId,
            selectedTopicId,
            selectedMicroThemeIds,
            includeDescendants,
            matchedNodes,
            requestedCount: normalizeCount(count),
            actualCount: finalQuestions.length,
            source: "phase25-smart-selector",
            sort,
        },
        questions: finalQuestions,
    };
}

export default buildTopicTest;
