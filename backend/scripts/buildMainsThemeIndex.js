// backend/scripts/buildMainsThemeIndex.js
// One-time build script. Runs independently. Does NOT touch server.js.
//
// Usage:
//   node backend/scripts/buildMainsThemeIndex.js
//
// Outputs:
//   backend/data/derived/mains_theme_pyq_index.json
//   backend/data/derived/mains_theme_unmatched.json
//
// Summary printed:
//   total, matched, unmatched, matchedBy breakdown,
//   confidence bucket summary, mapping stability report,
//   low-confidence matched sample, sample unmatched entries,
//   changed file list

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildMainsThemeIndex } from "../brain/mainsThemeAggregator.js";
import { flattenAllSubthemes } from "../brain/mainsThemeRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DERIVED_DIR  = path.join(__dirname, "..", "data", "derived");
const LAYER_DIR    = path.join(__dirname, "..", "data", "pyq_theme_layers");

// ─── Ensure output directory ──────────────────────────────────────────────────
if (!fs.existsSync(DERIVED_DIR)) {
  fs.mkdirSync(DERIVED_DIR, { recursive: true });
  console.log("[build] Created backend/data/derived/");
}

console.log("[build] Building Mains Theme Index...\n");
console.time("[build] Done in");

const result = buildMainsThemeIndex();
const { matched, unmatched, totalQuestions, matchedByStats } = result;

// ─── Write matched index ──────────────────────────────────────────────────────
const indexPath = path.join(DERIVED_DIR, "mains_theme_pyq_index.json");
fs.writeFileSync(indexPath, JSON.stringify(matched, null, 2), "utf8");

// ─── Write unmatched log ──────────────────────────────────────────────────────
const unmatchedPath = path.join(DERIVED_DIR, "mains_theme_unmatched.json");
fs.writeFileSync(unmatchedPath, JSON.stringify(unmatched, null, 2), "utf8");

// ─── Aggregate directive counts from matched index ────────────────────────────
const directiveTotals = {};
for (const subjects of Object.values(matched)) {
  for (const themes of Object.values(subjects)) {
    for (const subthemes of Object.values(themes)) {
      for (const [dir, cnt] of Object.entries(bucket => {}, [])) {
        // handled below
      }
    }
  }
}

// Actually collect directives properly
const directiveTotals2 = {};
const allBuckets = [];
for (const subjects of Object.values(matched)) {
  for (const themes of Object.values(subjects)) {
    for (const subthemes of Object.values(themes)) {
      for (const bucket of Object.values(subthemes)) {
        allBuckets.push(bucket);
        for (const [dir, cnt] of Object.entries(bucket.directives || {})) {
          directiveTotals2[dir] = (directiveTotals2[dir] || 0) + cnt;
        }
      }
    }
  }
}

const directiveSorted = Object.entries(directiveTotals2).sort((a, b) => b[1] - a[1]);

// ─── Counts ───────────────────────────────────────────────────────────────────
const matchedCount   = totalQuestions - unmatched.length;
const unmatchedCount = unmatched.length;
const matchRate      = totalQuestions > 0
  ? ((matchedCount / totalQuestions) * 100).toFixed(1) : "0.0";

// ─── Confidence buckets (from matched index) ──────────────────────────────────
const confBuckets = { "0.90+": 0, "0.75-0.89": 0, "0.50-0.74": 0, "<0.50": 0 };
const lowConfItems = [];   // matched items with avgConfidence < 0.85

for (const [, subjects] of Object.entries(matched)) {
  for (const [, themes] of Object.entries(subjects)) {
    for (const [, subthemes] of Object.entries(themes)) {
      for (const [subthemeName, bucket] of Object.entries(subthemes)) {
        const conf = bucket.avgConfidence;
        if (conf === null || conf === undefined) continue;

        if (conf >= 0.90)        confBuckets["0.90+"]++;
        else if (conf >= 0.75)   confBuckets["0.75-0.89"]++;
        else if (conf >= 0.50)   confBuckets["0.50-0.74"]++;
        else                     confBuckets["<0.50"]++;

        if (conf < 0.85) {
          lowConfItems.push({ subthemeName, conf, count: bucket.count, topDir: bucket.topDirective });
        }
      }
    }
  }
}
lowConfItems.sort((a, b) => a.conf - b.conf);

// ─── Mapping stability report ─────────────────────────────────────────────────
// Build nodeId → [{paper, subject, theme, subtheme}] from live theme layers
const PAPERS = ["GS1", "GS2", "GS3", "GS4"];
const nodeUsage = {};

for (const paper of PAPERS) {
  const entries = flattenAllSubthemes(paper);
  for (const e of entries) {
    for (const node of (e.mappedNodes || [])) {
      if (!nodeUsage[node]) nodeUsage[node] = [];
      nodeUsage[node].push({ paper, subject: e.subject, theme: e.theme, subtheme: e.subtheme });
    }
  }
}

// Flag nodes used in more than 3 subthemes (potential leakage)
const overlapFlags = [];
for (const [node, uses] of Object.entries(nodeUsage)) {
  if (uses.length > 3) {
    overlapFlags.push({
      node,
      usedIn: uses.length,
      risk: uses.length > 6 ? "HIGH" : "MODERATE",
      subthemes: uses.map(u => `${u.theme} / ${u.subtheme}`),
    });
  }
}
overlapFlags.sort((a, b) => b.usedIn - a.usedIn);

// ─── Print summary ────────────────────────────────────────────────────────────
const SEP = "─".repeat(52);

console.log(SEP);
console.log("  MAINS THEME INDEX BUILD SUMMARY");
console.log(SEP);
console.log(`  Total questions   : ${totalQuestions}`);
console.log(`  Matched           : ${matchedCount}  (${matchRate}%)`);
console.log(`  Unmatched         : ${unmatchedCount}`);
console.log(`  Papers indexed    : ${Object.keys(matched).join(", ")}`);
console.log(SEP);

// ── matchedBy breakdown ──────────────────────────────────────────────────────
console.log("\n  matchedBy breakdown:");
const mbLabels = [
  ["mappedNodeExact",   "mappedNodeExact  "],
  ["keywordStrong",     "keywordStrong    "],
  ["keywordModerate",   "keywordModerate  "],
  ["themeNameFallback", "themeNameFallback"],
  ["unmatched",         "unmatched        "],
];
for (const [key, label] of mbLabels) {
  const n   = matchedByStats?.[key] || 0;
  const pct = totalQuestions > 0 ? ((n / totalQuestions) * 100).toFixed(1) : "0.0";
  console.log(`    ${label} : ${String(n).padStart(4)}  (${pct}%)`);
}

// ── Confidence buckets ────────────────────────────────────────────────────────
console.log("\n  Confidence bucket summary (matched subthemes):");
for (const [bucket, count] of Object.entries(confBuckets)) {
  const total = allBuckets.length;
  const pct   = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
  console.log(`    ${bucket.padEnd(12)} : ${String(count).padStart(4)}  (${pct}%)`);
}

// ── Mapping stability report (overused nodes) ─────────────────────────────────
console.log(`\n  Mapping stability — nodes in >3 subthemes (${overlapFlags.length} flagged):`);
if (overlapFlags.length === 0) {
  console.log("    (none — all mappings look clean)");
} else {
  for (const f of overlapFlags.slice(0, 8)) {
    console.log(`    [${f.risk}] ${f.node}  (${f.usedIn} subthemes)`);
    for (const s of f.subthemes.slice(0, 3)) {
      console.log(`           · ${s}`);
    }
    if (f.subthemes.length > 3) console.log(`           · …and ${f.subthemes.length - 3} more`);
  }
}

// ── Subject / theme distribution ─────────────────────────────────────────────
console.log("\n  Subject distribution:");
for (const [paper, subjects] of Object.entries(matched)) {
  console.log(`\n  [${paper}]`);
  for (const [subject, themes] of Object.entries(subjects)) {
    let total = 0;
    for (const subthemes of Object.values(themes)) {
      for (const bucket of Object.values(subthemes)) {
        total += bucket.count || 0;
      }
    }
    console.log(`    ${subject.padEnd(28)} : ${total} questions, ${Object.keys(themes).length} themes`);
  }
}

// ── Directive summary ────────────────────────────────────────────────────────
console.log("\n  Directive summary (matched questions):");
for (const [dir, cnt] of directiveSorted) {
  const pct = matchedCount > 0 ? ((cnt / matchedCount) * 100).toFixed(1) : "0.0";
  console.log(`    ${dir.padEnd(22)} : ${String(cnt).padStart(4)}  (${pct}%)`);
}

// ── Low-confidence matched sample ─────────────────────────────────────────────
if (lowConfItems.length > 0) {
  console.log(`\n  Low-confidence matched subthemes (conf < 0.85, ${lowConfItems.length} total):`);
  for (const item of lowConfItems.slice(0, 5)) {
    console.log(`    "${item.subthemeName}"  conf=${item.conf}  count=${item.count}  topDir=${item.topDir || "(none)"}`);
  }
}

// ── Sample unmatched ─────────────────────────────────────────────────────────
if (unmatched.length > 0) {
  console.log(`\n  Sample unmatched (first ${Math.min(5, unmatched.length)}):`);
  for (const u of unmatched.slice(0, 5)) {
    const bc  = u.bestCandidate;
    const dbg = u._debug || {};
    console.log(`\n    id            : ${u.id}`);
    console.log(`    paper         : ${u.paper}`);
    console.log(`    syllabusNode  : ${u.syllabusNodeId || "(none)"}`);
    console.log(`    question      : ${u.question.slice(0, 100)}…`);
    if (bc?.theme) {
      console.log(`    bestCandidate : ${bc.subject} / ${bc.theme} / ${bc.subtheme}`);
      console.log(`                    confidence=${bc.confidence}, matchedBy=${bc.matchedBy}`);
    } else {
      console.log(`    bestCandidate : (none)`);
    }
    if (dbg.reason) {
      console.log(`    fallbackTrace : considered=${dbg.fallbackConsidered}, reason=${dbg.reason}`);
    }
  }
}

// ── Changed files ────────────────────────────────────────────────────────────
console.log(`\n${SEP}`);
console.log("  Files written:");
console.log(`    ${indexPath}`);
console.log(`    ${unmatchedPath}`);
console.log(SEP);

console.log("\n[build] Complete.");
console.timeEnd("[build] Done in");
