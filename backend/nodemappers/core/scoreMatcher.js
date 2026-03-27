import { normalizeText } from "./normalizeText.js";
import { tokenizeTopic } from "./tokenizeTopic.js";
import UNIFIED_SYLLABUS_INDEX from "../../brain/unifiedSyllabusIndex.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return value == null ? "" : String(value);
}

function keywordScore(tokens, node) {
  const hay = normalizeText(tokens.join(" "));

  const keywords = [
    ...safeArray(node.keywords),
    ...safeArray(node.aliases),
    node.name,
    node.microTheme,
    node.macroTheme,
    node.subject,
    node.section,
    node.mappedTopicName
  ]
    .filter(Boolean)
    .map(v => normalizeText(v));

  let score = 0;

  for (const kw of keywords) {
    if (!kw) continue;

    if (hay === kw) {
      score += 15;
      continue;
    }

    if (hay.includes(kw) && kw.length >= 4) {
      score += kw.includes(" ") ? 8 : 6;
      continue;
    }

    const kwTokens = tokenizeTopic(kw).filter(Boolean);
    let hits = 0;

    for (const token of tokens) {
      if (kwTokens.includes(token)) hits += 1;
    }

    score += hits;
  }

  return score;
}

function phraseBoost(text, node) {
  const hay = normalizeText(text);
  let score = 0;

  for (const phrase of [
    node.name,
    node.microTheme,
    node.macroTheme,
    node.section,
    node.mappedTopicName,
    ...(safeArray(node.aliases))
  ]) {
    const p = normalizeText(phrase || "");
    if (!p) continue;

    if (hay === p) {
      score += 12;
    } else if (hay.includes(p) && p.length >= 4) {
      score += 6;
    }
  }

  return score;
}

function boostedTermScore(text, boostedTerms = []) {
  const hay = normalizeText(text);
  let score = 0;

  for (const term of boostedTerms) {
    const t = normalizeText(term);
    if (!t) continue;

    if (hay === t) score += 6;
    else if (hay.includes(t)) score += 2;
  }

  return score;
}

function modeAwareBiasScore(subjectKey, node, context = {}) {
  let score = 0;

  const mode = normalizeText(context.mode || context.mappingMode || "plan");
  const requestedSubject = normalizeText(
    context.subject || context.originalSubject || ""
  );

  const gsPaper = normalizeText(node.gsPaper || "");
  const subjectGroup = normalizeText(node.subjectGroup || "");
  const subject = normalizeText(node.subject || "");
  const section = normalizeText(node.section || "");
  const macroTheme = normalizeText(node.macroTheme || "");
  const nodeKey = normalizeText(node.subjectKey || node.subject_group_key || "");
  const name = normalizeText(node.name || "");
  const tags = safeArray(node.tags).map(normalizeText);

  const isOptionalNode =
    gsPaper === "optional" ||
    subjectGroup.includes("optional") ||
    subject.includes("optional") ||
    nodeKey.includes("optional") ||
    name.includes("optional");

  const isGs1Node = gsPaper === "gs1" || subjectGroup.includes("gs1");
  const isGs2Node = gsPaper === "gs2" || subjectGroup.includes("gs2");
  const isGs3Node = gsPaper === "gs3" || subjectGroup.includes("gs3");

  const wantsOptional =
    requestedSubject.includes("optional geography") ||
    requestedSubject.includes("geography optional") ||
    requestedSubject.includes("optional");

  const wantsGsGeography =
    requestedSubject === "geography" ||
    requestedSubject.includes("gs1 geography") ||
    requestedSubject.includes("general geography");

  // ---- Subject family bias ----
  if (subjectKey === "geography") {
    if (wantsOptional) {
      if (isOptionalNode) score += 10;
      if (isGs1Node) score -= 4;
    } else if (wantsGsGeography || requestedSubject === "") {
      if (isGs1Node) score += 8;
      if (subjectGroup.includes("gs1")) score += 4;
      if (isOptionalNode) score -= 6;
      if (subjectGroup.includes("optional")) score -= 4;
    }

    if (
      section.includes("geography") ||
      section.includes("climatology") ||
      section.includes("indian geography") ||
      subject.includes("geography") ||
      macroTheme.includes("geography")
    ) {
      score += 3;
    }
  }

  if (subjectKey === "science_tech") {
    if (isGs3Node) score += 4;
    if (subject.includes("science")) score += 4;
    if (section.includes("science")) score += 3;
    if (nodeKey.includes("science")) score += 3;
    if (isOptionalNode) score -= 4;
  }

  if (subjectKey === "economy") {
    if (isGs3Node) score += 4;
    if (subject.includes("economy")) score += 4;
    if (section.includes("economy")) score += 3;
    if (macroTheme.includes("economy")) score += 3;
  }

  if (subjectKey === "polity") {
    if (isGs2Node) score += 5;
    if (subject.includes("polity")) score += 4;
    if (section.includes("polity")) score += 3;
    if (macroTheme.includes("polity")) score += 3;
  }

  // ---- Mode bias ----
  if (mode === "prelims_test" || mode === "prelims") {
    if (tags.includes("p")) score += 5;
    if (section.includes("prelims")) score += 4;
    if (name.includes("prelims")) score += 3;
    if (tags.includes("m")) score -= 1;
  }

  if (mode === "mains_test" || mode === "mains" || mode === "answer_writing") {
    if (tags.includes("m")) score += 5;
    if (section.includes("mains")) score += 4;
    if (name.includes("mains")) score += 3;
    if (tags.includes("p")) score -= 1;
  }

  if (mode === "plan") {
    // neutral mode, but favor canonical GS nodes unless user explicitly asks optional
    if (!wantsOptional && isOptionalNode && subjectKey !== "optional_geography") {
      score -= 2;
    }
  }

  if (mode === "revision") {
    // keep mostly neutral for now; later can incorporate user analytics
    score += 0;
  }

  return score;
}

export function buildUnifiedCandidatePool({ subjectKey, text, context = {} }) {
  const pool = Array.isArray(UNIFIED_SYLLABUS_INDEX) ? UNIFIED_SYLLABUS_INDEX : [];

  return pool.filter(node => {
    const nodeKey = safeString(node.subjectKey || node.subject_group_key).toLowerCase();
    const gsPaper = safeString(node.gsPaper).toLowerCase();
    const subjectGroup = safeString(node.subjectGroup).toLowerCase();
    const subject = safeString(node.subject).toLowerCase();
    const macroTheme = safeString(node.macroTheme).toLowerCase();
    const microTheme = safeString(node.microTheme).toLowerCase();
    const mappedTopicName = safeString(node.mappedTopicName).toLowerCase();
    const name = safeString(node.name).toLowerCase();
    const section = safeString(node.section).toLowerCase();

    if (nodeKey === subjectKey) return true;

    if (subjectKey === "science_tech") {
      return (
        nodeKey.includes("science") ||
        subjectGroup.includes("science") ||
        subject.includes("science") ||
        macroTheme.includes("science") ||
        section.includes("science") ||
        microTheme.includes("biotech") ||
        mappedTopicName.includes("biotech") ||
        name.includes("biotech")
      );
    }

    if (subjectKey === "economy") {
      return (
        nodeKey.includes("economy") ||
        subjectGroup.includes("economy") ||
        subject.includes("economy") ||
        macroTheme.includes("economy") ||
        section.includes("economy") ||
        gsPaper === "gs3"
      );
    }

    if (subjectKey === "polity") {
      return (
        nodeKey.includes("polity") ||
        subjectGroup.includes("polity") ||
        subject.includes("polity") ||
        macroTheme.includes("polity") ||
        section.includes("polity") ||
        gsPaper === "gs2"
      );
    }

    if (subjectKey === "geography") {
      return (
        nodeKey.includes("geography") ||
        subjectGroup.includes("geography") ||
        subject.includes("geography") ||
        macroTheme.includes("geography") ||
        section.includes("geography") ||
        gsPaper === "gs1" ||
        gsPaper === "optional"
      );
    }

    return false;
  });
}

export function scoreCandidates({
  subjectKey,
  text,
  tokens = [],
  candidates = [],
  boostedTerms = [],
  context = {}
}) {
  const hay = normalizeText(text);
  const normalizedTokens = tokens.length ? tokens : tokenizeTopic(text);

  return candidates
    .map(node => {
      const base = keywordScore(normalizedTokens, node);
      const phrase = phraseBoost(text, node);
      const boost = boostedTermScore(text, boostedTerms);

      const micro = normalizeText(node.microTheme || "");
      const macro = normalizeText(node.macroTheme || "");
      const mapped = normalizeText(node.mappedTopicName || "");
      const name = normalizeText(node.name || "");
      const section = normalizeText(node.section || "");

      let exact = 0;

      if (name && hay === name) exact += 16;
      if (micro && hay === micro) exact += 12;
      if (mapped && hay === mapped) exact += 12;
      if (section && hay === section) exact += 6;

      if (name && hay.includes(name) && name.length >= 4) exact += 8;
      if (micro && hay.includes(micro) && micro.length >= 4) exact += 6;
      if (mapped && hay.includes(mapped) && mapped.length >= 4) exact += 6;
      if (section && hay.includes(section) && section.length >= 4) exact += 3;
      if (macro && hay === macro) exact += 5;

      const subjectBias = modeAwareBiasScore(subjectKey, node, context);
      const total = base + phrase + boost + exact + subjectBias;

      return {
        ...node,
        _score: total,
        _debug: { base, phrase, boost, exact, subjectBias }
      };
    })
    .filter(node => node._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 8);
}