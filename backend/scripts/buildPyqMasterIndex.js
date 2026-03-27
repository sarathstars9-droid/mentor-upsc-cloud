import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_DIR = path.join(__dirname, "..");
const PYQ_QUESTIONS_DIR = path.join(BACKEND_DIR, "data", "pyq_questions");
const OUTPUT_DIR = path.join(BACKEND_DIR, "data", "pyq_index");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "pyq_master_index.json");

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

function build() {
    const files = walkTaggedJsonFiles(PYQ_QUESTIONS_DIR);

    const masterIndex = {};
    let total = 0;

    for (const file of files) {
        const data = readJSON(file);

        let questions = [];
        if (Array.isArray(data)) {
            questions = data;
        } else if (data && Array.isArray(data.questions)) {
            questions = data.questions;
        } else {
            continue;
        }

        for (const q of questions) {
            const id = String(q.id || q.question_id || "").trim();
            if (!id) continue;

            masterIndex[id] = {
                id,
                year: q.year || "",
                subject: q.subject || "",
                topic: q.topic || "",

                // 🔥 MAIN FIX
                question: q.question || q.questionText || "",
                options: q.options || [],
                answer: q.answer || "",
                explanation: q.explanation || "",

                // optional
                type: q.type || "",
                paper: q.paper || q.exam || ""
            };

            total++;
        }
    }

    writeJSON(OUTPUT_FILE, masterIndex);

    console.log("✅ MASTER INDEX BUILT");
    console.log("Total questions:", total);
    console.log("Output:", OUTPUT_FILE);
}

build();