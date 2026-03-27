import fs from "fs";

const inputPath = "backend/data/mains_gs2_polity.json";
const outputPath = "backend/data/mains_gs2_polity_tagged.json";

function mapPolityNode(q) {
    const theme = (q.theme || "").toLowerCase();
    const text = (q.question || "").toLowerCase();

    if (theme.includes("legislature")) return "GS2-POL-PARL";
    if (theme.includes("judiciary")) return "GS2-POL-JUD";
    if (theme.includes("fundamental rights")) return "GS2-POL-FR";
    if (theme.includes("directive principles")) return "GS2-POL-DPSP";
    if (theme.includes("centre-state")) return "GS2-POL-CSREL";
    if (theme.includes("preamble")) return "GS2-POL-PREAMBLE";
    if (theme.includes("executive")) return "GS2-POL-EXEC";

    if (text.includes("basic structure")) return "GS2-POL-DOCTRINES";
    if (text.includes("election")) return "GS2-POL-ELECTIONS";
    if (text.includes("panchayat")) return "GS2-POL-LOCAL";

    return "GS2-POL-CONTEMP";
}

const raw = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

const tagged = raw.questions.map(q => ({
    ...q,
    syllabusNodeId: mapPolityNode(q)
}));

fs.writeFileSync(
    outputPath,
    JSON.stringify({ ...raw, questions: tagged }, null, 2)
);

console.log("✅ Polity tagging complete");