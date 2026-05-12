const fs = require("fs");
const path = require("path");

const FILE = path.join(
    process.cwd(),
    "data/pyq_index/pyq_master_index.json"
);

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const questions = Object.values(raw);

// Expected UPSC pattern
function expectedCounts(year) {
    if (year < 2011) return { GS: 120, CSAT: 0 };
    return { GS: 100, CSAT: 80 };
}

const yearStats = {};

for (const q of questions) {
    const year = q.year ?? "null";

    if (!yearStats[year]) {
        yearStats[year] = {
            GS: 0,
            CSAT: 0,
            TOTAL: 0
        };
    }

    const paper = (q.paper || q.stage || "").toUpperCase();

    if (paper.includes("CSAT")) {
        yearStats[year].CSAT++;
    } else {
        yearStats[year].GS++;
    }

    yearStats[year].TOTAL++;
}

console.log("\n📊 FINAL YEAR-WISE AUDIT\n");
console.log("YEAR | GS | CSAT | TOTAL | EXPECTED | STATUS");
console.log("--------------------------------------------------");

Object.keys(yearStats)
    .filter(y => y !== "null")
    .sort((a, b) => Number(a) - Number(b))
    .forEach(year => {
        const y = Number(year);
        const actual = yearStats[year];
        const expected = expectedCounts(y);

        let status = "OK";

        if (actual.GS !== expected.GS || actual.CSAT !== expected.CSAT) {
            status = "MISMATCH";
        }

        console.log(
            `${year} | ${actual.GS} | ${actual.CSAT} | ${actual.TOTAL} | ${expected.GS}/${expected.CSAT} | ${status}`
        );
    });

// null year
if (yearStats["null"]) {
    console.log("\n⚠ NULL YEAR QUESTIONS:", yearStats["null"].TOTAL);
}

// summary
const total = questions.length;
const totalGS = questions.filter(q => !(q.paper || "").includes("CSAT")).length;
const totalCSAT = questions.filter(q => (q.paper || "").includes("CSAT")).length;

console.log("\n📦 TOTAL SUMMARY");
console.log("Total Questions:", total);
console.log("Total GS:", totalGS);
console.log("Total CSAT:", totalCSAT);