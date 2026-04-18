#!/usr/bin/env node

const fs = require("fs");

const filePath = process.argv[2];
if (!filePath) {
    console.error("Usage: node backend/scripts/auditCsatCoverage.cjs <path-to-csat_master_clean.json>");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
const questions = Array.isArray(data.questions) ? data.questions : [];

const EXPECTED = {};
for (let y = 2011; y <= 2025; y++) {
    EXPECTED[y] = { total: 80 };
}
EXPECTED[2025] = { total: 80, Quant: 30, Reasoning: 21, Comprehension: 29 };

const byYear = {};
for (const q of questions) {
    if (!byYear[q.year]) {
        byYear[q.year] = {
            found: 0,
            Quant: 0,
            Reasoning: 0,
            Comprehension: 0,
        };
    }
    byYear[q.year].found += 1;
    byYear[q.year][q.section] += 1;
}

const report = {};
for (let year = 2011; year <= 2025; year++) {
    const found = byYear[year] || {
        found: 0,
        Quant: 0,
        Reasoning: 0,
        Comprehension: 0,
    };

    report[year] = {
        expectedTotal: EXPECTED[year].total,
        foundTotal: found.found,
        missingTotal: EXPECTED[year].total - found.found,
        foundBreakup: {
            Quant: found.Quant,
            Reasoning: found.Reasoning,
            Comprehension: found.Comprehension,
        },
    };

    if (year === 2025) {
        report[year].expectedBreakup = {
            Quant: 30,
            Reasoning: 21,
            Comprehension: 29,
        };
        report[year].missingBreakup = {
            Quant: 30 - found.Quant,
            Reasoning: 21 - found.Reasoning,
            Comprehension: 29 - found.Comprehension,
        };
    }
}

console.log(JSON.stringify(report, null, 2));