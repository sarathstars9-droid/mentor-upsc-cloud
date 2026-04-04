import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getNodeById } from "../brain/unifiedSyllabusIndex.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INDEX_DIR = path.resolve(__dirname, "../data/pyq_index");

const PYQ_BY_NODE_PATH = path.join(INDEX_DIR, "pyq_by_node.json");
const MASTER_INDEX_PATH = path.join(INDEX_DIR, "pyq_master_index.json");

async function validateIndexes() {
  console.log("🔍 Validating PYQ Indexes...");
  
  const pyqByNodeRaw = await fs.readFile(PYQ_BY_NODE_PATH, "utf-8");
  const masterIndexRaw = await fs.readFile(MASTER_INDEX_PATH, "utf-8");
  
  const pyqByNode = JSON.parse(pyqByNodeRaw);
  const masterIndex = JSON.parse(masterIndexRaw);

  let orphanNodes = 0;
  let orphanQuestions = 0;
  let crossSubjectLeaks = 0;
  let duplicateQuestions = 0;
  let totalValid = 0;

  for (const [nodeId, buckets] of Object.entries(pyqByNode)) {
    // 1. Check if nodeId exists in syllabus registry
    const syllabusNode = getNodeById(nodeId);
    if (!syllabusNode) {
      console.warn(`[VALIDATION] Orphan Node ID found in pyq_by_node: ${nodeId}`);
      orphanNodes++;
    }

    const seenIds = new Set();

    // 2. Validate buckets and questions
    for (const [bucketName, questions] of Object.entries(buckets)) {
      if (!Array.isArray(questions)) continue; // skip 'total' and 'latestYear'

      for (const qid of questions) {
        // Duplicate check
        if (seenIds.has(qid)) {
           console.warn(`[VALIDATION] Duplicate Question ID in node ${nodeId}: ${qid}`);
           duplicateQuestions++;
        }
        seenIds.add(qid);

        // 3. Check if questionId exists in master index
        const masterQ = masterIndex[qid];
        if (!masterQ) {
          console.warn(`[VALIDATION] Orphan Question ID (not in master): ${qid} inside node ${nodeId}`);
          orphanQuestions++;
          continue;
        }

        // 4. Check stage/bucket classification leakage
        const mStage = String(masterQ.stage).toLowerCase();
        let expectedBucket = mStage;
        if (mStage.includes("csat")) expectedBucket = "csat";
        else if (mStage.includes("prelims")) expectedBucket = "prelims";
        else if (mStage.includes("mains")) expectedBucket = "mains";
        else if (mStage.includes("essay")) expectedBucket = "essay";
        else if (mStage.includes("optional")) expectedBucket = "optional";
        else if (mStage.includes("ethics")) expectedBucket = "ethics";

        if (bucketName !== expectedBucket && expectedBucket !== "unknown") {
           console.warn(`[VALIDATION] Leakage: Question ${qid} (stage: ${mStage}) found in bucket '${bucketName}' for node ${nodeId}`);
           crossSubjectLeaks++;
        }

        // 5. Subject leakage (if syllabus tree allows matching subject string roughly)
        // Ensure CSAT nodes only get CSAT questions
        if (nodeId.startsWith("CSAT") && bucketName !== "csat") {
           console.warn(`[VALIDATION] Cross-Subject Leakage: CSAT Node ${nodeId} has non-CSAT question ${qid}`);
           crossSubjectLeaks++;
        }

        totalValid++;
      }
    }
  }

  console.log("\n=== VALIDATION REPORT ===");
  console.log(`Total Valid Indexed Questions: ${totalValid}`);
  console.log(`Orphan Nodes (Not in Syllabus): ${orphanNodes}`);
  console.log(`Orphan Question IDs (Missing from Master): ${orphanQuestions}`);
  console.log(`Duplicate Question Instances: ${duplicateQuestions}`);
  console.log(`Cross-Subject/Bucket Leaks: ${crossSubjectLeaks}`);

  if (orphanNodes > 0 || orphanQuestions > 0 || crossSubjectLeaks > 0) {
     console.error("❌ Validation Failed with inconsistencies.");
     process.exit(1);
  }

  console.log("✅ Validation Passed: 0 anomalies detected!");
}

validateIndexes().catch(err => {
  console.error("Fatal validation error:", err);
  process.exit(1);
});