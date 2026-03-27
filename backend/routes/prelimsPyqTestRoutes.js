import express from "express";
import {
  getPracticePyqTest,
  getPracticeQuestionCount,
  getYearWisePyqTest,
  buildFullLengthMeta,
} from "../services/pyqTestService.js";
import { SYLLABUS_GRAPH_2026 } from "../brain/syllabusGraph.js";
import { CSAT_2026 } from "../brain/syllabusCSAT.js";

const router = express.Router();

function buildGsCatalog() {
  const result = [];

  for (const [paperKey, paperValue] of Object.entries(SYLLABUS_GRAPH_2026 || {})) {
    const subjects = paperValue?.subjects || {};

    for (const [subjectName, subjectData] of Object.entries(subjects)) {
      const topics = [];

      if (Array.isArray(subjectData?.sections)) {
        for (const section of subjectData.sections) {
          for (const topic of section?.topics || []) {
            const tags = topic?.tags || [];
            if (!tags.includes("P") && !tags.includes("PM")) continue;

            const topicMicroThemes = (topic.microThemes || []).map((label) => ({
              id: String(label),
              label,
            }));

            topics.push({
              id: topic.id,
              name: topic.name,
              microThemes: topicMicroThemes,
            });
          }
        }
      }

      if (Array.isArray(subjectData?.blocks)) {
        for (const block of subjectData.blocks) {
          for (const microTopic of block?.microThemes || []) {
            const examTag = microTopic?.examTag || "";
            if (!String(examTag).includes("P")) continue;

            topics.push({
              id: microTopic.code,
              name: microTopic.title,
              microThemes: (microTopic.subtopics || []).map((item) => ({
                id: String(item?.t || ""),
                label: item?.t || "Untitled subtopic",
              })),
            });
          }
        }
      }

      if (!topics.length) continue;

      const topicIds = topics.map((topic) => topic.id);
      const topicItems = topics.map((topic) => {
        const topicCount = getPracticeQuestionCount({
          paper: "GS",
          scope: "topic",
          topicId: topic.id,
        });

        return {
          ...topic,
          count: topicCount,
          microThemes: (topic.microThemes || []).map((micro) => ({
            ...micro,
            count: getPracticeQuestionCount({
              paper: "GS",
              scope: "subtopic",
              topicId: topic.id,
              microThemeIds: [micro.id],
            }),
          })),
        };
      }).filter((topic) => topic.count > 0);

      const subjectCount = getPracticeQuestionCount({
        paper: "GS",
        scope: "subject",
        subjectTopicIds: topicIds,
      });

      if (!subjectCount || !topicItems.length) continue;

      result.push({
        id: `${paperKey}::${subjectName}`,
        label: `${subjectName}`,
        paperKey,
        count: subjectCount,
        topicIds: topicItems.map((topic) => topic.id),
        topics: topicItems,
      });
    }
  }

  return result.sort((a, b) => a.label.localeCompare(b.label));
}

function buildCsatCatalog() {
  return (CSAT_2026?.sections || []).map((section) => {
    const topics = (section?.topics || []).map((topic) => ({
      id: topic.id,
      name: topic.name,
      microThemes: (topic.microThemes || []).map((label) => ({
        id: String(label),
        label,
      })),
    }));

    const topicItems = topics.map((topic) => ({
      ...topic,
      count: getPracticeQuestionCount({
        paper: "CSAT",
        scope: "topic",
        topicId: topic.id,
      }),
      microThemes: (topic.microThemes || []).map((micro) => ({
        ...micro,
        count: getPracticeQuestionCount({
          paper: "CSAT",
          scope: "subtopic",
          topicId: topic.id,
          microThemeIds: [micro.id],
        }),
      })),
    })).filter((topic) => topic.count > 0);

    const subjectCount = getPracticeQuestionCount({
      paper: "CSAT",
      scope: "subject",
      subjectTopicIds: topicItems.map((topic) => topic.id),
    });

    return {
      id: section.id,
      label: section.name,
      paperKey: "CSAT",
      count: subjectCount,
      topicIds: topicItems.map((topic) => topic.id),
      topics: topicItems,
    };
  }).filter((section) => section.count > 0);
}

router.get("/catalog", (_req, res) => {
  try {
    return res.json({
      GS: buildGsCatalog(),
      CSAT: buildCsatCatalog(),
    });
  } catch (err) {
    console.error("catalog route failed", err);
    return res.status(500).json({ error: "Failed to build practice catalog" });
  }
});

router.post("/practice", (req, res) => {
  try {
    const {
      paper = "GS",
      scope = "subject",
      subjectTopicIds = [],
      topicId = "",
      microThemeIds = [],
      limit = 10,
    } = req.body || {};

    const availableCount = getPracticeQuestionCount({
      paper,
      scope,
      subjectTopicIds,
      topicId,
      microThemeIds,
    });

    const questions = getPracticePyqTest({
      paper,
      scope,
      subjectTopicIds,
      topicId,
      microThemeIds,
      limit: Math.min(Number(limit) || 10, availableCount || Number(limit) || 10),
    });

    if (!questions.length) {
      return res.status(404).json({ error: "No questions found for the selected filters" });
    }

    return res.json({
      ok: true,
      test: {
        mode: "practice",
        availableCount,
        questions,
      },
    });
  } catch (err) {
    console.error("practice route failed", err);
    return res.status(500).json({ error: "Failed to build practice test" });
  }
});

router.post("/full-length", (req, res) => {
  try {
    const { type, year } = req.body || {};

    if (!type) {
      return res.status(400).json({ error: "type is required" });
    }

    let questions = [];

    if (type === "gs_yearwise") {
      questions = getYearWisePyqTest({ paperType: "GS", year: Number(year) });
    } else if (type === "csat_yearwise") {
      questions = getYearWisePyqTest({ paperType: "CSAT", year: Number(year) });
    } else {
      return res.status(400).json({ error: "Invalid full-length type" });
    }

    if (!questions.length) {
      return res.status(404).json({ error: "No questions found for the requested full-length test" });
    }

    const meta = buildFullLengthMeta(type, year, questions.length);

    return res.json({
      ok: true,
      test: {
        mode: "full_length",
        fullLengthType: type,
        meta,
        questions,
      },
    });
  } catch (err) {
    console.error("full-length route failed", err);
    return res.status(500).json({ error: "Failed to build full-length test" });
  }
});

export default router;
