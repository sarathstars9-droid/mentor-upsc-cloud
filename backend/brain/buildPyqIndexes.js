import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve("data");
const QUESTIONS_DIR = path.join(DATA_DIR, "pyq_questions");
const INDEX_DIR = path.join(DATA_DIR, "pyq_index");

function readJson(filePath, fallback = null) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
        return fallback;
    }
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function getQuestionsArray(fileData) {
    if (Array.isArray(fileData)) return fileData;
    if (fileData && Array.isArray(fileData.questions)) return fileData.questions;
    return [];
}

function detectBucket(q) {
    const stage = String(q.stage || "").toLowerCase();
    const paper = String(q.paper || "").toLowerCase();
    const subject = String(q.subject || "").toLowerCase();

    if (paper.includes("essay") || subject.includes("essay")) return "essay";
    if (paper.includes("ethics") || subject.includes("ethics")) return "ethics";
    if (paper.includes("csat") || subject.includes("csat")) return "csat";
    if (paper.includes("optional") || subject.includes("optional")) return "optional";

    if (stage.includes("prelim")) return "prelims";
    if (stage.includes("main")) return "mains";

    return "prelims";
}

function getNodeIds(q) {
    const ids = [];

    if (q.syllabusNodeId) ids.push(q.syllabusNodeId);
    if (q.primaryNodeId) ids.push(q.primaryNodeId);

    if (Array.isArray(q.allNodeIds)) {
        for (const id of q.allNodeIds) {
            if (id) ids.push(id);
        }
    }

    return [...new Set(ids.filter(Boolean))];
}

function main() {
    const files = fs
        .readdirSync(QUESTIONS_DIR)
        .filter((name) => name.endsWith(".json"));

    const pyqMaster = {};
    const pyqByNode = {};
    const pyqBySubject = {};
    const pyqByStage = {};

    for (const file of files) {
        const filePath = path.join(QUESTIONS_DIR, file);
        const fileData = readJson(filePath, null);
        const questions = getQuestionsArray(fileData);

        for (const q of questions) {
            if (!q?.id) continue;

            const bucket = detectBucket(q);
            const nodeIds = getNodeIds(q);
            const subject = q.subject || "Unknown";
            const stage = q.stage || "Unknown";

            pyqMaster[q.id] = {
                file,
                stage,
                subject,
                year: q.year ?? null,
                questionType: q.questionType || null
            };

            if (!pyqBySubject[subject]) pyqBySubject[subject] = [];
            pyqBySubject[subject].push(q.id);

            if (!pyqByStage[stage]) pyqByStage[stage] = [];
            pyqByStage[stage].push(q.id);

            for (const nodeId of nodeIds) {
                if (!pyqByNode[nodeId]) {
                    pyqByNode[nodeId] = {
                        prelims: [],
                        mains: [],
                        essay: [],
                        ethics: [],
                        optional: [],
                        csat: []
                    };
                }

                pyqByNode[nodeId][bucket].push(q.id);
            }
        }
    }

    writeJson(path.join(INDEX_DIR, "pyq_master_index.json"), pyqMaster);
    writeJson(path.join(INDEX_DIR, "pyq_by_node.json"), pyqByNode);
    writeJson(path.join(INDEX_DIR, "pyq_by_subject.json"), pyqBySubject);
    writeJson(path.join(INDEX_DIR, "pyq_by_stage.json"), pyqByStage);

    console.log("PYQ indexes built successfully.");
    console.log("Files written:");
    console.log("- pyq_master_index.json");
    console.log("- pyq_by_node.json");
    console.log("- pyq_by_subject.json");
    console.log("- pyq_by_stage.json");
}

main();