import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_DIR = path.join(__dirname, "..");
const PYQ_QUESTIONS_DIR = path.join(BACKEND_DIR, "data", "pyq_questions");
const OUTPUT_DIR = path.join(BACKEND_DIR, "data", "pyq_index");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "pyq_by_node.json");

function readJSON(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJSON(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function walkTaggedJsonFiles(dir) {
    const results = [];

    function walk(currentDir) {
        if (!fs.existsSync(currentDir)) return;

        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile() && entry.name.endsWith("_tagged.json")) {
                results.push(fullPath);
            }
        }
    }

    walk(dir);
    return results;
}

function getBucketFromQuestion(question = {}) {
    const qid = String(question.id || question.question_id || "").trim();
    const exam = String(question.exam || "").trim().toLowerCase();
    const stage = String(question.stage || "").trim().toLowerCase();
    const paper = String(question.paper || "").trim().toLowerCase();

    // 1. strongest signal: explicit exam/stage metadata
    if (exam === "mains" || stage === "mains") return "mains";
    if (exam === "prelims" || stage === "prelims") return "prelims";
    if (exam === "essay" || stage === "essay") return "essay";
    if (exam === "ethics" || stage === "ethics") return "ethics";
    if (exam === "optional" || stage === "optional") return "optional";
    if (exam === "csat" || stage === "csat") return "csat";

    // 2. infer from paper if needed
    if (paper === "gs4") return "ethics";
    if (paper === "essay") return "essay";
    if (paper.includes("optional")) return "optional";
    if (paper === "csat") return "csat";

    // 3. fallback to id prefix
    // 3. fallback to id pattern (VERY IMPORTANT FIX)
    if (/^(PRE|PRELIMS)_/i.test(qid)) return "prelims";

    // 👉 NEW: detect GS mains pattern
    if (/^GS\d/i.test(qid)) return "mains";

    if (/^(MAINS|MAIN)_/i.test(qid)) return "mains";
    if (/^ESSAY_/i.test(qid)) return "essay";
    if (/^ETHICS_/i.test(qid)) return "ethics";
    if (/^(OPT|OPTIONAL)_/i.test(qid)) return "optional";
    if (/^CSAT_/i.test(qid)) return "csat";

    return null;
}

function createEmptyBuckets() {
    return {
        prelims: [],
        mains: [],
        essay: [],
        ethics: [],
        optional: [],
        csat: []
    };
}

function normalizeNodeIds(question) {
    const raw =
        question.syllabusNodeId ??
        question.syllabus_node_id ??
        question.syllabusNodeIds ??
        question.syllabus_node_ids ??
        question.nodeId ??
        question.node_id ??
        question.nodeIds ??
        question.node_ids ??
        [];

    if (Array.isArray(raw)) {
        return raw.map((x) => String(x).trim()).filter(Boolean);
    }

    if (typeof raw === "string" && raw.trim()) {
        return [raw.trim()];
    }

    return [];
}

function ensureNode(index, nodeId) {
    if (!index[nodeId]) {
        index[nodeId] = createEmptyBuckets();
    }
}

function pushUnique(arr, value) {
    if (!arr.includes(value)) {
        arr.push(value);
    }
}

function sortBuckets(index) {
    const sortedNodeIds = Object.keys(index).sort();
    const finalIndex = {};

    for (const nodeId of sortedNodeIds) {
        finalIndex[nodeId] = {
            prelims: [...index[nodeId].prelims].sort(),
            mains: [...index[nodeId].mains].sort(),
            essay: [...index[nodeId].essay].sort(),
            ethics: [...index[nodeId].ethics].sort(),
            optional: [...index[nodeId].optional].sort(),
            csat: [...index[nodeId].csat].sort()
        };
    }

    return finalIndex;
}

function rebuild() {
    const files = walkTaggedJsonFiles(PYQ_QUESTIONS_DIR);

    const index = {};
    let totalQuestions = 0;
    let mappedQuestions = 0;
    let skippedNoBucket = 0;
    let skippedNoNode = 0;
    let skippedNoId = 0;

    for (const file of files) {
        const data = readJSON(file);

        let questions = [];
        if (Array.isArray(data)) {
            questions = data;
        } else if (data && Array.isArray(data.questions)) {
            questions = data.questions;
        } else {
            console.warn(`⚠ Skipping non-question file: ${file}`);
            continue;
        }

        for (const question of questions) {
            totalQuestions++;

            const qid = String(question.id || question.question_id || "").trim();
            if (!qid) {
                skippedNoId++;
                continue;
            }

            const bucket = getBucketFromQuestion(question);
            if (String(question.id || "").includes("GS3_ENV_2024_01")) {
                console.log("DEBUG_ENV_BUCKET", {
                    id: question.id,
                    exam: question.exam,
                    stage: question.stage,
                    paper: question.paper,
                    bucket
                });
            }
            if (!bucket) {
                skippedNoBucket++;
                continue;
            }

            const nodeIds = normalizeNodeIds(question);
            if (!nodeIds.length) {
                skippedNoNode++;
                continue;
            }

            for (const nodeId of nodeIds) {
                ensureNode(index, nodeId);
                pushUnique(index[nodeId][bucket], qid);
            }

            mappedQuestions++;
        }
    }

    const finalIndex = sortBuckets(index);
    writeJSON(OUTPUT_FILE, finalIndex);

    console.log("✅ Rebuild complete");
    console.log("Tagged files:", files.length);
    console.log("Total questions:", totalQuestions);
    console.log("Mapped questions:", mappedQuestions);
    console.log("Skipped (no id):", skippedNoId);
    console.log("Skipped (unknown bucket):", skippedNoBucket);
    console.log("Skipped (no node ids):", skippedNoNode);
    console.log("Nodes created:", Object.keys(finalIndex).length);
    console.log("Output:", OUTPUT_FILE);
}

rebuild();