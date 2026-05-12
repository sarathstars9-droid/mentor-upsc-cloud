const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data/pyq_index/pyq_master_index.json");
const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const questions = Object.values(raw);

// change year here if needed
const year = 2014;

const qs = questions.filter(q =>
    q.year === year && !(q.paper || "").includes("CSAT")
);

// unique by normalized text
const normalizeText = (text) =>
    (text || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .trim()
        .slice(0, 120);

const uniqueSet = new Set(qs.map(q => normalizeText(q.question)));

console.log("YEAR:", year);
console.log("Total records:", qs.length);
console.log("Unique questions:", uniqueSet.size);

// optional: show duplicates
const seen = {};
const duplicates = [];

for (const q of qs) {
    const key = normalizeText(q.question);

    if (seen[key]) {
        duplicates.push({
            id1: seen[key].id,
            id2: q.id,
            preview: key.slice(0, 80)
        });
    } else {
        seen[key] = q;
    }
}

console.log("Duplicate pairs found:", duplicates.length);

if (duplicates.length > 0) {
    console.log("\nSample duplicates:");
    duplicates.slice(0, 5).forEach(d => {
        console.log(d);
    });
}