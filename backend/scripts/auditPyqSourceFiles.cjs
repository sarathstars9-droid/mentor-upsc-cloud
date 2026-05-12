const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "data", "pyq_questions_v2");

function walk(dir) {
    let out = [];
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) out.push(...walk(full));
        else if (name.endsWith(".json")) out.push(full);
    }
    return out;
}

function getQuestions(json) {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.questions)) return json.questions;
    if (json.data?.questions && Array.isArray(json.data.questions)) return json.data.questions;
    if (Array.isArray(json.data)) return json.data;
    return [];
}

function hasAnswer(q) {
    return !!(q.answer || q.correctAnswer || q.correct_answer || q.answerKey);
}

const files = walk(ROOT);

console.log("TOTAL FILES:", files.length);

for (const file of files) {
    let json;
    try {
        json = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        continue;
    }

    const qs = getQuestions(json);
    if (!qs.length) continue;

    const withAns = qs.filter(hasAnswer).length;
    const rel = path.relative(process.cwd(), file);

    console.log(`${rel} | total=${qs.length} | withAnswer=${withAns}`);
}