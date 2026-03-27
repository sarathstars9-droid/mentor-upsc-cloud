import { SYLLABUS_GRAPH_2026 } from "./syllabusGraph.js";
import { CSAT_2026 } from "./syllabusCSAT.js";

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalize(value = "") {
    return String(value).toLowerCase().trim();
}

function unique(arr = []) {
    return [...new Set(arr.filter(Boolean))];
}

function buildGsNodes() {
    const nodes = [];

    for (const [paperKey, paperValue] of Object.entries(SYLLABUS_GRAPH_2026)) {
        const subjects = paperValue?.subjects || {};

        for (const [subjectName, subjectValue] of Object.entries(subjects)) {
            for (const section of safeArray(subjectValue.sections)) {
                for (const topic of safeArray(section.topics)) {
                    nodes.push({
                        id: topic.id,
                        paper: paperKey,
                        subject: subjectName,
                        sectionName: section.name,
                        topicName: topic.name,
                        keywords: unique([
                            ...(topic.keywords || []),
                            topic.name,
                            section.name,
                            subjectName
                        ]).map(normalize),
                        microThemes: safeArray(topic.microThemes).map(normalize)
                    });
                }
            }
        }
    }

    return nodes;
}

function buildCsatNodes() {
    const nodes = [];

    for (const section of safeArray(CSAT_2026.sections)) {
        for (const topic of safeArray(section.topics)) {
            nodes.push({
                id: topic.id,
                paper: "CSAT",
                subject: section.name,
                sectionName: section.name,
                topicName: topic.name,
                keywords: unique([
                    ...(topic.keywords || []),
                    topic.name,
                    section.name
                ]).map(normalize),
                microThemes: safeArray(topic.microThemes).map(normalize)
            });
        }
    }

    return nodes;
}

export const ALL_SYLLABUS_NODES = [
    ...buildGsNodes(),
    ...buildCsatNodes()
];