import fs from "fs";
import path from "path";
import {
    PRELIMS_SELECTOR_MAP,
    getSelectorSubjectMap,
    getTopicLabels,
    getSubtopicConfig,
    getSubtopicLabels,
} from "./prelimsSelectorMap.js";
import { getRcQuestionsForTopic, TOPIC_TO_RC_TYPE } from "../engines/rcSubtopicLoader.js";
console.log("[PHASE3A BUILDER VERSION] growth-dev-clean-v2");
/* =========================
   PATHS
========================= */

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data", "pyq_questions");

/* =========================
   BASIC HELPERS
========================= */

function readJSON(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function norm(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[_/\\-]+/g, " ")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeId(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/[^\w]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function titleFromId(text) {
    return String(text || "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function uniq(arr) {
    return [...new Set((arr || []).filter(Boolean))];
}

function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function dedupeById(items) {
    const seen = new Set();
    const out = [];

    for (const item of items) {
        const id = item?.id || item?.questionId;
        if (!id) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(item);
    }

    return out;
}

function getAllJsonFilesRecursive(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            results = results.concat(getAllJsonFilesRecursive(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
            results.push(fullPath);
        }
    }

    return results;
}

/* =========================
   FILE FILTERING
========================= */

function isTaggedPrelimsFile(filePath) {
    const name = path.basename(filePath).toLowerCase();
    return name.startsWith("prelims_") && name.endsWith("_tagged.json");
}

function getTaggedPrelimsFiles() {
    return getAllJsonFilesRecursive(DATA_DIR).filter(isTaggedPrelimsFile);
}

/* =========================
   NORMALIZATION
========================= */

function normalizeOptionValue(value) {
    if (typeof value === "string") return value.trim();
    if (value && typeof value === "object") {
        return String(
            value.text ||
            value.value ||
            value.label ||
            value.option ||
            ""
        ).trim();
    }
    return "";
}

function normalizeOptions(question) {
    const rawOptions = question?.options;

    if (rawOptions && !Array.isArray(rawOptions) && typeof rawOptions === "object") {
        const mapped = {};
        Object.keys(rawOptions).forEach((key) => {
            const k = String(key).trim().toUpperCase().slice(0, 1);
            mapped[k] = normalizeOptionValue(rawOptions[key]);
        });

        return {
            A: mapped.A || mapped["1"] || "",
            B: mapped.B || mapped["2"] || "",
            C: mapped.C || mapped["3"] || "",
            D: mapped.D || mapped["4"] || "",
        };
    }

    if (Array.isArray(rawOptions)) {
        const letters = ["A", "B", "C", "D"];
        const mapped = {};
        rawOptions.forEach((value, index) => {
            const key = letters[index];
            if (key) mapped[key] = normalizeOptionValue(value);
        });
        return {
            A: mapped.A || "",
            B: mapped.B || "",
            C: mapped.C || "",
            D: mapped.D || "",
        };
    }

    return {
        A: normalizeOptionValue(question?.optionA || question?.a),
        B: normalizeOptionValue(question?.optionB || question?.b),
        C: normalizeOptionValue(question?.optionC || question?.c),
        D: normalizeOptionValue(question?.optionD || question?.d),
    };
}

function normalizeAnswer(answer) {
    const raw = String(answer || "").trim().toUpperCase();
    if (["A", "B", "C", "D"].includes(raw)) return raw;
    if (["1", "2", "3", "4"].includes(raw)) {
        return ["A", "B", "C", "D"][Number(raw) - 1];
    }
    return raw;
}

function normalizeQuestion(q, sourceFile) {
    const id = q?.id || q?.questionId;
    if (!id) return null;

    const question = String(q.question || q.questionText || q.title || "").trim();
    if (!question) return null;

    const stage = norm(q.stage || "prelims");
    const paper = norm(q.paper || "");
    const subject = String(q.subject || "").trim();
    const section = String(q.section || "").trim();
    const microtheme = String(q.microtheme || q.microTheme || "").trim();
    const module = String(q.module || "").trim();

    return {
        ...q,
        id: String(id),
        questionId: String(id),
        sourceFile,
        sourceBase: path.basename(sourceFile),
        sourceNorm: norm(path.basename(sourceFile)),
        stage,
        paper,
        year: Number(q.year || 0),
        subject,
        section,
        microtheme,
        module,
        subjectNorm: norm(subject),
        sectionNorm: norm(section),
        microNorm: norm(microtheme),
        moduleNorm: norm(module),
        question,
        questionText: question,
        questionType: String(q.questionType || "").trim(),
        options: normalizeOptions(q),
        answer: normalizeAnswer(q.answer),
        syllabusNodeId: q.syllabusNodeId || q.nodeId || "",
    };
}

/* =========================
   STRICT CSAT FILTERING (ZERO LEAKAGE)
========================= */

/**
 * CRITICAL: Maps user-friendly CSAT subject to strict nodeId prefixes
 * This ensures ZERO cross-subject contamination
 */
function mapCsatSubjectToNodeIdPrefixes(subjectId) {
    const normId = normalizeId(subjectId || "");
    
    // Map to exact nodeId prefixes used in data files
    // IMPORTANT: csat_reasoning, csat_lr both map to same LR nodeId prefixes
    const mapping = {
        csat_quant: ["CSAT-BN", "CSAT-DI"],           // Basic Numerals + Data Interpretation
        csat_lr: ["CSAT-LR", "CSAT-DM"],              // Logical Reasoning + Decision Making
        csat_reasoning: ["CSAT-LR", "CSAT-DM"],       // Alias for csat_lr
        csat_rc: ["CSAT-COMP"],                       // Comprehension/RC
    };
    
    return mapping[normId] || [];
}

/**
 * STRICT: Load CSAT questions from correct files by subject
 * This bypasses the fuzzy filtering and uses source file restrictions
 */
function loadCsatQuestionsBySubject(subjectId) {
    const normId = normalizeId(subjectId || "");
    
    let targetFile = null;
    // IMPORTANT: csat_reasoning is an alias for csat_lr
    const fileMapping = {
        csat_quant: "prelims_csat_quant_tagged.json",
        csat_lr: "prelims_csat_lr_tagged.json",
        csat_reasoning: "prelims_csat_lr_tagged.json",  // Alias for csat_lr
        csat_rc: "prelims_csat_rc_tagged.json",
    };
    
    targetFile = fileMapping[normId];
    if (!targetFile) {
        console.warn(`[CSAT LOADER] Unknown CSAT subject: ${subjectId}`);
        return { questions: [], validationLog: { error: "unknown_subject" } };
    }
    
    // Find the file
    const allFiles = getTaggedPrelimsFiles();
    const sourceFile = allFiles.find(f => path.basename(f) === targetFile);
    
    if (!sourceFile) {
        console.warn(`[CSAT LOADER] File not found: ${targetFile}`);
        return { questions: [], validationLog: { error: "file_not_found" } };
    }
    
    console.log(`[CSAT LOADER] Loading from: ${targetFile}`);
    
    try {
        const json = readJSON(sourceFile);
        const rawQuestions = Array.isArray(json) ? json : safeArray(json?.questions);
        
        const validationLog = {
            sourceFile: targetFile,
            rawLoaded: rawQuestions.length,
            expectedNodePrefixes: mapCsatSubjectToNodeIdPrefixes(subjectId),
            afterNormalization: 0,
            afterNodeValidation: 0,
            rejected: { wrongNode: 0, missingData: 0 },
        };
        
        const questions = [];
        for (const q of rawQuestions) {
            const nq = normalizeQuestion(q, sourceFile);
            if (!nq) {
                validationLog.rejected.missingData++;
                continue;
            }
            
            // STRICT: Validate nodeId belongs to this subject
            const nodeId = nq.syllabusNodeId || nq.nodeId || "";
            const expectedPrefixes = mapCsatSubjectToNodeIdPrefixes(subjectId);
            const isValidNode = expectedPrefixes.some(prefix => nodeId.startsWith(prefix));
            
            if (!isValidNode) {
                validationLog.rejected.wrongNode++;
                console.warn(`[CSAT VALIDATION] Question ${nq.id} has wrong nodeId: ${nodeId}. Expected prefixes: ${expectedPrefixes.join(", ")}`);
                continue;
            }
            
            validationLog.afterNormalization++;
            validationLog.afterNodeValidation++;
            questions.push(nq);
        }
        
        console.log(`[CSAT LOADER SUMMARY]`, validationLog);
        return { questions, validationLog };
        
    } catch (error) {
        console.error(`[CSAT LOADER ERROR] Failed to load ${targetFile}:`, error.message);
        return { questions: [], validationLog: { error: error.message } };
    }
}

/**
 * RC PASSAGE INTEGRITY: Group RC questions by passageText
 * Ensures passages are never split across returned question sets
 */
function groupRcQuestionsByPassage(questions) {
    const groups = [];
    const passageMap = new Map();
    
    for (const q of questions) {
        const passageId = q.passageText || null;
        
        // If question has no passage, discard it (RC questions MUST have passages)
        if (!passageId) {
            console.warn(`[RC VALIDATOR] Discarding RC question with missing passage: ${q.id}`);
            continue;
        }
        
        // Add to passage group
        if (!passageMap.has(passageId)) {
            passageMap.set(passageId, []);
        }
        passageMap.get(passageId).push(q);
    }
    
    // Convert to groups
    for (const [passageText, qs] of passageMap) {
        if (qs.length > 0) {
            groups.push({
                passage: passageText,
                questions: qs,
                size: qs.length,
            });
        }
    }
    
    console.log(`[RC GROUPING] Grouped ${questions.length} RC questions into ${groups.length} passage groups`);
    return groups;
}

/**
 * DEDUPLICATION: Ensure no question appears twice
 */
function validateAndDeduplicateQuestions(questions, context = "") {
    const seen = new Set();
    const duplicates = [];
    const deduped = [];
    
    for (const q of questions) {
        const id = q?.id || q?.questionId;
        if (!id) continue;
        
        if (seen.has(id)) {
            duplicates.push(id);
        } else {
            seen.add(id);
            deduped.push(q);
        }
    }
    
    if (duplicates.length > 0) {
        console.warn(`[DEDUP WARNING] ${context}: Found ${duplicates.length} duplicate questions`, duplicates.slice(0, 5));
    }
    
    return { deduped, duplicates };
}

function loadAllPrelimsQuestions() {
    const files = getTaggedPrelimsFiles();
    const all = [];

    files.forEach((file) => {
        try {
            const json = readJSON(file);
            const arr = Array.isArray(json) ? json : safeArray(json?.questions);
            arr.forEach((q) => {
                const nq = normalizeQuestion(q, file);
                if (nq) all.push(nq);
            });
        } catch {
            console.warn("Skipping unreadable file:", file);
        }
    });

    return dedupeById(all);
}

/* =========================
   STRICT REQUEST HELPERS
========================= */

function isCsatRequest(practicePaper, selectedSubjectId, selectedSubjectLabel, fullLengthType) {
    const bag = [
        norm(practicePaper),
        normalizeId(selectedSubjectId),
        norm(selectedSubjectLabel),
        norm(fullLengthType),
    ].join(" ");

    return bag.includes("csat");
}

const SUBJECT_RULES = {
    culture: {
        ids: ["culture"],
        labels: ["art and culture", "art & culture", "culture"],
        files: ["prelims_gs_art_culture_tagged.json"],
    },
    history: {
        ids: ["history", "ancient_history", "medieval_history", "modern_history"],
        labels: ["ancient history", "medieval history", "modern history", "history"],
        files: [
            "prelims_gs_history_ancient_tagged.json",
            "prelims_gs_history_medieval_tagged.json",
            "prelims_gs_history_modern_tagged.json",
        ],
    },
    economy: {
        ids: ["economy"],
        labels: ["economy", "indian economy"],
        files: ["prelims_gs_economy_tagged.json"],
    },
    polity: {
        ids: ["polity", "governance", "polity_governance"],
        labels: ["polity and governance", "polity", "governance"],
        files: ["prelims_gs_polity_governance_tagged.json"],
    },
    geography: {
        ids: ["geography", "geography_india", "geography_world", "indian_geography", "world_geography"],
        labels: ["indian geography", "world geography", "geography"],
        files: [
            "prelims_gs_geography_india_tagged.json",
            "prelims_gs_geography_world_tagged.json",
        ],
    },
    sciencetech: {
        ids: ["sciencetech", "science_tech", "science_and_technology", "science_technology"],
        labels: ["science and technology", "science & technology"],
        files: ["prelims_gs_science_tech_tagged.json"],
    },
    environment: {
        ids: ["environment", "ecology", "environment_and_ecology"],
        labels: ["environment", "environment and ecology"],
        files: ["prelims_gs_environment_tagged.json"],
    },
    ir: {
        ids: ["ir", "international_relations"],
        labels: ["international relations"],
        files: ["prelims_gs_international_relations_tagged.json"],
    },
    current_affairs_misc: {
        ids: ["current_affairs_misc", "current_affairs", "misc"],
        labels: ["current affairs and miscellaneous", "current affairs"],
        files: ["prelims_gs_current_affairs_misc_tagged.json"],
    },
    csat: {
        ids: ["csat", "csat_quant", "csat_reasoning", "csat_reading"],
        labels: ["csat"],
        files: [
            "prelims_csat_quant_tagged.json",
            "prelims_csat_lr_tagged.json",
            "prelims_csat_rc_tagged.json",
        ],
    },
};



function resolveSubjectRule({ selectedSubjectId, selectedSubjectLabel, csatMode }) {
    if (csatMode) return SUBJECT_RULES.csat;

    const idNorm = normalizeId(selectedSubjectId);
    const labelNorm = norm(selectedSubjectLabel);

    const rules = Object.values(SUBJECT_RULES).filter((r) => r !== SUBJECT_RULES.csat);

    for (const rule of rules) {
        if (rule.ids.some((id) => normalizeId(id) === idNorm)) return rule;
        if (rule.labels.some((label) => norm(label) === labelNorm)) return rule;
    }

    return null;
}

function normalizePayloadLabels(body = {}) {
    const selectedSubjectLabel =
        body.selectedSubjectLabel ||
        body.subjectLabel ||
        titleFromId(body.selectedSubjectId || body.subjectId || "");

    const selectedTopicLabel =
        body.selectedTopicLabel ||
        body.topicLabel ||
        titleFromId(body.selectedTopicId || body.topicId || "");

    const selectedMicroThemeLabels = uniq(
        [
            ...safeArray(body.selectedMicroThemeLabels),
            ...safeArray(body.microThemeLabels),
        ].map((x) => String(x || "").trim()).filter(Boolean)
    );

    return {
        selectedSubjectLabel,
        selectedTopicLabel,
        selectedMicroThemeLabels,
    };
}

/* =========================
   MATCHING ENGINE
========================= */

const STOP_TOKENS = new Set([
    "and",
    "or",
    "the",
    "of",
    "in",
    "on",
    "for",
    "to",
    "by",
    "with",
    "a",
    "an",
]);

function buildAliasBag(label = "", id = "") {
    return uniq([
        norm(label),
        norm(titleFromId(id)),
        norm(String(label || "").replace(/&/g, "and")),
    ].filter(Boolean));


    const tokenized = uniq(
        rawPhrases.flatMap((phrase) =>
            phrase
                .split(" ")
                .map((t) => t.trim())
                .filter(
                    (t) =>
                        t &&
                        t.length >= 3 &&
                        !STOP_TOKENS.has(t)
                )
        )
    );

    return uniq([...rawPhrases, ...tokenized]);
}

function textContainsAlias(textNorm, aliasBag) {
    if (!textNorm) return false;
    return aliasBag.some((alias) => textNorm.includes(alias));
}

function getMappedTopicAliases(subjectId, topicId) {
    const aliases = safeArray(PRELIMS_SELECTOR_MAP?.[subjectId]?.topics?.[topicId]).map(norm);

    if (subjectId === "economy" && topicId === "growth_development") {
        console.log("[ALIASES growth_development]", aliases);
    }

    return aliases;
}

function getMappedSubtopicAliases(subjectId, subtopicId) {
    const aliases = safeArray(PRELIMS_SELECTOR_MAP?.[subjectId]?.subtopics?.[subtopicId]).map(norm);

    if (subjectId === "economy" && subtopicId === "human_development") {
        console.log("[ALIASES human_development]", aliases);
    }

    return aliases;
}

function strictMatchQuestionToTopic(q, topicLabel, topicId, subjectId) {
    const aliasBag = buildAliasBag(topicLabel, topicId);
    const mappedAliases = getMappedTopicAliases(subjectId, topicId);

    const finalAliases = uniq([...aliasBag, ...mappedAliases]);

    return (
        textContainsAlias(q.sectionNorm, finalAliases) ||
        textContainsAlias(q.microNorm, finalAliases) ||
        textContainsAlias(q.moduleNorm, finalAliases)
    );
}

function strictMatchQuestionToSubtopic(q, subtopicLabel, subtopicId, subjectId) {
    const aliasBag = buildAliasBag(subtopicLabel, subtopicId);
    const mappedAliases = getMappedSubtopicAliases(subjectId, subtopicId);

    const finalAliases = uniq([...aliasBag, ...mappedAliases]);

    return (
        textContainsAlias(q.microNorm, finalAliases) ||
        textContainsAlias(q.sectionNorm, finalAliases)
    );
}

/* =========================
   STRICT FILTERS
========================= */

function filterStagePrelims(questions) {
    return questions.filter((q) => q.stage.includes("prelim"));
}

function filterPaper(questions, csatMode) {
    return questions.filter((q) => {
        const srcBase = q.sourceBase.toLowerCase();
        const isCsatFile = srcBase.startsWith("prelims_csat_");
        if (csatMode) {
            return q.paper.includes("csat") || isCsatFile;
        }
        return q.paper.includes("gs1") && !isCsatFile;
    });
}

function filterSubjectStrict(questions, subjectRule) {
    if (!subjectRule) return [];

    return questions.filter((q) => {
        const fileOk = subjectRule.files.some(
            (fileName) => q.sourceBase.toLowerCase() === fileName.toLowerCase()
        );
        const labelOk = subjectRule.labels.some(
            (label) => q.subjectNorm === norm(label)
        );
        return fileOk || labelOk;
    });
}

function filterYearStrict(questions, yearValue) {
    const year = Number(yearValue || 0);
    if (!year) return [];
    return questions.filter((q) => Number(q.year) === year);
}

function filterTopicStrict(questions, topicLabel, topicId, subjectId) {
    if (!topicLabel && !topicId) return [];

    const aliasBag = buildAliasBag(topicLabel, topicId);
    const mappedAliases = getTopicLabels(subjectId, topicId);

    const finalAliases = uniq([...aliasBag, ...mappedAliases]);

    return questions.filter((q) => {
        return (
            textContainsAlias(q.sectionNorm, finalAliases) ||
            textContainsAlias(q.microNorm, finalAliases) ||
            textContainsAlias(q.moduleNorm, finalAliases)
        );
    });
}

function filterSubtopicsStrict(
    questions,
    selectedMicroThemeLabels,
    selectedMicroThemeIds,
    selectedSubjectId
) {
    const labels = safeArray(selectedMicroThemeLabels);
    const ids = safeArray(selectedMicroThemeIds);

    if (!labels.length && !ids.length) return [];

    const pendingSubtopics = ids.filter((id) => {
        const cfg = getSubtopicConfig(selectedSubjectId, id);
        return cfg?.taggingPending;
    });

    if (pendingSubtopics.length) {
        return [];
    }

    return questions.filter((q) => {
        for (let i = 0; i < Math.max(labels.length, ids.length); i += 1) {
            const label = labels[i] || "";
            const id = ids[i] || "";

            const aliasBag = buildAliasBag(label, id);
            const mappedAliases = getSubtopicLabels(selectedSubjectId, id);
            const finalAliases = uniq([...aliasBag, ...mappedAliases]);

            const matched =
                textContainsAlias(q.microNorm, finalAliases) ||
                textContainsAlias(q.sectionNorm, finalAliases) ||
                textContainsAlias(q.moduleNorm, finalAliases);

            if (matched) return true;
        }
        return false;
    });
}
/* =========================
   RESPONSE HELPERS
========================= */

function sendBuilderError(res, message, details = {}) {
    return res.status(400).json({
        success: false,
        error: message,
        ...details,
    });
}

function buildSuccessPayload({
    mode,
    paper,
    scope,
    year,
    questions,
    debug,
}) {
    return {
        success: true,
        mode,
        paper,
        scope,
        year: year ? Number(year) : null,
        total: questions.length,
        questions,
        debug,
    };
}

/* =========================
   MAIN BUILDER
========================= */

export default async function buildPrelimsPracticeTest(req, res) {
    try {
        const body = req.body || {};

        const mode = body.mode || "sectional";
        const practicePaper = body.practicePaper || body.paper || "GS";
        const practiceScope = body.practiceScope || body.scope || "subject";
        const count = Math.max(1, Number(body.practiceQuestionCount || body.count || 10));

        const selectedSubjectId = body.selectedSubjectId || body.subjectId || "";
        const selectedTopicId = body.selectedTopicId || body.topicId || "";
        const selectedMicroThemeIds = safeArray(body.selectedMicroThemeIds || body.microThemeIds);

        const fullLengthType = body.fullLengthType || "";
        const fullLengthYear = body.fullLengthYear || body.year || "";

        const {
            selectedSubjectLabel,
            selectedTopicLabel,
            selectedMicroThemeLabels,
        } = normalizePayloadLabels(body);

        const csatMode = isCsatRequest(
            practicePaper,
            selectedSubjectId,
            selectedSubjectLabel,
            fullLengthType
        );

        let questions = loadAllPrelimsQuestions();
        questions = filterStagePrelims(questions);
        questions = filterPaper(questions, csatMode);

        if (!questions.length) {
        }

        if (mode === "full_length") {
            // CSAT full-length: Use strict nodeId-based loading
            let fullLengthQuestions = questions;
            let flValidationLog = { csatMode, year: fullLengthYear, stage: "full_length" };
            
            if (csatMode) {
                // Load strictly by CSAT subject from correct file
                const { questions: csatQs, validationLog: csatLog } = loadCsatQuestionsBySubject(fullLengthType || "csat_quant");
                fullLengthQuestions = csatQs;
                flValidationLog = { ...flValidationLog, ...csatLog };
            }
            
            const byYear = filterYearStrict(fullLengthQuestions, fullLengthYear);

            if (!byYear.length) {
                return sendBuilderError(
                    res,
                    `No ${csatMode ? "CSAT" : "GS"} prelims questions found for year ${fullLengthYear}.`,
                    { 
                        mode, 
                        paper: csatMode ? "CSAT" : "GS", 
                        year: fullLengthYear,
                        validationLog: flValidationLog,
                    }
                );
            }

            const expected = csatMode ? 80 : 100;
            const finalQuestions = shuffle(byYear).slice(0, expected);
            
            // Deduplicate
            const { deduped: cleanFL, duplicates: dupFL } = validateAndDeduplicateQuestions(finalQuestions, `Full-Length-${fullLengthYear}`);

            console.log("[BUILDER VALIDATION - FULL LENGTH]", {
                mode: "full_length",
                csatMode,
                year: fullLengthYear,
                initialPool: fullLengthQuestions.length,
                afterYearFilter: byYear.length,
                expected,
                returned: cleanFL.length,
                duplicatesRemoved: dupFL.length,
            });

            return res.json(
                buildSuccessPayload({
                    mode: "full_length",
                    paper: csatMode ? "CSAT" : "GS",
                    scope: fullLengthType || "yearwise",
                    year: fullLengthYear,
                    questions: cleanFL,
                    debug: {
                        stage: "prelims",
                        paperFilter: csatMode ? "csat" : "gs1",
                        exactYear: Number(fullLengthYear),
                        found: byYear.length,
                        returned: cleanFL.length,
                        duplicatesRemoved: dupFL.length,
                    },
                })
            );
        }

        const subjectRule = resolveSubjectRule({
            selectedSubjectId,
            selectedSubjectLabel,
            csatMode,
        });

        if (!subjectRule) {
            return sendBuilderError(
                res,
                `Unknown subject selection: "${selectedSubjectId || selectedSubjectLabel || "blank"}".`
            );
        }

        // CRITICAL FIX: For CSAT, use STRICT nodeId-based loading (ZERO LEAKAGE)
        let subjectQuestions = [];
        let builderValidationLog = {
            requestedNode: csatMode ? selectedSubjectId : "N/A",
            csatMode,
            stage: "subject_loading",
        };
        
        if (csatMode) {
            // CSAT: Load strictly from correct file by subject ID
            const { questions: csatQs, validationLog: csatLog } = loadCsatQuestionsBySubject(selectedSubjectId);
            subjectQuestions = csatQs;
            builderValidationLog = { ...builderValidationLog, ...csatLog };
            
            console.log("[BUILDER VALIDATION - CSAT]", {
                requestedNode: selectedSubjectId,
                totalFetched: csatQs.length,
                afterDedup: csatQs.length,
                rejected: csatLog.rejected,
            });
        } else {
            // GS: Use existing filter logic
            subjectQuestions = filterSubjectStrict(questions, subjectRule);
        }

        if (!subjectQuestions.length) {
            return sendBuilderError(
                res,
                `No exact PYQs are tagged for selected subtopic "${selectedMicroThemeLabels[0] || selectedMicroThemeIds[0] || "Unknown"}" under topic "${selectedTopicLabel || selectedTopicId}". Topic-level questions exist, but subtopic-level tagging is not available yet.`,
                {
                    selectedSubjectId,
                    selectedSubjectLabel,
                    matchedFiles: subjectRule.files,
                    matchedLabels: subjectRule.labels,
                    builderLog: builderValidationLog,
                }
            );
        }
        if (selectedSubjectId === "culture") {
            console.log("[CULTURE SUBJECT DEBUG]", {
                selectedSubjectId,
                selectedSubjectLabel,
                subjectPool: subjectQuestions.length,
                sample: subjectQuestions.slice(0, 5).map((q) => ({
                    id: q.id,
                    subject: q.subject,
                    section: q.section,
                    microtheme: q.microtheme,
                    year: q.year,
                    paper: q.paper,
                    stage: q.stage,
                    sourceBase: q.sourceBase,
                })),
            });
        }
        if (practiceScope === "subject") {
            const finalQuestions = shuffle(subjectQuestions).slice(0, count);

            // Deduplicate final questions
            const { deduped: cleanQuestions, duplicates: dupCount } = validateAndDeduplicateQuestions(finalQuestions, `${selectedSubjectId}-subject`);

            return res.json(
                buildSuccessPayload({
                    mode: "practice",
                    paper: csatMode ? "CSAT" : "GS",
                    scope: "subject",
                    year: null,
                    questions: cleanQuestions,
                    debug: {
                        stage: "prelims",
                        paperFilter: csatMode ? "csat" : "gs1",
                        subject: selectedSubjectLabel || selectedSubjectId,
                        pool: subjectQuestions.length,
                        returned: cleanQuestions.length,
                        duplicatesRemoved: dupCount.length,
                    },
                })
            );
        }

        // CSAT RC supports topic-level practice via question classification
        const isRcTopicRequest =
            csatMode &&
            normalizeId(selectedSubjectId) === "csat_rc" &&
            practiceScope === "topic" &&
            selectedTopicId &&
            TOPIC_TO_RC_TYPE[selectedTopicId];

        if (isRcTopicRequest) {
            const rcFiltered = getRcQuestionsForTopic(selectedTopicId);
            if (!rcFiltered.length) {
                return sendBuilderError(
                    res,
                    `No RC questions found for type "${selectedTopicId}". Try a different subtopic.`,
                    { selectedSubjectId, selectedTopicId }
                );
            }
            const finalRc = shuffle(rcFiltered).slice(0, count);
            const { deduped: cleanRc } = validateAndDeduplicateQuestions(finalRc, `rc-${selectedTopicId}`);
            console.log("[BUILDER - RC TOPIC]", {
                topicId: selectedTopicId,
                pool: rcFiltered.length,
                returned: cleanRc.length,
            });
            return res.json(buildSuccessPayload({
                mode: "practice",
                paper: "CSAT",
                scope: "topic",
                year: null,
                questions: cleanRc,
                debug: { rcTopic: selectedTopicId, pool: rcFiltered.length, returned: cleanRc.length },
            }));
        }

        // Other CSAT subjects do not support topic/subtopic-level practice
        if (csatMode && (practiceScope === "topic" || practiceScope === "subtopic")) {
            return sendBuilderError(
                res,
                `CSAT does not support ${practiceScope}-level practice. Please use subject-level practice instead.`,
                {
                    csatMode,
                    requestedScope: practiceScope,
                    availableScopes: ["subject"],
                }
            );
        }

        const topicQuestions = filterTopicStrict(
            subjectQuestions,
            selectedTopicLabel,
            selectedTopicId,
            selectedSubjectId
        );

        if (!topicQuestions.length) {
            console.log("[TOPIC DEBUG]", {
                selectedSubjectId,
                selectedSubjectLabel,
                selectedTopicId,
                selectedTopicLabel,
                topicPool: topicQuestions.length,
                sampleSubjectQuestions: subjectQuestions.slice(0, 5).map((q) => ({
                    section: q.section,
                    microtheme: q.microtheme,
                    module: q.module,
                    subject: q.subject,
                    sourceBase: q.sourceBase,
                })),
            });
            return sendBuilderError(
                res,
                `No questions found for selected topic "${selectedTopicLabel || selectedTopicId}" inside subject "${selectedSubjectLabel || selectedSubjectId}".`,
                {
                    selectedSubjectId,
                    selectedSubjectLabel,
                    selectedTopicId,
                    selectedTopicLabel,
                }
            );
        }

        if (practiceScope === "topic") {
            const finalQuestions = shuffle(topicQuestions).slice(0, count);

            return res.json(
                buildSuccessPayload({
                    mode: "practice",
                    paper: csatMode ? "CSAT" : "GS",
                    scope: "topic",
                    year: null,
                    questions: finalQuestions,
                    debug: {
                        stage: "prelims",
                        paperFilter: csatMode ? "csat" : "gs1",
                        subject: selectedSubjectLabel || selectedSubjectId,
                        topic: selectedTopicLabel || selectedTopicId,
                        pool: topicQuestions.length,
                        returned: finalQuestions.length,
                    },
                })
            );
        }

        const subtopicQuestions = filterSubtopicsStrict(
            topicQuestions,
            selectedMicroThemeLabels,
            selectedMicroThemeIds,
            selectedSubjectId
        );

        if (!subtopicQuestions.length) {
            console.log("[SUBTOPIC DEBUG]", {
                selectedSubjectId,
                selectedTopicId,
                selectedMicroThemeIds,
                selectedMicroThemeLabels,
                subtopicPool: subtopicQuestions.length,
                sampleTopicQuestions: topicQuestions.slice(0, 5).map((q) => ({
                    section: q.section,
                    microtheme: q.microtheme,
                    module: q.module,
                    subject: q.subject,
                    sourceBase: q.sourceBase,
                })),
            });
            return sendBuilderError(
                res,
                `No exact PYQs are tagged for selected subtopic "${selectedMicroThemeLabels[0] || selectedMicroThemeIds[0] || "Unknown"}" under topic "${selectedTopicLabel || selectedTopicId}". Topic-level questions exist, but subtopic-level tagging is not available yet.`,
                {
                    selectedSubjectId,
                    selectedSubjectLabel,
                    selectedTopicId,
                    selectedTopicLabel,
                    selectedMicroThemeIds,
                    selectedMicroThemeLabels,
                }
            );
        }

        const finalQuestions = shuffle(subtopicQuestions).slice(0, count);

        return res.json(
            buildSuccessPayload({
                mode: "practice",
                paper: csatMode ? "CSAT" : "GS",
                scope: "subtopic",
                year: null,
                questions: finalQuestions,
                debug: {
                    stage: "prelims",
                    paperFilter: csatMode ? "csat" : "gs1",
                    subject: selectedSubjectLabel || selectedSubjectId,
                    topic: selectedTopicLabel || selectedTopicId,
                    subtopics: selectedMicroThemeLabels.length
                        ? selectedMicroThemeLabels
                        : selectedMicroThemeIds,
                    pool: subtopicQuestions.length,
                    returned: finalQuestions.length,
                },
            })
        );
    } catch (error) {
        console.error("buildPrelimsPracticeTest error:", error);
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to build prelims practice test",
        });
    }
}