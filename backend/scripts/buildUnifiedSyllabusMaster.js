// backend/scripts/buildUnifiedSyllabusMaster.js
// ESM ONLY
// Purpose:
// - Read all syllabus sources
// - Normalize mixed structures
// - Build canonical syllabus master
// - Preserve legacy ids via alias map
// - Generate audit reports
//
// Run:
// node backend/scripts/buildUnifiedSyllabusMaster.js

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "..");
const BRAIN_DIR = path.join(BACKEND_DIR, "brain");
const OUT_DIR = path.join(BACKEND_DIR, "data", "syllabus_index");

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function slugify(value = "") {
    return String(value)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ")
        .replace(/[’'`]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-+/g, "-")
        .toUpperCase();
}

function norm(value = "") {
    return String(value)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’'`]/g, "")
        .replace(/&/g, " and ")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function arr(value) {
    return Array.isArray(value) ? value : [];
}

function uniq(arrLike) {
    return Array.from(new Set(arrLike.filter(Boolean)));
}

function cleanName(value = "") {
    return String(value).replace(/\s+/g, " ").trim();
}

function toTagArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return uniq(value.map((x) => String(x).trim()).filter(Boolean));
    return uniq([String(value).trim()]);
}

function stageFromTags(tags = []) {
    const set = new Set(tags);
    return {
        prelims: set.has("P") || set.has("PM"),
        mains: set.has("M") || set.has("PM") || set.has("CS"),
        optional: set.has("OPT"),
        csat: set.has("CSAT"),
        ethics: set.has("ETH") || set.has("GS4"),
        essay: set.has("ESSAY"),
    };
}

function mergeTags(...tagLists) {
    const out = [];
    for (const list of tagLists) {
        for (const tag of toTagArray(list)) out.push(tag);
    }
    return uniq(out);
}

function buildCanonicalId(parts = [], fallbackPrefix = "NODE") {
    const safe = parts.map((x) => slugify(x)).filter(Boolean);
    if (!safe.length) return `${fallbackPrefix}-UNSPECIFIED`;
    return safe.join("-");
}

function buildFingerprint(subject, section, topic, subtopic, microTheme) {
    return norm([subject, section, topic, subtopic, microTheme].filter(Boolean).join(" | "));
}

function deriveBaseLegacyId({ rootPaper, sectionId, topicId, clusterId, sourceType }) {
    const candidates = [clusterId, topicId, sectionId].filter(Boolean).map(String);

    for (const id of candidates) {
        if (
            id.startsWith("GS1-") ||
            id.startsWith("GS2-") ||
            id.startsWith("GS3-") ||
            id.startsWith("GS4-") ||
            id.startsWith("CSAT-") ||
            id.startsWith("OPT-") ||
            id.startsWith("1C.")
        ) {
            return id.replace(/\./g, "-");
        }
    }

    return slugify(rootPaper || sourceType || "NODE");
}

function makeStableMicroId(baseLegacyId, index) {
    return `${baseLegacyId}-MT${String(index).padStart(2, "0")}`;
}

async function importModuleIfExists(fileName) {
    const fullPath = path.join(BRAIN_DIR, fileName);
    if (!fs.existsSync(fullPath)) return null;
    return import(pathToFileURL(fullPath).href);
}

async function loadSources() {
    const sources = [];

    const syllabusGraphMod = await importModuleIfExists("syllabusGraph.js");
    if (syllabusGraphMod?.SYLLABUS_GRAPH_2026) {
        sources.push({
            sourceFile: "syllabusGraph.js",
            sourceKey: "SYLLABUS_GRAPH_2026",
            payload: syllabusGraphMod.SYLLABUS_GRAPH_2026,
            sourceType: "graph",
        });
    }

    const optionalMod = await importModuleIfExists("syllabusOptional.js");
    if (optionalMod?.default) {
        sources.push({
            sourceFile: "syllabusOptional.js",
            sourceKey: "OPTIONAL_2026",
            payload: optionalMod.default,
            sourceType: "optional",
        });
    }

    const csatMod = await importModuleIfExists("syllabusCSAT.js");
    if (csatMod?.CSAT_2026) {
        sources.push({
            sourceFile: "syllabusCSAT.js",
            sourceKey: "CSAT_2026",
            payload: csatMod.CSAT_2026,
            sourceType: "csat",
        });
    }

    const gs4Mod = await importModuleIfExists("syllabusGS4.js");
    if (gs4Mod?.GS4_2026) {
        sources.push({
            sourceFile: "syllabusGS4.js",
            sourceKey: "GS4_2026",
            payload: gs4Mod.GS4_2026,
            sourceType: "gs4",
        });
    }

    const essayMod = await importModuleIfExists("syllabusEssay.js");
    if (essayMod?.ESSAY_2026) {
        sources.push({
            sourceFile: "syllabusEssay.js",
            sourceKey: "ESSAY_2026",
            payload: essayMod.ESSAY_2026,
            sourceType: "essay",
        });
    }

    return sources;
}

function inferPaperGroupFromTopKey(topKey = "") {
    const t = String(topKey).toUpperCase();
    if (t.startsWith("GS1")) return "GS1";
    if (t.startsWith("GS2")) return "GS2";
    if (t.startsWith("GS3")) return "GS3";
    if (t.startsWith("GS4")) return "GS4";
    return null;
}

function normalizeMicroThemeItem(item) {
    if (typeof item === "string") {
        return {
            label: cleanName(item),
            tags: [],
            keywords: [],
            legacyIds: [],
            rawType: "string",
        };
    }

    if (item && typeof item === "object") {
        const label =
            cleanName(item.name) ||
            cleanName(item.title) ||
            cleanName(item.t) ||
            cleanName(item.label) ||
            "";

        return {
            label,
            tags: mergeTags(item.tags, item.tag ? [item.tag] : []),
            keywords: uniq([...arr(item.keywords), ...arr(item.aliases)].map(cleanName)),
            legacyIds: uniq([item.id, item.code].filter(Boolean)),
            rawType: "object",
        };
    }

    return {
        label: "",
        tags: [],
        keywords: [],
        legacyIds: [],
        rawType: typeof item,
    };
}

function makeNodeRecord({
    sourceFile,
    sourceKey,
    sourceType,
    rootPaper,
    subject,
    section,
    topic,
    subtopic,
    microTheme,
    parentTags = [],
    ownTags = [],
    keywords = [],
    legacyIds = [],
    pathParts = [],
    note = "",
    baseLegacyId = "",
    microIndex = 1,
}) {
    const subjectName = cleanName(subject);
    const sectionName = cleanName(section);
    const topicName = cleanName(topic);
    const subtopicName = cleanName(subtopic);
    const microThemeName = cleanName(microTheme);

    const mergedTags = mergeTags(parentTags, ownTags);
    const stages = stageFromTags(mergedTags);

    const canonicalId = makeStableMicroId(
        baseLegacyId || buildCanonicalId([rootPaper, subjectName, topicName], "NODE"),
        microIndex
    );

    const fingerprint = buildFingerprint(
        subjectName,
        sectionName,
        topicName,
        subtopicName,
        microThemeName
    );

    return {
        syllabusNodeId: canonicalId,
        fingerprint,
        sourceFile,
        sourceKey,
        sourceType,
        rootPaper: rootPaper || null,
        subject: subjectName || null,
        section: sectionName || null,
        topic: topicName || null,
        subtopic: subtopicName || null,
        microTheme: microThemeName || null,
        tags: mergedTags,
        stages,
        keywords: uniq([
            microThemeName,
            subtopicName,
            topicName,
            ...keywords,
        ].map(cleanName).filter(Boolean)),
        legacyIds: uniq(legacyIds),
        baseLegacyId: baseLegacyId || null,
        pathParts: uniq(pathParts.map(cleanName).filter(Boolean)),
        note: note || "",
    };
}

function pushAudit(audit, key, value) {
    audit[key].push(value);
}

function traverseGraphSource(source, nodes, audit) {
    const graph = source.payload || {};
    const topKeys = Object.keys(graph);

    for (const topKey of topKeys) {
        const paperGroup = inferPaperGroupFromTopKey(topKey);
        const paperObj = graph[topKey];
        if (!paperObj || typeof paperObj !== "object") continue;

        const subjectsObj = paperObj.subjects || {};
        for (const [subjectName, subjectObj] of Object.entries(subjectsObj)) {
            if (!subjectObj || typeof subjectObj !== "object") continue;

            if (Array.isArray(subjectObj.sections)) {
                for (const section of subjectObj.sections) {
                    const sectionId = section?.id || null;
                    const sectionName = section?.name || sectionId || "Unnamed Section";
                    const sectionTags = mergeTags(subjectObj.tags, section?.tags);

                    for (const topic of arr(section?.topics)) {
                        const topicId = topic?.id || null;
                        const topicName = topic?.name || topicId || "Unnamed Topic";
                        const topicTags = mergeTags(sectionTags, topic?.tags);
                        const topicKeywords = arr(topic?.keywords).map(cleanName);

                        const microThemes = arr(topic?.microThemes);
                        if (!microThemes.length) {
                            pushAudit(audit, "missingMicroThemes", {
                                sourceFile: source.sourceFile,
                                rootPaper: topKey,
                                subject: subjectName,
                                section: sectionName,
                                topic: topicName,
                            });
                        }

                        microThemes.forEach((mt, index) => {
                            const mtNorm = normalizeMicroThemeItem(mt);
                            const mtLabel = mtNorm.label || `Unnamed MicroTheme ${index + 1}`;

                            const baseLegacyId = deriveBaseLegacyId({
                                rootPaper: paperGroup || topKey,
                                sectionId,
                                topicId,
                                clusterId: null,
                                sourceType: source.sourceType,
                            });

                            const node = makeNodeRecord({
                                sourceFile: source.sourceFile,
                                sourceKey: source.sourceKey,
                                sourceType: source.sourceType,
                                rootPaper: paperGroup || topKey,
                                subject: subjectName,
                                section: sectionName,
                                topic: topicName,
                                subtopic: "",
                                microTheme: mtLabel,
                                parentTags: topicTags,
                                ownTags: mtNorm.tags,
                                keywords: uniq([...topicKeywords, ...mtNorm.keywords]),
                                legacyIds: uniq([sectionId, topicId, ...mtNorm.legacyIds]),
                                pathParts: [topKey, subjectName, sectionName, topicName, mtLabel],
                                note: "",
                                baseLegacyId,
                                microIndex: index + 1,
                            });

                            nodes.push(node);
                        });
                    }
                }
            }

            if (Array.isArray(subjectObj.blocks)) {
                const subjectTags = mergeTags(subjectObj.tags);
                for (const block of subjectObj.blocks) {
                    const blockName = cleanName(block?.block || block?.name || "Unnamed Block");
                    const blockTags = mergeTags(subjectTags, block?.tags);

                    for (const mt of arr(block?.microThemes)) {
                        const mtId = mt?.id || mt?.code || null;
                        const mtName = cleanName(mt?.title || mt?.name || mt?.t || "Unnamed Cluster");
                        const mtTags = mergeTags(blockTags, mt?.tags, mt?.examTag ? [mt.examTag] : []);

                        const subtopics = arr(mt?.subtopics);
                        if (!subtopics.length) {
                            pushAudit(audit, "missingSubtopics", {
                                sourceFile: source.sourceFile,
                                rootPaper: topKey,
                                subject: subjectName,
                                block: blockName,
                                cluster: mtName,
                            });
                        }

                        subtopics.forEach((st, index) => {
                            const stNorm = normalizeMicroThemeItem(st);
                            const stLabel = stNorm.label || `Unnamed Subtopic ${index + 1}`;

                            const baseLegacyId = deriveBaseLegacyId({
                                rootPaper: paperGroup || topKey,
                                sectionId: null,
                                topicId: null,
                                clusterId: mtId,
                                sourceType: source.sourceType,
                            });

                            const node = makeNodeRecord({
                                sourceFile: source.sourceFile,
                                sourceKey: source.sourceKey,
                                sourceType: source.sourceType,
                                rootPaper: paperGroup || topKey,
                                subject: subjectName,
                                section: blockName,
                                topic: mtName,
                                subtopic: stLabel,
                                microTheme: stLabel,
                                parentTags: mtTags,
                                ownTags: stNorm.tags,
                                keywords: uniq([...stNorm.keywords]),
                                legacyIds: uniq([mtId, ...stNorm.legacyIds]),
                                pathParts: [topKey, subjectName, blockName, mtName, stLabel],
                                note: mt?.note || "",
                                baseLegacyId,
                                microIndex: index + 1,
                            });

                            nodes.push(node);
                        });
                    }
                }
            }
        }
    }
}

function traverseStandardSectionsSource(source, nodes, audit, inferredRootPaper, inferredSubjectName, extraTags = []) {
    const payload = source.payload || {};
    const sections = arr(payload.sections);

    for (const section of sections) {
        const sectionId = section?.id || null;
        const sectionName = cleanName(section?.name || sectionId || "Unnamed Section");
        const sectionTags = mergeTags(extraTags, payload.tags, section?.tags);

        for (const topic of arr(section?.topics)) {
            const topicId = topic?.id || null;
            const topicName = cleanName(topic?.name || topicId || "Unnamed Topic");
            const topicTags = mergeTags(sectionTags, topic?.tags);
            const topicKeywords = arr(topic?.keywords).map(cleanName);

            const mts = arr(topic?.microThemes);
            if (!mts.length) {
                pushAudit(audit, "missingMicroThemes", {
                    sourceFile: source.sourceFile,
                    rootPaper: inferredRootPaper,
                    subject: inferredSubjectName,
                    section: sectionName,
                    topic: topicName,
                });
            }

            mts.forEach((mt, index) => {
                const mtNorm = normalizeMicroThemeItem(mt);
                const mtLabel = mtNorm.label || `Unnamed MicroTheme ${index + 1}`;

                const baseLegacyId = deriveBaseLegacyId({
                    rootPaper: inferredRootPaper,
                    sectionId,
                    topicId,
                    clusterId: null,
                    sourceType: source.sourceType,
                });

                const node = makeNodeRecord({
                    sourceFile: source.sourceFile,
                    sourceKey: source.sourceKey,
                    sourceType: source.sourceType,
                    rootPaper: inferredRootPaper,
                    subject: inferredSubjectName,
                    section: sectionName,
                    topic: topicName,
                    subtopic: "",
                    microTheme: mtLabel,
                    parentTags: topicTags,
                    ownTags: mtNorm.tags,
                    keywords: uniq([...topicKeywords, ...mtNorm.keywords]),
                    legacyIds: uniq([sectionId, topicId, ...mtNorm.legacyIds]),
                    pathParts: [inferredRootPaper, inferredSubjectName, sectionName, topicName, mtLabel],
                    note: "",
                    baseLegacyId,
                    microIndex: index + 1,
                });

                nodes.push(node);
            });
        }
    }
}

function traverseOptionalSource(source, nodes, audit) {
    const payload = source.payload || {};
    const subjectName = cleanName(payload.subject || "Optional");
    const topTags = mergeTags(payload.tags, ["OPT"]);

    for (const [paperKey, paperObj] of Object.entries(payload)) {
        if (!paperKey.startsWith("Paper") || !paperObj || typeof paperObj !== "object") continue;

        const paperName = cleanName(paperObj.name || paperKey);
        const sections = arr(paperObj.sections);

        for (const section of sections) {
            const sectionId = section?.id || null;
            const sectionName = cleanName(section?.name || sectionId || "Unnamed Section");
            const sectionTags = mergeTags(topTags, paperObj.tags, section?.tags);

            for (const topic of arr(section?.topics)) {
                const topicId = topic?.id || null;
                const topicName = cleanName(topic?.name || topicId || "Unnamed Topic");
                const topicTags = mergeTags(sectionTags, topic?.tags);
                const topicKeywords = arr(topic?.keywords).map(cleanName);

                const mts = arr(topic?.microThemes);
                if (!mts.length) {
                    pushAudit(audit, "missingMicroThemes", {
                        sourceFile: source.sourceFile,
                        rootPaper: paperKey,
                        subject: subjectName,
                        section: sectionName,
                        topic: topicName,
                    });
                }

                mts.forEach((mt, index) => {
                    const mtNorm = normalizeMicroThemeItem(mt);
                    const mtLabel = mtNorm.label || `Unnamed MicroTheme ${index + 1}`;

                    const baseLegacyId = deriveBaseLegacyId({
                        rootPaper: `OPTIONAL-${paperKey.toUpperCase()}`,
                        sectionId,
                        topicId,
                        clusterId: null,
                        sourceType: source.sourceType,
                    });

                    const node = makeNodeRecord({
                        sourceFile: source.sourceFile,
                        sourceKey: source.sourceKey,
                        sourceType: source.sourceType,
                        rootPaper: `OPTIONAL-${paperKey.toUpperCase()}`,
                        subject: `${subjectName} Optional`,
                        section: paperName,
                        topic: sectionName,
                        subtopic: topicName,
                        microTheme: mtLabel,
                        parentTags: topicTags,
                        ownTags: mtNorm.tags,
                        keywords: uniq([...topicKeywords, ...mtNorm.keywords]),
                        legacyIds: uniq([sectionId, topicId, ...mtNorm.legacyIds]),
                        pathParts: [
                            `OPTIONAL-${paperKey.toUpperCase()}`,
                            subjectName,
                            paperName,
                            sectionName,
                            topicName,
                            mtLabel,
                        ],
                        note: "",
                        baseLegacyId,
                        microIndex: index + 1,
                    });

                    nodes.push(node);
                });
            }
        }
    }
}

function traverseSource(source, nodes, audit) {
    if (source.sourceType === "graph") {
        traverseGraphSource(source, nodes, audit);
        return;
    }

    if (source.sourceType === "optional") {
        traverseOptionalSource(source, nodes, audit);
        return;
    }

    if (source.sourceType === "csat") {
        traverseStandardSectionsSource(source, nodes, audit, "CSAT", "CSAT", ["P", "CSAT"]);
        return;
    }

    if (source.sourceType === "gs4") {
        traverseStandardSectionsSource(source, nodes, audit, "GS4", "Ethics", ["M", "GS4", "ETH"]);
        return;
    }

    if (source.sourceType === "essay") {
        traverseStandardSectionsSource(source, nodes, audit, "ESSAY", "Essay", ["M", "ESSAY"]);
    }
}

function finalizeNodes(rawNodes, audit) {
    const fingerprintMap = new Map();
    const idMap = new Map();
    const finalNodes = [];
    const legacyAliasTemp = {};
    const duplicates = [];

    for (const raw of rawNodes) {
        let canonicalId = raw.syllabusNodeId;
        let suffix = 2;

        while (idMap.has(canonicalId)) {
            canonicalId = `${raw.syllabusNodeId}-D${String(suffix).padStart(2, "0")}`;
            suffix += 1;
        }
        idMap.set(canonicalId, true);

        const node = {
            ...raw,
            syllabusNodeId: canonicalId,
            legacyIds: uniq(raw.legacyIds),
            keywords: uniq(raw.keywords.map(cleanName)),
        };

        if (fingerprintMap.has(node.fingerprint)) {
            duplicates.push({
                fingerprint: node.fingerprint,
                existing: fingerprintMap.get(node.fingerprint).syllabusNodeId,
                duplicate: node.syllabusNodeId,
                subject: node.subject,
                topic: node.topic,
                microTheme: node.microTheme,
            });
        } else {
            fingerprintMap.set(node.fingerprint, node);
        }

        for (const legacyId of node.legacyIds) {
            if (!legacyAliasTemp[legacyId]) legacyAliasTemp[legacyId] = [];
            legacyAliasTemp[legacyId].push(node.syllabusNodeId);
        }

        finalNodes.push(node);
    }

    const legacyAliasMap = {};
    for (const [legacyId, canonicalIdsRaw] of Object.entries(legacyAliasTemp)) {
        const canonicalIds = uniq(canonicalIdsRaw).sort();
        legacyAliasMap[legacyId] = {
            aliasType: canonicalIds.length === 1 ? "leaf" : "parent",
            canonicalIds,
            primaryNodeId: canonicalIds[0],
        };
    }

    audit.duplicateFingerprints = duplicates;

    const broadWordSet = new Set([
        "overview",
        "basics",
        "concept",
        "broad",
        "general",
        "introduction",
        "issues",
        "trends",
        "types",
        "features",
    ]);

    for (const node of finalNodes) {
        const n = norm(node.microTheme);
        const words = n.split(" ").filter(Boolean);
        const broadHits = words.filter((w) => broadWordSet.has(w));

        if (words.length <= 2 || broadHits.length >= 1) {
            pushAudit(audit, "weakNodes", {
                syllabusNodeId: node.syllabusNodeId,
                subject: node.subject,
                topic: node.topic,
                microTheme: node.microTheme,
            });
        }

        if (!node.tags.length) {
            pushAudit(audit, "missingTags", {
                syllabusNodeId: node.syllabusNodeId,
                subject: node.subject,
                topic: node.topic,
                microTheme: node.microTheme,
            });
        }

        if (!node.keywords.length) {
            pushAudit(audit, "missingKeywords", {
                syllabusNodeId: node.syllabusNodeId,
                subject: node.subject,
                topic: node.topic,
                microTheme: node.microTheme,
            });
        }

        if (!node.subject || !node.microTheme) {
            pushAudit(audit, "malformedNodes", {
                syllabusNodeId: node.syllabusNodeId,
                node,
            });
        }
    }

    return { finalNodes, legacyAliasMap };
}

function buildById(nodes) {
    const out = {};
    for (const node of nodes) out[node.syllabusNodeId] = node;
    return out;
}

function buildBySubject(nodes) {
    const out = {};
    for (const node of nodes) {
        const key = node.subject || "UNKNOWN";
        if (!out[key]) out[key] = [];
        out[key].push(node.syllabusNodeId);
    }
    for (const key of Object.keys(out)) out[key].sort();
    return out;
}

function buildSummary(nodes, sources, audit) {
    const byRootPaper = {};
    const bySubject = {};
    const bySourceFile = {};

    for (const node of nodes) {
        byRootPaper[node.rootPaper] = (byRootPaper[node.rootPaper] || 0) + 1;
        bySubject[node.subject] = (bySubject[node.subject] || 0) + 1;
        bySourceFile[node.sourceFile] = (bySourceFile[node.sourceFile] || 0) + 1;
    }

    return {
        generatedAt: new Date().toISOString(),
        sourcesLoaded: sources.map((s) => ({
            sourceFile: s.sourceFile,
            sourceKey: s.sourceKey,
            sourceType: s.sourceType,
        })),
        totals: {
            nodes: nodes.length,
            sourceFiles: sources.length,
            duplicateFingerprints: audit.duplicateFingerprints.length,
            weakNodes: audit.weakNodes.length,
            missingTags: audit.missingTags.length,
            missingKeywords: audit.missingKeywords.length,
            missingMicroThemes: audit.missingMicroThemes.length,
            missingSubtopics: audit.missingSubtopics.length,
            malformedNodes: audit.malformedNodes.length,
        },
        byRootPaper,
        bySubject,
        bySourceFile,
    };
}

async function main() {
    ensureDir(OUT_DIR);

    const sources = await loadSources();
    if (!sources.length) {
        throw new Error("No syllabus source files found in backend/brain");
    }

    const rawNodes = [];
    const audit = {
        missingMicroThemes: [],
        missingSubtopics: [],
        missingTags: [],
        missingKeywords: [],
        malformedNodes: [],
        weakNodes: [],
        duplicateFingerprints: [],
    };

    for (const source of sources) {
        traverseSource(source, rawNodes, audit);
    }

    const { finalNodes, legacyAliasMap } = finalizeNodes(rawNodes, audit);

    finalNodes.sort((a, b) => {
        return [
            a.rootPaper,
            a.subject,
            a.section,
            a.topic,
            a.subtopic,
            a.microTheme,
            a.syllabusNodeId,
        ].join("|").localeCompare([
            b.rootPaper,
            b.subject,
            b.section,
            b.topic,
            b.subtopic,
            b.microTheme,
            b.syllabusNodeId,
        ].join("|"));
    });

    const unifiedNodesMaster = {
        version: "2026-canonical-v2",
        summary: buildSummary(finalNodes, sources, audit),
        nodes: finalNodes,
    };

    const unifiedNodesById = buildById(finalNodes);
    const unifiedNodesBySubject = buildBySubject(finalNodes);

    const auditReport = {
        version: "2026-canonical-v2",
        summary: unifiedNodesMaster.summary,
        duplicateFingerprints: audit.duplicateFingerprints,
        weakNodes: audit.weakNodes,
        missingTags: audit.missingTags,
        missingKeywords: audit.missingKeywords,
        missingMicroThemes: audit.missingMicroThemes,
        missingSubtopics: audit.missingSubtopics,
        malformedNodes: audit.malformedNodes,
    };

    writeJson(path.join(OUT_DIR, "unified_nodes_master.json"), unifiedNodesMaster);
    writeJson(path.join(OUT_DIR, "unified_nodes_by_id.json"), unifiedNodesById);
    writeJson(path.join(OUT_DIR, "unified_nodes_by_subject.json"), unifiedNodesBySubject);
    writeJson(path.join(OUT_DIR, "legacy_node_alias_map.json"), legacyAliasMap);
    writeJson(path.join(OUT_DIR, "audit_report.json"), auditReport);

    console.log("✅ Unified syllabus master built");
    console.log(`Nodes: ${finalNodes.length}`);
    console.log(`Sources: ${sources.length}`);
    console.log(`Output: ${OUT_DIR}`);
}

main().catch((err) => {
    console.error("❌ buildUnifiedSyllabusMaster failed");
    console.error(err);
    process.exit(1);
});
