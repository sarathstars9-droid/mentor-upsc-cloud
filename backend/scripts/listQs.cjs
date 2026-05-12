const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data/pyq_index/pyq_master_index.json");

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const questions = Object.values(raw);

const year = 2014;

const qs = questions
    .filter(q => q.year === year && !(q.paper || "").includes("CSAT"))
    .map(q => Number(q.questionNumber))
    .filter(Boolean)
    .sort((a, b) => a - b);

console.log("Present Q numbers:\n");
console.log(qs);