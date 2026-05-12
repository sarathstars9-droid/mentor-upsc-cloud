const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "pyq_index", "pyq_master_index.json");

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const questions = Object.values(raw);

function isCSAT(q) {
    const text = [
        q.paper,
        q.stage,
        q.subject,
        q.module,
        q.id,
        q.sourceFile
    ].join(" ").toLowerCase();

    return text.includes("csat");
}

const list = questions
    .filter(q => Number(q.year) === 2014 && !isCSAT(q))
    .sort((a, b) => (a.questionNumber || 999) - (b.questionNumber || 999));

console.log(`\n📘 2014 GS AVAILABLE QUESTIONS (${list.length})\n`);

list.forEach((q, i) => {
    console.log(`\n==============================`);
    console.log(`Q${i + 1} (orig: ${q.questionNumber || "NA"})`);
    console.log(`ID: ${q.id}`);
    console.log(`\n${q.question}\n`);

    if (q.options) {
        console.log(`A. ${q.options.A || ""}`);
        console.log(`B. ${q.options.B || ""}`);
        console.log(`C. ${q.options.C || ""}`);
        console.log(`D. ${q.options.D || ""}`);
    }

    console.log(`\n✅ Answer: ${q.answer}`);
});

console.log(`\n==============================`);
console.log(`TOTAL: ${list.length}`);