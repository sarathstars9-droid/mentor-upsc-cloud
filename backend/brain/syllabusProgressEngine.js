import SYLLABUS_GRAPH_2026 from "./syllabusGraph.js";

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];

  const out = new Set();

  for (const raw of tags) {
    const t = String(raw || "").toUpperCase().trim();

    if (t === "PM") {
      out.add("P");
      out.add("M");
    } else if (t === "P" || t === "M") {
      out.add(t);
    }
  }

  return Array.from(out);
}

function flattenNode(node, parentPath = [], paperKey = "") {
  if (!node || typeof node !== "object") return [];

  const id = String(node.id || "").trim();
  const name = String(node.name || "").trim();
  const tags = normalizeTags(node.tags);
  const pathParts = [...parentPath, name].filter(Boolean);
  const path = pathParts.join(" > ");

  const rows = [];

  if (id) {
    rows.push({
      id,
      code: id,
      name,
      path,
      paper: paperKey,
      tags,
      microThemes: Array.isArray(node.microThemes) ? node.microThemes : [],
      keywords: Array.isArray(node.keywords) ? node.keywords : [],
      schemes: Array.isArray(node.schemes) ? node.schemes : [],
    });
  }

  if (Array.isArray(node.sections)) {
    for (const child of node.sections) {
      rows.push(...flattenNode(child, pathParts, paperKey));
    }
  }

  if (Array.isArray(node.topics)) {
    for (const child of node.topics) {
      rows.push(...flattenNode(child, pathParts, paperKey));
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      rows.push(...flattenNode(child, pathParts, paperKey));
    }
  }

  return rows;
}

function flattenRootGraph(graph) {
  const rows = [];

  for (const [paperKey, paperValue] of Object.entries(graph || {})) {
    if (!paperValue) continue;

    // GS1 / GS2 / GS3 style object with "subjects"
    if (
      typeof paperValue === "object" &&
      !Array.isArray(paperValue) &&
      paperValue.subjects &&
      typeof paperValue.subjects === "object"
    ) {
      for (const subjectNode of Object.values(paperValue.subjects)) {
        rows.push(...flattenNode(subjectNode, [], paperKey));
      }
      continue;
    }

    // GS4 / Essay / CSAT / Optional style object
    if (typeof paperValue === "object" && !Array.isArray(paperValue)) {
      rows.push(...flattenNode(paperValue, [], paperKey));
      continue;
    }

    // Array-style fallback
    if (Array.isArray(paperValue)) {
      for (const node of paperValue) {
        rows.push(...flattenNode(node, [], paperKey));
      }
    }
  }

  return rows;
}

function getStatusScore(block) {
  const status = String(block?.Status || block?.CompletionStatus || "").toLowerCase();

  if (status === "completed") return 1;
  if (status === "partial") return 0.5;
  return 0;
}

function getEffortRatio(block) {
  const planned = safeNum(block?.PlannedMinutes ?? block?.Minutes, 0);
  const actual = safeNum(block?.ActualMinutes, 0);

  if (planned <= 0) return actual > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, actual / planned));
}

function getCoverageContribution(block) {
  return getStatusScore(block) * getEffortRatio(block);
}

export function buildSyllabusIndex() {
  const flat = flattenRootGraph(SYLLABUS_GRAPH_2026);

  const byCode = {};
  for (const item of flat) {
    if (item.code) byCode[item.code] = item;
  }

  return { flat, byCode };
}

export function buildSyllabusCoverageRadar(progress) {
  if (!progress || !Array.isArray(progress.papers)) {
    return {
      GS1: 0,
      GS2: 0,
      GS3: 0,
      GS4: 0,
      ESSAY: 0,
      CSAT: 0,
      OPTIONAL: 0,
    };
  }

  const radar = {
    GS1: 0,
    GS2: 0,
    GS3: 0,
    GS4: 0,
    ESSAY: 0,
    CSAT: 0,
    OPTIONAL: 0,
  };

  for (const row of progress.papers) {
    const key = String(row.paper || "").toUpperCase();

    if (key.includes("GS1")) radar.GS1 = row.progressPercent;
    if (key.includes("GS2")) radar.GS2 = row.progressPercent;
    if (key.includes("GS3")) radar.GS3 = row.progressPercent;
    if (key.includes("GS4")) radar.GS4 = row.progressPercent;

    if (key.includes("ESSAY")) radar.ESSAY = row.progressPercent;

    if (key.includes("CSAT")) radar.CSAT = row.progressPercent;

    if (key.includes("OPTIONAL")) radar.OPTIONAL = row.progressPercent;
  }

  return radar;
}

export function computeSyllabusProgress(blocks = []) {
  const index = buildSyllabusIndex();

  const topicMap = {};
  for (const item of index.flat) {
    topicMap[item.code] = {
      ...item,
      touched: 0,
      score: 0,
      completedCount: 0,
      partialCount: 0,
      totalActualMinutes: 0,
      totalPlannedMinutes: 0,
    };
  }

  for (const block of blocks) {
    const code = String(
      block?.MappingCode || block?.SyllabusTop1Code || block?.code || ""
    ).trim();

    if (!code || !topicMap[code]) continue;

    const contribution = getCoverageContribution(block);
    const status = String(block?.Status || block?.CompletionStatus || "").toLowerCase();

    topicMap[code].touched += 1;
    topicMap[code].score += contribution;
    topicMap[code].totalActualMinutes += safeNum(block?.ActualMinutes, 0);
    topicMap[code].totalPlannedMinutes += safeNum(
      block?.PlannedMinutes ?? block?.Minutes,
      0
    );

    if (status === "completed") topicMap[code].completedCount += 1;
    if (status === "partial") topicMap[code].partialCount += 1;
  }

  const allTopics = Object.values(topicMap);

  const paperSummary = {};
  const examModeSummary = {
    Prelims: { totalTopics: 0, completedEquivalent: 0, touchedTopics: 0 },
    Mains: { totalTopics: 0, completedEquivalent: 0, touchedTopics: 0 },
  };

  for (const topic of allTopics) {
    const paper = topic.paper || "Unknown";

    if (!paperSummary[paper]) {
      paperSummary[paper] = {
        paper,
        totalTopics: 0,
        touchedTopics: 0,
        completedEquivalent: 0,
      };
    }

    paperSummary[paper].totalTopics += 1;

    if (topic.touched > 0) {
      paperSummary[paper].touchedTopics += 1;
      paperSummary[paper].completedEquivalent += Math.min(1, topic.score);
    }

    if (topic.tags.includes("P")) {
      examModeSummary.Prelims.totalTopics += 1;
      if (topic.touched > 0) {
        examModeSummary.Prelims.touchedTopics += 1;
        examModeSummary.Prelims.completedEquivalent += Math.min(1, topic.score);
      }
    }

    if (topic.tags.includes("M")) {
      examModeSummary.Mains.totalTopics += 1;
      if (topic.touched > 0) {
        examModeSummary.Mains.touchedTopics += 1;
        examModeSummary.Mains.completedEquivalent += Math.min(1, topic.score);
      }
    }
  }

  const papers = Object.values(paperSummary).map((row) => ({
    ...row,
    progressPercent:
      row.totalTopics > 0
        ? Math.round((row.completedEquivalent / row.totalTopics) * 100)
        : 0,
  }));

  const modes = {
    Prelims: {
      ...examModeSummary.Prelims,
      progressPercent:
        examModeSummary.Prelims.totalTopics > 0
          ? Math.round(
            (examModeSummary.Prelims.completedEquivalent /
              examModeSummary.Prelims.totalTopics) *
            100
          )
          : 0,
    },
    Mains: {
      ...examModeSummary.Mains,
      progressPercent:
        examModeSummary.Mains.totalTopics > 0
          ? Math.round(
            (examModeSummary.Mains.completedEquivalent /
              examModeSummary.Mains.totalTopics) *
            100
          )
          : 0,
    },
  };

  const totalTopics = allTopics.length;
  const totalCompletedEquivalent = allTopics.reduce(
    (sum, t) => sum + Math.min(1, t.score),
    0
  );

  const untouchedTopics = allTopics
    .filter((t) => t.touched === 0)
    .slice(0, 40);

  const weakTopics = allTopics
    .filter((t) => t.touched > 0 && t.score > 0 && t.score < 1)
    .sort((a, b) => a.score - b.score)
    .slice(0, 25);

  return {
    overall: {
      totalTopics,
      overallProgressPercent:
        totalTopics > 0
          ? Math.round((totalCompletedEquivalent / totalTopics) * 100)
          : 0,
      touchedTopics: allTopics.filter((t) => t.touched > 0).length,
      untouchedTopicsCount: allTopics.filter((t) => t.touched === 0).length,
    },
    modes,
    papers,
    weakTopics,
    untouchedTopics,
    topics: allTopics,
  };
}