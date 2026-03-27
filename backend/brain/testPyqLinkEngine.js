import { getPyqsForTopic, getPyqsForBlock } from "./pyqLinkEngine.js";

console.log("TEST FILE STARTED");

const byTopic = getPyqsForTopic("GS3-ECO-PRE-BOP", 10);
console.log("=== TEST: getPyqsForTopic ===");
console.log(JSON.stringify(byTopic, null, 2));

const fakeBlock = {
    primaryNodeId: "GS3-ECO-PRE-BOP"
};

const byBlock = getPyqsForBlock(fakeBlock, 10);
console.log("=== TEST: getPyqsForBlock ===");
console.log(JSON.stringify(byBlock, null, 2));

console.log("TEST FILE FINISHED");