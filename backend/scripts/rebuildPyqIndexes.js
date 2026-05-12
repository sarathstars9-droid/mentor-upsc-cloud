import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { expandCanonicalOrLegacyToLeafNodeIds, UNIFIED_NODES_BY_ID } from "../brain/unifiedSyllabusIndex.js";
import { PYQ_NODE_ALIAS_MAP, normalizePyqNodeId } from "../brain/pyqNodeAliasMap.js";

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
  const stats = {
    totalQuestions: totalIncoming,
    directlyResolved: 0,
    aliasResolved: 0,
    unresolved: 0,
    unresolvedByNode: {},
  };
  let skippedMissingNodeId = 0;
  const stageCounts = Object.fromEntries(stages.map(s => [s, 0]));

  // Validate alias map targets
  const invalidAliases = [];
  for (const [from, to] of Object.entries(PYQ_NODE_ALIAS_MAP)) {
    if (!UNIFIED_NODES_BY_ID[to]) {
      invalidAliases.push({ from, to });
    }
  }
  if (invalidAliases.length) {
    console.error("❌ Invalid PYQ_NODE_ALIAS_MAP targets (they do not exist in UNIFIED_NODES_BY_ID):", invalidAliases);
    throw new Error("PYQ_NODE_ALIAS_MAP contains invalid canonical leaf node targets.");
  }

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

  function isValidNode(nid) {
    if (!nid) return false;
    return expandCanonicalOrLegacyToLeafNodeIds(nid).length > 0;
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
    const rawNodeId = q.syllabusNodeId || q.nodeId;
    if (!rawNodeId) {
      skippedMissingNodeId++;
      continue;
    }

    const nodeId = normalizePyqNodeId(rawNodeId);

    if (rawNodeId !== nodeId && isValidNode(nodeId)) {
      stats.aliasResolved++;
    } else if (isValidNode(nodeId)) {
      stats.directlyResolved++;
    }

    q.syllabusNodeId = nodeId;

    const stage = String(q.stage || "").toLowerCase();
    let bucketStage = stage;
    if (!stages.includes(bucketStage)) {
      if (stage.includes("csat")) bucketStage = "csat";
      else if (stage.includes("prelims")) bucketStage = "prelims";
      else if (stage.includes("mains")) bucketStage = "mains";
      else continue;
    }

    // ── CSAT questions: never expand to leaf nodes ─────────────────────────────
    // CSAT parent nodes (CSAT-RC, CSAT-LR, CSAT-BN) each expand to 19-61 leaf
    // microtheme nodes, which would assign every RC/LR/quant question to dozens
    // of buckets simultaneously — causing a question-count explosion.
    // For CSAT we keep the exact assigned module-level node (one bucket only).
    if (bucketStage === "csat") {
      initNode(nodeId);
      if (!pyqByNode[nodeId][bucketStage].includes(q.id)) {
        pyqByNode[nodeId][bucketStage].push(q.id);
        pyqByNode[nodeId].total += 1;
        const qYear = Number(q.year || 0);
        if (qYear > (pyqByNode[nodeId].latestYear || 0)) {
          pyqByNode[nodeId].latestYear = qYear;
        }
      }
      if (stageCounts[bucketStage] !== undefined) stageCounts[bucketStage]++;
      continue;
    }

    // CRITICAL: Expand possibly legacy/parent nodes into their exact leaf canonical IDs
    let lookupNodeId = nodeId;

    // Explicit patch for reading comprehension which often uses legacy CSAT-COMP directly in datasets
    if (lookupNodeId === "CSAT-COMP") {
      lookupNodeId = "CSAT-RC";
    }

    const resolvedNodes = expandCanonicalOrLegacyToLeafNodeIds(lookupNodeId);

    // Expansion guard: only expand when the leaf set is small (question is specific).
    // A large leaf count means the nodeId is a broad parent tag — expanding it
    // would insert the question into every microtheme bucket under that parent,
    // creating artificial count inflation (same pattern as the CSAT-RC explosion).
    // Threshold: ≤ 6 leaves → expand (specific enough).
    //            > 6 leaves → keep the exact nodeId only (broad parent tag).
    const EXPAND_LEAF_THRESHOLD = 6;
    const canExpand = resolvedNodes && resolvedNodes.length > 0 && resolvedNodes.length <= EXPAND_LEAF_THRESHOLD;

    // FALLBACK: if resolver fails, still keep raw syllabusNodeId alive in pyq_by_node
    // We ALSO include the raw nodeId even if resolution succeeds, so that direct API lookups
    // for parent nodes like '1C.VA.ARCH' continue to return questions.
    const finalNodes =
      canExpand
        ? Array.from(new Set([...resolvedNodes, nodeId]))
        : [nodeId];

    if (!resolvedNodes || resolvedNodes.length === 0) {
      stats.unresolved++;
      stats.unresolvedByNode[rawNodeId] = (stats.unresolvedByNode[rawNodeId] || 0) + 1;
    }

    // Now safely map to every resolved canonical leaf node
    for (const validNodeId of finalNodes) {
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
  console.log(`[PYQ BUILD] Total Valid Questions Mapped: ${Object.values(stageCounts).reduce((a, b) => a + b, 0)}`);

  stages.forEach(s => {
    console.log(`[PYQ BUILD] Total ${s.toUpperCase()}: ${stageCounts[s]}`);
  });

  if (skippedMissingNodeId > 0) {
    console.log(`[PYQ BUILD] Ignored questions missing syllabusNodeId: ${skippedMissingNodeId}`);
  }

  console.log("\n[PYQ INDEX REBUILD SUMMARY]");
  console.log(`  Total Processed : ${stats.totalQuestions}`);
  console.log(`  Directly Resolved : ${stats.directlyResolved}`);
  console.log(`  Alias Resolved : ${stats.aliasResolved}`);
  console.log(`  Unresolved (Fallback) : ${stats.unresolved}`);

  if (stats.unresolved > 0) {
    console.log(`\n[PYQ BUILD] Top Unresolved Nodes:`);
    const unresolvedEntries = Object.entries(stats.unresolvedByNode)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
    console.table(unresolvedEntries.map(([node, count]) => ({ RawNodeID: node, Count: count })));
  }

  // Top Nodes
  const nodeEntries = Object.entries(pyqByNode)
    .map(([nid, data]) => ({ nid, total: data.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  console.log(`\n[PYQ BUILD] Top 10 High Volume Nodes:`);
  nodeEntries.forEach((n, i) => console.log(`  ${i + 1}. ${n.nid} => ${n.total} qs`));
  console.log("✅ Rebuild complete! Fast lookup index generated at pyq_by_node.json");
}

rebuildIndexes().catch(err => {
  console.error("Fatal exception during rebuilding pyq indexes:", err);
  process.exit(1);
});