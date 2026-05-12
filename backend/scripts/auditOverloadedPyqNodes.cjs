// backend/scripts/auditOverloadedPyqNodes.cjs
// Audits overloaded leaf nodes in the PYQ index to identify misclassified questions.
// Uses pyq_by_node.json for counts + pyq_master_index.json for question details.
//
// Run from backend/: node scripts/auditOverloadedPyqNodes.cjs

const fs   = require("fs");
const path = require("path");

const BY_NODE_PATH   = path.join(__dirname, "..", "data", "pyq_index", "pyq_by_node.json");
const MASTER_PATH    = path.join(__dirname, "..", "data", "pyq_index", "pyq_master_index.json");
const OUT_PATH       = path.join(__dirname, "..", "data", "audit_overloaded_nodes.txt");

// ── Load data ─────────────────────────────────────────────────────────────────

if (!fs.existsSync(BY_NODE_PATH)) { console.error("❌ pyq_by_node.json not found"); process.exit(1); }
if (!fs.existsSync(MASTER_PATH))  { console.error("❌ pyq_master_index.json not found"); process.exit(1); }

const byNode = JSON.parse(fs.readFileSync(BY_NODE_PATH,  "utf8"));
const master = JSON.parse(fs.readFileSync(MASTER_PATH,   "utf8"));

// Build question lookup map (id → question object)
const qMap = Array.isArray(master)
    ? Object.fromEntries(master.map(q => [q.id, q]))
    : master; // already keyed by id

// ── Top 20 overloaded nodes ───────────────────────────────────────────────────

const FOCUS_NODES = [
    "GS1-GEO-IND-PHYSIO-MT01",
    "GS1-HIS-MOD-NATIONAL-MT01",
    "GS3-ST-GENSCI-BIO-MT04",
    "GS2-IR-INSTITUTIONS-MT04",
];

const sorted = Object.entries(byNode)
    .map(([nodeId, v]) => ({ nodeId, total: v.total || 0 }))
    .sort((a, b) => b.total - a.total);

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(s, n) { return String(s || "").padEnd(n); }

function fmtOptions(opts) {
    if (!opts) return "(no options)";
    if (typeof opts === "object" && !Array.isArray(opts)) {
        return Object.entries(opts)
            .map(([k, v]) => `${k}) ${String(v).slice(0, 55)}`)
            .join("  |  ");
    }
    return String(opts).slice(0, 120);
}

function origNodeBreakdown(ids) {
    const counts = {};
    for (const id of ids) {
        const q = qMap[id];
        if (!q) continue;
        const n = q.nodeId || "?";
        counts[n] = (counts[n] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// ── Build report ──────────────────────────────────────────────────────────────

const lines = [];
const log   = (...args) => { const s = args.join(" "); console.log(s); lines.push(s); };

log("=".repeat(70));
log("         PYQ OVERLOADED NODE AUDIT REPORT");
log("=".repeat(70));
log(`pyq_by_node questions indexed : ${Object.keys(byNode).length} nodes`);
log(`pyq_master_index total         : ${Object.keys(qMap).length} questions`);
log("");

// ── Section 1: Top 20 ─────────────────────────────────────────────────────────

log("─".repeat(70));
log("TOP 20 OVERLOADED NODES (by prelims count in pyq_by_node.json)");
log("─".repeat(70));

sorted.slice(0, 20).forEach((n, i) => {
    const marker = FOCUS_NODES.includes(n.nodeId) ? " ◀ FOCUS" : "";
    log(`${String(i + 1).padStart(2)}. ${pad(n.nodeId, 42)} ${String(n.total).padStart(4)} total${marker}`);
});

// ── Section 2: Focus node deep-dives ─────────────────────────────────────────

for (const nodeId of FOCUS_NODES) {
    const entry    = byNode[nodeId] || {};
    const prelims  = entry.prelims || [];
    const qs       = prelims.map(id => qMap[id]).filter(Boolean);

    log("");
    log("═".repeat(70));
    log(`FOCUS NODE: ${nodeId}`);
    log(`Total prelims questions : ${prelims.length}   (found in qMap: ${qs.length})`);
    log("═".repeat(70));

    // Orig nodeId breakdown
    log("");
    log("  Orig nodeId → count (before normalization):");
    const breakdown = origNodeBreakdown(prelims);
    for (const [orig, cnt] of breakdown) {
        log(`    ${pad(orig, 40)} : ${cnt}`);
    }

    // 20 sample questions
    const samples = qs.slice(0, 20);
    log("");
    log(`  SAMPLE QUESTIONS (${samples.length} of ${qs.length}):`);

    for (let i = 0; i < samples.length; i++) {
        const q = samples[i];
        log("");
        log(`  ── Sample ${String(i + 1).padStart(2)} ──────────────────────────────────`);
        log(`  ID       : ${q.id}`);
        log(`  Year     : ${q.year}`);
        log(`  OrigNode : ${q.nodeId || "(none)"}`);
        log(`  SylNode  : ${q.syllabusNodeId || "(none)"}`);
        log(`  Question : ${String(q.question || q.questionText || "").slice(0, 200)}`);
        log(`  Options  : ${fmtOptions(q.options)}`);
        const mapper = q.mappingAudit?.intelligentMapper;
        if (mapper) {
            log(`  Mapper   : from=${mapper.fromNodeId}  to=${mapper.toNodeId}  conf=${mapper.confidence}  kw=${JSON.stringify(mapper.matchedKeywords)}`);
        } else {
            log(`  Mapper   : (none)`);
        }
    }
}

// ── Section 3: Diagnosis ─────────────────────────────────────────────────────

log("");
log("═".repeat(70));
log("DIAGNOSIS SUMMARY");
log("═".repeat(70));

const diagnoses = [
    {
        node: "GS3-ST-GENSCI-BIO-MT04",
        count: byNode["GS3-ST-GENSCI-BIO-MT04"]?.total || 0,
        origBreakdown: origNodeBreakdown(byNode["GS3-ST-GENSCI-BIO-MT04"]?.prelims || []),
        findings: [
            { origNode: "GS3-ST-PHYSICS",   count: 97,  suspectedNode: "GS3-ST-GENSCI-PHY-MT01", reason: "Physics questions (nuclear energy, quantum computing, lasers, etc.) incorrectly mapped to Biology node. Rule: GS3-ST-PHYSICS → GS3-ST-GENSCI-PHY-MT01" },
            { origNode: "GS3-ST-CHEMISTRY", count: 79,  suspectedNode: "GS3-ST-GENSCI-CHE-MT02", reason: "Chemistry questions (polymers, compounds, elements, etc.) incorrectly mapped to Biology node. Rule: GS3-ST-CHEMISTRY → GS3-ST-GENSCI-CHE-MT02" },
            { origNode: "GS3-ST-GENSCI",    count: 22,  suspectedNode: "GS3-ST-GENSCI-BIO-MT04", reason: "Generic general science — biology is a reasonable fallback IF the question has no physics/chemistry content. Needs per-question keyword analysis." },
        ],
    },
    {
        node: "GS2-IR-INSTITUTIONS-MT04",
        count: byNode["GS2-IR-INSTITUTIONS-MT04"]?.total || 0,
        origBreakdown: origNodeBreakdown(byNode["GS2-IR-INSTITUTIONS-MT04"]?.prelims || []),
        findings: [
            { origNode: "GS2-IR-GEOPOLITICS",              count: 44, suspectedNode: "GS2-IR-GEOPOLITICS-MT01",   reason: "Geopolitics questions (bilateral relations, territorial disputes, alliances) are not about international institutions. Need a separate leaf node." },
            { origNode: "GS2-IR-CURRENT",                  count: 28, suspectedNode: "GS2-IR-CURRENT-MT03",       reason: "Current IR events mapped to Institutions — they are dynamic affairs, not org/institution trivia. Need separate leaf." },
            { origNode: "GS2-IR-GLOBAL-CURRENT-AFFAIRS",   count: 28, suspectedNode: "GS2-IR-CURRENT-MT03",       reason: "Same as IR-CURRENT — global CA questions are not about institutions." },
            { origNode: "GS2-IR-INTL-ORG",                 count: 37, suspectedNode: "GS2-IR-INSTITUTIONS-MT04",  reason: "International organisations are legitimately about institutions. This mapping is CORRECT." },
            { origNode: "GS2-IR-INTERNATIONAL-ORGANISATIONS", count: 35, suspectedNode: "GS2-IR-INSTITUTIONS-MT04", reason: "Same as INTL-ORG — this mapping is CORRECT." },
            { origNode: "GS2-IR-SECURITY",                 count: 2,  suspectedNode: "GS2-IR-SECURITY-MT02",      reason: "Security questions (terrorism, defence treaties) should not be under Institutions." },
        ],
    },
    {
        node: "GS1-GEO-IND-PHYSIO-MT01",
        count: byNode["GS1-GEO-IND-PHYSIO-MT01"]?.total || 0,
        origBreakdown: origNodeBreakdown(byNode["GS1-GEO-IND-PHYSIO-MT01"]?.prelims || []),
        findings: [
            { origNode: "GS1-GEO-IND", count: 231, suspectedNode: "various geography leaves", reason: "Parent node GS1-GEO-IND is mapped to PHYSIO-MT01 (Physical Geography of India) as default catch-all. This dumps ALL 231 uncategorized India geography questions here — rivers (→ DRAINAGE), climate (→ CLIMATE), agriculture (→ AGRI), world geography (→ GS1-GEO-WORLD). Needs keyword-based intelligent splitter, not a single alias." },
        ],
    },
    {
        node: "GS1-HIS-MOD-NATIONAL-MT01",
        count: byNode["GS1-HIS-MOD-NATIONAL-MT01"]?.total || 0,
        origBreakdown: origNodeBreakdown(byNode["GS1-HIS-MOD-NATIONAL-MT01"]?.prelims || []),
        findings: [
            { origNode: "GS1-HIS-MOD-NATIONAL", count: 203, suspectedNode: "MT01..MT06 phase leaves", reason: "Parent GS1-HIS-MOD-NATIONAL maps to MT01 (National Movement) as default. Questions about constitutional development (→ CONSTDEV-MT01), British expansion (→ EXPANSION-MT01), social reform movements (→ REFORM-MT01), economic critique (→ ECONOMIC-MT01) are all incorrectly lumped here. Needs keyword-based phase splitter." },
        ],
    },
];

for (const d of diagnoses) {
    log("");
    log(`▶ ${d.node}  (${d.count} total)`);
    for (const f of d.findings) {
        log(`  [${pad(f.origNode, 38)} × ${String(f.count).padStart(3)}]`);
        log(`     → Suspected better node : ${f.suspectedNode}`);
        log(`     → Reason                : ${f.reason}`);
    }
}

// ── Section 4: Suggested rule additions ──────────────────────────────────────

log("");
log("═".repeat(70));
log("SUGGESTED ALIAS RULE ADDITIONS (do not add until questions are verified)");
log("═".repeat(70));
log("");
log('  // Physics questions should NOT go to the Biology node');
log('  "GS3-ST-PHYSICS":                "GS3-ST-GENSCI-PHY-MT01",  // was: GS3-ST-GENSCI-BIO-MT04');
log('  "GS3-ST-CHEMISTRY":              "GS3-ST-GENSCI-CHE-MT02",  // was: GS3-ST-GENSCI-BIO-MT04');
log('');
log('  // Geopolitics / current IR events should NOT go to the Institutions node');
log('  "GS2-IR-GEOPOLITICS":            "GS2-IR-GEOPOLITICS-MT01", // was: GS2-IR-INSTITUTIONS-MT04');
log('  "GS2-IR-CURRENT":                "GS2-IR-CURRENT-MT03",     // was: GS2-IR-INSTITUTIONS-MT04');
log('  "GS2-IR-GLOBAL-CURRENT-AFFAIRS": "GS2-IR-CURRENT-MT03",     // was: GS2-IR-INSTITUTIONS-MT04');
log('  "GS2-IR-SECURITY":               "GS2-IR-SECURITY-MT02",    // was: GS2-IR-INSTITUTIONS-MT04');
log('');
log('  // GS1-GEO-IND parent → keep PHYSIO only as last resort; needs per-question');
log('  //  intelligent splitter (keyword: river/drainage, climate/monsoon, soil/agri,');
log('  //  world/global → GS1-GEO-WORLD)');
log('');
log('  // GS1-HIS-MOD-NATIONAL parent → split by phase keywords:');
log('  //  1857/mutiny/great uprising → EXPANSION; Tilak/Lal-Bal-Pal/partition');
log('  //  → NATIONAL-MT02; Gandhi/swaraj/hartals → NATIONAL-MT01; reforms/');
log('  //  education/social → REFORM; constitutional/act/dyarchy → CONSTDEV');

// ── Write to file ─────────────────────────────────────────────────────────────

fs.writeFileSync(OUT_PATH, lines.join("\n"), "utf8");
console.log("");
console.log(`📄 Full report saved to: ${OUT_PATH}`);
