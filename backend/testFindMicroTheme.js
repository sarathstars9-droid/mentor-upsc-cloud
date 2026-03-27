import { mapPlanItemToMicroTheme } from "./brain/findMicroTheme.js";

const tests = [
    ["Monsoon", "Geography"],
    ["Inflation", "Economy"],
    ["Fundamental Rights", "Polity"],
    ["Biotechnology", "Science and Tech"]
];

for (const [topic, subject] of tests) {
    console.log("\n==============================");
    console.log("TOPIC:", topic);
    console.log("SUBJECT:", subject);
    console.dir(mapPlanItemToMicroTheme(topic, subject), { depth: 3 });
}