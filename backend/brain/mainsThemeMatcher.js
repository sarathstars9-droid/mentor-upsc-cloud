// backend/brain/mainsThemeMatcher.js
// Matches tagged Mains questions to theme/subtheme entries from the theme layer.
// DETERMINISTIC — no AI calls. Fully bucketed scoring with inspectable debug output.
//
// Tagged Mains questions only reliably contain:
//   id, year, questionNumber, directive, theme, question, syllabusNodeId
// Do NOT rely on: keywords, section, microtheme, microthemes.
//
// Scoring priority (additive within a candidate):
//   +100  exact mappedNode match          → auto-accept (mappedNodeExact)
//   + 12  exact phrase (subtheme name) in question text
//   +  8  tagged-theme field of question matches theme-layer theme name exactly
//   +  5  keyword hit in question text
//   +  4  keyword hit in tagged theme field of question
//   +  3  keyword hit in syllabusNodeId
//   +  2  theme-layer theme name appears in question text
//   +  1  directive appears in question text (weak supporting signal only)
//
// Thresholds (for non-node matches):
//   MIN_SCORE = 8   — raw score must reach this to be considered a match at all
//   MIN_GAP   = 3   — gap between best and second-best score required
//   confidence ≥ 0.70 → keywordStrong
//   confidence ≥ 0.50 → keywordModerate
//   score ≥ MIN_SCORE & theme-name-hit → themeNameFallback
//   else   → unmatched
//
// matchedBy labels (exhaustive):
//   mappedNodeExact   — syllabusNodeId matched a mappedNode entry (exact or prefix)
//   keywordStrong     — confidence ≥ 0.70, score ≥ MIN_SCORE, gap ≥ MIN_GAP
//   keywordModerate   — confidence ≥ 0.50, score ≥ MIN_SCORE, gap ≥ MIN_GAP
//   themeNameFallback — theme name matched, score ≥ MIN_SCORE, gap ≥ MIN_GAP
//   unmatched         — nothing passed thresholds
//
// _debug.fallbackTrace reports why fallback was or was not accepted:
//   fallbackConsidered  — true if keyword/theme scoring was attempted
//   fallbackAccepted    — true if fallback produced a match
//   fallbackRejected    — true if fallback was considered but rejected
//   reason              — "gap-below-threshold" | "score-below-threshold" |
//                         "no-theme-hit" | "node-match-used" | "accepted"

import { flattenAllSubthemes } from "./mainsThemeRegistry.js";

// ─── Conservative thresholds ──────────────────────────────────────────────────
export const MIN_SCORE = 8;   // minimum raw score for any non-node match
export const MIN_GAP   = 3;   // required gap between best and second-best raw score

// Maximum possible raw score used for normalisation (rough ceiling)
// 10 keyword hits × 5 + exact theme hit (8) + subtheme name (12) = ~60
const SCORE_CEILING = 60;

// ─── Normaliser ───────────────────────────────────────────────────────────────
function norm(s) {
  return String(s || "").trim().toLowerCase();
}

// ─── Build per-field search surfaces from a tagged question ──────────────────
// Only uses fields reliably present in tagged Mains files.
function buildSurfaces(q) {
  return {
    questionText:   norm(q.question       || ""),
    taggedTheme:    norm(q.theme          || ""),   // theme field from tagged file
    syllabusNodeId: norm(q.syllabusNodeId || ""),
    directive:      norm(q.directive      || ""),
  };
}

// ─── Score one candidate subtheme entry against a question ───────────────────
// Returns { rawScore, matchedBy, hitFlags, matchedKeywords }
function scoreCandidate(entry, surfaces, nodeId) {
  let rawScore = 0;
  const matchedKeywords = [];
  const hitFlags = {
    mappedNode:       false,
    taggedThemeMatch: false,
    subthemeNameHit:  false,
    themeNameInQ:     false,
    directiveSignal:  false,
  };

  const { keywords, mappedNodes } = entry;
  const entrySubthemeNorm = norm(entry.subtheme);
  const entryThemeNorm    = norm(entry.theme);

  // ── 1. mappedNode match (guard: only if array is non-empty) ─────────────
  // Both exact and prefix matches → mappedNodeExact (both are high-confidence node links)
  if (nodeId && Array.isArray(mappedNodes) && mappedNodes.length > 0) {
    for (const mn of mappedNodes) {
      const mnNorm = norm(mn);
      if (!mnNorm) continue;

      if (mnNorm === nodeId || nodeId.startsWith(mnNorm) || mnNorm.startsWith(nodeId)) {
        return {
          rawScore: 100, matchedBy: "mappedNodeExact",
          matchedKeywords: [mn],
          hitFlags: { ...hitFlags, mappedNode: true },
        };
      }
    }
  }

  // ── 2. Tagged-theme field exact match with theme-layer theme name ────────
  if (entryThemeNorm && surfaces.taggedTheme === entryThemeNorm) {
    rawScore += 8;
    hitFlags.taggedThemeMatch = true;
  } else if (entryThemeNorm && surfaces.taggedTheme.includes(entryThemeNorm)) {
    rawScore += 4;
    hitFlags.taggedThemeMatch = true;
  }

  // ── 3. subtheme name exact phrase in question text ───────────────────────
  if (entrySubthemeNorm.length >= 4 && surfaces.questionText.includes(entrySubthemeNorm)) {
    rawScore += 12;
    hitFlags.subthemeNameHit = true;
  }

  // ── 4. Keyword scoring ───────────────────────────────────────────────────
  const kwList = Array.isArray(keywords) ? keywords : [];
  for (const kw of kwList) {
    const kwNorm = norm(kw);
    if (!kwNorm || kwNorm.length < 3) continue;

    if (surfaces.questionText.includes(kwNorm)) {
      rawScore += 5;
      matchedKeywords.push(kw);
      continue;
    }
    if (surfaces.taggedTheme.includes(kwNorm)) {
      rawScore += 4;
      matchedKeywords.push(kw);
      continue;
    }
    if (surfaces.syllabusNodeId.includes(kwNorm)) {
      rawScore += 3;
      matchedKeywords.push(kw);
    }
  }

  // ── 5. theme-layer theme name in question text ───────────────────────────
  if (entryThemeNorm.length >= 4 && surfaces.questionText.includes(entryThemeNorm)) {
    rawScore += 2;
    hitFlags.themeNameInQ = true;
  }

  // ── 6. Directive as weak supporting signal (+1 only) ─────────────────────
  // Only fires if we already have some score (avoids false positives).
  // Directive is too generic to be a primary signal.
  if (rawScore > 0 && surfaces.directive) {
    const entryThemeWords = entryThemeNorm.split(/\s+/);
    if (entryThemeWords.some(w => w.length > 4 && surfaces.directive.includes(w))) {
      rawScore += 1;
      hitFlags.directiveSignal = true;
    }
  }

  return { rawScore, matchedBy: "keyword", matchedKeywords, hitFlags };
}

// ─── Convert rawScore to 0–1 confidence ──────────────────────────────────────
function toConfidence(rawScore) {
  const capped = Math.min(rawScore, SCORE_CEILING);
  return Math.round((capped / SCORE_CEILING) * 100) / 100;
}

// ─── Determine matchedBy label (non-node path only) ──────────────────────────
// Called only when score >= MIN_SCORE AND gap >= MIN_GAP.
function classifyMatchedBy(confidence, hitFlags) {
  if (confidence >= 0.70) return "keywordStrong";
  if (confidence >= 0.50) return "keywordModerate";
  if (hitFlags.taggedThemeMatch || hitFlags.themeNameInQ) return "themeNameFallback";
  return "unmatched";
}

// ─── Main matcher ─────────────────────────────────────────────────────────────

/**
 * Match a tagged Mains question to a theme/subtheme.
 *
 * @param {object} q       - Tagged question object (id, year, directive, theme, question, syllabusNodeId)
 * @param {string} paper   - "GS1" | "GS2" | "GS3" | "GS4"
 * @param {string} subject - Subject from the source file (e.g., "Economy")
 * @returns {object} match result with _debug info
 *
 * Return shape (matched):
 *   { paper, subject, theme, subtheme, confidence, matchedBy, _debug }
 *
 * Return shape (unmatched):
 *   { paper, subject, theme: null, subtheme: null, confidence, matchedBy: "unmatched",
 *     _debug: { rawScore, secondBestScore, gap, matchedKeywords, candidateTheme,
 *               candidateSubtheme, hitFlags,
 *               fallbackConsidered, fallbackAccepted, fallbackRejected, reason } }
 */
export function matchQuestionToTheme(q, paper, subject) {
  const surfaces = buildSurfaces(q);
  const nodeId   = surfaces.syllabusNodeId;

  // All subtheme entries for this paper
  const allEntries = flattenAllSubthemes(paper);

  // Filter to subject-scope first (fall back to full pool only if no entries found)
  const subjectEntries = allEntries.filter(e =>
    norm(e.subject) === norm(subject) ||
    norm(e.subject).includes(norm(subject)) ||
    norm(subject).includes(norm(e.subject))
  );

  const candidatePool = subjectEntries.length > 0 ? subjectEntries : allEntries;

  // ── Score every candidate; track best AND second-best ────────────────────
  let bestRawScore    = -1;
  let secondRawScore  = -1;
  let bestEntry       = null;
  let bestMatchedKeywords = [];
  let bestHitFlags    = {};
  let usedNodeMatch   = false;

  for (const entry of candidatePool) {
    const result = scoreCandidate(entry, surfaces, nodeId);

    if (result.rawScore > bestRawScore) {
      secondRawScore      = bestRawScore;          // previous best → second-best
      bestRawScore        = result.rawScore;
      bestEntry           = entry;
      bestMatchedKeywords = result.matchedKeywords;
      bestHitFlags        = result.hitFlags;
    } else if (result.rawScore > secondRawScore) {
      secondRawScore = result.rawScore;
    }

    // Short-circuit on node match (score = 100, unambiguous)
    if (result.rawScore >= 100) {
      usedNodeMatch = true;
      break;
    }
  }

  const gap = bestRawScore - Math.max(secondRawScore, 0);

  // ── Auto-accept: node match (no score/gap threshold needed) ──────────────
  if (bestRawScore >= 100 && bestEntry) {
    return {
      paper:     bestEntry.paper,
      subject:   bestEntry.subject,
      theme:     bestEntry.theme,
      subtheme:  bestEntry.subtheme,
      confidence: 0.97,
      matchedBy: "mappedNodeExact",
      _debug: {
        rawScore:          bestRawScore,
        secondBestScore:   secondRawScore,
        gap,
        matchedKeywords:   bestMatchedKeywords,
        candidateTheme:    bestEntry.theme,
        candidateSubtheme: bestEntry.subtheme,
        hitFlags:          bestHitFlags,
        // Fallback trace
        fallbackConsidered: false,
        fallbackAccepted:   false,
        fallbackRejected:   false,
        reason:             "node-match-used",
      },
    };
  }

  // ── Keyword / theme-name match — must pass BOTH MIN_SCORE and MIN_GAP ────
  // (Fallback path — only reached when no mapped node matched)
  const fallbackConsidered = true;

  if (bestRawScore >= MIN_SCORE && gap >= MIN_GAP && bestEntry) {
    const confidence = toConfidence(bestRawScore);
    const matchedBy  = classifyMatchedBy(confidence, bestHitFlags);

    if (matchedBy !== "unmatched") {
      return {
        paper:     bestEntry.paper,
        subject:   bestEntry.subject,
        theme:     bestEntry.theme,
        subtheme:  bestEntry.subtheme,
        confidence,
        matchedBy,
        _debug: {
          rawScore:          bestRawScore,
          secondBestScore:   secondRawScore,
          gap,
          matchedKeywords:   bestMatchedKeywords,
          candidateTheme:    bestEntry.theme,
          candidateSubtheme: bestEntry.subtheme,
          hitFlags:          bestHitFlags,
          // Fallback trace
          fallbackConsidered: true,
          fallbackAccepted:   true,
          fallbackRejected:   false,
          reason:             "accepted",
        },
      };
    }

    // Passed score+gap but classifyMatchedBy returned "unmatched" (no theme/keyword hit)
    const confidence0 = bestRawScore > 0 ? toConfidence(bestRawScore) : 0;
    return {
      paper,
      subject: subject || "",
      theme:   null,
      subtheme: null,
      confidence: confidence0,
      matchedBy: "unmatched",
      _debug: {
        rawScore:          bestRawScore,
        secondBestScore:   secondRawScore,
        gap,
        matchedKeywords:   bestMatchedKeywords,
        candidateTheme:    bestEntry?.theme    || null,
        candidateSubtheme: bestEntry?.subtheme || null,
        candidateSubject:  bestEntry?.subject  || null,
        hitFlags:          bestHitFlags,
        fallbackConsidered: true,
        fallbackAccepted:   false,
        fallbackRejected:   true,
        reason:             "no-theme-hit",
      },
    };
  }

  // ── Tie-safety: gap too small ──────────────────────────────────────────────
  const rejectionReason = bestRawScore < MIN_SCORE
    ? "score-below-threshold"
    : "gap-below-threshold";

  const confidence = bestRawScore > 0 ? toConfidence(bestRawScore) : 0;
  return {
    paper,
    subject: subject || "",
    theme:   null,
    subtheme: null,
    confidence,
    matchedBy: "unmatched",
    _debug: {
      rawScore:          bestRawScore,
      secondBestScore:   secondRawScore,
      gap,
      matchedKeywords:   bestMatchedKeywords,
      candidateTheme:    bestEntry?.theme    || null,
      candidateSubtheme: bestEntry?.subtheme || null,
      candidateSubject:  bestEntry?.subject  || null,
      hitFlags:          bestHitFlags,
      // Fallback trace
      fallbackConsidered: true,
      fallbackAccepted:   false,
      fallbackRejected:   true,
      reason:             rejectionReason,
    },
  };
}
