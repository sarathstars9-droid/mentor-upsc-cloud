import { loadAllPrelimsQuestions } from "../loaders/prelimsUnifiedLoader.js";
import { getQuestionsByNodeId } from "../brain/nodeIdTopicEngine.js";

const { questions } = loadAllPrelimsQuestions();

const byNode = {};

for (const q of questions) {
    const nodeId = q.nodeId || q.syllabusNodeId;
    if (!nodeId) continue;
    byNode[nodeId] = (byNode[nodeId] || 0) + 1;
}

console.log("\nNODEID TOPIC ENGINE AUDIT\n");

let totalNodes = 0;
let matchedNodes = 0;
let mismatches = 0;

for (const [nodeId, expected] of Object.entries(byNode)) {
    totalNodes++;

    const result = getQuestionsByNodeId({
        nodeId,
        subjectId: "",
        fallbackPool: questions,
    });

    const actual = result.questions.length;

    if (actual === expected) {
        matchedNodes++;
    } else {
        mismatches++;
        console.log("[MISMATCH]", {
            nodeId,
            expected,
            actual,
            source: result.source,
        });
    }
}

console.log("\nSUMMARY");
console.log({
    totalNodes,
    matchedNodes,
    mismatches,
    status: mismatches === 0 ? "PASS" : "FAIL",
});