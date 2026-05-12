const fs = require("fs");
const path = require("path");

const YEAR = 2014;
const URL = "https://www.upscprep.com/untitled-2/";

const MASTER = path.join(process.cwd(), "data", "pyq_index", "pyq_master_index.json");
const OUT = path.join(process.cwd(), "data", "audit", "missing_2014_from_web.json");

function norm(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .trim()
        .slice(0, 140);
}

function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, "\n")
        .replace(/&nbsp;/g, " ")
        .replace(/&#8217;/g, "'")
        .replace(/&#8216;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/\n+/g, "\n");
}

function parseQuestions(text) {
    const blocks = text.split(/\n\s*(\d{1,3})\.\)/g);
    const questions = [];

    for (let i = 1; i < blocks.length; i += 2) {
        const qNo = Number(blocks[i]);
        const body = blocks[i + 1] || "";

        if (!qNo || qNo < 1 || qNo > 100) continue;

        const ansMatch = body.match(/Ans:\s*([A-D])/i);
        const answer = ansMatch ? ansMatch[1].toUpperCase() : null;

        const beforeAns = body.split(/Ans:/i)[0];

        const optionMatch = beforeAns.match(
            /([\s\S]*?)\na\)\s*([\s\S]*?)\nb\)\s*([\s\S]*?)\nc\)\s*([\s\S]*?)\nd\)\s*([\s\S]*)/i
        );

        let question = beforeAns.trim();
        let options = { A: "", B: "", C: "", D: "" };

        if (optionMatch) {
            question = optionMatch[1].trim();
            options = {
                A: optionMatch[2].trim(),
                B: optionMatch[3].trim(),
                C: optionMatch[4].trim(),
                D: optionMatch[5].trim(),
            };

            for (const k of Object.keys(options)) {
                options[k] = options[k]
                    .split(/\nSubject:/i)[0]
                    .split(/\nTopic:/i)[0]
                    .replace(/\s+/g, " ")
                    .trim();
            }
        }

        question = question.replace(/\s+/g, " ").trim();

        questions.push({
            id: `OFFICIAL_GS_${YEAR}_Q${qNo}`,
            year: YEAR,
            paper: "GS",
            questionNumber: qNo,
            question,
            options,
            answer,
            nodeId: null,
            source: URL
        });
    }

    return questions;
}

async function main() {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });

    const masterRaw = JSON.parse(fs.readFileSync(MASTER, "utf8"));
    const existing = Object.values(masterRaw).filter(q => {
        const paperText = [q.paper, q.stage, q.subject, q.id, q.sourceFile].join(" ").toLowerCase();
        return Number(q.year) === YEAR && !paperText.includes("csat");
    });

    const existingKeys = new Set(existing.map(q => norm(q.question)));

    const html = await fetch(URL).then(r => r.text());
    const text = stripHtml(html);
    const official = parseQuestions(text);

    const missing = official.filter(q => !existingKeys.has(norm(q.question)));

    fs.writeFileSync(OUT, JSON.stringify({
        year: YEAR,
        officialCount: official.length,
        existingCount: existing.length,
        missingCount: missing.length,
        warning: "Questions with image/table content may need manual verification from official UPSC PDF.",
        missing
    }, null, 2));

    console.log("Official parsed:", official.length);
    console.log("Existing in master:", existing.length);
    console.log("Missing candidates:", missing.length);
    console.log("Saved:", OUT);

    console.log("\nMissing Q numbers:");
    console.log(missing.map(q => q.questionNumber));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});