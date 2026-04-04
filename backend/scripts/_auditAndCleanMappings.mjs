// backend/scripts/_auditAndCleanMappings.mjs
// One-time script: audits mappedNode overlap and applies targeted cleanup.
// Run: node backend/scripts/_auditAndCleanMappings.mjs
// Does NOT modify matcher or aggregator logic.

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

// ── GS1 cleanup ──────────────────────────────────────────────────────────────
const gs1 = load('gs1_theme_layer.json');

for (const subjectData of Object.values(gs1.subjects)) {
  for (const theme of subjectData.themes) {
    for (const subtheme of theme.subthemes) {
      const mn = subtheme.mappedNodes || [];
      const name = subtheme.name;

      // GS1-SOC-DEV-POVERTY: keep only in "Social Empowerment" subtheme
      // Remove from "Population Related Issues" — poverty ≠ population demographics
      if (name === 'Population Related Issues') {
        subtheme.mappedNodes = mn.filter(n => n !== 'GS1-SOC-DEV-POVERTY');
      }

      // GS1-SOC-UPSC-EMPOWER: remove from "Social Empowerment + Regionalism"
      // That subtheme is primarily about civil service ethos/nationalism, not empowerment
      if (name === 'Social Empowerment + Regionalism') {
        subtheme.mappedNodes = mn.filter(n => n !== 'GS1-SOC-UPSC-EMPOWER');
      }

      // GS1-SOC-EMPOWER-SC: remove from "Social Empowerment" generic buckets
      // It belongs only to "Caste" subtheme specifically
      if (name === 'Social Empowerment' && theme.name !== 'Social Empowerment, Communalism, Regionalism and Secularism') {
        // Remove SC from general Social Empowerment under RWPPPU theme — already in Caste
        subtheme.mappedNodes = mn.filter(n => n !== 'GS1-SOC-EMPOWER-SC');
      }
    }
  }
}
save('gs1_theme_layer.json', gs1);
console.log('[GS1] Cleanup done');

// ── GS3 cleanup ──────────────────────────────────────────────────────────────
const gs3 = load('gs3_theme_layer.json');

for (const [subject, subjectData] of Object.entries(gs3.subjects)) {
  for (const theme of subjectData.themes) {
    for (const subtheme of theme.subthemes) {
      const mn = subtheme.mappedNodes || [];
      const name = subtheme.name;

      // GS3-DM-PREP-MIT leaked into Internal Security "Generic" — remove
      // Disaster prep/mitigation is NOT internal security preparedness
      if (subject === 'Internal Security' && name === 'Generic') {
        subtheme.mappedNodes = mn.filter(n => n !== 'GS3-DM-PREP-MIT');
      }

      // GS3-ECO-PLAN-GROWTH is too broad — remove from non-planning subthemes
      // Keep only in: Inclusive Growth, Growth and Development, Digital Economy, Care Economy, National Income, Macroeconomic Indicators
      const planGrowthKeepIn = new Set([
        'Inclusive Growth', 'Growth and Development', 'Digital Economy',
        'Care Economy', 'National Income', 'Macroeconomic Indicators',
        'Liberalisation',
      ]);
      if (mn.includes('GS3-ECO-PLAN-GROWTH') && !planGrowthKeepIn.has(name)) {
        subtheme.mappedNodes = mn.filter(n => n !== 'GS3-ECO-PLAN-GROWTH');
      }

      // GS3-ECO-FOREIGN-TRADE-IO: keep in External Sector and FDI only
      // Remove from Infrastructure > Investment (too far)
      if (name === 'Investment' && theme.name === 'Infrastructure and Investment') {
        subtheme.mappedNodes = mn.filter(n => n !== 'GS3-ECO-FOREIGN-TRADE-IO');
      }
    }
  }
}
save('gs3_theme_layer.json', gs3);
console.log('[GS3] Cleanup done');

// ── GS4 cleanup ──────────────────────────────────────────────────────────────
const gs4 = load('gs4_theme_layer.json');

// GS4-ETH-GOV is overused (13 subthemes). Strategy:
//   - Keep in: Public Administration Ethics theme (primary home)
//   - Keep in: Probity theme (governance is core there)
//   - Remove from: Applied Ethics case patterns where GOV co-occurs with CS/APPLIED
// GS4-ETH-ATT is overused (10 subthemes). Strategy:
//   - Keep in: Aptitude/Foundational Values theme (primary home)
//   - Remove from: Probity, Applied Ethics, Case Patterns where it's secondary
// GS4-ETH-THINK is overused (6 subthemes). Strategy:
//   - Keep ONLY in: Moral Thinkers theme + Philosophical Basis of Governance

for (const [subject, subjectData] of Object.entries(gs4.subjects)) {
  for (const theme of subjectData.themes) {
    for (const subtheme of theme.subthemes) {
      const mn = subtheme.mappedNodes || [];
      const name = subtheme.name;
      const themeName = theme.name;

      // GS4-ETH-ATT: remove from Case Study Pattern Framework — patterns aren't aptitude tests
      if (themeName === 'Case Study Pattern Framework') {
        subtheme.mappedNodes = mn.filter(n => n !== 'GS4-ETH-ATT');
      }

      // GS4-ETH-ATT: remove from Probity in Governance where PROB is the primary signal
      // Keep ATT only in: Codes of Ethics (conduct is aptitude-related)
      if (themeName === 'Probity in Governance') {
        const atKeepInProbity = new Set([
          'Codes of Ethics and Codes of Conduct',
          'Concept of Public Service',
          'Work Culture',
        ]);
        if (!atKeepInProbity.has(name)) {
          subtheme.mappedNodes = mn.filter(n => n !== 'GS4-ETH-ATT');
        }
      }

      // GS4-ETH-THINK: keep only in Moral Thinkers theme and Philosophical Basis
      if (mn.includes('GS4-ETH-THINK')) {
        const thinkAllowed = new Set([
          'Contributions of Moral Thinkers and Philosophers from India and World',
          'Probity in Governance',  // Philosophical Basis
        ]);
        if (!thinkAllowed.has(themeName)) {
          subtheme.mappedNodes = mn.filter(n => n !== 'GS4-ETH-THINK');
        }
        // Within Probity, only keep THINK in Philosophical Basis
        if (themeName === 'Probity in Governance' && name !== 'Philosophical Basis of Governance and Probity') {
          subtheme.mappedNodes = subtheme.mappedNodes.filter(n => n !== 'GS4-ETH-THINK');
        }
      }

      // GS4-ETH-GOV: remove from Case Study Pattern Framework
      // Those patterns should use CS/APPLIED/PROB as primary signals
      if (themeName === 'Case Study Pattern Framework') {
        // Keep GOV only in Citizen-Centric and Administrative Rationality patterns
        const govKeepInPatterns = new Set([
          'Citizen-Centric Administration Pattern',
          'Administrative Rationality and Ethics',
          'Governance Reform Ethics',
        ]);
        if (!govKeepInPatterns.has(name)) {
          subtheme.mappedNodes = mn.filter(n => n !== 'GS4-ETH-GOV');
        }
      }

      // GS4-ETH-GOV: remove from "Ethics in Human Actions" etc. in Ethics Theory
      // Those belong to HV/ATT cluster, not public admin governance
      if (themeName === 'Ethics and Human Interface') {
        const govKeepInEHI = new Set([
          'Ethics in Private and Public Relationships',
          'Ethics and its Scope',
          'Digital and Technology Ethics',
        ]);
        if (!govKeepInEHI.has(name)) {
          subtheme.mappedNodes = mn.filter(n => n !== 'GS4-ETH-GOV');
        }
      }

      // Applied Ethics > Applied Ethics theme: remove GOV, keep APPLIED as primary
      if (subject === 'Applied Ethics and Case Patterns' && themeName === 'Applied Ethics') {
        const govKeepInApplied = new Set([
          'Administrative Rationality and Ethics',
          'Governance Reform Ethics',
        ]);
        if (!govKeepInApplied.has(name)) {
          subtheme.mappedNodes = mn.filter(n => n !== 'GS4-ETH-GOV');
        }
      }
    }
  }
}
save('gs4_theme_layer.json', gs4);
console.log('[GS4] Cleanup done');

console.log('\nAll cleanup scripts applied. Run buildMainsThemeIndex.js to verify.');
