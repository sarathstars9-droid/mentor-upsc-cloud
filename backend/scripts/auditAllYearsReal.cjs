const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data/pyq_index/pyq_master_index.json");

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const questions = Object.values(raw);

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .trim()
        .slice(0, 160);
}

const yearMap = {};

for (const q of questions) {
    if ((q.paper || "").includes("CSAT")) continue;

    const year = q.year || "null";

    if (!yearMap[year]) {
        yearMap[year] = {
            total: 0,
            set: new Set()
        };
    }

    yearMap[year].total++;

    const key = normalizeText(q.question);
    if (key) yearMap[year].set.add(key);
}

console.log("\n📊 REAL GS AUDIT (TEXT BASED)\n");
console.log("YEAR | TOTAL | UNIQUE | DUPLICATES");

Object.keys(yearMap)
    .filter(y => y !== "null")
    .sort((a, b) => a - b)
    .forEach(year => {
        const total = yearMap[year].total;
        const unique = yearMap[year].set.size;
        const dup = total - unique;

        console.log(`${year} | ${total} | ${unique} | ${dup}`);
    });