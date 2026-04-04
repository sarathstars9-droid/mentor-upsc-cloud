import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSAT_DIR = path.resolve(__dirname, "../pyq_questions/prelims/csat");

function readJson(fileName) {
    const fullPath = path.join(CSAT_DIR, fileName);

    if (!fs.existsSync(fullPath)) {
        throw new Error(`CSAT source file not found: ${fullPath}`);
    }

    const raw = fs.readFileSync(fullPath, "utf-8");
    return JSON.parse(raw);
}

function normalizeQuestions(payload, expectedModule) {
    const questions = Array.isArray(payload?.questions) ? payload.questions : [];

    return questions.map((q) => ({
        ...q,
        exam: q.exam || payload.exam || "UPSC_CSE",
        stage: q.stage || payload.stage || "Prelims",
        paper: q.paper || payload.paper || "CSAT",
        subject: q.subject || payload.subject || "CSAT",
        module: q.module || payload.module || expectedModule,
    }));
}

export function loadCSATData() {
    const quantPayload = readJson("prelims_csat_quant_tagged.json");
    const lrPayload = readJson("prelims_csat_lr_tagged.json");
    const rcPayload = readJson("prelims_csat_rc_tagged.json");

    const quant = normalizeQuestions(quantPayload, "Quantitative Aptitude");
    const lr = normalizeQuestions(lrPayload, "Logical Reasoning");
    const rc = normalizeQuestions(rcPayload, "Reading Comprehension");

    return {
        quant,
        lr,
        rc,
    };
}

export function getCSATCounts() {
    const { quant, lr, rc } = loadCSATData();

    return {
        quant: quant.length,
        lr: lr.length,
        rc: rc.length,
        total: quant.length + lr.length + rc.length,
    };
}