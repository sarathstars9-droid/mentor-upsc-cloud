import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(
    __dirname,
    "../data/pyq_questions/prelims/csat/prelims_csat_rc_tagged.json"
);

const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

import { classifyRcQuestion } from "../engines/classifyRcQuestion.js";

const mixed = data.questions.filter(q => classifyRcQuestion(q.question || "") === "MIXED");

console.log("Total MIXED:", mixed.length);

mixed.slice(0, 20).forEach(q => {
    console.log("\n--------------------");
    console.log(q.id);
    console.log(q.question);
});