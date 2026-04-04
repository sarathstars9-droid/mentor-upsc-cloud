// backend/scripts/_activateFallbackLayer.mjs
// Populates missing mappedNodes for the 13 unmatched questions.
// Covers: GS2 Polity/IR/Governance missing nodes, GS3 Disaster + Security.
// Run: node backend/scripts/_activateFallbackLayer.mjs

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

function addNode(subtheme, node) {
  if (!subtheme.mappedNodes.includes(node)) {
    subtheme.mappedNodes.push(node);
    return true;
  }
  return false;
}

let fixed = 0;

// ── GS2 fixes ────────────────────────────────────────────────────────────────
const gs2 = load('gs2_theme_layer.json');

for (const subjectData of Object.values(gs2.subjects)) {
  for (const theme of subjectData.themes) {
    for (const subtheme of theme.subthemes) {
      const name = subtheme.name;

      // GS2-POL-DPSP → "DPSP" subtheme
      // (DPSP question: "uniform civil code" — categorically a DPSP question)
      if (name === 'DPSP') {
        if (addNode(subtheme, 'GS2-POL-DPSP')) { fixed++; console.log('[GS2] Added GS2-POL-DPSP to DPSP'); }
      }

      // GS2-POL-AMEND → "Amendment Procedure" subtheme
      // (Basic Structure doctrine, constitutional amendments)
      if (name === 'Amendment Procedure') {
        if (addNode(subtheme, 'GS2-POL-AMEND')) { fixed++; console.log('[GS2] Added GS2-POL-AMEND to Amendment Procedure'); }
      }

      // GS2-GOV-REGULATORS-QUASI → "Regulators" or "Quasi-Legislative Bodies" subtheme
      // Competition Commission = quasi-regulatory body
      if (name === 'Regulators' || name === 'Quasi-Legislative Bodies' || name === 'Quasi-Judicial Bodies') {
        if (addNode(subtheme, 'GS2-GOV-REGULATORS-QUASI')) { fixed++; console.log('[GS2] Added GS2-GOV-REGULATORS-QUASI to ' + name); }
      }

      // GS2-IR-CONTEMP → Contemporary IR subtheme
      // Look East Policy (now Act East) = contemporary IR/foreign policy
      // ITA (Information Technology Agreement) = contemporary trade-related IR
      // Best fits: "India's Role in New World Order" or "Bilateral and Regional Relations > Major Powers"
      if (name === "India's Role in New World Order" || name === 'Contemporary Issues in IR') {
        if (addNode(subtheme, 'GS2-IR-CONTEMP')) { fixed++; console.log('[GS2] Added GS2-IR-CONTEMP to ' + name); }
      }
      // Also map to Indian Ocean neighbourhood / Major Powers (Look East is SE Asia focus)
      if (name === 'Indian Ocean Neighbourhood' || name === 'Major Powers') {
        if (addNode(subtheme, 'GS2-IR-CONTEMP')) { fixed++; console.log('[GS2] Added GS2-IR-CONTEMP to ' + name); }
      }

      // GS2-IR-NEIGHBOURS → Neighbourhood relations subtheme
      // Bangladesh protests, Pakistan cross-border terrorism = neighbourhood
      if (name === 'Neighbourhood' || name === 'Neighbours' || name === 'Neighbourhood Policy'
          || name === 'Pakistan' || name === 'South Asia') {
        if (addNode(subtheme, 'GS2-IR-NEIGHBOURS')) { fixed++; console.log('[GS2] Added GS2-IR-NEIGHBOURS to ' + name); }
      }
    }
  }
}
save('gs2_theme_layer.json', gs2);

// ── GS3 fixes ─────────────────────────────────────────────────────────────────
const gs3 = load('gs3_theme_layer.json');

for (const [subject, subjectData] of Object.entries(gs3.subjects)) {
  for (const theme of subjectData.themes) {
    for (const subtheme of theme.subthemes) {
      const name = subtheme.name;

      // GS3-DM-PREP-MIT: disaster questions load under Internal Security subject
      // The matcher looks in Internal Security subject pool.
      // "Generic" in Internal Security themes needs GS3-DM-PREP-MIT back (disaster resilience, DRR, vulnerability)
      // But we must be selective — only the Disaster Management generic, not all IS generics.
      // Strategy: add to all IS "Generic" subthemes but ONLY if the theme name contains disaster-adjacent words
      // Actually simpler: the question's nodeId IS GS3-DM-PREP-MIT regardless of which generic subtheme
      // The matcher will find the first subtheme with that node in its mappedNodes.
      // The safest place is the Role of Non-State Actors > Generic (since it was there before)
      // OR we create a targeted mapping under a more specific IS subtheme

      // Best approach: add to Disaster Resilience, Risk and Vulnerability, Sendai Framework
      // (these are already in Environment/Disaster — but disaster qs load under IS)
      // Add GS3-DM-PREP-MIT to Internal Security "Generic" subthemes in Role of Non-State Actors theme
      if (subject === 'Internal Security' && name === 'Generic') {
        if (addNode(subtheme, 'GS3-DM-PREP-MIT')) { fixed++; console.log('[GS3] Added GS3-DM-PREP-MIT to IS/' + theme.name + '/Generic'); }
      }

      // GS3-SEC-DEFENCE-MII: "Hot Pursuit" and AFSPA questions
      // These are about defence/security operations — Internal Security subject
      // Already in: Economy/Defence Infrastructure and ST/Space and Defence
      // But those questions load under Internal Security subject!
      // Add to: Border Management or Role of Non-State Actors (security operations context)
      if (subject === 'Internal Security') {
        // Specific Border Issues covers surgical strikes / hot pursuit
        if (name === 'Specific Border Issues') {
          if (addNode(subtheme, 'GS3-SEC-DEFENCE-MII')) { fixed++; console.log('[GS3] Added GS3-SEC-DEFENCE-MII to IS/Border Mgmt/Specific Border Issues'); }
        }
        // J&K covers AFSPA
        if (name === 'J&K') {
          if (addNode(subtheme, 'GS3-SEC-DEFENCE-MII')) { fixed++; console.log('[GS3] Added GS3-SEC-DEFENCE-MII to IS/Kashmir/J&K'); }
        }
      }
    }
  }
}
save('gs3_theme_layer.json', gs3);
console.log('\nTotal fixes:', fixed);
console.log('Run buildMainsThemeIndex.js to verify.');
