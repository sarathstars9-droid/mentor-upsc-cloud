/**
 * backend/ocrMapping/topicResolver.js
 *
 * SUBJECT-LOCKED deterministic topic resolver
 */

import { getNodesBySubject, getAliasesForNode } from "./nodeRegistryAdapter.js";
import { isLeafNode } from "../brain/unifiedSyllabusIndex.js";

/* ---------------- NORMALIZATION ---------------- */

function normalizeText(txt) {
  return String(txt || "")
    .toLowerCase()
    .replace(/[_/\\|]+/g, " ")
    .replace(/[^\w\s&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------------- PHRASE BUILDER ---------------- */

function buildPhrases(text) {
  const words = normalizeText(text).split(" ").filter(Boolean);
  const phrases = new Set();

  for (let i = 0; i < words.length; i++) {
    phrases.add(words[i]);

    if (i < words.length - 1) {
      phrases.add(`${words[i]} ${words[i + 1]}`);
    }

    if (i < words.length - 2) {
      phrases.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }

  return Array.from(phrases);
}

/* ---------------- SCORING ENGINE ---------------- */

function calculateTopicScore(text, node) {
  let score = 0;

  const normalizedText = normalizeText(text);
  const phrases = buildPhrases(normalizedText);

  const aliases = getAliasesForNode(node.syllabusNodeId) || [];

  const normalizedAliases = aliases.map(a => normalizeText(a));

  /* ---------- EXACT MATCH ---------- */

  if (normalizedAliases.includes(normalizedText)) {
    score += 200;
  }

  /* ---------- TOPIC FIELD MATCH ---------- */

  const topicFields = [
    node.topic,
    node.subtopic,
    node.microTheme
  ].map(normalizeText);

  if (topicFields.includes(normalizedText)) {
    score += 220;
  }

  /* ---------- PHRASE MATCH ---------- */

  for (const phrase of phrases) {
    if (normalizedAliases.includes(phrase)) {
      score += phrase.includes(" ") ? 80 : 40;
    }
  }

  /* ---------- PARTIAL MATCH ---------- */

  for (const phrase of phrases) {
    for (const alias of normalizedAliases) {
      if (
        phrase.length > 3 &&
        alias.includes(phrase)
      ) {
        score += 10;
      }
    }
  }

  /* ---------- DOMAIN BOOST ---------- */

  const strongMatchCount = normalizedAliases.filter(a =>
    normalizedText.includes(a) && a.length > 4
  ).length;

  score += strongMatchCount * 25;

  /* ---------- LEAF PRIORITY ---------- */

  if (isLeafNode(node.syllabusNodeId)) {
    score += 40;
  } else {
    score -= 10; // penalize parent nodes
  }

  return score;
}

/* ---------------- MAIN RESOLVER ---------------- */

export function resolveTopic(cleanedText, lockedSubjectId) {
  const normalizedText = normalizeText(cleanedText);

  if (!normalizedText || !lockedSubjectId) {
    return {
      nodeId: null,
      nodeName: "Unmapped",
      confidenceScore: 0,
      confidenceBadge: "LOW",
      candidates: [],
      reason: "missing_input_or_subject",
    };
  }

  /* ---------- SUBJECT LOCK ---------- */

  const pool = getNodesBySubject(lockedSubjectId);

  /* ---------- SCORING ---------- */

  const scores = pool.map(node => ({
    nodeId: node.syllabusNodeId,
    nodeName: node.microTheme || node.subtopic || node.topic || "Unknown",
    score: calculateTopicScore(normalizedText, node),
    isLeaf: isLeafNode(node.syllabusNodeId),
  })).filter(s => s.score > 0);

  /* ---------- SORTING ---------- */

  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.isLeaf !== b.isLeaf) return a.isLeaf ? -1 : 1;
    return a.nodeId.localeCompare(b.nodeId);
  });

  if (scores.length === 0) {
    return {
      nodeId: null,
      nodeName: "Unmapped",
      confidenceScore: 0,
      confidenceBadge: "LOW",
      candidates: [],
      reason: "no_match",
    };
  }

  const top = scores[0];
  const second = scores[1] || null;

  const maxScore = 300;

  const confidenceScore = Math.min(top.score / maxScore, 1.0);
  const gap = second ? (top.score - second.score) / maxScore : 1.0;

  /* ---------- AMBIGUITY LOGIC ---------- */

  const isAmbiguous =
    confidenceScore < 0.50 ||
    (confidenceScore < 0.80 && gap < 0.15);

  const confidenceBadge = isAmbiguous
    ? "LOW"
    : confidenceScore >= 0.85 && gap >= 0.15
      ? "HIGH"
      : "MEDIUM";

  return {
    nodeId: isAmbiguous ? null : top.nodeId,
    nodeName: isAmbiguous ? "Unmapped" : top.nodeName,
    confidenceScore,
    confidenceBadge,
    candidates: scores.slice(0, 5),
    gap,
    isLeaf: top.isLeaf,
    reason: isAmbiguous ? "ambiguous_match" : "resolved",
  };
}