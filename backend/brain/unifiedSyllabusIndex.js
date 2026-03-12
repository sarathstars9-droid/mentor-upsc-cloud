// backend/brain/unifiedSyllabusIndex.js
// Unified UPSC syllabus flattener for Phase 2 mapping engine

import { SYLLABUS_GRAPH_2026 } from "./syllabusGraph.js";
import { GS4_2026 } from "./syllabusGS4.js";
import { ESSAY_2026 } from "./syllabusEssay.js";
import { CSAT_2026 } from "./syllabusCSAT.js";
import OPTIONAL_2026 from "./syllabusOptional.js";

/* -------------------- HELPERS -------------------- */
function arr(v) {
  return Array.isArray(v) ? v.filter(Boolean) : [];
}

function unique(arrInput = []) {
  return [...new Set(arr(arrInput).map(String).map((x) => x.trim()).filter(Boolean))];
}

function buildNode({
  syllabusNodeId,
  name,
  aliases = [],
  keywords = [],
  microThemes = [],
  tags = [],
  gsPaper = null,
  subjectGroup = null,
  subject = null,
  section = null,
  parentTopic = null,
  path = null,
  sourceType = null,
}) {
  const rawTextPool = unique([
    name,
    ...aliases,
    ...keywords,
    ...microThemes,
    section,
    parentTopic,
    subject,
  ]);

  return {
    syllabusNodeId,
    code: syllabusNodeId, // backward compatibility
    name,
    aliases: unique(aliases),
    keywords: unique(keywords),
    microThemes: unique(microThemes),
    tags: unique(tags),
    gsPaper,
    subjectGroup,
    subject,
    section,
    parentTopic,
    path,
    sourceType,
    rawTextPool,
  };
}

/* -------------------- GS1 / GS2 / GS3 from master graph -------------------- */
function flattenMainGraph(graph) {
  const out = [];

  for (const gsPaper of Object.keys(graph || {})) {
    const gs = graph[gsPaper];
    if (!gs?.subjects) continue;

    for (const subjectName of Object.keys(gs.subjects || {})) {
      const subject = gs.subjects[subjectName];

      // sections -> topics
      for (const section of arr(subject?.sections)) {
        for (const topic of arr(section?.topics)) {
          out.push(
            buildNode({
              syllabusNodeId: topic.id,
              name: topic.name,
              aliases: [],
              keywords: arr(topic.keywords),
              microThemes: arr(topic.microThemes),
              tags: arr(topic.tags),
              gsPaper,
              subjectGroup: gsPaper,
              subject: subjectName,
              section: section.name,
              parentTopic: null,
              path: `${gs.heading} > ${subjectName} > ${section.name} > ${topic.name}`,
              sourceType: "MAIN_GRAPH_TOPIC",
            })
          );

          for (const sub of arr(topic.subTopics)) {
            out.push(
              buildNode({
                syllabusNodeId: sub.id,
                name: sub.name,
                aliases: [topic.name],
                keywords: arr(sub.keywords),
                microThemes: arr(sub.microThemes),
                tags: arr(sub.tags).length ? arr(sub.tags) : arr(topic.tags),
                gsPaper,
                subjectGroup: gsPaper,
                subject: subjectName,
                section: section.name,
                parentTopic: topic.name,
                path: `${gs.heading} > ${subjectName} > ${section.name} > ${topic.name} > ${sub.name}`,
                sourceType: "MAIN_GRAPH_SUBTOPIC",
              })
            );
          }
        }
      }

      // blocks -> microThemes style
      for (const block of arr(subject?.blocks)) {
        for (const micro of arr(block?.microThemes)) {
          const extraSubtopics = arr(micro?.subtopics).map((x) => x?.t).filter(Boolean);

          out.push(
            buildNode({
              syllabusNodeId: micro.code,
              name: micro.title,
              aliases: [block.block],
              keywords: arr(micro.keywords),
              microThemes: extraSubtopics,
              tags: [micro.examTag || "PM"],
              gsPaper,
              subjectGroup: gsPaper,
              subject: subjectName,
              section: block.block,
              parentTopic: null,
              path: `${gs.heading} > ${subjectName} > ${block.block} > ${micro.title}`,
              sourceType: "MAIN_GRAPH_BLOCK_MICRO",
            })
          );
        }
      }
    }
  }

  return out;
}

/* -------------------- GS4 -------------------- */
function flattenGS4(gs4) {
  const out = [];

  for (const section of arr(gs4?.sections)) {
    for (const topic of arr(section?.topics)) {
      out.push(
        buildNode({
          syllabusNodeId: topic.id,
          name: topic.name,
          aliases: [section.name, "GS4", "Ethics"],
          keywords: arr(topic.keywords),
          microThemes: arr(topic.microThemes),
          tags: arr(topic.tags),
          gsPaper: "GS4",
          subjectGroup: "GS4",
          subject: "Ethics",
          section: section.name,
          parentTopic: null,
          path: `GS4 > ${section.name} > ${topic.name}`,
          sourceType: "GS4_TOPIC",
        })
      );

      for (const sub of arr(topic.subTopics)) {
        out.push(
          buildNode({
            syllabusNodeId: sub.id,
            name: sub.name,
            aliases: [topic.name, section.name, "GS4", "Ethics"],
            keywords: arr(sub.keywords),
            microThemes: arr(sub.microThemes),
            tags: arr(sub.tags).length ? arr(sub.tags) : arr(topic.tags),
            gsPaper: "GS4",
            subjectGroup: "GS4",
            subject: "Ethics",
            section: section.name,
            parentTopic: topic.name,
            path: `GS4 > ${section.name} > ${topic.name} > ${sub.name}`,
            sourceType: "GS4_SUBTOPIC",
          })
        );
      }
    }
  }

  return out;
}

/* -------------------- ESSAY -------------------- */
function flattenEssay(essay) {
  const out = [];

  for (const section of arr(essay?.sections)) {
    for (const topic of arr(section?.topics)) {
      out.push(
        buildNode({
          syllabusNodeId: topic.id,
          name: topic.name,
          aliases: [section.name, "Essay"],
          keywords: arr(topic.keywords),
          microThemes: arr(topic.microThemes),
          tags: arr(topic.tags),
          gsPaper: "ESSAY",
          subjectGroup: "ESSAY",
          subject: "Essay",
          section: section.name,
          parentTopic: null,
          path: `ESSAY > ${section.name} > ${topic.name}`,
          sourceType: "ESSAY_TOPIC",
        })
      );

      for (const sub of arr(topic.subTopics)) {
        out.push(
          buildNode({
            syllabusNodeId: sub.id,
            name: sub.name,
            aliases: [topic.name, section.name, "Essay"],
            keywords: arr(sub.keywords),
            microThemes: arr(sub.microThemes),
            tags: arr(sub.tags).length ? arr(sub.tags) : arr(topic.tags),
            gsPaper: "ESSAY",
            subjectGroup: "ESSAY",
            subject: "Essay",
            section: section.name,
            parentTopic: topic.name,
            path: `ESSAY > ${section.name} > ${topic.name} > ${sub.name}`,
            sourceType: "ESSAY_SUBTOPIC",
          })
        );
      }
    }
  }

  return out;
}

/* -------------------- CSAT -------------------- */
function flattenCSAT(csat) {
  const out = [];

  for (const section of arr(csat?.sections)) {
    for (const topic of arr(section?.topics)) {
      out.push(
        buildNode({
          syllabusNodeId: topic.id,
          name: topic.name,
          aliases: [section.name, "CSAT"],
          keywords: arr(topic.keywords),
          microThemes: arr(topic.microThemes),
          tags: arr(topic.tags),
          gsPaper: "CSAT",
          subjectGroup: "CSAT",
          subject: section.name,
          section: section.name,
          parentTopic: null,
          path: `CSAT > ${section.name} > ${topic.name}`,
          sourceType: "CSAT_TOPIC",
        })
      );

      for (const sub of arr(topic.subTopics)) {
        out.push(
          buildNode({
            syllabusNodeId: sub.id,
            name: sub.name,
            aliases: [topic.name, section.name, "CSAT"],
            keywords: arr(sub.keywords),
            microThemes: arr(sub.microThemes),
            tags: arr(sub.tags).length ? arr(sub.tags) : arr(topic.tags),
            gsPaper: "CSAT",
            subjectGroup: "CSAT",
            subject: section.name,
            section: section.name,
            parentTopic: topic.name,
            path: `CSAT > ${section.name} > ${topic.name} > ${sub.name}`,
            sourceType: "CSAT_SUBTOPIC",
          })
        );
      }
    }
  }

  return out;
}

/* -------------------- OPTIONAL -------------------- */
function flattenOptional(optionalGraph) {
  const out = [];
  const subjectName = optionalGraph?.subject || "Optional";

  for (const paperKey of Object.keys(optionalGraph || {})) {
    if (!/^Paper/i.test(paperKey)) continue;

    const paper = optionalGraph[paperKey];
    const paperName = paper?.name || paperKey;

    for (const section of arr(paper?.sections)) {
      for (const topic of arr(section?.topics)) {
        out.push(
          buildNode({
            syllabusNodeId: topic.id,
            name: topic.name,
            aliases: [paperName, section.name, subjectName],
            keywords: arr(topic.keywords),
            microThemes: arr(topic.microThemes),
            tags: arr(topic.tags),
            gsPaper: "OPTIONAL",
            subjectGroup: "OPTIONAL",
            subject: subjectName,
            section: `${paperKey} > ${section.name}`,
            parentTopic: null,
            path: `OPTIONAL > ${subjectName} > ${paperName} > ${section.name} > ${topic.name}`,
            sourceType: "OPTIONAL_TOPIC",
          })
        );

        for (const sub of arr(topic.subTopics)) {
          out.push(
            buildNode({
              syllabusNodeId: sub.id,
              name: sub.name,
              aliases: [topic.name, paperName, section.name, subjectName],
              keywords: arr(sub.keywords),
              microThemes: arr(sub.microThemes),
              tags: arr(sub.tags).length ? arr(sub.tags) : arr(topic.tags),
              gsPaper: "OPTIONAL",
              subjectGroup: "OPTIONAL",
              subject: subjectName,
              section: `${paperKey} > ${section.name}`,
              parentTopic: topic.name,
              path: `OPTIONAL > ${subjectName} > ${paperName} > ${section.name} > ${topic.name} > ${sub.name}`,
              sourceType: "OPTIONAL_SUBTOPIC",
            })
          );
        }
      }
    }
  }

  return out;
}

/* -------------------- BUILD FINAL INDEX -------------------- */
const unified = [
  ...flattenMainGraph(SYLLABUS_GRAPH_2026),
  ...flattenGS4(GS4_2026),
  ...flattenEssay(ESSAY_2026),
  ...flattenCSAT(CSAT_2026),
  ...flattenOptional(OPTIONAL_2026),
];

const deduped = [];
const seen = new Set();

for (const node of unified) {
  if (!node?.syllabusNodeId) continue;
  if (seen.has(node.syllabusNodeId)) continue;
  seen.add(node.syllabusNodeId);
  deduped.push(node);
}

export const UNIFIED_SYLLABUS_INDEX = deduped;

export const SYLLABUS_INDEX_BY_ID = Object.fromEntries(
  UNIFIED_SYLLABUS_INDEX.map((node) => [node.syllabusNodeId, node])
);

export default UNIFIED_SYLLABUS_INDEX;