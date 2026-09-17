import express from "express";
import {
  UNIFIED_SYLLABUS_INDEX,
  UNIFIED_NODES_BY_ID,
  getNodeById,
  getChildNodeIds,
  resolveToCanonicalNodeIds,
} from "../brain/unifiedSyllabusIndex.js";
import {
  getPyqSummaryForNode,
  getPyqQuestionIdsForTopic,
} from "../brain/pyqLinkEngine.js";
import { computeSyllabusProgress, buildUnifiedNodeList } from "../brain/syllabusProgressEngine.js";
import { getWeaknessMapForUser } from "../services/weaknessScoringService.js";
import { query } from "../db/index.js";

import { buildPyqCorpusInventory, getWorkspacePyqMetrics, resolveMappingNode } from '../brain/pyqCorpusInventory.js';
import { fetchAttemptedPyqIds } from '../services/pyqInventoryService.js';
import { getPhysicalExamIdentity } from '../brain/pyqPhysicalIdentity.js';
import { getAuthUserId } from '../middleware/authMiddleware.js';
const router = express.Router();

// Kept as an export for existing local audit callers.
export function calculateMasterCorpusCounts() {
  return buildPyqCorpusInventory();
}

// Helper to normalize paperKey URL param to canonical paper key
function normalizePaperKey(param = "") {
  const p = String(param || "").trim().toLowerCase();
  if (p === "gs1") return "GS1";
  if (p === "gs2") return "GS2";
  if (p === "gs3") return "GS3";
  if (p === "gs4" || p === "ethics") return "GS4";
  if (p === "essay") return "ESSAY";
  if (p === "csat") return "CSAT";
  if (p === "optional-p1" || p === "optional_p1" || p === "optional-paper1" || p === "opt-geo1") return "OPTIONAL_P1";
  if (p === "optional-p2" || p === "optional_p2" || p === "optional-paper2" || p === "opt-geo2") return "OPTIONAL_P2";
  return p.toUpperCase().replace("-", "_");
}

function getPaperMeta(canonicalPaperKey) {
  switch (canonicalPaperKey) {
    case "GS1":
      return {
        paperKey: "gs1",
        canonicalPaperKey: "GS1",
        title: "GENERAL STUDIES PAPER I",
        subtitle: "GS1 Coverage",
        subjectsSummary: "History · Indian Society · Geography",
      };
    case "GS2":
      return {
        paperKey: "gs2",
        canonicalPaperKey: "GS2",
        title: "GENERAL STUDIES PAPER II",
        subtitle: "GS2 Coverage",
        subjectsSummary: "Polity · Governance · Social Justice · International Relations",
      };
    case "GS3":
      return {
        paperKey: "gs3",
        canonicalPaperKey: "GS3",
        title: "GENERAL STUDIES PAPER III",
        subtitle: "GS3 Coverage",
        subjectsSummary: "Economy · Environment · Security · Science & Tech",
      };
    case "GS4":
      return {
        paperKey: "gs4",
        canonicalPaperKey: "GS4",
        title: "GENERAL STUDIES PAPER IV",
        subtitle: "Ethics, Integrity & Aptitude",
        subjectsSummary: "Ethics & Human Interface · Human Values · Governance Integrity",
      };
    case "ESSAY":
      return {
        paperKey: "essay",
        canonicalPaperKey: "ESSAY",
        title: "ESSAY PAPER",
        subtitle: "Essay Themes & Ideas",
        subjectsSummary: "Philosophical · Society · Governance · Tech & Environment",
      };
    case "CSAT":
      return {
        paperKey: "csat",
        canonicalPaperKey: "CSAT",
        title: "CSAT (GS PAPER II - PRELIMS)",
        subtitle: "Aptitude & Comprehension",
        subjectsSummary: "Comprehension · Logical Reasoning · Basic Numeracy",
      };
    case "OPTIONAL_P1":
      return {
        paperKey: "optional-p1",
        canonicalPaperKey: "OPTIONAL_P1",
        title: "GEOGRAPHY OPTIONAL — PAPER 1",
        subtitle: "Physical & Human Geography",
        subjectsSummary: "Geomorphology · Climatology · Oceanography · Economic Geography",
      };
    case "OPTIONAL_P2":
      return {
        paperKey: "optional-p2",
        canonicalPaperKey: "OPTIONAL_P2",
        title: "GEOGRAPHY OPTIONAL — PAPER 2",
        subtitle: "Geography of India",
        subjectsSummary: "Physical Setting · Agriculture · Industry · Regional Planning",
      };
    default:
      return {
        paperKey: canonicalPaperKey.toLowerCase().replace("_", "-"),
        canonicalPaperKey,
        title: canonicalPaperKey,
        subtitle: `${canonicalPaperKey} Coverage`,
        subjectsSummary: "Syllabus Topics",
      };
  }
}

// Helper to extract weak base node IDs for a user via canonical index resolution
async function getWeakNodeSetForUser(userId = "moulika") {
  const weakSet = new Set();
  try {
    const weaknessMap = await getWeaknessMapForUser(userId);
    for (const rawKey of Object.keys(weaknessMap || {})) {
      const baseId = rawKey.split("::")[0].trim();
      if (baseId) {
        weakSet.add(baseId);
        weakSet.add(baseId.toUpperCase());
        weakSet.add(baseId.replace(/\./g, "-"));

        const canonicalIds = resolveToCanonicalNodeIds(baseId);
        for (const cid of canonicalIds) {
          weakSet.add(cid);
          weakSet.add(cid.toUpperCase());
        }
      }
    }
  } catch (err) {
    console.error("[syllabusDrilldown] Failed to get weakness map:", err.message);
  }
  return weakSet;
}

// Fetch user node progress from DB
async function fetchUserNodeProgress(userId = "moulika") {
  const progressMap = {};
  try {
    const res = await query(
      "SELECT node_id, status, coverage_percent, revision_count, last_revised_at, updated_at FROM public.syllabus_node_progress WHERE user_id = $1",
      [userId]
    );
    if (res.rows && res.rows.length > 0) {
      for (const row of res.rows) {
        progressMap[row.node_id] = {
          status: row.status || "untouched",
          coverage: (row.coverage_percent || 0) / 100,
          revisionCount: row.revision_count || 0,
          lastRevisedAt: row.last_revised_at || null,
          updatedAt: row.updated_at || null,
        };
      }
    }
  } catch (e) {
    // Return empty map if DB query fails safely
  }
  return progressMap;
}

// Fetch user pyq attempt records for a set of question IDs
async function fetchUserPyqAttempts(questionIds = [], userId = "moulika") {
  const attemptMap = {};
  if (!questionIds.length) return attemptMap;

  try {
    const pRes = await query(
      `SELECT question_id, is_correct, selected_option, created_at FROM public.pyq_attempts WHERE user_id = $1 AND question_id = ANY($2::text[])`,
      [userId, questionIds]
    );
    if (pRes?.rows) {
      for (const r of pRes.rows) {
        attemptMap[r.question_id] = {
          attempted: true,
          isCorrect: r.is_correct ?? null,
          userAnswer: r.selected_option ?? null,
          attemptedAt: r.created_at || null,
        };
      }
    }

    const mRes = await query(
      `SELECT question_id, score, evaluation_json, created_at FROM public.mains_answer_attempts WHERE user_id = $1 AND question_id = ANY($2::text[])`,
      [userId, questionIds]
    );
    if (mRes?.rows) {
      for (const r of mRes.rows) {
        if (!attemptMap[r.question_id]) {
          attemptMap[r.question_id] = {
            attempted: true,
            isCorrect: (r.score || 0) >= 5,
            userAnswer: "Answer submitted",
            attemptedAt: r.created_at || null,
          };
        }
      }
    }
  } catch (e) {
    // Ignore safe failure
  }
  return attemptMap;
}

// Build hierarchical node tree for a paper
function buildPaperHierarchy(canonicalPaperKey, progressMap = {}, weakSet = new Set(), actionableNodeIds = new Set(), inventory = buildPyqCorpusInventory()) {
  const allPaperNodes = UNIFIED_SYLLABUS_INDEX.filter((n) => {
    const root = (n.rootPaper || n.paperKey || "").toUpperCase().replace("-", "_");
    if (canonicalPaperKey === "OPTIONAL_P1") return root === "OPTIONAL_PAPER1" || root === "OPTIONAL_P1";
    if (canonicalPaperKey === "OPTIONAL_P2") return root === "OPTIONAL_PAPER2" || root === "OPTIONAL_P2";
    return root === canonicalPaperKey;
  });

  const subjectGroups = {};
  for (const node of allPaperNodes) {
    const subject = node.subject || "General";
    const section = node.section || "Core Topics";

    if (!subjectGroups[subject]) subjectGroups[subject] = {};
    if (!subjectGroups[subject][section]) subjectGroups[subject][section] = [];

    subjectGroups[subject][section].push(node);
  }

  const hierarchy = [];

  for (const [subjectName, sections] of Object.entries(subjectGroups)) {
    const sectionNodes = [];

    for (const [sectionName, nodes] of Object.entries(sections)) {
      const topicNodes = nodes.map((node) => {
        const prog = progressMap[node.syllabusNodeId] || {};
        const qids = getPyqQuestionIdsForTopic(node.syllabusNodeId);
        const pyqCount = new Set(qids).size;

        let status = prog.status || "untouched";
        if (status === "untouched" && prog.coverage > 0) {
          if (prog.coverage >= 0.95) status = "mastered";
          else if (prog.coverage >= 0.75) status = "revised";
          else if (prog.coverage >= 0.5) status = "covered";
          else if (prog.coverage > 0) status = "in_progress";
        }

        const isWeak = weakSet.has(node.syllabusNodeId) || Array.from(weakSet).some((w) => node.syllabusNodeId.startsWith(w) || w.startsWith(node.syllabusNodeId));
        const isActionable = actionableNodeIds.has(node.syllabusNodeId);

        return {
          nodeId: node.syllabusNodeId,
          name: node.name || node.topic || node.microTheme || node.syllabusNodeId,
          subject: subjectName,
          section: sectionName,
          level: node.level || 3,
          isActionable,
          status,
          coveragePercent: Math.round((prog.coverage || 0) * 100),
          linkedPyqCount: pyqCount,
          attemptedPyqCount: 0,
          isWeak,
          isRevisionDue: false,
          children: [],
        };
      });

      const secQSet = new Set();
      nodes.forEach((n) => {
        const qids = getPyqQuestionIdsForTopic(n.syllabusNodeId);
        qids.forEach((id) => secQSet.add(id));
      });
      // A section-level association contributes to the section count without
      // pretending that any individual child microtheme has that mapping.
      const sectionIds = new Set(nodes.map(n => n.syllabusNodeId));
      for (const mapping of inventory.mappings) {
        if (mapping.physicalPaper && mapping.canonicalNodeIds.length && mapping.canonicalNodeIds.every(id => sectionIds.has(id))) secQSet.add(mapping.id);
      }

      const actionableSectionNodes = topicNodes.filter((t) => t.isActionable);
      const totalSectionNodes = actionableSectionNodes.length || topicNodes.length;
      const coveredSectionNodes = actionableSectionNodes.filter((t) => ["covered", "revised", "mastered"].includes(t.status)).length;
      const inProgressSectionNodes = actionableSectionNodes.filter((t) => t.status === "in_progress").length;

      let sectionStatus = "untouched";
      if (coveredSectionNodes === totalSectionNodes && totalSectionNodes > 0) sectionStatus = "covered";
      else if (coveredSectionNodes > 0 || inProgressSectionNodes > 0) sectionStatus = "in_progress";

      sectionNodes.push({
        nodeId: `SEC-${subjectName}-${sectionName}`.replace(/\s+/g, "_"),
        name: sectionName,
        subject: subjectName,
        level: 2,
        isActionable: false,
        status: sectionStatus,
        coveredCount: coveredSectionNodes,
        totalCount: totalSectionNodes,
        linkedPyqCount: secQSet.size,
        children: topicNodes,
      });
    }

    const totalSubjNodes = sectionNodes.reduce((acc, s) => acc + s.totalCount, 0);
    const coveredSubjNodes = sectionNodes.reduce((acc, s) => acc + s.coveredCount, 0);

    hierarchy.push({
      nodeId: `SUBJ-${subjectName}`.replace(/\s+/g, "_"),
      name: subjectName,
      subject: subjectName,
      level: 1,
      isActionable: false,
      coveredCount: coveredSubjNodes,
      totalCount: totalSubjNodes,
      sections: sectionNodes,
    });
  }

  return hierarchy;
}

// ---------------------------------------------------------
// GET /api/syllabus/papers/:paperKey
// ---------------------------------------------------------
router.get("/papers/:paperKey", async (req, res) => {
  try {
    const { paperKey } = req.params;
    const userId = getAuthUserId(req) || "moulika";
    const canonicalKey = normalizePaperKey(paperKey);
    const meta = getPaperMeta(canonicalKey);

    // 1) Canonical progress engine for paper summary totals
    const progressEngineRes = await computeSyllabusProgress();
    const paperProgressData = progressEngineRes.papers.find((p) => {
      const pKey = p.paperKey.toUpperCase().replace("-", "_");
      return pKey === canonicalKey;
    });

    const totals = paperProgressData?.totals || {};

    // 2) Weakness map for live weak nodes via canonical index resolution
    const weakSet = await getWeakNodeSetForUser(userId);

    // 3) Actionable nodes list for this paper
    const actionableList = buildUnifiedNodeList().filter((n) => {
      const pKey = n.paperKey.toUpperCase().replace("-", "_");
      return pKey === canonicalKey;
    });
    const actionableNodeIds = new Set(actionableList.map((n) => n.nodeId));

    // Calculate unique weak node count for this paper
    const rawWeaknessMap = await getWeaknessMapForUser(userId);
    let weakCount = 0;
    for (const rawKey of Object.keys(rawWeaknessMap || {})) {
      const baseId = rawKey.split("::")[0].trim();
      const canonicalIds = resolveToCanonicalNodeIds(baseId);
      const targetIds = canonicalIds.length ? canonicalIds : [baseId];

      const belongsToPaper = targetIds.some((cid) => {
        const node = getNodeById(cid);
        const pKey = (node?.rootPaper || node?.paperKey || "").toUpperCase().replace("-", "_");
        if (canonicalKey === "OPTIONAL_P1") return pKey === "OPTIONAL_PAPER1" || pKey === "OPTIONAL_P1";
        if (canonicalKey === "OPTIONAL_P2") return pKey === "OPTIONAL_PAPER2" || pKey === "OPTIONAL_P2";
        if (pKey === canonicalKey) return true;
        if (canonicalKey === "GS1" && (cid.startsWith("1C") || cid.startsWith("GS1"))) return true;
        if (canonicalKey === "GS2" && (cid.startsWith("2P") || cid.startsWith("GS2"))) return true;
        if (canonicalKey === "GS3" && (cid.startsWith("3E") || cid.startsWith("GS3"))) return true;
        if (canonicalKey === "GS4" && (cid.startsWith("4E") || cid.startsWith("GS4") || cid.startsWith("ETH"))) return true;
        return false;
      });

      if (belongsToPaper) weakCount++;
    }

    const inventory = buildPyqCorpusInventory();
    const metrics = getWorkspacePyqMetrics(canonicalKey, await fetchAttemptedPyqIds(userId), inventory);
    const corpusTotal = metrics.physicalCorpusTotal;
    const mappedUnique = metrics.mappedInCorpusUnique;
    const unmapped = metrics.unmappedInCorpus;

    const summary = {
      totalNodes: totals.totalNodes || actionableList.length,
      coveredNodes: (totals.coveredNodes || 0) + (totals.revisedNodes || 0) + (totals.masteredNodes || 0),
      inProgressNodes: totals.inProgressNodes || 0,
      untouchedNodes: totals.untouchedNodes || (totals.totalNodes || actionableList.length),
      revisedNodes: totals.revisedNodes || 0,
      masteredNodes: totals.masteredNodes || 0,
      weakNodesCount: weakCount,
      // PYQ user attempt exposure semantics
      totalPyqs: corpusTotal,
      mappedPyqs: mappedUnique,
      unmappedPyqs: unmapped,
      attemptedPyqs: metrics.attemptedUnique,
      pyqCoveragePercent: metrics.pyqExposurePercent,
      pyqExposurePercent: metrics.pyqExposurePercent,
      mappingCompletenessPercent: metrics.mappingCoverage,
    };

    const pyq = { ...metrics, mappedUnique, unmapped };

    const progressMap = await fetchUserNodeProgress(userId);
    const hierarchy = buildPaperHierarchy(canonicalKey, progressMap, weakSet, actionableNodeIds, inventory);

    return res.json({
      ok: true,
      paperKey: meta.paperKey,
      canonicalPaperKey: meta.canonicalPaperKey,
      title: meta.title,
      subtitle: meta.subtitle,
      subjectsSummary: meta.subjectsSummary,
      summary,
      pyq,
      hierarchy,
    });
  } catch (err) {
    console.error("[syllabusDrilldown] GET /papers/:paperKey failed:", err);
    return res.status(500).json({ ok: false, error: err.message || "Failed to load paper syllabus" });
  }
});

// ---------------------------------------------------------
// GET /api/syllabus/nodes/:nodeId
// ---------------------------------------------------------
router.get("/nodes/:nodeId", async (req, res) => {
  try {
    const { nodeId } = req.params;
    const userId = getAuthUserId(req) || "moulika";

    const node = getNodeById(nodeId) || UNIFIED_NODES_BY_ID[nodeId] || resolveMappingNode(nodeId).node;

    if (!node) {
      return res.status(404).json({ ok: false, error: `Node ${nodeId} not found in canonical syllabus` });
    }

    const progressMap = await fetchUserNodeProgress(userId);
    const prog = progressMap[nodeId] || {};

    const pyqSummary = getPyqSummaryForNode(nodeId, 200);

    const childIds = getChildNodeIds(nodeId).length ? getChildNodeIds(nodeId) : node.isContainer ? resolveMappingNode(nodeId).canonicalNodeIds.filter(id => id !== nodeId) : [];
    const children = childIds.map((cid) => {
      const cnode = getNodeById(cid);
      const cprog = progressMap[cid] || {};
      const cpyqQids = getPyqQuestionIdsForTopic(cid);
      return {
        nodeId: cid,
        name: cnode?.name || cnode?.topic || cid,
        status: cprog.status || "untouched",
        coveragePercent: Math.round((cprog.coverage || 0) * 100),
        linkedPyqCount: new Set(cpyqQids).size,
      };
    });

    const isLeaf = children.length === 0;

    // Weakness check
    const weakSet = await getWeakNodeSetForUser(userId);
    const isWeak =
      weakSet.has(nodeId) ||
      weakSet.has(nodeId.replace(/-/g, ".")) ||
      weakSet.has(nodeId.replace(/\./g, "-")) ||
      Array.from(weakSet).some((w) => nodeId.startsWith(w) || w.startsWith(nodeId));

    // Breadcrumbs
    const paperKey = (node.rootPaper || node.paperKey || "GS1").toLowerCase();
    const breadcrumbs = [
      { label: "Syllabus", path: "/syllabus" },
      { label: node.rootPaper || node.paperKey || "GS1", path: `/syllabus/${paperKey}` },
    ];
    if (node.subject) {
      breadcrumbs.push({ label: node.subject, path: `/syllabus/${paperKey}` });
    }
    if (node.section) {
      breadcrumbs.push({ label: node.section, path: `/syllabus/${paperKey}` });
    }
    breadcrumbs.push({ label: node.name || node.topic || nodeId, path: null });

    const status = prog.status || (prog.coverage >= 0.5 ? "covered" : prog.coverage > 0 ? "in_progress" : "untouched");
    const pyqCount = pyqSummary.total;
    const recommendations = [];

    if (isWeak) {
      recommendations.push("Topic flagged as weak zone! Prioritize core concept recovery block.");
    }
    if (status === "untouched") {
      recommendations.push("Topic has not been started yet. Schedule an initial concept study block.");
      if (pyqCount > 0) {
        recommendations.push(`Review the ${pyqCount} linked PYQs to understand UPSC exam trends.`);
      }
    } else if (status === "in_progress") {
      recommendations.push("Topic is partially covered. Complete core reading & micro-theme revision.");
      if (pyqCount > 0) {
        recommendations.push(`Solve linked ${pyqSummary.prelimsCount > 0 ? 'Prelims' : 'Mains'} PYQs for high-yield practice.`);
      }
    } else {
      recommendations.push("Topic is covered. Keep your edge sharp with active recall & timed PYQ tests.");
      if (pyqSummary.mainsCount > 0) {
        recommendations.push("Write a Mains answer for this topic to test structure & analytical depth.");
      }
    }

    return res.json({
      ok: true,
      node: {
        nodeId: node.syllabusNodeId,
        name: node.name || node.topic || node.syllabusNodeId,
        paperKey: node.rootPaper || node.paperKey,
        subject: node.subject,
        section: node.section,
        topic: node.topic,
        subtopic: node.subtopic,
        microTheme: node.microTheme,
      },
      breadcrumbs,
      isLeaf,
      children,
      coverage: {
        status,
        coveragePercent: Math.round((prog.coverage || 0) * 100),
        lastActivityAt: prog.updatedAt || null,
        revisionCount: prog.revisionCount || 0,
        lastRevisedAt: prog.lastRevisedAt || null,
        isRevisionDue: false,
        isWeak,
        weaknessReason: isWeak ? "Scored weak in PYQ/test signals" : null,
        mistakeCount: 0,
      },
      pyqSummary: {
        total: pyqSummary.total,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        prelimsCount: pyqSummary.prelimsCount,
        mainsCount: pyqSummary.mainsCount,
        essayCount: pyqSummary.essayCount,
        ethicsCount: pyqSummary.ethicsCount,
        optionalCount: pyqSummary.optionalCount,
        csatCount: pyqSummary.csatCount,
      },
      mentorAction: {
        statusSummary: `${node.name || nodeId} is currently ${status.replace("_", " ")}${isWeak ? " (Weak Zone)" : ""} with ${pyqCount} linked PYQs.`,
        recommendations,
        actionTarget: `/focus?nodeId=${encodeURIComponent(nodeId)}`,
      },
    });
  } catch (err) {
    console.error("[syllabusDrilldown] GET /nodes/:nodeId failed:", err);
    return res.status(500).json({ ok: false, error: err.message || "Failed to load node details" });
  }
});

// ---------------------------------------------------------
// GET /api/syllabus/nodes/:nodeId/pyqs
// ---------------------------------------------------------
router.get("/nodes/:nodeId/pyqs", async (req, res) => {
  try {
    const { nodeId } = req.params;
    const userId = getAuthUserId(req) || "moulika";

    const pyqSummary = getPyqSummaryForNode(nodeId, 200);
    const questions = pyqSummary.questions || [];

    const qIds = questions.map((q) => q.id).filter(Boolean);
    const attemptMap = await fetchUserPyqAttempts(qIds, userId);

    const enrichedQuestions = questions.map((q) => {
      const att = attemptMap[q.id] || { attempted: false, isCorrect: null, userAnswer: null };
      return {
        id: q.id,
        year: q.year || null,
        paper: getPhysicalExamIdentity(q).physicalPaper,
        physicalPaper: getPhysicalExamIdentity(q).physicalPaper,
        sourcePaper: q.paper || null,
        syllabusNodeId: q.syllabusNodeId || null,
        canonicalNodeIds: resolveMappingNode(q.syllabusNodeId || q.nodeId).canonicalNodeIds,
        subject: q.subject || null,
        stage: q.stage || null,
        question: q.question || q.questionText || "Question text unavailable",
        marks: q.marks || null,
        options: q.options || null,
        answer: q.answer || null,
        sourceCertification: q.sourceCertification || { status: "no-detected-content-conflict" },
        attemptStatus: att.attempted ? "attempted" : "unattempted",
        isCorrect: att.isCorrect,
        userAnswer: att.userAnswer,
      };
    });

    return res.json({
      ok: true,
      nodeId,
      total: pyqSummary.total,
      returnedCount: enrichedQuestions.length,
      questions: enrichedQuestions,
    });
  } catch (err) {
    console.error("[syllabusDrilldown] GET /nodes/:nodeId/pyqs failed:", err);
    return res.status(500).json({ ok: false, error: err.message || "Failed to load node PYQs" });
  }
});

export default router;
