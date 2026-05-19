/**
 * backend/mainsReview/resolveMainsSyllabusContext.js
 *
 * Performs real tagged-node search against the MentorOS unified syllabus index
 * (1,726 nodes across GS1/GS2/GS3/GS4/Essay/Geography Optional/CSAT).
 *
 * Called by mainsReviewRoutes.js BEFORE buildAir1Prompt so that the prompt
 * receives concrete syllabusNode / microTheme / nodeId values instead of "Unknown".
 *
 * NOTE on tag format: nodes carry tags like "P", "M", "PM", "GS4", "ETH", "OPT".
 * "PM" = prelims+mains combined tag. We treat any tag containing "M" as mains-eligible.
 *
 * Exported helpers (matches the names required in the audit):
 *   loadMainsTaggedNodes()          → returns all mains-tagged nodes from the index
 *   normalizeTaggedNode(node)       → normalises a node to a flat context shape
 *   findBestMainsNodeMatches(q)     → scored search, returns top matches
 *   resolveMainsSyllabusContext(p)  → full resolution, returns inferredMetadata
 */

import { UNIFIED_SYLLABUS_INDEX } from "../brain/unifiedSyllabusIndex.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function normalize(text = "") {
    return String(text)
        .toLowerCase()
        .replace(/[–—]/g, "-")
        .replace(/[^\w\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function matchSourceFromBand(band) {
    if (band === "high")   return "exact_node";
    if (band === "medium") return "related_node";
    return "global_inference";
}

// ─── exported API ─────────────────────────────────────────────────────────────

/**
 * loadMainsTaggedNodes()
 * Returns all nodes relevant to Mains: GS/Essay/Optional root papers,
 * OR explicitly tagged "M" or "PM" (prelims+mains combined).
 * Excludes pure CSAT nodes.
 */
export function loadMainsTaggedNodes() {
    return UNIFIED_SYLLABUS_INDEX.filter((node) => {
        const tags = Array.isArray(node.tags)
            ? node.tags.map(t => String(t).toUpperCase())
            : [];
        const root = String(node.rootPaper || "").toUpperCase();

        // "PM" = prelims+mains. "M" = mains only. Both count.
        const hasMainsTag = tags.some(t => t === "M" || t === "PM");

        // GS/Essay/Optional papers are all Mains-relevant by definition
        const isMainsPaper = (
            root.startsWith("GS") ||
            root.startsWith("ESSAY") ||
            root.startsWith("OPTIONAL")
        );

        // Exclude pure CSAT nodes
        const isPureCsat = root.startsWith("CSAT");

        return !isPureCsat && (hasMainsTag || isMainsPaper);
    });
}

/**
 * normalizeTaggedNode(node)
 * Flattens a raw enriched node into a simple context object for prompt injection.
 * Uses the enriched `normalizedXxx` fields produced by unifiedSyllabusIndex.js.
 */
export function normalizeTaggedNode(node) {
    if (!node) return null;
    return {
        nodeId:       node.syllabusNodeId  || "",
        paper:        node.gsPaper         || node.rootPaper || "",
        subject:      node.subject         || "",
        // topic = enriched topicName (raw), section for fallback
        topic:        node.topicName       || node.topic    || node.sectionName || node.section || "",
        // syllabusNode label: prefer microTheme, then subtopic, then topic
        syllabusNode: node.microTheme      || node.subtopic || node.topic       || "",
        microTheme:   node.microTheme      || "",
        section:      node.sectionName     || node.section  || "",
        keywords:     Array.isArray(node.keywords)
                        ? node.keywords
                        : (Array.isArray(node.normalizedKeywords) ? node.normalizedKeywords : []),
    };
}

/**
 * findBestMainsNodeMatches(query, options)
 * Directly scores all mains-tagged nodes using the pre-normalised index fields.
 * Does NOT use searchUnifiedNodes() because its `tags` filter misses composite "PM" tags.
 *
 * @param {string} query   – combined question text + topic + syllabusNode hint
 * @param {object} options – { subject, paper, limit }
 * @returns {Array}  top scored normalised node objects
 */
export function findBestMainsNodeMatches(query, { subject = "", paper = "", limit = 5 } = {}) {
    const mainsNodes = loadMainsTaggedNodes();
    console.log("[MainsTaggedNodes] loaded count", mainsNodes.length);

    if (!query || !mainsNodes.length) return [];

    const normQuery   = normalize(query);
    const queryTokens = normQuery.split(" ").filter(t => t.length >= 3);

    // Subject narrowing using enriched normalizedSubject / normalizedSection fields
    const normSubject = normalize(subject);
    let pool = mainsNodes;
    if (normSubject) {
        const narrowed = mainsNodes.filter(n => {
            const ns = n.normalizedSubject || normalize(n.subject || "");
            const nc = n.normalizedSection || normalize(n.section || "");
            return ns.includes(normSubject) || normSubject.includes(ns) || nc.includes(normSubject);
        });
        // Only use narrowed if it has meaningful results
        if (narrowed.length >= 3) pool = narrowed;
    }

    const scored = pool.map(node => {
        let score = 0;

        // Use pre-normalised fields from enrichedNode (populated by unifiedSyllabusIndex.js)
        const nMicro    = node.normalizedMicroTheme  || normalize(node.microTheme  || "");
        const nSubtopic = node.normalizedSubtopic    || normalize(node.subtopic    || "");
        const nTopic    = node.normalizedTopic       || normalize(node.topic       || "");
        const nSection  = node.normalizedSection     || normalize(node.section     || "");
        const nSubject  = node.normalizedSubject     || normalize(node.subject     || "");
        const nKeywords = node.normalizedKeywords    || (node.keywords || []).map(normalize);
        const nSearch   = node.searchableTextNormalized || "";

        // ── Exact / contains match on structured fields ─────────────────────
        if (nMicro    && normQuery === nMicro)     score += 200;
        if (nTopic    && normQuery === nTopic)      score += 160;
        if (nSubtopic && normQuery === nSubtopic)   score += 140;
        if (nSection  && normQuery === nSection)    score += 100;

        if (nMicro    && nMicro.includes(normQuery)    && normQuery.length >= 4) score += 80;
        if (nTopic    && nTopic.includes(normQuery)    && normQuery.length >= 4) score += 60;
        if (nSearch   && nSearch.includes(normQuery)   && normQuery.length >= 6) score += 40;

        // ── Token-level overlap ──────────────────────────────────────────────
        for (const token of queryTokens) {
            if (nMicro.includes(token))                                  score += 20;
            if (nSubtopic.includes(token))                               score += 16;
            if (nTopic.includes(token))                                  score += 14;
            if (nSection.includes(token))                                score += 10;
            if (nSubject.includes(token))                                score +=  8;
            if (nKeywords.some(k => k.includes(token)))                  score += 10;
            if (nSearch.includes(token))                                 score +=  2;
        }

        // ── Subject match boost ──────────────────────────────────────────────
        if (normSubject && nSubject.includes(normSubject))               score += 15;

        return { node, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

    return scored.map(x => normalizeTaggedNode(x.node)).filter(Boolean);
}

/**
 * resolveMainsSyllabusContext(payload)
 * Master resolver — called from the route before buildAir1Prompt.
 *
 * Returns:
 *  {
 *    resolvedPaper, resolvedSubject, resolvedTopic,
 *    resolvedSyllabusNode, resolvedMicroTheme, resolvedNodeId,
 *    confidence, matchSource, relatedNodes: []
 *  }
 *
 * Diagnostic logs (required by audit):
 *   [MainsTaggedNodes] loaded count N
 *   [MainsNodeMatch]   bestMatch  { nodeId, syllabusNode, microTheme }
 *   [MainsNodeMatch]   confidence "high|medium|low"
 *   [MainsNodeMatch]   source     "exact_node|related_node|global_inference"
 */
export function resolveMainsSyllabusContext(payload = {}) {
    const getSafe = (f) => {
        if (!f) return "";
        return typeof f === "string" ? f.trim() : String(f).trim();
    };

    const paper        = getSafe(payload.paper);
    const subject      = getSafe(payload.subject);
    const topic        = getSafe(payload.topic);
    const syllabusNode = getSafe(payload.syllabusNode);
    const question     = getSafe(payload.question);

    // Build search query — include known non-Unknown fields as prefix to boost phrase scoring
    const knownParts = [
        syllabusNode !== "Unknown" ? syllabusNode : "",
        topic        !== "Unknown" ? topic        : "",
        subject      !== "Unknown" ? subject      : "",
    ].filter(Boolean);

    const searchQuery = [...knownParts, question].join(" ").trim();

    // Determine best subject hint for narrowing
    // If subject is Unknown but topic carries subject info (e.g. "History"), use topic as hint
    const KNOWN_SUBJECTS = ["History", "Geography", "Society", "Culture", "Polity",
                             "Governance", "Economy", "Environment", "Ethics", "Essay",
                             "International Relations", "Internal Security", "Science", "Disaster"];
    let subjectHint = subject !== "Unknown" ? subject : "";
    if (!subjectHint && topic !== "Unknown") {
        const topicLower = topic.toLowerCase();
        const found = KNOWN_SUBJECTS.find(s => topicLower.includes(s.toLowerCase()) || s.toLowerCase().includes(topicLower));
        if (found) subjectHint = found;
    }

    const matches = findBestMainsNodeMatches(searchQuery, {
        subject: subjectHint,
        paper:   paper !== "Unknown" ? paper : "",
        limit: 5,
    });

    const bestMatch = matches[0] || null;

    // Derive confidence from keyword overlap between question and best match node fields
    let band = "low";
    if (bestMatch) {
        const nodeText  = normalize([
            bestMatch.syllabusNode,
            bestMatch.microTheme,
            bestMatch.topic,
            ...(bestMatch.keywords || []),
        ].join(" "));
        const qTokens   = normalize(question).split(" ").filter(t => t.length >= 4);
        const hits      = qTokens.filter(t => nodeText.includes(t)).length;
        const ratio     = qTokens.length ? hits / qTokens.length : 0;

        if (ratio >= 0.5)      band = "high";
        else if (ratio >= 0.2) band = "medium";
        else                   band = "low";
    }

    const confidence  = band;
    const matchSource = matchSourceFromBand(band);

    console.log("[MainsNodeMatch] bestMatch", bestMatch
        ? { nodeId: bestMatch.nodeId, syllabusNode: bestMatch.syllabusNode, microTheme: bestMatch.microTheme }
        : null
    );
    console.log("[MainsNodeMatch] confidence", confidence);
    console.log("[MainsNodeMatch] source",     matchSource);

    // Final resolved values — prefer real match, fall back to payload input
    const resolvedPaper        = (bestMatch?.paper   && bestMatch.paper   !== "Unknown") ? bestMatch.paper   : (paper   || "Unknown");
    const resolvedSubject      = (bestMatch?.subject && bestMatch.subject !== "Unknown") ? bestMatch.subject : (subject || "Unknown");
    const resolvedTopic        = (bestMatch?.topic   && bestMatch.topic   !== "Unknown") ? bestMatch.topic   : (topic   || "Unknown");
    const resolvedSyllabusNode = bestMatch?.syllabusNode || syllabusNode || "Unknown";
    const resolvedMicroTheme   = bestMatch?.microTheme   || "";
    const resolvedNodeId       = bestMatch?.nodeId       || "";
    const relatedNodes         = matches.slice(1).map(m => m.syllabusNode).filter(Boolean);

    return {
        resolvedPaper,
        resolvedSubject,
        resolvedTopic,
        resolvedSyllabusNode,
        resolvedMicroTheme,
        resolvedNodeId,
        confidence,
        matchSource,
        relatedNodes,
    };
}
