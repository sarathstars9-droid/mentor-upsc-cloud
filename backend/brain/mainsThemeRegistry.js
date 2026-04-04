// backend/brain/mainsThemeRegistry.js
// Loads all 4 GS theme-layer JSON files and exposes them as a unified registry.
// Theme layers are OVERLAYS — they do NOT replace tagged source files.
// Source of truth for question text, IDs, years: tagged pyq_questions/mains/*.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const THEME_LAYER_DIR = path.join(__dirname, "..", "data", "pyq_theme_layers");

const PAPER_TO_FILE = {
  GS1: "gs1_theme_layer.json",
  GS2: "gs2_theme_layer.json",
  GS3: "gs3_theme_layer.json",
  GS4: "gs4_theme_layer.json",
};

// ─── Load once at module init ─────────────────────────────────────────────────
function loadLayer(paper) {
  const file = PAPER_TO_FILE[paper];
  if (!file) return null;
  const filePath = path.join(THEME_LAYER_DIR, file);
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return raw;
  } catch (err) {
    console.warn(`[mainsThemeRegistry] Could not load ${file}:`, err.message);
    return null;
  }
}

export const MAINS_THEME_LAYERS = {
  GS1: loadLayer("GS1"),
  GS2: loadLayer("GS2"),
  GS3: loadLayer("GS3"),
  GS4: loadLayer("GS4"),
};

/**
 * Get the theme layer for a single paper.
 * @param {string} paper - "GS1" | "GS2" | "GS3" | "GS4"
 * @returns {object|null}
 */
export function getThemeLayerForPaper(paper) {
  const key = String(paper || "").toUpperCase();
  return MAINS_THEME_LAYERS[key] || null;
}

/**
 * Get the subjects map for a paper.
 * Returns: { "History": { themes: [...] }, ... }
 */
export function getSubjectsForPaper(paper) {
  const layer = getThemeLayerForPaper(paper);
  if (!layer || !layer.subjects) return {};
  return layer.subjects;
}

/**
 * Get all themes for a subject within a paper.
 * Returns: [ { name, subthemes, ... }, ... ]
 */
export function getThemesForSubject(paper, subject) {
  const subjects = getSubjectsForPaper(paper);
  const subjectData = subjects[subject];
  if (!subjectData || !Array.isArray(subjectData.themes)) return [];
  return subjectData.themes;
}

/**
 * Get all subthemes for a theme within a subject/paper.
 * Returns: [ { name, keywords, mappedNodes }, ... ]
 */
export function getSubthemesForTheme(paper, subject, themeName) {
  const themes = getThemesForSubject(paper, subject);
  const theme  = themes.find(t => t.name === themeName);
  if (!theme || !Array.isArray(theme.subthemes)) return [];
  return theme.subthemes;
}

/**
 * Return a flat list of all [paper, subject, theme, subtheme] combinations.
 * Useful for building search indexes.
 */
export function flattenAllSubthemes(paper) {
  const subjects = getSubjectsForPaper(paper);
  const results  = [];

  for (const [subject, subjectData] of Object.entries(subjects)) {
    const themes = Array.isArray(subjectData.themes) ? subjectData.themes : [];
    for (const theme of themes) {
      const subthemes = Array.isArray(theme.subthemes) ? theme.subthemes : [];
      for (const subtheme of subthemes) {
        results.push({
          paper,
          subject,
          theme:    theme.name,
          subtheme: subtheme.name,
          keywords: Array.isArray(subtheme.keywords) ? subtheme.keywords : [],
          mappedNodes: Array.isArray(subtheme.mappedNodes) ? subtheme.mappedNodes : [],
        });
      }
    }
  }

  return results;
}
