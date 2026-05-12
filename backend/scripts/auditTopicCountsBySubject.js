import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizePyqNodeId } from "../brain/pyqNodeAliasMap.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ CORRECT PATH (your system)
const MASTER_PATH = path.join(
    __dirname,
    "../data/pyq_index/pyq_master_index.json"
);

const OUT_PATH = path.join(
    __dirname,
    "../data/audit_topic_counts_by_subject.json"
);

// ---------- LOAD DATA ----------
if (!fs.existsSync(MASTER_PATH)) {
    console.error("❌ Master index not found at:", MASTER_PATH);
    process.exit(1);
}

console.log("✅ Using master index:", MASTER_PATH);

const raw = JSON.parse(fs.readFileSync(MASTER_PATH, "utf8"));

const questions = Array.isArray(raw)
    ? raw
    : raw.questions || raw.items || Object.values(raw);

// ---------- BUILD AUDIT ----------
const audit = {};

for (const q of questions) {
    const subject =
        q.subjectId ||
        q.subject_id ||
        q.subject ||
        q.paper ||
        "unknown_subject";

    const rawNodeId =
        q.nodeId ||
        q.node_id ||
        q.syllabusNodeId ||
        q.syllabus_node_id ||
        q.topicNodeId ||
        "unknown_node";

    const nodeId = normalizePyqNodeId(rawNodeId);

    const topic =
        q.topic ||
        q.topicName ||
        q.microTheme ||
        q.microtheme ||
        q.subtopic ||
        q.label ||
        nodeId ||
        "unknown_topic";

    if (!audit[subject]) audit[subject] = {};

    const key = `${topic}__${nodeId}`;

    if (!audit[subject][key]) {
        audit[subject][key] = {
            subject,
            topic,
            nodeId,
            count: 0,
            years: {},
            questionIds: [],
        };
    }

    audit[subject][key].count += 1;

    const year = q.year || "unknown_year";
    audit[subject][key].years[year] =
        (audit[subject][key].years[year] || 0) + 1;

    audit[subject][key].questionIds.push(
        q.id || q.questionId || q.question_id
    );
}

// ---------- FORMAT OUTPUT ----------
const finalAudit = {};

for (const [subject, topics] of Object.entries(audit)) {
    finalAudit[subject] = Object.values(topics).sort(
        (a, b) => b.count - a.count
    );
}

// ---------- SAVE FILE ----------
fs.writeFileSync(OUT_PATH, JSON.stringify(finalAudit, null, 2), "utf8");

// ---------- PRINT SUMMARY ----------
console.log("\n==============================");
console.log("✅ TOPIC COUNT AUDIT COMPLETE");
console.log("==============================");

for (const [subject, topics] of Object.entries(finalAudit)) {
    const total = topics.reduce((sum, t) => sum + t.count, 0);

    console.log(`\n📚 ${subject} — ${total} questions`);
    console.log("--------------------------------");

    for (const t of topics) {
        console.log(
            `${String(t.count).padStart(4)}  ${t.topic}  [${t.nodeId}]`
        );
    }
}

console.log(`\n📄 Saved audit file: ${OUT_PATH}`);