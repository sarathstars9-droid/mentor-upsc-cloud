// backend/brain/autoNodeResolver.js
import syllabusGraph from "./syllabusGraph.js";
const SUBJECT_ALIASES = {
    science_and_tech: "science_tech",
    optional_geography: "geography_optional",
};


/**
 * AUTO NODE RESOLVER
 * ------------------
 * Deterministic semantic resolver for UPSC Mentor OS.
 *
 * Goal:
 *   text + subjectId -> best syllabus node(s)
 *
 * Principles:
 *   - syllabusGraph.js is single source of truth
 *   - subject lock is HARD
 *   - deterministic only
 *   - no random fallback
 *   - confidence + ambiguity gate required
 */

const DEFAULT_WEIGHTS = {
    exactPhrase: 0.40,
    tokenOverlap: 0.25,
    aliasMatch: 0.20,
    subjectMatch: 0.15,
};

const DEFAULT_THRESHOLDS = {
    acceptScore: 0.85,
    minGap: 0.15,
    maxCandidates: 10,
};

const STOPWORDS = new Set([
    "and",
    "or",
    "the",
    "of",
    "in",
    "on",
    "for",
    "to",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "with",
    "from",
    "by",
    "at",
    "into",
    "about",
    "under",
    "over",
    "topic",
    "subtopic",
    "chapter",
    "unit",
    "part",
    "notes",
    "study",
    "revision",
    "pyq",
    "pyqs",
]);

const SUBJECT_PREFIX_MAP = {
    gs1: ["GS1-"],
    gs2: ["GS2-"],
    gs3: ["GS3-"],
    gs4: ["GS4-"],
    ethics: ["GS4-ETH", "GS4-"],
    essay: ["ESSAY-"],
    csat: ["CSAT-", "PRE-CSAT-", "PRELIMS-CSAT-"],
    geography_optional: ["GO-", "GEO-OPT-", "GEOGRAPHY-OPTIONAL-"],
    optional_geography: ["GO-", "GEO-OPT-", "GEOGRAPHY-OPTIONAL-"],
    history: ["GS1-HIS-"],
    geography: ["GS1-GEO-", "GO-", "GEO-OPT-"],
    polity: ["GS2-POL-"],
    governance: ["GS2-GOV-"],
    ir: ["GS2-IR-"],
    economy: ["GS3-ECO-"],
    environment: ["GS3-ENV-"],
    science_tech: ["GS3-ST-"],
    security: ["GS3-SEC-"],
    disaster_management: ["GS3-DM-"],
};

function safeArray(value) {
    return Array.isArray(value) ? value : value ? [value] : [];
}

function normalizeText(text = "") {
    return String(text)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[’']/g, "")
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenize(text = "") {
    return normalizeText(text)
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .filter((t) => !STOPWORDS.has(t));
}

function unique(arr = []) {
    return [...new Set(arr.filter(Boolean))];
}

function phraseIncludes(haystack, needle) {
    if (!haystack || !needle) return false;
    return normalizeText(haystack).includes(normalizeText(needle));
}

function tokenOverlapScore(aTokens, bTokens) {
    if (!aTokens.length || !bTokens.length) return 0;

    const a = new Set(aTokens);
    const b = new Set(bTokens);

    let overlap = 0;
    for (const token of a) {
        if (b.has(token)) overlap += 1;
    }

    const denom = Math.max(a.size, b.size, 1);
    return overlap / denom;
}

function flattenGraph(graph) {
    const nodes = [];

    function visit(node, parentId = null) {
        if (!node || typeof node !== "object") return;

        const nodeId = node.id || node.nodeId;
        if (!nodeId) return;

        nodes.push({
            id: nodeId,
            parentId,
            name: node.name || node.title || "",
            microThemes: unique([
                ...safeArray(node.microTheme),
                ...safeArray(node.microThemes),
                ...safeArray(node.subtopics),
            ]),
            aliases: unique([
                ...safeArray(node.aliases),
                ...safeArray(node.synonyms),
                ...safeArray(node.keywords),
            ]),
            raw: node,
        });

        const children = safeArray(node.children);
        for (const child of children) {
            visit(child, nodeId);
        }
    }

    if (Array.isArray(graph)) {
        for (const node of graph) visit(node, null);
    } else if (graph && typeof graph === "object") {
        for (const value of Object.values(graph)) {
            if (Array.isArray(value)) {
                for (const node of value) visit(node, null);
            } else if (value && typeof value === "object") {
                visit(value, null);
            }
        }
    }

    return nodes;
}

const FLAT_NODES = flattenGraph(syllabusGraph);

const NODE_MAP = new Map(FLAT_NODES.map((n) => [n.id, n]));

const CHILDREN_MAP = buildChildrenMap(FLAT_NODES);

function buildChildrenMap(nodes) {
    const map = new Map();

    for (const node of nodes) {
        if (!map.has(node.id)) map.set(node.id, []);
    }

    for (const node of nodes) {
        if (node.parentId) {
            if (!map.has(node.parentId)) map.set(node.parentId, []);
            map.get(node.parentId).push(node.id);
        }
    }

    return map;
}

function getDescendantLeafNodeIds(nodeId) {
    const out = [];
    const stack = [nodeId];

    while (stack.length) {
        const current = stack.pop();
        const children = CHILDREN_MAP.get(current) || [];

        if (!children.length) {
            out.push(current);
            continue;
        }

        for (const childId of children) stack.push(childId);
    }

    return unique(out);
}

function isLeafNode(nodeId) {
    return (CHILDREN_MAP.get(nodeId) || []).length === 0;
}

function resolveSubjectPrefixes(subjectId = "") {
    const key = normalizeText(subjectId).replace(/\s+/g, "_");
    return SUBJECT_PREFIX_MAP[key] || [];
}

function nodeMatchesSubject(nodeId, subjectId) {
    const prefixes = resolveSubjectPrefixes(subjectId);
    if (!prefixes.length) return true;
    return prefixes.some((prefix) => nodeId.startsWith(prefix));
}

function buildNodeSearchCorpus(node) {
    const fields = [
        node.name,
        ...node.microThemes,
        ...node.aliases,
    ].filter(Boolean);

    const normalizedFields = fields.map(normalizeText);
    const tokens = unique(normalizedFields.flatMap((x) => tokenize(x)));

    return {
        fields: normalizedFields,
        tokens,
    };
}

function scoreNode({ inputText, inputTokens, node, subjectId, weights }) {
    const corpus = buildNodeSearchCorpus(node);

    let exactPhrase = 0;
    for (const field of corpus.fields) {
        if (phraseIncludes(field, inputText) || phraseIncludes(inputText, field)) {
            exactPhrase = 1;
            break;
        }
    }

    const tokenOverlap = Math.max(
        ...[node.name, ...node.microThemes, ...node.aliases].map((field) =>
            tokenOverlapScore(inputTokens, tokenize(field))
        ),
        0
    );

    let aliasMatch = 0;
    for (const alias of node.aliases) {
        const aliasNorm = normalizeText(alias);
        if (!aliasNorm) continue;
        if (aliasNorm === inputText || phraseIncludes(inputText, aliasNorm) || phraseIncludes(aliasNorm, inputText)) {
            aliasMatch = 1;
            break;
        }
    }

    const subjectMatch = nodeMatchesSubject(node.id, subjectId) ? 1 : 0;

    const score =
        exactPhrase * weights.exactPhrase +
        tokenOverlap * weights.tokenOverlap +
        aliasMatch * weights.aliasMatch +
        subjectMatch * weights.subjectMatch;

    return {
        score: Number(score.toFixed(4)),
        signals: {
            exactPhrase: Number(exactPhrase.toFixed(4)),
            tokenOverlap: Number(tokenOverlap.toFixed(4)),
            aliasMatch: Number(aliasMatch.toFixed(4)),
            subjectMatch: Number(subjectMatch.toFixed(4)),
        },
    };
}

function getLockedCandidates(subjectId) {
    return FLAT_NODES.filter((node) => nodeMatchesSubject(node.id, subjectId));
}

export function autoResolveNodes({
    text,
    subjectId,
    weights = DEFAULT_WEIGHTS,
    thresholds = DEFAULT_THRESHOLDS,
    expandParentToLeaves = true,
    debug = true,
} = {}) {
    const inputText = normalizeText(text);
    const inputTokens = tokenize(inputText);

    if (!inputText) {
        return {
            ok: false,
            nodeIds: [],
            confidence: 0,
            selectedNode: null,
            selectedLeafNodeIds: [],
            candidates: [],
            quarantine: true,
            reason: "EMPTY_INPUT",
        };
    }

    const lockedNodes = getLockedCandidates(subjectId);

    if (!lockedNodes.length) {
        return {
            ok: false,
            nodeIds: [],
            confidence: 0,
            selectedNode: null,
            selectedLeafNodeIds: [],
            candidates: [],
            quarantine: true,
            reason: "NO_SUBJECT_LOCK_MATCH",
        };
    }

    const scored = lockedNodes
        .map((node) => {
            const result = scoreNode({
                inputText,
                inputTokens,
                node,
                subjectId,
                weights,
            });

            return {
                nodeId: node.id,
                name: node.name,
                parentId: node.parentId,
                score: result.score,
                signals: result.signals,
                isLeaf: isLeafNode(node.id),
            };
        })
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.isLeaf !== b.isLeaf) return Number(b.isLeaf) - Number(a.isLeaf);
            return a.nodeId.localeCompare(b.nodeId);
        });

    const topCandidates = scored.slice(0, thresholds.maxCandidates);
    const best = topCandidates[0] || null;
    const runnerUp = topCandidates[1] || null;

    const confidence = best?.score || 0;
    const gap = best && runnerUp ? Number((best.score - runnerUp.score).toFixed(4)) : confidence;

    const accepted =
        !!best &&
        confidence >= thresholds.acceptScore &&
        gap >= thresholds.minGap;

    const selectedNode = accepted ? best.nodeId : null;

    let selectedLeafNodeIds = [];
    if (accepted && selectedNode) {
        if (expandParentToLeaves && !isLeafNode(selectedNode)) {
            selectedLeafNodeIds = getDescendantLeafNodeIds(selectedNode);
        } else {
            selectedLeafNodeIds = [selectedNode];
        }
    }

    if (debug) {
        console.log("AUTO-MAPPER DEBUG:", {
            input: text,
            normalized: inputText,
            subjectId,
            topCandidates: topCandidates.slice(0, 5),
            selectedNode,
            selectedLeafNodeIds,
            confidence,
            gap,
            accepted,
        });
    }

    return {
        ok: accepted,
        nodeIds: selectedLeafNodeIds,
        confidence,
        gap,
        selectedNode,
        selectedLeafNodeIds,
        selectedNodeMeta: selectedNode ? NODE_MAP.get(selectedNode) || null : null,
        candidates: topCandidates,
        quarantine: !accepted,
        reason: accepted ? "ACCEPTED" : "LOW_CONFIDENCE_OR_AMBIGUOUS",
    };
}

export function explainAutoResolve(input) {
    const result = autoResolveNodes({ ...input, debug: false });
    return {
        input,
        result,
    };
}

export default autoResolveNodes;