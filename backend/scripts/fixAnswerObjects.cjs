const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "pyq_index", "pyq_master_index.json");
const OUT = path.join(process.cwd(), "data", "pyq_index", "pyq_master_index_fixed.json");

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const questions = Object.values(raw);

function normalize(ans) {
    if (ans === undefined || ans === null) return null;

    if (typeof ans === "string") {
        const clean = ans.trim().toUpperCase().replace(/[().]/g, "");
        return ["A", "B", "C", "D"].includes(clean) ? clean : null;
    }

    if (typeof ans === "object") {
        const keys = [
            "correct_option",
            "correctOption",
            "correct_answer",
            "correctAnswer",
            "answer",
            "option",
            "key",
            "value",
        ];

        for (const k of keys) {
            if (ans[k]) {
                const clean = String(ans[k]).trim().toUpperCase().replace(/[().]/g, "");
                if (["A", "B", "C", "D"].includes(clean)) return clean;
            }
        }
    }

    return null;
}

let fixedCount = 0;
let availableCount = 0;
let missingCount = 0;

const fixed = {};

for (const q of questions) {
    const oldAnswer = q.answer;
    const newAnswer = normalize(oldAnswer);

    if (newAnswer) availableCount++;
    else missingCount++;

    if (oldAnswer !== newAnswer) fixedCount++;

    fixed[q.id] = {
        ...q,
        answer: newAnswer,
        answerMeta:
            oldAnswer && typeof oldAnswer === "object"
                ? oldAnswer
                : q.answerMeta || null,
    };
}

fs.writeFileSync(OUT, JSON.stringify(fixed, null, 2), "utf8");

console.log("✅ FIX COMPLETE");
console.log("Total questions:", questions.length);
console.log("Fixed/normalized answers:", fixedCount);
console.log("Available answers:", availableCount);
console.log("Missing answers:", missingCount);
console.log("Saved to:", OUT);