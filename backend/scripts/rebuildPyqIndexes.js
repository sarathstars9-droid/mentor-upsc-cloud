import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getNodeById, expandCanonicalOrLegacyToLeafNodeIds } from "../brain/unifiedSyllabusIndex.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_DIR = path.resolve(__dirname, "../data/pyq_index");
const MASTER_INDEX_PATH = path.join(INDEX_DIR, "pyq_master_index.json");
const OUTPUT_PATH = path.join(INDEX_DIR, "pyq_by_node.json");

// Define bucket list explicitly requested by user
const stages = ["prelims", "mains", "csat", "essay", "ethics", "optional"];

async function rebuildIndexes() {
  console.log("⏳ Loading pyq_master_index.json...");
  
  let masterIndexRaw;
  try {
    masterIndexRaw = await fs.readFile(MASTER_INDEX_PATH, "utf-8");
  } catch (err) {
    console.error("❌ Fatal: Missing pyq_master_index.json! Run buildPyqMasterIndex first.");
    process.exit(1);
  }

  const pyqMasterIndex = JSON.parse(masterIndexRaw);
  const totalIncoming = Object.keys(pyqMasterIndex).length;

  console.log(`✅ Loaded ${totalIncoming} questions from master index.`);
  
  // The structure to be written
  const pyqByNode = {};
  
  // Counters for debug log
  let skippedMissingNodeId = 0;
  let unknownNodeIds = 0;
  const stageCounts = Object.fromEntries(stages.map(s => [s, 0]));

  // Helper to init node
  function initNode(nid) {
    if (!pyqByNode[nid]) {
      pyqByNode[nid] = {
        total: 0,
        latestYear: 0
      };
      stages.forEach(stg => { pyqByNode[nid][stg] = []; });
    }
  }

  // Iterate over all questions in Master Index
  const questionsList = Object.values(pyqMasterIndex);

  // Sorting list by Year DESC before bucket injection ensures buckets are cleanly naturally ordered
  questionsList.sort((a, b) => {
    const yA = Number(a.year || 0);
    const yB = Number(b.year || 0);
    return yB - yA; // Latest first
  });

  for (const q of questionsList) {
    const nodeId = q.syllabusNodeId || q.nodeId;
    if (!nodeId) {
      skippedMissingNodeId++;
      continue;
    }

    const stage = String(q.stage || "").toLowerCase();

    // Ensure stage is a valid bucket
    let bucketStage = stage;
    if (!stages.includes(bucketStage)) {
       // fallback generic bucket handling
       if (stage.includes("csat")) bucketStage = "csat";
       else if (stage.includes("prelims")) bucketStage = "prelims";
       else if (stage.includes("mains")) bucketStage = "mains";
       else continue; // Invalid stage, completely drops it. Wait, should we?
       // Just put into optional by default if unknown? No, user explicitly said don't mix buckets.
    }

    // CRITICAL: Expand possibly legacy/parent nodes into their exact leaf canonical IDs
    let lookupNodeId = nodeId;

    // Explicit patch for reading comprehension which often uses legacy CSAT-COMP directly in datasets
    if (lookupNodeId === "CSAT-COMP") {
      lookupNodeId = "CSAT-RC";
    }

    const resolvedNodes = expandCanonicalOrLegacyToLeafNodeIds(lookupNodeId);
    
    if (!resolvedNodes || resolvedNodes.length === 0) {
       unknownNodeIds++;
       console.warn(`[WARNING] Orphan question ${q.id}: Cannot resolve "${nodeId}" to any valid leaf node in Syllabus. Skipping.`);
       continue;
    }

    // Now safely map to every resolved canonical leaf node
    for (const validNodeId of resolvedNodes) {
      initNode(validNodeId);

      // Push explicitly only if not exist
      if (!pyqByNode[validNodeId][bucketStage].includes(q.id)) {
        pyqByNode[validNodeId][bucketStage].push(q.id);
        pyqByNode[validNodeId].total += 1;
        
        const qYear = Number(q.year || 0);
        if (qYear > (pyqByNode[validNodeId].latestYear || 0)) {
          pyqByNode[validNodeId].latestYear = qYear;
        }

        // Track metric (only once per question per stage mapping, so we don't skew total count by multiplying leaf nodes)
      }
    }
    
    // Increment metric for question mapping overall
    if (stageCounts[bucketStage] !== undefined) {
        stageCounts[bucketStage]++;
    }
  }

  // Write exact output structure
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(pyqByNode, null, 2), "utf-8");

  // Output required console debug metrics
  console.log("\n\n=== REBUILD INDEX REPORT ===");
  console.log(`[PYQ BUILD] Total Processed Nodes: ${Object.keys(pyqByNode).length}`);
  console.log(`[PYQ BUILD] Total Valid Questions Mapped: ${Object.values(stageCounts).reduce((a,b)=>a+b, 0)}`);
  
  stages.forEach(s => {
      console.log(`[PYQ BUILD] Total ${s.toUpperCase()}: ${stageCounts[s]}`);
  });

  if (skippedMissingNodeId > 0) {
     console.log(`[PYQ BUILD] Ignored questions missing syllabusNodeId: ${skippedMissingNodeId}`);
  }
  if (unknownNodeIds > 0) {
     console.log(`[PYQ BUILD] Mismatched/Skipped due to Invalid syllabusNodeId: ${unknownNodeIds}`);
  }

  // Top Nodes
  const nodeEntries = Object.entries(pyqByNode)
    .map(([nid, data]) => ({ nid, total: data.total }))
    .sort((a,b) => b.total - a.total)
    .slice(0, 10);
    
  console.log(`\n[PYQ BUILD] Top 10 High Volume Nodes:`);
  nodeEntries.forEach((n, i) => console.log(`  ${i+1}. ${n.nid} => ${n.total} qs`));
  console.log("✅ Rebuild complete! Fast lookup index generated at pyq_by_node.json");
}

rebuildIndexes().catch(err => {
  console.error("Fatal exception during rebuilding pyq indexes:", err);
  process.exit(1);
});