/**
 * backend/ocrMapping/index.js
 *
 * FINAL OCR → SUBJECT → TOPIC → CONFIDENCE PIPELINE
 */

import { cleanOcrText, assessTextQuality } from "./ocrSanitizer.js";
import { resolveSubject } from "./subjectResolver.js";
import { resolveTopic } from "./topicResolver.js";
import { evaluateConfidence } from "./mappingConfidence.js";
export function processOcrText(rawText) {
  /* ---------------- CLEAN ---------------- */
  const cleanedText = cleanOcrText(rawText);
  const isTextAcceptable = assessTextQuality(cleanedText);

  const warnings = [];
  if (!isTextAcceptable) warnings.push("LOW_QUALITY_TEXT");

  /* ---------------- SUBJECT ---------------- */
  const subjectResult = resolveSubject(cleanedText);

  /* ---------------- TOPIC ---------------- */
  let topicResult = {
    nodeId: null,
    nodeName: "Unmapped",
    confidenceScore: 0,
    confidenceBadge: "LOW",
    candidates: [],
    gap: 0,
  };

  if (subjectResult.isLocked && subjectResult.subjectId) {
    topicResult = resolveTopic(cleanedText, subjectResult.subjectId);
  } else {
    warnings.push("AMBIGUOUS_SUBJECT");
  }

  /* ---------------- FINAL CONFIDENCE ---------------- */

  // Use ONLY topic confidence if available
  const finalScore =
    topicResult.nodeId !== null
      ? topicResult.confidenceScore
      : subjectResult.confidenceScore;

  const finalGap =
    topicResult.gap !== undefined
      ? topicResult.gap
      : subjectResult.gapScore || 0;

  const confidenceObj = evaluateConfidence(
    finalScore,
    finalGap,
    isTextAcceptable
  );

  /* ---------------- STRICT CONTROL ---------------- */

  // If subject not locked → block everything
  if (!subjectResult.isLocked) {
    return {
      rawText,
      cleanedText,

      subjectId: null,
      subjectName: "Unmapped",

      nodeId: null,
      nodeName: "Unmapped",

      resolverConfidence: 0,
      confidenceBadge: "LOW",

      mappingSource: "NONE",
      isApproved: false,

      subjectCandidates: subjectResult.candidates,
      topicCandidates: [],

      textQuality: isTextAcceptable ? "ACCEPTABLE" : "LOW",
      warnings: [...warnings, "SUBJECT_NOT_LOCKED"],
    };
  }

  // If topic ambiguous → don't map node
  if (!topicResult.nodeId) {
    return {
      rawText,
      cleanedText,

      subjectId: subjectResult.subjectId,
      subjectName: subjectResult.subjectName,

      nodeId: null,
      nodeName: "Unmapped",

      resolverConfidence: finalScore,
      confidenceBadge: "LOW",

      mappingSource: "SUGGESTED",
      isApproved: false,

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

    subjectId: subjectResult.subjectId,
    subjectName: subjectResult.subjectName,

    nodeId: topicResult.nodeId,
    nodeName: topicResult.nodeName,

    resolverConfidence: finalScore,
    confidenceBadge: confidenceObj.confidenceBadge,

    mappingSource: confidenceObj.canAutoMap ? "AUTO" : "SUGGESTED",
    isApproved: confidenceObj.canAutoMap,

    subjectCandidates: subjectResult.candidates,
    topicCandidates: topicResult.candidates,

    textQuality: isTextAcceptable ? "ACCEPTABLE" : "LOW",
    warnings,
  };
}