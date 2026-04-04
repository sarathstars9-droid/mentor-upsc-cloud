import { loadCSATData, getCSATCounts } from "./data/loaders/csatLoader.js";

const data = loadCSATData();
const counts = getCSATCounts();

console.log("CSAT COUNTS:", counts);
console.log("SAMPLE QUANT:", data.quant[0]?.id);
console.log("SAMPLE LR:", data.lr[0]?.id);
console.log("SAMPLE RC:", data.rc[0]?.id);