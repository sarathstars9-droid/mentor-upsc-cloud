/**
 * backend/ocrMapping/index.js
 *
 * STAGE-FIRST OCR → SUBJECT → TOPIC → CONFIDENCE PIPELINE
 *
 * Resolution order (strict):
 *  1. Stage detection (prelims/mains/csat/essay/general) — FIRST
 *  2. GS paper detection (GS1/GS2/GS3/GS4 — always mains)
 *  3. MISC-GEN check — only for explicit non-syllabus intents
 *  4. Multi-subject detection → split into sub-blocks if needed
 *  5. Subject resolution (locked to stage pool)
 *  6. Topic resolution (locked to subject + stage pool)
 *
 * MISC-GEN is NEVER auto-assigned for normal syllabus blocks.
 * Unresolved syllabus blocks return nodeId: null, not MISC-GEN.
 */

import { cleanOcrText, assessTextQuality } from "./ocrSanitizer.js";
import { resolveSubject } from "./subjectResolver.js";
import { resolveTopic } from "./topicResolver.js";
import { evaluateConfidence } from "./mappingConfidence.js";
import { detectOcrStage } from "./stageDetector.js";
import { detectOcrMiscIntent } from "./miscIntentDetector.js";
import { splitOcrBlock } from "./ocrBlockSplitter.js";

/**
 * Process a single OCR text block through the full pipeline.
 *
 * @param {string} rawText   - Raw OCR / typed text for one block
 * @param {Object} [opts]    - Optional context
 * @param {number} [opts.minutes] - Block duration (used for split)
 * @returns {Object} - Fully resolved block mapping result
 */
export function processOcrText(rawText, opts = {}) {
  /* ---------------- CLEAN ---------------- */
  const cleanedText = cleanOcrText(rawText);
  const isTextAcceptable = assessTextQuality(cleanedText);

  const warnings = [];
  if (!isTextAcceptable) warnings.push("LOW_QUALITY_TEXT");

  /* ---------------- STAGE LOCK (FIRST) ---------------- */
  // Stage detection MUST happen before subject or topic resolution.
  // The stage determines WHICH file pool to query.
  const stageResult = detectOcrStage(cleanedText);
  const { stage, gsPaper, stageConfidence } = stageResult;

  /* ---------------- MISC-GEN CHECK ---------------- */
  // Only explicit generic/admin/current-affairs intents may produce MISC-GEN.
  // Normal syllabus blocks must NEVER get MISC-GEN as fallback.
  const miscIntentResult = detectOcrMiscIntent(cleanedText);
  if (miscIntentResult.isMiscGen) {
    return {
      rawText,
      cleanedText,
      stage,
      gsPaper,
      subjectId: null,
      subjectName: miscIntentResult.intentLabel,
      nodeId: null,
      nodeName: miscIntentResult.intentLabel,
      resolverConfidence: 0.8,
      confidenceBadge: "MEDIUM",
      mappingSource: "MISC-GEN",
      isApproved: true,
      isMiscGen: true,
      subjectCandidates: [],
      topicCandidates: [],
      textQuality: isTextAcceptable ? "ACCEPTABLE" : "LOW",
      warnings: [...warnings, "MISC_GEN_INTENT"],
    };
  }

  /* ---------------- MULTI-SUBJECT SPLIT ---------------- */
  // Detect if block contains 2+ subjects. If yes, split and recurse.
  const splitResult = splitOcrBlock(cleanedText, { stage, gsPaper, minutes: opts.minutes || 0 });
  if (splitResult && splitResult.subBlocks && splitResult.subBlocks.length >= 2) {
    const resolvedSubBlocks = splitResult.subBlocks.map((sub) =>
      processOcrText(sub.text, { minutes: sub.minutes })
    );
    return {
      rawText,
      cleanedText,
      stage,
      gsPaper,
      subjectId: null,
      subjectName: "Mixed",
      nodeId: null,
      nodeName: "Mixed Block",
      resolverConfidence: 0,
      confidenceBadge: "LOW",
      mappingSource: "SPLIT",
      isApproved: false,
      isMiscGen: false,
      isSplit: true,
      subBlocks: resolvedSubBlocks.map((sb, i) => ({
        ...sb,
        splitIndex: i,
        splitMinutes: splitResult.subBlocks[i].minutes,
        splitSubjectLabel: splitResult.subBlocks[i].subjectLabel,
      })),
      subjectCandidates: [],
      topicCandidates: [],
      textQuality: isTextAcceptable ? "ACCEPTABLE" : "LOW",
      warnings: [...warnings, "MIXED_BLOCK_SPLIT"],
    };
  }

  /* ---------------- SUBJECT RESOLUTION (STAGE-LOCKED) ---------------- */
  // Pass stage context to subject resolver so it can filter to the right pool.
  const subjectResult = resolveSubject(cleanedText, { stage, gsPaper });

  /* ---------------- TOPIC RESOLUTION (STAGE + SUBJECT LOCKED) ---------------- */
  let topicResult = {
    nodeId: null,
    nodeName: "Unmapped",
    confidenceScore: 0,
    confidenceBadge: "LOW",
    candidates: [],
    gap: 0,
  };

  if (subjectResult.isLocked && subjectResult.subjectId) {
    // resolveTopic is already subject-locked; pass stage for additional filtering
    topicResult = resolveTopic(cleanedText, subjectResult.subjectId, { stage, gsPaper });
  } else {
    warnings.push("AMBIGUOUS_SUBJECT");
  }

  /* ---------------- FINAL CONFIDENCE ---------------- */
  const finalScore =
    topicResult.nodeId !== null
      ? topicResult.confidenceScore
      : subjectResult.confidenceScore;

  const finalGap =
    topicResult.gap !== undefined
      ? topicResult.gap
      : subjectResult.gapScore || 0;

  const confidenceObj = evaluateConfidence(finalScore, finalGap, isTextAcceptable);

  /* ---------------- STRICT CONTROL ---------------- */

  // If subject not locked → block everything, return null (NOT MISC-GEN)
  if (!subjectResult.isLocked) {
    return {
      rawText,
      cleanedText,
      stage,
      gsPaper,
      subjectId: null,
      subjectName: "Unmapped",
      nodeId: null,
      nodeName: "Unmapped",
      resolverConfidence: 0,
      confidenceBadge: "LOW",
      mappingSource: "NONE",
      isApproved: false,
      isMiscGen: false,
      subjectCandidates: subjectResult.candidates,
      topicCandidates: [],
      textQuality: isTextAcceptable ? "ACCEPTABLE" : "LOW",
      warnings: [...warnings, "SUBJECT_NOT_LOCKED"],
    };
  }

  // If topic ambiguous → map subject only, no node
  if (!topicResult.nodeId) {
    return {
      rawText,
      cleanedText,
      stage,
      gsPaper,
      subjectId: subjectResult.subjectId,
      subjectName: subjectResult.subjectName,
      nodeId: null,
      nodeName: "Unmapped",
      resolverConfidence: finalScore,
      confidenceBadge: "LOW",
      mappingSource: "SUGGESTED",
      isApproved: false,
      isMiscGen: false,
      subjectCandidates: subjectResult.candidates,
      topicCandidates: topicResult.candidates,
      textQuality: isTextAcceptable ? "ACCEPTABLE" : "LOW",
      warnings: [...warnings, "AMBIGUOUS_TOPIC"],
    };
  }

  /* ---------------- FINAL OUTPUT ---------------- */
  return {
    rawText,
    cleanedText,
    stage,
    gsPaper,
    subjectId: subjectResult.subjectId,
    subjectName: subjectResult.subjectName,
    nodeId: topicResult.nodeId,
    nodeName: topicResult.nodeName,
    resolverConfidence: finalScore,
    confidenceBadge: confidenceObj.confidenceBadge,
    mappingSource: confidenceObj.canAutoMap ? "AUTO" : "SUGGESTED",
    isApproved: confidenceObj.canAutoMap,
    isMiscGen: false,
    subjectCandidates: subjectResult.candidates,
    topicCandidates: topicResult.candidates,
    textQuality: isTextAcceptable ? "ACCEPTABLE" : "LOW",
    warnings,
  };
}