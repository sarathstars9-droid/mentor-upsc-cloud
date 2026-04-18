#!/usr/bin/env node

const fs = require("fs");

const filePath = process.argv[2];
if (!filePath) {
    console.error("Usage: node backend/scripts/validateCsatMaster.js <path-to-csat_master_clean.json>");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
const questions = data.questions || [];

const byYear = {};
for (const q of questions) {
    if (!byYear[q.year]) {
        byYear[q.year] = { total: 0, Quant: 0, Reasoning: 0, Comprehension: 0 };
    }
    byYear[q.year].total++;
    byYear[q.year][q.section]++;
}

console.log(JSON.stringify(byYear, null, 2));

const problems = [];
for (const [year, stats] of Object.entries(byYear)) {
    const y = Number(year);

    if (y === 2025) {
        if (stats.total !== 80) problems.push(`2025 total should be 80, found ${stats.total}`);
        if (stats.Quant !== 30) problems.push(`2025 Quant should be 30, found ${stats.Quant}`);
        if (stats.Reasoning !== 21) problems.push(`2025 Reasoning should be 21, found ${stats.Reasoning}`);
        if (stats.Comprehension !== 29) problems.push(`2025 Comprehension should be 29, found ${stats.Comprehension}`);
    }
}

if (problems.length) {
    console.error("\nProblems found:");
    for (const p of problems) console.error("-", p);
    process.exit(2);
}

console.log("\nValidation passed.");