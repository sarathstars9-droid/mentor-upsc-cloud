// backend/scripts/auditPrelimsTestEngine.cjs
// Audits the Prelims Test Engine data: year distribution, node coverage, missing answers/options, duplicates
"use strict";

const fs   = require("fs");
const path = require("path");

const MASTER_PATH  = path.join(__dirname, "..", "data", "pyq_index", "pyq_master_index.json");
const BY_NODE_PATH = path.join(__dirname, "..", "data", "pyq_index", "pyq_by_node.json");

function load(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function isCsat(q) {
  const paper   = String(q.paper   || "").toUpperCase();
  const stage   = String(q.stage   || "").toLowerCase();
  const subject = String(q.subject || "").toLowerCase();
  const nodeId  = String(q.syllabusNodeId || q.nodeId || "").toUpperCase();
  return paper === "CSAT" || stage === "csat" || subject.includes("csat") || nodeId.startsWith("CSAT");
}

function main() {
  console.log("\n=== PRELIMS TEST ENGINE AUDIT ===\n");

  const master  = load(MASTER_PATH);
  const byNode  = load(BY_NODE_PATH);
  const allQ    = Object.values(master);

  console.log(`Total questions in master index: ${allQ.length}`);

  // ── Year × Paper table ────────────────────────────────────────────────────
  const yearTable = {};
  let missingAnswer  = 0;
  let missingOptions = 0;
  const idSeen = {};
  const duplicateIds = [];

  for (const q of allQ) {
    const yr   = String(q.year || "null");
    const paper = isCsat(q) ? "CSAT" : "GS";

    if (!yearTable[yr]) yearTable[yr] = { GS: 0, CSAT: 0 };
    yearTable[yr][paper]++;

    if (!q.answer && !q.correctAnswer) missingAnswer++;

    const opts = q.options || {};
    if (!opts.A && !opts.B && !opts.C && !opts.D) missingOptions++;

    const id = String(q.id || "");
    if (id) {
      if (idSeen[id]) duplicateIds.push(id);
      else idSeen[id] = true;
    }
  }

  console.log("\nYEAR-WISE DISTRIBUTION (GS | CSAT):");
  console.log("YEAR".padEnd(8) + "GS".padEnd(8) + "CSAT");
  const sortedYears = Object.keys(yearTable).sort();
  for (const yr of sortedYears) {
    const { GS, CSAT } = yearTable[yr];
    console.log(yr.padEnd(8) + String(GS).padEnd(8) + CSAT);
  }

  // ── By-node coverage ──────────────────────────────────────────────────────
  const nodeKeys  = Object.keys(byNode);
  const emptyNodes = nodeKeys.filter(k => {
    const v = byNode[k];
    const ids = Array.isArray(v) ? v : Object.values(v).flat();
    return ids.length === 0;
  });

  // ── Sample topic-node fetch ───────────────────────────────────────────────
  const sampleNode = nodeKeys.find(k => {
    const v = byNode[k];
    const ids = Array.isArray(v) ? v : Object.values(v).flat();
    return ids.length >= 3;
  });

  console.log("\n--- SAMPLE TOPIC NODE FETCH ---");
  if (sampleNode) {
    const v    = byNode[sampleNode];
    const ids  = (Array.isArray(v) ? v : Object.values(v).flat()).slice(0, 3);
    const qs   = ids.map(id => master[id]).filter(Boolean);
    console.log(`Node: ${sampleNode} → ${ids.length} IDs found`);
    qs.forEach((q, i) => console.log(`  Q${i + 1}: [${q.year}] ${String(q.question || "").slice(0, 80)}…`));
  } else {
    console.log("No suitable sample node found.");
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n--- SUMMARY ---");
  console.log(`Total node keys in pyq_by_node.json : ${nodeKeys.length}`);
  console.log(`Nodes with ZERO questions           : ${emptyNodes.length}`);
  if (emptyNodes.length > 0 && emptyNodes.length < 20) {
    console.log("  Empty nodes:", emptyNodes.join(", "));
  }
  console.log(`Questions missing answer            : ${missingAnswer}`);
  console.log(`Questions missing ALL options       : ${missingOptions}`);
  console.log(`Duplicate question IDs              : ${duplicateIds.length}`);
  if (duplicateIds.length > 0 && duplicateIds.length < 20) {
    console.log("  Duplicate IDs:", duplicateIds.join(", "));
  }

  // GS-only totals
  const gsTotal   = allQ.filter(q => !isCsat(q)).length;
  const csatTotal = allQ.filter(q => isCsat(q)).length;
  console.log(`\nGS total  : ${gsTotal}`);
  console.log(`CSAT total: ${csatTotal}`);
  console.log("\n✅ Audit complete.");
}

main();
