/**
 * backend/blockResolution/ocrSectionPipeline.js — V2
 *
 * Master OCR → Subject → Section → NodeId pipeline.
 *
 * New signature:
 *   runOcrSectionPipeline(rawText, context = {})
 *
 * context shape:
 *   {
 *     confirmedSubject: string,   // prior confirmed subject
 *     confirmedSection: string,   // prior confirmed section
 *     recentHints: string[]       // recent session topic hints
 *   }
 *
 * Flow:
 *   1. sanitize
 *   2. classify subject (with context)
 *   3. classify section (with context, subject-locked)
 *   4. normalize section via SECTION_ALIASES
 *   5. call pdfResolver.js
 *   6. return UI-ready result
 *
 * RULES:
 * - NEVER assigns nodeId directly from OCR text
 * - Low-confidence sets reviewRequired = true
 * - pdfResolver.js is ALWAYS the final authority
 */

import { sanitizeOcrText } from "./ocrSanitizer.js";
import { classifySubject } from "./subjectClassifier.js";
import { classifySection, SUBJECT_TO_PDF_LABEL } from "./sectionClassifier.js";
import { resolveNode } from "./pdfResolver.js";

/**
 * Run the full OCR → section → nodeId pipeline.
 *
 * @param {string} rawText
 * @param {object} context - Optional session context
 * @returns {object} UI-ready resolved result
 */
export function runOcrSectionPipeline(rawText, context = {}) {

  /* ── 1. SANITIZE ────────────────────────────────────────────────────────── */
  const sanitized = sanitizeOcrText(rawText);

  if (!sanitized.normalizedText) {
    return {
      rawText,
      cleanText: "",
      normalizedText: "",
      subject: { value: null, confidence: 0, confidenceGap: 0, alternatives: [], matchedKeywords: [] },
      section: { value: null, normalizedValue: null, confidence: 0, confidenceGap: 0, alternatives: [], matchedKeywords: [] },
      resolver: { syllabusNodeId: null, topic: null, mappingStatus: "empty-input", reason: "empty-input" },
      reviewRequired: true,
      confidenceBand: "low",
    };
  }

  /* ── 2. CLASSIFY SUBJECT ────────────────────────────────────────────────── */
  const subjectResult = classifySubject(sanitized, context);

  // Use _topSubject even if review required — section classifier needs a subject.
  const resolvedSubject = subjectResult.subject || subjectResult._topSubject || null;

  /* ── 3. CLASSIFY SECTION (subject-locked) ───────────────────────────────── */
  let sectionResult = {
    section: null,
    normalizedSection: null,
    pdfSection: null,
    confidence: 0,
    confidenceGap: 0,
    confidenceBand: "low",
    scores: [],
    matchedKeywords: [],
    alternatives: [],
    reviewRequired: true,
    _topSection: null,
  };

  if (resolvedSubject) {
    sectionResult = classifySection({
      sanitized,
      subject: resolvedSubject,
      context,
    });
  }

  const resolvedSection = sectionResult.section || sectionResult._topSection || null;
  const normalizedSection = sectionResult.normalizedSection || resolvedSection;

  /* ── 4. CALL pdfResolver.js ─────────────────────────────────────────────── */
  let resolverResult = {
    syllabusNodeId: null,
    topic: null,
    mappingStatus: "no-section",
    reason: "subject-or-section-not-resolved",
  };

  if (resolvedSubject && resolvedSection) {
    const pdfSubjectLabel = SUBJECT_TO_PDF_LABEL[resolvedSubject] || resolvedSubject;
    const pdfSectionKey = sectionResult.pdfSection
      || `${pdfSubjectLabel} > ${normalizedSection}`;

    resolverResult = resolveNode({
      pdfSubject: pdfSubjectLabel,
      pdfSection: pdfSectionKey,
      questionText: sanitized.cleanText,
      existingNodeId: null,
    });
  }

  /* ── 5. COMPUTE FINAL CONFIDENCE BAND ──────────────────────────────────── */
  const reviewRequired =
    subjectResult.reviewRequired ||
    sectionResult.reviewRequired ||
    !resolverResult.syllabusNodeId;

  const avgConfidence =
    ((subjectResult.confidence || 0) + (sectionResult.confidence || 0)) / 2;

  const confidenceBand =
    !reviewRequired && avgConfidence >= 0.60
      ? "high"
      : avgConfidence >= 0.30
      ? "medium"
      : "low";

  /* ── 6. RETURN UI-READY RESULT ──────────────────────────────────────────── */
  return {
    rawText,
    cleanText: sanitized.cleanText,
    normalizedText: sanitized.normalizedText,

    subject: {
      value: resolvedSubject,
      confidence: subjectResult.confidence,
      confidenceGap: subjectResult.confidenceGap,
      confidenceBand: subjectResult.confidenceBand || "low",
      alternatives: subjectResult.alternatives || [],
      matchedKeywords: subjectResult.matchedKeywords || [],
      reviewRequired: subjectResult.reviewRequired,
    },

    section: {
      value: resolvedSection,
      normalizedValue: normalizedSection,
      pdfSection: sectionResult.pdfSection || null,
      confidence: sectionResult.confidence,
      confidenceGap: sectionResult.confidenceGap,
      confidenceBand: sectionResult.confidenceBand || "low",
      alternatives: sectionResult.alternatives || [],
      matchedKeywords: sectionResult.matchedKeywords || [],
      reviewRequired: sectionResult.reviewRequired,
    },

    resolver: {
      syllabusNodeId: resolverResult.syllabusNodeId || null,
      topic: resolverResult.topic || null,
      mappingStatus: resolverResult.mappingStatus || "unknown",
      reason: resolverResult.reason || "unknown",
    },

    reviewRequired,
    confidenceBand,
  };
}
