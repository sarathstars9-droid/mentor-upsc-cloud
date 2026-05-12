const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data/pyq_index/pyq_master_index.json");
const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const questions = Object.values(raw);

const fields = [
    "answer",
    "correctAnswer",
    "correct_answer",
    "answerKey",
    "correctOption",
    "correct_option",
    "key",
    "ans"
];

console.log("Total:", questions.length);

for (const f of fields) {
    const count = questions.filter(q => q[f] !== undefined && q[f] !== null && String(q[f]).trim() !== "").length;
    console.log(`${f}: ${count}`);
}

console.log("\nSample first 5 answer-related fields:\n");

questions.slice(0, 5).forEach(q => {
    console.log("ID:", q.id);
    for (const f of fields) {
        if (q[f] !== undefined) console.log(`  ${f}:`, q[f]);
    }
    console.log("  keys:", Object.keys(q).join(", "));
    console.log("---");
});