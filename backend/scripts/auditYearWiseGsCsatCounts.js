import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizePyqNodeId } from "../brain/pyqNodeAliasMap.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_PATH = path.resolve(__dirname, "..", "data", "pyq_index", "pyq_master_index.json");
const OUT_PATH = path.resolve(__dirname, "..", "data", "audit", "year_wise_gs_csat_audit.json");

if (!fs.existsSync(MASTER_PATH)) {
    console.error("❌ Master index not found:", MASTER_PATH);
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(MASTER_PATH, "utf8"));
const questions = Array.isArray(raw)
    ? raw
    : raw.questions || raw.items || Object.values(raw);

function getStageGroup(q) {
    const nodeId = normalizePyqNodeId(
        q.nodeId ||
        q.node_id ||
        q.syllabusNodeId ||
        q.syllabus_node_id ||
        q.topicNodeId ||
        ""
    );

    const subject = String(q.subject || q.subjectId || "").toLowerCase();
    const paper = String(q.paper || q.paperId || "").toLowerCase();
    const id = String(q.id || q.questionId || "").toLowerCase();

    if (
        nodeId.startsWith("CSAT") ||
        subject.includes("csat") ||
        paper.includes("csat") ||
        id.includes("csat")
    ) {
        return "csat";
    }

    return "gs";
}

const audit = {};

for (const q of questions) {
    const year = String(q.year || "unknown_year");
    const group = getStageGroup(q);
    const id = q.id || q.questionId || q.question_id || "";

    if (!audit[year]) {
        audit[year] = {
            year,
            gs: 0,
            csat: 0,
            total: 0,
            gsQuestionIds: [],
            csatQuestionIds: [],
        };
    }

    audit[year][group] += 1;
    audit[year].total += 1;

    if (group === "gs") audit[year].gsQuestionIds.push(id);
    if (group === "csat") audit[year].csatQuestionIds.push(id);
}

const finalAudit = Object.values(audit).sort((a, b) => {
    if (a.year === "unknown_year") return 1;
    if (b.year === "unknown_year") return -1;
    return Number(a.year) - Number(b.year);
});

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(finalAudit, null, 2), "utf8");

console.log("\n✅ YEAR-WISE GS + CSAT AUDIT COMPLETE\n");
console.log("YEAR   GS   CSAT   TOTAL");
console.log("-------------------------");

for (const y of finalAudit) {
    console.log(
        `${String(y.year).padEnd(6)} ${String(y.gs).padStart(3)}  ${String(y.csat).padStart(5)}  ${String(y.total).padStart(5)}`
    );
}

console.log("\n📄 Saved:", OUT_PATH);