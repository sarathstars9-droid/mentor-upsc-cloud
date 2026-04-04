// backend/brain/mainsThemeAggregator.js
// Builds the derived theme-PYQ index from tagged Mains questions + theme matcher.
//
// Bucket output shape per subtheme:
//   { questionIds, count, years, lastAskedYear, directives, topDirective }
//
// Unmatched entry shape:
//   { id, paper, question, theme, syllabusNodeId,
//     bestCandidate: { subject, theme, subtheme, confidence, matchedBy }, reason }
//
// Tagged question files remain the source of truth.
// This aggregator is a read-only consumer.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { matchQuestionToTheme } from "./mainsThemeMatcher.js";
import { normalizeDirective, getTopDirective } from "./mainsDirectiveUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const MAINS_DATA_DIR = path.join(__dirname, "..", "data", "pyq_questions", "mains");

// ─── File manifest ────────────────────────────────────────────────────────────
const MAINS_FILE_MAP = [
  // GS1
  { file: "mains_gs1_history_tagged.json",       paper: "GS1", subject: "History"     },
  { file: "mains_gs1_geography_tagged.json",     paper: "GS1", subject: "Geography"   },
  { file: "mains_gs1_society_tagged.json",       paper: "GS1", subject: "Society"     },
  { file: "mains_gs1_art_culture_tagged.json",   paper: "GS1", subject: "Art & Culture" },
  // GS2
  { file: "mains_gs2_polity_tagged.json",                  paper: "GS2", subject: "Polity"                  },
  { file: "mains_gs2_governance_tagged.json",              paper: "GS2", subject: "Governance"              },
  { file: "mains_gs2_social_justice_tagged.json",          paper: "GS2", subject: "Social Justice"          },
  { file: "mains_gs2_international_relations_tagged.json", paper: "GS2", subject: "International Relations" },
  // GS3
  { file: "mains_gs3_economy_tagged.json",             paper: "GS3", subject: "Economy"               },
  { file: "mains_gs3_agriculture_tagged.json",         paper: "GS3", subject: "Economy"               }, // folded under Economy
  { file: "mains_gs3_environment_tagged.json",         paper: "GS3", subject: "Environment"           },
  { file: "mains_gs3_science_tech_tagged.json",        paper: "GS3", subject: "Science and Technology" },
  { file: "mains_gs3_internal_security_tagged.json",   paper: "GS3", subject: "Internal Security"     },
  { file: "mains_gs3_disaster_management_tagged.json", paper: "GS3", subject: "Internal Security"     }, // folded
  // GS4
  { file: "mains_gs4_ethics_tagged.json", paper: "GS4", subject: "Ethics Theory" },
];

// ─── Load all tagged questions from disk ──────────────────────────────────────
// Only uses reliably-present fields: id, year, questionNumber, directive, theme,
// question, syllabusNodeId. Does NOT assume section/microtheme/keywords.
export function loadAllMainsQuestions() {
  const all  = [];
  const seen = new Set();

  for (const { file, paper, subject } of MAINS_FILE_MAP) {
    const filePath = path.join(MAINS_DATA_DIR, file);
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
      console.warn(`[mainsThemeAggregator] Could not read ${file}:`, err.message);
      continue;
    }

    const questions = Array.isArray(raw?.questions) ? raw.questions : [];
    for (const q of questions) {
      const id = String(q?.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      // Attach inferred paper/subject; tagged file values take precedence
      all.push({
        ...q,
        _paper:   q.paper   || paper,
        _subject: q.subject || subject,
      });
    }
  }

  return all;
}

// ─── Build the aggregated index ───────────────────────────────────────────────

/**
 * Build a nested aggregated theme index from all Mains questions.
 *
 * Returns:
 *   {
 *     matched:       nested index (see bucket shape above),
 *     unmatched:     array of unmatched entries (see shape above),
 *     totalQuestions: number,
 *     matchedByStats: { mappedNodeExact, keywordStrong, keywordModerate, themeNameFallback, unmatched }
 *   }
 */
export function buildMainsThemeIndex() {
  const questions = loadAllMainsQuestions();

  const index      = {};   // nested: paper → subject → theme → subtheme → bucket
  const unmatched  = [];
  const matchedByStats = {
    mappedNodeExact:   0,
    keywordStrong:     0,
    keywordModerate:   0,
    themeNameFallback: 0,
    unmatched:         0,
  };

  for (const q of questions) {
    const paper     = String(q._paper   || q.paper   || "").toUpperCase();
    const subject   = String(q._subject || q.subject || "").trim();
    const qid       = String(q.id || "").trim();
    const year      = q.year ? Number(q.year) : null;
    const rawDir    = String(q.directive || "").trim();
    const directive = normalizeDirective(rawDir);

    if (!paper || !qid) continue;

    const matchResult = matchQuestionToTheme(q, paper, subject);
    const mb = matchResult?.matchedBy || "unmatched";

    // Count in stats
    if (mb in matchedByStats) {
      matchedByStats[mb]++;
    } else {
      matchedByStats.unmatched++;
    }

    if (!matchResult || !matchResult.theme || mb === "unmatched") {
      // Build unmatched entry with bestCandidate from _debug
      const dbg = matchResult?._debug || {};
      unmatched.push({
        id:            qid,
        paper,
        question:      String(q.question || "").slice(0, 200),
        theme:         String(q.theme    || ""),     // tagged theme field (not matched)
        syllabusNodeId: q.syllabusNodeId || "",
        bestCandidate: {
          subject:    dbg.candidateSubject  || subject,
          theme:      dbg.candidateTheme    || null,
          subtheme:   dbg.candidateSubtheme || null,
          confidence: matchResult?.confidence || 0,
          matchedBy:  mb,
        },
        reason: "no-theme-match",
      });
      continue;
    }

    const { theme, subtheme } = matchResult;

    // Initialise nested paths
    if (!index[paper])                              index[paper]                          = {};
    if (!index[paper][subject])                     index[paper][subject]                 = {};
    if (!index[paper][subject][theme])              index[paper][subject][theme]          = {};
    if (!index[paper][subject][theme][subtheme]) {
      index[paper][subject][theme][subtheme] = {
        questionIds:      [],
        count:            0,
        years:            [],
        lastAskedYear:    null,
        directives:       {},   // canonical directive → count
        topDirective:     null,
        // Match-quality accumulators (cleared in post-process)
        _confidenceSum:   0,
        _matchModes:      { mappedNodeExact: 0, keywordStrong: 0, keywordModerate: 0, themeNameFallback: 0 },
        avgConfidence:    null,
        matchModeSummary: {},
      };
    }

    const bucket = index[paper][subject][theme][subtheme];

    if (!bucket.questionIds.includes(qid)) {
      bucket.questionIds.push(qid);
      bucket.count++;

      if (year && !bucket.years.includes(year)) {
        bucket.years.push(year);
      }

      if (year && (!bucket.lastAskedYear || year > bucket.lastAskedYear)) {
        bucket.lastAskedYear = year;
      }

      if (directive) {
        bucket.directives[directive] = (bucket.directives[directive] || 0) + 1;
      }

      // Accumulate match-quality metrics
      const conf = matchResult?.confidence ?? 0;
      bucket._confidenceSum += conf;
      if (mb in bucket._matchModes) {
        bucket._matchModes[mb]++;
      }
    }
  }

  // ── Post-process: sort years desc, compute topDirective + avgConfidence ────
  for (const subjects of Object.values(index)) {
    for (const themes of Object.values(subjects)) {
      for (const subthemes of Object.values(themes)) {
        for (const bucket of Object.values(subthemes)) {
          bucket.years.sort((a, b) => b - a);
          bucket.topDirective = getTopDirective(bucket.directives);
          // Compute & expose match-quality metrics; clean up accumulators
          bucket.avgConfidence    = bucket.count > 0
            ? Math.round((bucket._confidenceSum / bucket.count) * 100) / 100
            : null;
          bucket.matchModeSummary = { ...bucket._matchModes };
          delete bucket._confidenceSum;
          delete bucket._matchModes;
        }
      }
    }
  }

  return { matched: index, unmatched, totalQuestions: questions.length, matchedByStats };
}

// ─── Query helpers (used by API routes) ──────────────────────────────────────

/**
 * Get a count-annotated subject tree for a paper.
 * Returns: [ { subject, count, themes: [{ name, count, subthemes: [{ name, count, lastAskedYear, years, directives, topDirective }] }] } ]
 */
export function getSubjectTreeForPaper(index, paper) {
  const paperData = index[paper] || {};
  const result    = [];

  for (const [subject, themes] of Object.entries(paperData)) {
    const themeList  = [];
    let subjectTotal = 0;

    for (const [themeName, subthemes] of Object.entries(themes)) {
      const subthemeList = [];
      let themeTotal     = 0;

      for (const [subthemeName, bucket] of Object.entries(subthemes)) {
        subthemeList.push({
          name:             subthemeName,
          count:            bucket.count,
          lastAskedYear:    bucket.lastAskedYear,
          years:            bucket.years,
          directives:       bucket.directives,
          topDirective:     bucket.topDirective,
          avgConfidence:    bucket.avgConfidence,
          matchModeSummary: bucket.matchModeSummary,
        });
        themeTotal   += bucket.count;
        subjectTotal += bucket.count;
      }

      subthemeList.sort((a, b) => (b.lastAskedYear || 0) - (a.lastAskedYear || 0));
      themeList.push({ name: themeName, count: themeTotal, subthemes: subthemeList });
    }

    themeList.sort((a, b) => b.count - a.count);
    result.push({ subject, count: subjectTotal, themes: themeList });
  }

  result.sort((a, b) => b.count - a.count);
  return result;
}

/**
 * Get question IDs for a specific theme (all its subthemes combined).
 * Returns: { questionIds, count, years, lastAskedYear }
 */
export function getQuestionIdsForTheme(index, paper, subject, theme) {
  const themeData = index?.[paper]?.[subject]?.[theme] || {};

  const allIds      = [];
  const years       = new Set();
  let lastAskedYear = null;

  for (const bucket of Object.values(themeData)) {
    allIds.push(...bucket.questionIds);
    (bucket.years || []).forEach(y => years.add(y));
    if (bucket.lastAskedYear && (!lastAskedYear || bucket.lastAskedYear > lastAskedYear)) {
      lastAskedYear = bucket.lastAskedYear;
    }
  }

  return {
    questionIds:  [...new Set(allIds)],
    count:        allIds.length,
    years:        [...years].sort((a, b) => b - a),
    lastAskedYear,
  };
}

/**
 * Get question IDs for a specific subtheme.
 * Returns: { questionIds, count, years, lastAskedYear, directives, topDirective }
 */
export function getQuestionIdsForSubtheme(index, paper, subject, theme, subtheme) {
  const bucket = index?.[paper]?.[subject]?.[theme]?.[subtheme];
  if (!bucket) return {
    questionIds: [], count: 0, years: [], lastAskedYear: null,
    directives: {}, topDirective: null,
  };
  return {
    questionIds:      bucket.questionIds      || [],
    count:            bucket.count            || 0,
    years:            bucket.years            || [],
    lastAskedYear:    bucket.lastAskedYear    || null,
    directives:       bucket.directives       || {},
    topDirective:     bucket.topDirective     || null,
    avgConfidence:    bucket.avgConfidence    ?? null,
    matchModeSummary: bucket.matchModeSummary || {},
  };
}
