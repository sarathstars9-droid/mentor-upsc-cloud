import fs from "fs";
import path from "path";
import { getStageFromQID } from "../brain/pyqStage.js";

const indexPath = path.resolve("backend/data/pyq_index/pyq_by_node.json");

function audit() {
  const data = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  let total = 0;
  const seen = new Map();
  const duplicates = new Map();
  let mismatchCount = 0;

  Object.entries(data).forEach(([node, buckets]) => {
    ["prelims", "mains"].forEach((stage) => {
      (buckets[stage] || []).forEach((qid) => {
        total++;

        const detected = getStageFromQID(qid);
        if (detected !== stage) {
          mismatchCount++;
          console.log("❌ Stage mismatch:", qid, "expected:", stage, "got:", detected);
        }

        if (!seen.has(qid)) {
          seen.set(qid, []);
        }
        seen.get(qid).push({ node, stage });

        if (seen.get(qid).length > 1) {
          duplicates.set(qid, seen.get(qid));
        }
      });
    });
  });

  console.log("Total Questions:", total);
  console.log("Stage Mismatch Count:", mismatchCount);
  console.log("Duplicate Count:", duplicates.size);

  if (duplicates.size > 0) {
    console.log("\\n🔁 Duplicate IDs:");
    for (const [qid, occurrences] of duplicates.entries()) {
      console.log(`- ${qid}`);
      occurrences.forEach((entry, idx) => {
        console.log(`   ${idx + 1}. node=${entry.node} stage=${entry.stage}`);
      });
    }
  }

  console.log("\\nAudit Completed");
}

audit();