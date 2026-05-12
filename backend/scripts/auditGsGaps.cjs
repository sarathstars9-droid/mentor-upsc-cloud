const fs = require("fs");
const path = require("path");

const FILE = path.join(
    process.cwd(),
    "data/pyq_index/pyq_master_index.json"
);

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const questions = Object.values(raw);

const gsByYear = {};

for (const q of questions) {
    if ((q.paper || "").includes("CSAT")) continue;

    const year = q.year;
    if (!year) continue;

    gsByYear[year] = (gsByYear[year] || 0) + 1;
}

console.log("\n📊 GS GAP REPORT\n");
console.log("YEAR | GS | TARGET | GAP");

Object.keys(gsByYear)
    .sort((a, b) => a - b)
    .forEach(year => {
        const gs = gsByYear[year];

        let target = year < 2011 ? 120 : 100;

        const gap = gs - target;

        console.log(`${year} | ${gs} | ${target} | ${gap}`);
    });