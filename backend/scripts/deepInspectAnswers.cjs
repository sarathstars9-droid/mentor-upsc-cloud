const fs = require("fs");
const path = require("path");

const FILE = path.join(
    process.cwd(),
    "data/pyq_index/pyq_master_index.json"
);

const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
const questions = Object.values(raw);

console.log("\n🔍 Inspecting OBJECT answers...\n");

let count = 0;

for (const q of questions) {
    if (q.answer && typeof q.answer === "object") {
        console.log("ID:", q.id);
        console.log("ANSWER OBJECT:", JSON.stringify(q.answer, null, 2));
        console.log("------\n");

        count++;
        if (count >= 10) break;
    }
}

console.log("Total object answers found:", count);