const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "pyq_papers", "prelims", "2014.json");
const paper = JSON.parse(fs.readFileSync(FILE, "utf8"));

function norm(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/\[2014\]/g, "")
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const qs = paper.questions;

for (let i = 0; i < qs.length; i++) {
    for (let j = i + 1; j < qs.length; j++) {
        const a = norm(qs[i].question);
        const b = norm(qs[j].question);

        const small = a.length < b.length ? a : b;
        const large = a.length < b.length ? b : a;

        if (small.length > 40 && large.includes(small.slice(0, 80))) {
            console.log("\nPossible duplicate:");
            console.log("A:", qs[i].id, "| orig:", qs[i].originalQuestionNumber, "| Q:", qs[i].question.slice(0, 120));
            console.log("B:", qs[j].id, "| orig:", qs[j].originalQuestionNumber, "| Q:", qs[j].question.slice(0, 120));
        }
    }
}