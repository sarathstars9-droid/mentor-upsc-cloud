import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizePyqNodeId } from "../brain/pyqNodeAliasMap.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_PATH = path.resolve(__dirname, "..", "data", "pyq_index", "pyq_master_index.json");
const OUT_PATH = path.resolve(__dirname, "..", "data", "audit", "subject_wise_audit.json");

function normalizeSubject(q) {
    const node = normalizePyqNodeId(
        q.nodeId || q.node_id || q.syllabusNodeId || q.syllabus_node_id || q.topicNodeId || ""
    );

    const raw = String(q.subjectId || q.subject_id || q.subject || "").toLowerCase();

    if (node.startsWith("CSAT")) return "csat";
    if (node.startsWith("GS1-HIS-ANC")) return "ancient_history";
    if (node.startsWith("GS1-HIS-MED")) return "medieval_history";
    if (node.startsWith("GS1-HIS-MOD")) return "modern_history";
    if (node.startsWith("GS1-GEO")) return "geography";
    if (node.startsWith("GS2-POL")) return "indian_polity";
    if (node.startsWith("GS2-IR")) return "international_relations";
    if (node.startsWith("GS3-ECO")) return "economy";
    if (node.startsWith("GS3-ENV")) return "environment";
    if (node.startsWith("GS3-ST")) return "science_tech";
    if (node.startsWith("1C-MISC")) return "current_affairs_misc";

    return raw || "unknown_subject";
}

if (!fs.existsSync(MASTER_PATH)) {
    console.error("❌ Master index not found:", MASTER_PATH);
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(MASTER_PATH, "utf8"));
const questions = Array.isArray(raw) ? raw : raw.questions || raw.items || Object.values(raw);

const audit = {};

for (const q of questions) {
    const subject = normalizeSubject(q);
    const nodeId = normalizePyqNodeId(
        q.nodeId || q.node_id || q.syllabusNodeId || q.syllabus_node_id || q.topicNodeId || ""
    );

    if (!audit[subject]) {
        audit[subject] = {
            subject,
            total: 0,
            years: {},
            nodes: {},
            questionIds: [],
        };
    }

    audit[subject].total += 1;
    audit[subject].questionIds.push(q.id || q.questionId || q.question_id);

    const year = q.year || "unknown_year";
    audit[subject].years[year] = (audit[subject].years[year] || 0) + 1;

    const nodeKey = nodeId || "unknown_node";
    audit[subject].nodes[nodeKey] = (audit[subject].nodes[nodeKey] || 0) + 1;
}

const finalAudit = Object.values(audit)
    .sort((a, b) => b.total - a.total)
    .map((s) => ({
        ...s,
        nodes: Object.entries(s.nodes)
            .sort((a, b) => b[1] - a[1])
            .map(([nodeId, count]) => ({ nodeId, count })),
    }));

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(finalAudit, null, 2), "utf8");

console.log("\n✅ SUBJECT-WISE AUDIT COMPLETE\n");

for (const s of finalAudit) {
    console.log(`${String(s.total).padStart(5)}  ${s.subject}`);
}

console.log("\n📄 Saved:", OUT_PATH);