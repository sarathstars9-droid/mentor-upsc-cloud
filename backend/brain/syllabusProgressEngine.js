import fs from "fs";
import path from "path";
import { SYLLABUS_GRAPH_2026 } from "./syllabusGraph.js";
import { GS4_2026 } from "./syllabusGS4.js";
import { ESSAY_2026 } from "./syllabusEssay.js";
import { CSAT_2026 } from "./syllabusCSAT.js";
import OPTIONAL_2026 from "./syllabusOptional.js";

const DATA_DIR = path.join(process.cwd(), "data");
const PYQ_INDEX_DIR = path.join(DATA_DIR, "pyq_index");

const NODE_PROGRESS_FILE = path.join(DATA_DIR, "nodeProgress.json");
const PYQ_PROGRESS_FILE = path.join(DATA_DIR, "pyqProgress.json");
const TEST_SESSIONS_FILE = path.join(DATA_DIR, "testSessions.json");
const ACTIVITY_LOG_FILE = path.join(DATA_DIR, "activityLog.json");
const PYQ_BY_NODE_FILE = path.join(PYQ_INDEX_DIR, "pyq_by_node.json");

function safeReadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function avg(arr = []) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + safeNum(x, 0), 0) / arr.length;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const out = new Set();

  for (const raw of tags) {
    const t = String(raw || "").toUpperCase().trim();
    if (t === "PM") {
      out.add("P");
      out.add("M");
    } else if (t) {
      out.add(t);
    }
  }

  return Array.from(out);
}

function pushNode({
  out,
  nodeId,
  name,
  paperKey,
  paperLabel,
  subject,
  section,
  tags = [],
  microThemes = [],
  keywords = [],
  pathLabel = "",
}) {
  if (!nodeId) return;

  out.push({
    nodeId,
    name: name || nodeId,
    paperKey,
    paperLabel,
    subject: subject || "",
    section: section || "",
    tags: normalizeTags(tags),
    microThemes: Array.isArray(microThemes) ? microThemes : [],
    keywords: Array.isArray(keywords) ? keywords : [],
    pathLabel,
  });
}

function flattenGs123() {
  const out = [];

  for (const paperKey of ["GS1", "GS2", "GS3"]) {
    const paper = SYLLABUS_GRAPH_2026?.[paperKey];
    const paperLabel = paperKey;

    for (const [subjectName, subjectValue] of Object.entries(paper?.subjects || {})) {
      for (const section of subjectValue?.sections || []) {
        for (const topic of section?.topics || []) {
          pushNode({
            out,
            nodeId: topic.id,
            name: topic.name,
            paperKey,
            paperLabel,
            subject: subjectName,
            section: section.name,
            tags: topic.tags,
            microThemes: topic.microThemes,
            keywords: topic.keywords,
            pathLabel: `${paperLabel} > ${subjectName} > ${section.name} > ${topic.name}`,
          });

          for (const subTopic of topic?.subTopics || []) {
            pushNode({
              out,
              nodeId: subTopic.id,
              name: subTopic.name,
              paperKey,
              paperLabel,
              subject: subjectName,
              section: section.name,
              tags: subTopic.tags?.length ? subTopic.tags : topic.tags,
              microThemes: subTopic.microThemes,
              keywords: subTopic.keywords,
              pathLabel: `${paperLabel} > ${subjectName} > ${section.name} > ${topic.name} > ${subTopic.name}`,
            });
          }
        }
      }

      for (const block of subjectValue?.blocks || []) {
        for (const micro of block?.microThemes || []) {
          pushNode({
            out,
            nodeId: micro.code,
            name: micro.title,
            paperKey,
            paperLabel,
            subject: subjectName,
            section: block.block,
            tags: [micro.examTag || "PM"],
            microThemes: (micro.subtopics || []).map((x) => x?.t).filter(Boolean),
            keywords: micro.keywords || [],
            pathLabel: `${paperLabel} > ${subjectName} > ${block.block} > ${micro.title}`,
          });
        }
      }
    }
  }

  return out;
}

function flattenGs4() {
  const out = [];
  const paperKey = "GS4";
  const paperLabel = "GS4";

  for (const section of GS4_2026?.sections || []) {
    for (const topic of section?.topics || []) {
      pushNode({
        out,
        nodeId: topic.id,
        name: topic.name,
        paperKey,
        paperLabel,
        subject: "Ethics",
        section: section.name,
        tags: topic.tags,
        microThemes: topic.microThemes,
        keywords: topic.keywords,
        pathLabel: `${paperLabel} > ${section.name} > ${topic.name}`,
      });

      for (const subTopic of topic?.subTopics || []) {
        pushNode({
          out,
          nodeId: subTopic.id,
          name: subTopic.name,
          paperKey,
          paperLabel,
          subject: "Ethics",
          section: section.name,
          tags: subTopic.tags?.length ? subTopic.tags : topic.tags,
          microThemes: subTopic.microThemes,
          keywords: subTopic.keywords,
          pathLabel: `${paperLabel} > ${section.name} > ${topic.name} > ${subTopic.name}`,
        });
      }
    }
  }

  return out;
}

function flattenEssay() {
  const out = [];
  const paperKey = "ESSAY";
  const paperLabel = "Essay";

  for (const section of ESSAY_2026?.sections || []) {
    for (const topic of section?.topics || []) {
      pushNode({
        out,
        nodeId: topic.id,
        name: topic.name,
        paperKey,
        paperLabel,
        subject: "Essay",
        section: section.name,
        tags: topic.tags,
        microThemes: topic.microThemes,
        keywords: topic.keywords,
        pathLabel: `${paperLabel} > ${section.name} > ${topic.name}`,
      });
    }
  }

  return out;
}

function flattenCsat() {
  const out = [];
  const paperKey = "CSAT";
  const paperLabel = "CSAT";

  for (const section of CSAT_2026?.sections || []) {
    for (const topic of section?.topics || []) {
      pushNode({
        out,
        nodeId: topic.id,
        name: topic.name,
        paperKey,
        paperLabel,
        subject: section.name,
        section: section.name,
        tags: topic.tags,
        microThemes: topic.microThemes,
        keywords: topic.keywords,
        pathLabel: `${paperLabel} > ${section.name} > ${topic.name}`,
      });
    }
  }

  return out;
}

function flattenOptional() {
  const out = [];

  for (const paperKey of ["Paper1", "Paper2"]) {
    const optPaper = OPTIONAL_2026?.[paperKey];
    const finalPaperKey = paperKey === "Paper1" ? "OPTIONAL_P1" : "OPTIONAL_P2";
    const finalPaperLabel = paperKey === "Paper1" ? "Optional P1" : "Optional P2";

    for (const section of optPaper?.sections || []) {
      for (const topic of section?.topics || []) {
        pushNode({
          out,
          nodeId: topic.id,
          name: topic.name,
          paperKey: finalPaperKey,
          paperLabel: finalPaperLabel,
          subject: "Geography Optional",
          section: section.name,
          tags: topic.tags,
          microThemes: topic.microThemes,
          keywords: topic.keywords,
          pathLabel: `${finalPaperLabel} > ${section.name} > ${topic.name}`,
        });

        for (const subTopic of topic?.subTopics || []) {
          pushNode({
            out,
            nodeId: subTopic.id,
            name: subTopic.name,
            paperKey: finalPaperKey,
            paperLabel: finalPaperLabel,
            subject: "Geography Optional",
            section: section.name,
            tags: subTopic.tags?.length ? subTopic.tags : topic.tags,
            microThemes: subTopic.microThemes,
            keywords: subTopic.keywords,
            pathLabel: `${finalPaperLabel} > ${section.name} > ${topic.name} > ${subTopic.name}`,
          });
        }
      }
    }
  }

  return out;
}

export function buildUnifiedNodeList() {
  return [
    ...flattenGs123(),
    ...flattenGs4(),
    ...flattenEssay(),
    ...flattenCsat(),
    ...flattenOptional(),
  ];
}

function buildPaperShell(paperKey, paperLabel, subtitle = "") {
  return {
    paperKey,
    paperLabel,
    subtitle,
    nodes: [],
    totals: {
      totalNodes: 0,
      touchedNodes: 0,
      inProgressNodes: 0,
      coveredNodes: 0,
      revisedNodes: 0,
      masteredNodes: 0,
      untouchedNodes: 0,
    },
    pyq: {
      totalPyqs: 0,
      attemptedPyqs: 0,
      correctPercent: 0,
      revisedPyqs: 0,
      yearCoveragePercent: 0,
    },
    tests: {
      sectionalCount: 0,
      fullTestCount: 0,
      institutionalTestCount: 0,
    },
    progress: {
      syllabusPercent: 0,
      pyqPercent: 0,
      revisionPercent: 0,
    },
    weakZonesCount: 0,
    lastActivityAt: null,
    readinessScore: 0,
    status: "balanced",
  };
}

function getPaperMap() {
  return {
    GS1: buildPaperShell("GS1", "GS1", "History, Culture, Geography, Society"),
    GS2: buildPaperShell("GS2", "GS2", "Polity, Governance, Social Justice, IR"),
    GS3: buildPaperShell("GS3", "GS3", "Economy, Environment, Security, S&T"),
    GS4: buildPaperShell("GS4", "GS4", "Ethics, Integrity, Aptitude"),
    ESSAY: buildPaperShell("ESSAY", "Essay", "Essay themes and idea clusters"),
    CSAT: buildPaperShell("CSAT", "CSAT", "Comprehension, Reasoning, Numeracy"),
    OPTIONAL_P1: buildPaperShell("OPTIONAL_P1", "Optional P1", "Physical + Human Geography"),
    OPTIONAL_P2: buildPaperShell("OPTIONAL_P2", "Optional P2", "Indian Geography"),
  };
}

function deriveNodeStatus(row = {}) {
  const coverage = clamp(safeNum(row.coverage, 0), 0, 1);
  const revisionCount = safeNum(row.revisionCount, 0);
  const masteryScore = safeNum(row.masteryScore, 0);

  if (masteryScore >= 0.85 || coverage >= 0.95) return "mastered";
  if (revisionCount >= 2 || coverage >= 0.75) return "revised";
  if (coverage >= 0.5) return "covered";
  if (coverage > 0) return "in_progress";
  if (safeNum(row.touchCount, 0) > 0 || row.lastTouchedAt) return "touched";
  return "untouched";
}

function derivePaperStatus(readinessScore) {
  if (readinessScore >= 85) return "exam_ready";
  if (readinessScore >= 70) return "strong";
  if (readinessScore >= 50) return "balanced";
  if (readinessScore >= 30) return "lagging";
  return "critical";
}

function latestDate(values = []) {
  return values
    .filter(Boolean)
    .map((x) => new Date(x).getTime())
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => b - a)[0] || null;
}

function summarizeNodeForWeakZone(node, nodeProgress, pyqProgress, testsByNode) {
  const accuracy = safeNum(pyqProgress?.correctPercent, 0);
  const coverage = safeNum(nodeProgress?.coverage, 0);
  const testAccuracy = avg((testsByNode || []).map((x) => x.accuracy));
  const score = testAccuracy || accuracy;

  if (score >= 50 && coverage >= 0.4) return null;

  let reason = "Low study evidence";
  if (score > 0 && score < 50) reason = "Low PYQ/test accuracy";
  else if (coverage < 0.25) reason = "Very low syllabus coverage";
  else if ((testsByNode || []).length >= 2 && testAccuracy < 50) reason = "Repeated weak test performance";

  return {
    paperKey: node.paperKey,
    topicLabel: node.name,
    nodeId: node.nodeId,
    reason,
    evidenceType: testAccuracy ? "test_signal" : accuracy ? "pyq_signal" : "study_signal",
    priority: score < 35 || coverage < 0.15 ? "high" : "medium",
    suggestedAction:
      score < 50
        ? "Revise concept and solve 10-15 linked questions"
        : "Schedule one focused recovery block",
    weaknessScore: clamp(Math.round((100 - Math.max(score, coverage * 100))), 0, 100),
  };
}

export async function computeSyllabusProgress() {
  const nodeList = buildUnifiedNodeList();
  const paperMap = getPaperMap();

  const nodeProgress = safeReadJson(NODE_PROGRESS_FILE, {});
  const pyqProgress = safeReadJson(PYQ_PROGRESS_FILE, {});
  const testSessions = safeReadJson(TEST_SESSIONS_FILE, []);
  const activityLog = safeReadJson(ACTIVITY_LOG_FILE, []);
  const pyqByNode = safeReadJson(PYQ_BY_NODE_FILE, {});

  const testsByNode = {};
  for (const test of Array.isArray(testSessions) ? testSessions : []) {
    const nodeIds = Array.isArray(test?.nodeIds) ? test.nodeIds : [];
    for (const nodeId of nodeIds) {
      if (!testsByNode[nodeId]) testsByNode[nodeId] = [];
      testsByNode[nodeId].push(test);
    }
  }

  const weakZones = [];
  const untouchedZones = [];

  for (const node of nodeList) {
    const paper = paperMap[node.paperKey];
    if (!paper) continue;

    paper.nodes.push(node);
    paper.totals.totalNodes += 1;

    const progressRow = nodeProgress[node.nodeId] || {};
    const pyqRow = pyqProgress[node.nodeId] || {};
    const nodeTests = testsByNode[node.nodeId] || [];
    const status = deriveNodeStatus(progressRow);

    if (status === "touched") paper.totals.touchedNodes += 1;
    if (status === "in_progress") paper.totals.inProgressNodes += 1;
    if (status === "covered") paper.totals.coveredNodes += 1;
    if (status === "revised") paper.totals.revisedNodes += 1;
    if (status === "mastered") paper.totals.masteredNodes += 1;
    if (status === "untouched") {
      paper.totals.untouchedNodes += 1;

      untouchedZones.push({
        paperKey: node.paperKey,
        topicLabel: node.name,
        nodeId: node.nodeId,
        priority: safeNum(pyqByNode?.[node.nodeId]?.length || pyqByNode?.[node.nodeId]?.count || 0) >= 5 ? "high" : "medium",
        linkedPyqCount: Array.isArray(pyqByNode?.[node.nodeId])
          ? pyqByNode[node.nodeId].length
          : safeNum(pyqByNode?.[node.nodeId]?.count, 0),
        daysPending: progressRow?.lastTouchedAt
          ? Math.max(0, Math.floor((Date.now() - new Date(progressRow.lastTouchedAt).getTime()) / 86400000))
          : 999,
        suggestedBlockMinutes: 60,
      });
    }

    paper.pyq.totalPyqs += Array.isArray(pyqByNode?.[node.nodeId])
      ? pyqByNode[node.nodeId].length
      : safeNum(pyqByNode?.[node.nodeId]?.count, 0);

    paper.pyq.attemptedPyqs += safeNum(pyqRow.attempted, 0);
    paper.pyq.revisedPyqs += safeNum(pyqRow.revised, 0);

    const nodeWeak = summarizeNodeForWeakZone(node, progressRow, pyqRow, nodeTests);
    if (nodeWeak) weakZones.push(nodeWeak);

    const nodeLast = latestDate([
      progressRow?.lastTouchedAt,
      pyqRow?.lastAttemptAt,
      ...nodeTests.map((x) => x?.submittedAt),
    ]);

    if (nodeLast && (!paper.lastActivityAt || nodeLast > new Date(paper.lastActivityAt).getTime())) {
      paper.lastActivityAt = new Date(nodeLast).toISOString();
    }
  }

  const papers = Object.values(paperMap).map((paper) => {
    const totalNodes = Math.max(1, paper.totals.totalNodes);
    const totalPyqs = Math.max(1, paper.pyq.totalPyqs);

    const coveredEquivalent =
      paper.totals.touchedNodes * 0.25 +
      paper.totals.inProgressNodes * 0.5 +
      paper.totals.coveredNodes * 0.75 +
      paper.totals.revisedNodes * 0.9 +
      paper.totals.masteredNodes * 1;

    const syllabusPercent = Math.round((coveredEquivalent / totalNodes) * 100);
    const pyqPercent = Math.round((paper.pyq.attemptedPyqs / totalPyqs) * 100);

    const revisionBase = paper.totals.revisedNodes + paper.totals.masteredNodes;
    const revisionPercent = Math.round((revisionBase / totalNodes) * 100);

    const relatedWeakZones = weakZones.filter((x) => x.paperKey === paper.paperKey);
    paper.weakZonesCount = relatedWeakZones.length;

    const relatedTests = (Array.isArray(testSessions) ? testSessions : []).filter((x) => {
      const nodeIds = Array.isArray(x?.nodeIds) ? x.nodeIds : [];
      return nodeIds.some((id) => paper.nodes.some((n) => n.nodeId === id));
    });

    paper.tests.sectionalCount = relatedTests.filter((x) => x.type === "sectional").length;
    paper.tests.fullTestCount = relatedTests.filter((x) => x.type === "full_length").length;
    paper.tests.institutionalTestCount = relatedTests.filter((x) => x.source === "institutional_test").length;

    const pyqAccuracyValues = paper.nodes
      .map((node) => safeNum(pyqProgress[node.nodeId]?.correctPercent, NaN))
      .filter((x) => Number.isFinite(x));

    paper.pyq.correctPercent = Math.round(avg(pyqAccuracyValues));
    paper.pyq.yearCoveragePercent = pyqPercent;

    paper.progress.syllabusPercent = clamp(syllabusPercent);
    paper.progress.pyqPercent = clamp(pyqPercent);
    paper.progress.revisionPercent = clamp(revisionPercent);

    const readiness =
      paper.progress.syllabusPercent * 0.4 +
      paper.progress.pyqPercent * 0.25 +
      paper.progress.revisionPercent * 0.2 +
      clamp(paper.pyq.correctPercent) * 0.15 -
      Math.min(20, relatedWeakZones.length * 2);

    paper.readinessScore = clamp(Math.round(readiness));
    paper.status = derivePaperStatus(paper.readinessScore);

    delete paper.nodes;
    return paper;
  });

  const summary = {
    overallSyllabusCoveragePercent: Math.round(avg(papers.map((p) => p.progress.syllabusPercent))),
    overallPyqCoveragePercent: Math.round(avg(papers.map((p) => p.progress.pyqPercent))),
    overallRevisionPercent: Math.round(avg(papers.map((p) => p.progress.revisionPercent))),
    overallReadinessScore: Math.round(avg(papers.map((p) => p.readinessScore))),
    untouchedNodes: papers.reduce((s, p) => s + safeNum(p.totals.untouchedNodes), 0),
    weakClusters: weakZones.length,
  };

  const recentActivity = (Array.isArray(activityLog) ? activityLog : [])
    .slice()
    .sort((a, b) => new Date(b?.time || 0).getTime() - new Date(a?.time || 0).getTime())
    .slice(0, 20)
    .map((row) => ({
      time: row.time || row.createdAt || new Date().toISOString(),
      source: row.source || "system",
      activityType: row.activityType || "study_block",
      paperKey: row.paperKey || "GS1",
      label: row.label || row.rawText || "Activity logged",
      mappedNodeIds: Array.isArray(row.mappedNodeIds) ? row.mappedNodeIds : [],
    }));

  const nextActions = [];

  const lowReadiness = [...papers].sort((a, b) => a.readinessScore - b.readinessScore).slice(0, 3);
  for (const paper of lowReadiness) {
    nextActions.push({
      priority: paper.readinessScore < 35 ? "high" : "medium",
      label: `${paper.paperLabel} is under-prepared`,
      action: `Add 2 focused blocks and 1 practice session for ${paper.paperLabel}`,
    });
  }

  const highUntouched = [...untouchedZones]
    .sort((a, b) => safeNum(b.linkedPyqCount) - safeNum(a.linkedPyqCount))
    .slice(0, 3);

  for (const zone of highUntouched) {
    nextActions.push({
      priority: zone.priority,
      label: `${zone.topicLabel} is untouched`,
      action: `Schedule a ${zone.suggestedBlockMinutes}-minute block and link PYQs`,
    });
  }

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    summary,
    papers,
    weakZones: weakZones
      .sort((a, b) => safeNum(b.weaknessScore) - safeNum(a.weaknessScore))
      .slice(0, 20),
    untouchedZones: untouchedZones
      .sort((a, b) => {
        const scoreA = safeNum(a.linkedPyqCount) + (a.priority === "high" ? 5 : 0);
        const scoreB = safeNum(b.linkedPyqCount) + (b.priority === "high" ? 5 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 20),
    recentActivity,
    nextActions: nextActions.slice(0, 10),
  };
}