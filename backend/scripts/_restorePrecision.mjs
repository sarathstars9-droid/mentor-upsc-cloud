// backend/scripts/_restorePrecision.mjs
// Surgical removal of over-broad mappedNode assignments.
// Each problematic node is reduced to the single most semantically correct subtheme.
// Accepts ~5-15 unmatched as a consequence of restored precision.
//
// Run: node backend/scripts/_restorePrecision.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAYER_DIR = path.join(__dirname, '../data/pyq_theme_layers');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(LAYER_DIR, name), 'utf8'));
}
function save(name, data) {
  fs.writeFileSync(path.join(LAYER_DIR, name), JSON.stringify(data, null, 2), 'utf8');
}

function remove(subtheme, node) {
  const before = subtheme.mappedNodes.length;
  subtheme.mappedNodes = subtheme.mappedNodes.filter(n => n !== node);
  return subtheme.mappedNodes.length < before;
}

let removed = 0;

// ── GS2 ──────────────────────────────────────────────────────────────────────
const gs2 = load('gs2_theme_layer.json');

for (const [subject, subjectData] of Object.entries(gs2.subjects)) {
  for (const theme of subjectData.themes) {
    for (const subtheme of theme.subthemes) {
      const n = subtheme.name;

      // ── GS2-GOV-REGULATORS-QUASI ──────────────────────────────────────────
      // Keep ONLY in "Statutory Bodies" — Competition Commission is a statutory regulatory body.
      // Remove from: Statutory Commissions (constitutional, not quasi-regulatory),
      //              Generic constitutional bodies, Development Process and Industry (too broad)
      if (n === 'Statutory Commissions' || n === 'Generic' || n === 'Development Process and Industry') {
        if (remove(subtheme, 'GS2-GOV-REGULATORS-QUASI')) {
          removed++;
          console.log('[GS2] Removed GS2-GOV-REGULATORS-QUASI from ' + subject + '/' + theme.name + '/' + n);
        }
      }
      // Result: only "Statutory Bodies" keeps this node → 1 question intentionally unmatched
      // (because the question is filed under Governance subject, but the node is in Polity's Statutory Bodies)
      // Actually: keep in BOTH Statutory Bodies (Polity) and also flag it might not match
      // since the question loads under Governance subject. The matcher filters to subject scope first.
      // → This 1 question will be unmatched (acceptable per user's goal).

      // ── GS2-IR-CONTEMP ────────────────────────────────────────────────────
      // Questions: Look East Policy (SE Asia contemporary IR), ITA tariffs (multilateral trade)
      // Best fit: "India's Role in New World Order" (contemporary foreign policy role)
      // Remove from: Major Powers (bilateral big-power relations — different scope)
      //              Indian Ocean Neighbourhood (geographic focus, not contemporary policy)
      if (n === 'Major Powers' || n === 'Indian Ocean Neighbourhood') {
        if (remove(subtheme, 'GS2-IR-CONTEMP')) {
          removed++;
          console.log('[GS2] Removed GS2-IR-CONTEMP from ' + n);
        }
      }
      // Add to the right home if not already there
      if (n === "India's Role in New World Order") {
        if (!subtheme.mappedNodes.includes('GS2-IR-CONTEMP')) {
          subtheme.mappedNodes.push('GS2-IR-CONTEMP');
          console.log('[GS2] Added GS2-IR-CONTEMP to India\'s Role in New World Order');
        }
      }

      // ── GS2-IR-NEIGHBOURS ─────────────────────────────────────────────────
      // Questions: Pakistan cross-border attacks, Dhaka Shahbag protests (Bangladesh)
      // These are about immediate neighbourhood — South Asia.
      // Best fit: "Indian Ocean Neighbourhood" (SAARC, South Asia — most precise)
      // Remove from: BIMSTEC (a multilateral grouping, not neighbourhood bilateral)
      if (n === 'BIMSTEC') {
        if (remove(subtheme, 'GS2-IR-NEIGHBOURS')) {
          removed++;
          console.log('[GS2] Removed GS2-IR-NEIGHBOURS from BIMSTEC');
        }
      }
      // Keep in: Indian Ocean Neighbourhood — correct home
    }
  }
}

save('gs2_theme_layer.json', gs2);
console.log('\n[GS2] Done');

// ── GS3 ──────────────────────────────────────────────────────────────────────
const gs3 = load('gs3_theme_layer.json');

for (const [subject, subjectData] of Object.entries(gs3.subjects)) {
  for (const theme of subjectData.themes) {
    for (const subtheme of theme.subthemes) {
      const n = subtheme.name;

      // ── GS3-DM-PREP-MIT ───────────────────────────────────────────────────
      // Questions: disaster resilience, DRR, vulnerability assessment, Sendai Framework
      // These are PURELY disaster management topics.
      // Correct home: Environment / Disaster Management / *  (already there)
      // Problem: also added to Internal Security "Generic" subthemes to force 100%.
      // These questions load under Internal Security due to file-folding in aggregator,
      // so matcher looks there — but GS3-DM-PREP-MIT in IS Generics is conceptually wrong.
      // Fix: Remove from ALL Internal Security subthemes. Accept 4 unmatched. ✓
      if (subject === 'Internal Security') {
        if (remove(subtheme, 'GS3-DM-PREP-MIT')) {
          removed++;
          console.log('[GS3] Removed GS3-DM-PREP-MIT from IS/' + theme.name + '/' + n);
        }
      }

      // ── GS3-SEC-DEFENCE-MII ───────────────────────────────────────────────
      // Questions: Hot Pursuit / Surgical Strikes (border ops), AFSPA (armed forces special powers)
      // Hot Pursuit → Specific Border Issues is precise ✓
      // AFSPA → J&K is an acceptable fit (AFSPA is heavily associated with J&K/Northeast)
      // Both are already meaningful. Keep both. No removal needed.
      // (These 2 questions will match correctly via one of the two nodes.)
    }
  }
}

save('gs3_theme_layer.json', gs3);
console.log('[GS3] Done');

console.log('\nTotal removed:', removed);
console.log('Expected unmatched after rebuild: ~5-8 (GS2-REGULATORS + 2x IR-CONTEMP + 4x DM-PREP)');
console.log('\nRun node scripts/buildMainsThemeIndex.js to verify.');
