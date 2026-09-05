import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  UNIFIED_NODES_BY_ID,
  isLeafNode,
  resolveLegacyNodeAlias
} from './unifiedSyllabusIndex.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '..');

let canonicalPyqIndex = null;
let legacyAliasMapRaw = null;

function loadLegacyMap() {
  if (legacyAliasMapRaw) return legacyAliasMapRaw;
  try {
    const raw = fs.readFileSync(path.join(baseDir, 'data', 'syllabus_index', 'legacy_node_alias_map.json'), 'utf8');
    legacyAliasMapRaw = JSON.parse(raw);
  } catch(e) {
    legacyAliasMapRaw = {};
  }
  return legacyAliasMapRaw;
}

export function normalizeMainsPyqNodeId(rawNodeId) {
  if (!rawNodeId) return { input_node_id: rawNodeId, resolution_type: 'UNRESOLVED', canonical_node_id: null, canonical_node_ids: [], source: 'normalization' };
  
  if (UNIFIED_NODES_BY_ID[rawNodeId]) {
    return { input_node_id: rawNodeId, resolution_type: 'EXACT', canonical_node_id: rawNodeId, canonical_node_ids: [rawNodeId], source: 'exact' };
  }
  
  const alias = resolveLegacyNodeAlias(rawNodeId);
  if (alias && alias !== rawNodeId && typeof alias === 'string' && UNIFIED_NODES_BY_ID[alias]) {
    return {
      input_node_id: rawNodeId,
      resolution_type: isLeafNode(alias) ? 'LEGACY_ALIAS' : 'CANONICAL_PARENT',
      canonical_node_id: alias,
      canonical_node_ids: [alias],
      source: 'alias_map_string'
    };
  }
  
  const rawAliasMap = loadLegacyMap();
  if (rawAliasMap[rawNodeId]) {
    const mapped = rawAliasMap[rawNodeId];
    if (typeof mapped === 'string') {
      return { input_node_id: rawNodeId, resolution_type: 'LEGACY_ALIAS', canonical_node_id: mapped, canonical_node_ids: [mapped], source: 'legacy_map' };
    } else if (mapped && typeof mapped === 'object') {
      if (mapped.aliasType === 'parent' || mapped.aliasType === 'topic') {
        const canonicalId = mapped.primaryNodeId || rawNodeId;
        return { input_node_id: rawNodeId, resolution_type: 'CANONICAL_PARENT', canonical_node_id: canonicalId, canonical_node_ids: mapped.canonicalIds || [canonicalId], source: 'legacy_map_object' };
      }
      if (mapped.aliasType === 'ambiguous') {
        return { input_node_id: rawNodeId, resolution_type: 'AMBIGUOUS', canonical_node_id: null, canonical_node_ids: mapped.canonicalIds || [], source: 'legacy_map_ambiguous' };
      }
    }
  }
  
  return { input_node_id: rawNodeId, resolution_type: 'UNRESOLVED', canonical_node_id: null, canonical_node_ids: [], source: 'no_match' };
}

export function reloadCanonicalPyqIndex() {
  canonicalPyqIndex = null;
}

function getPaperKey(q) {
  if (q.paper === 'GS1' || q.id?.includes('GS1')) return 'GS1';
  if (q.paper === 'GS2' || q.id?.includes('GS2')) return 'GS2';
  if (q.paper === 'GS3' || q.id?.includes('GS3')) return 'GS3';
  if (q.paper === 'GS4' || q.id?.includes('GS4')) return 'GS4';
  if (q.paper === 'ESSAY' || (q.subject || '').toUpperCase() === 'ESSAY' || q.id?.includes('ESSAY')) return 'ESSAY';
  if (q.paper && q.paper.includes('OPTIONAL') && (q.paper.includes('I') || q.section?.includes('1') || q.id?.includes('_P1_'))) {
    if (q.paper.includes('II') || q.section?.includes('2') || q.id?.includes('_P2_')) return 'OPTIONAL-II';
    return 'OPTIONAL-I';
  }
  if (q.paper && q.paper.includes('OPT')) return 'OPTIONAL-I'; 
  if (q.id?.includes('_P1_')) return 'OPTIONAL-I';
  if (q.id?.includes('_P2_')) return 'OPTIONAL-II';
  return 'UNKNOWN';
}

export function buildCanonicalPyqIndex() {
  if (canonicalPyqIndex) return canonicalPyqIndex;
  
  canonicalPyqIndex = new Map();
  const pyqDir = path.join(baseDir, 'data', 'pyq_questions', 'mains');
  if (!fs.existsSync(pyqDir)) return canonicalPyqIndex;

  const files = fs.readdirSync(pyqDir).filter(f => f.endsWith('.json') && !f.includes('master_clean_fixed'));
  
  let allQs = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(pyqDir, file), 'utf8'));
    let qs = data.questions || data;
    if (data.topics) qs = data.topics;
    if (Array.isArray(qs)) {
      allQs.push(...qs.filter(q => q && (q.question || q.topic)).map(q => ({
        ...q,
        question: q.question || q.topic
      })));
    }
  }

  // Group by canonical_node_id
  for (const q of allQs) {
    const links = [];
    if (q.syllabusNodeId) links.push(...(Array.isArray(q.syllabusNodeId) ? q.syllabusNodeId : [q.syllabusNodeId]));
    if (q.nodeId) links.push(...(Array.isArray(q.nodeId) ? q.nodeId : [q.nodeId]));
    const uniqueLinks = [...new Set(links)];
    
    for (const rawNodeId of uniqueLinks) {
      const norm = normalizeMainsPyqNodeId(rawNodeId);
      if (norm.resolution_type === 'EXACT' || norm.resolution_type === 'LEGACY_ALIAS' || norm.resolution_type === 'CANONICAL_PARENT') {
        const canonicalId = norm.canonical_node_id;
        if (canonicalId) {
          if (!canonicalPyqIndex.has(canonicalId)) {
            canonicalPyqIndex.set(canonicalId, []);
          }
          const paper = getPaperKey(q);
          canonicalPyqIndex.get(canonicalId).push({
            id: q.id || q.questionId || q.question_id,
            question_id: q.id || q.questionId || q.question_id,
            question_text: q.question,
            question: q.question,
            year: q.year || parseInt(q.yearStr) || null,
            paper: paper,
            marks: q.marks || null,
            canonical_node_id: canonicalId,
            raw_node_id: rawNodeId,
            normalization_type: norm.resolution_type,
            normalization_source: norm.source
          });
        }
      }
    }
  }
  
  return canonicalPyqIndex;
}

function getAncestors(nodeId) {
  const ancestors = [];
  const node = UNIFIED_NODES_BY_ID[nodeId];
  if (!node) return ancestors;

  if (node.parentId) {
    ancestors.push(node.parentId);
  }

  if (node.baseLegacyId) {
    const norm = normalizeMainsPyqNodeId(node.baseLegacyId);
    if (norm.canonical_node_id && norm.canonical_node_id !== nodeId) {
      ancestors.push(norm.canonical_node_id);
    }
  }

  if (Array.isArray(node.legacyIds)) {
    for (const legacyId of node.legacyIds) {
      const norm = normalizeMainsPyqNodeId(legacyId);
      if (norm.canonical_node_id && norm.canonical_node_id !== nodeId) {
        ancestors.push(norm.canonical_node_id);
      }
    }
  }

  return [...new Set(ancestors)];
}

const STOP_WORDS = new Set([
  'discuss', 'examine', 'critically', 'analyse', 'analyze', 'evaluate', 'comment', 
  'explain', 'elucidate', 'describe', 'assess', 'india', 'indian', 'context', 
  'recent', 'importance', 'what', 'how', 'why', 'is', 'the', 'in', 'to', 'and', 'for',
  'of', 'a', 'on', 'with', 'by', 'as', 'are', 'be', 'this', 'that', 'it', 'from',
  'which', 'an', 'has', 'have', 'do', 'does', 'did', 'will', 'would', 'should', 'can',
  'could', 'may', 'might', 'must', 'not', 'no', 'or', 'if', 'but', 'so', 'then',
  'concept', 'development', 'model', 'features', 'factors', 'role'
]);

function tokenize(text) {
  if (!text) return [];
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  return normalized.split(/\s+/).filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

function calculateRelevance(questionText, queryText, node) {
  if (!queryText) return { score: 0, matched_terms: [], matched_phrases: [] };
  
  const qTokens = tokenize(questionText);
  const qTextLower = (questionText || '').toLowerCase().replace(/\s+/g, ' ');
  
  const queryTokens = tokenize(queryText);
  const queryTextLower = (queryText || '').toLowerCase().replace(/\s+/g, ' ');

  // Enrich with canonical node metadata, but with lower weights
  const nodeTokens = [];
  if (node) {
    nodeTokens.push(...tokenize(node.topic));
    nodeTokens.push(...tokenize(node.microTheme));
    (node.keywords || []).forEach(kw => nodeTokens.push(...tokenize(kw)));
  }
  const uniqueNodeTokens = [...new Set(nodeTokens)];

  let score = 0;
  const matched_terms = new Set();
  const matched_phrases = new Set();

  // 1. Exact Phrase Overlap
  const phrases = [
    'cooperative federalism', 'competitive federalism', 'centre state', 'fiscal federalism',
    'finance commission', 'inter state', 'slope development', 'geomorphic cycle',
    'landscape evolution', 'urban flooding', 'disaster management', 'climate change'
  ];
  
  // Dynamic phrases from query (bigrams)
  const queryWords = queryTextLower.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  for (let i = 0; i < queryWords.length - 1; i++) {
    phrases.push(`${queryWords[i]} ${queryWords[i+1]}`);
  }

  for (const phrase of phrases) {
    if (queryTextLower.includes(phrase) && qTextLower.includes(phrase)) {
      score += 5.0; // High weight for phrases
      matched_phrases.add(phrase);
    }
  }

  // 2. Meaningful Token Overlap (Query vs Question)
  for (const token of queryTokens) {
    if (qTokens.includes(token)) {
      score += 2.0;
      matched_terms.add(token);
    }
  }

  // 3. Node Metadata Overlap
  for (const token of uniqueNodeTokens) {
    if (qTokens.includes(token)) {
      score += 0.5;
      matched_terms.add(`[node]${token}`);
    }
  }

  return {
    score,
    matched_terms: [...matched_terms],
    matched_phrases: [...matched_phrases]
  };
}

export function getMainsQuestionsByNodeId(nodeId, { budget = 6, stage = 'mains', queryText = '' } = {}) {
  const index = buildCanonicalPyqIndex();
  
  const requestedNode = UNIFIED_NODES_BY_ID[nodeId];
  
  let requestedPaper = null;
  if (requestedNode) {
     const rootPaper = requestedNode.rootPaper || '';
     if (rootPaper.toUpperCase().startsWith('GS1')) requestedPaper = 'GS1';
     else if (rootPaper.toUpperCase().startsWith('GS2')) requestedPaper = 'GS2';
     else if (rootPaper.toUpperCase().startsWith('GS3')) requestedPaper = 'GS3';
     else if (rootPaper.toUpperCase().startsWith('GS4')) requestedPaper = 'GS4';
     else if (rootPaper.toUpperCase().startsWith('ESSAY')) requestedPaper = 'ESSAY';
     else if (rootPaper.toUpperCase().includes('OPTIONAL')) {
        if (rootPaper.toUpperCase().includes('PAPER 1') || rootPaper.toUpperCase().includes('PAPER I')) requestedPaper = 'OPTIONAL-I';
        else if (rootPaper.toUpperCase().includes('PAPER 2') || rootPaper.toUpperCase().includes('PAPER II')) requestedPaper = 'OPTIONAL-II';
     }
  }
  
  // Quick fallback if rootPaper didn't parse properly
  if (!requestedPaper && requestedNode) {
     requestedPaper = getPaperKey({ paper: requestedNode.rootPaper, id: nodeId });
  }

  const result = {
    questions: [],
    retrieval_meta: {
      requested_node_id: nodeId,
      exact_count: 0,
      parent_count: 0,
      ancestor_count: 0,
      normalized_legacy_count: 0,
      unresolved_skipped: 0, 
      final_count: 0,
      max_budget: budget,
      retrieval_version: "mains-pyq-v2",
      rejected_questions: []
    }
  };

  if (!requestedNode) return result;

  const seenIds = new Set();
  const seenTexts = new Set();

  // We collect all valid candidates from exactly matching, parent, and ancestors
  // then sort and slice at the end, so budget is a ceiling and we get the absolute best.
  
  const allCandidates = [];

  function processCandidates(questions, level) {
    for (const q of questions) {
      if (requestedPaper && requestedPaper !== 'UNKNOWN' && q.paper !== requestedPaper && q.paper !== 'UNKNOWN') continue;

      const normText = (q.question_text || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (seenIds.has(q.question_id) || seenTexts.has(normText)) continue;

      seenIds.add(q.question_id);
      seenTexts.add(normText);
      
      let relevance = { score: 0, matched_terms: [], matched_phrases: [] };
      if (level === 'PARENT_NODE' || level === 'ANCESTOR_NODE') {
        relevance = calculateRelevance(q.question_text, queryText, requestedNode);
      } else {
        // EXACT_NODE intrinsically gets a massive score so it's always top
        relevance = { score: 100, matched_terms: ['EXACT_MATCH'], matched_phrases: [] };
      }

      const candidate = {
        ...q,
        retrieval_level: level,
        matched_node_id: q.canonical_node_id,
        relevance_score: relevance.score,
        matched_terms: relevance.matched_terms,
        matched_phrases: relevance.matched_phrases
      };
      
      allCandidates.push(candidate);
    }
  }

  const exactQs = index.get(nodeId) || [];
  processCandidates(exactQs, 'EXACT_NODE');

  const ancestors = getAncestors(nodeId);
  // Level 2 is the first ancestor (Parent)
  if (ancestors.length > 0) {
    const parentQs = index.get(ancestors[0]) || [];
    processCandidates(parentQs, 'PARENT_NODE');
  }

  // Level 3: Ancestors
  for (let i = 1; i < ancestors.length; i++) {
    const ancestorQs = index.get(ancestors[i]) || [];
    processCandidates(ancestorQs, 'ANCESTOR_NODE');
  }

  // Determine thresholds
  const THRESHOLD_PARENT = queryText ? 2.0 : 0; // If no query, we effectively don't retrieve from parent unless it's 0 threshold? Wait. User said: "If queryText is missing: DO NOT broadly fill from parent/ancestor buckets".
  const THRESHOLD_ANCESTOR = queryText ? 4.0 : 999;
  
  let validCandidates = allCandidates.filter(c => {
    if (c.retrieval_level === 'EXACT_NODE') return true;
    if (!queryText) {
      result.retrieval_meta.rejected_questions.push({ ...c, reject_reason: 'NO_QUERY_TEXT' });
      return false; // Safety fallback
    }
    
    let passed = false;
    if (c.retrieval_level === 'PARENT_NODE') passed = c.relevance_score >= THRESHOLD_PARENT;
    if (c.retrieval_level === 'ANCESTOR_NODE') passed = c.relevance_score >= THRESHOLD_ANCESTOR;
    
    if (!passed) {
      result.retrieval_meta.rejected_questions.push({ ...c, reject_reason: 'BELOW_THRESHOLD' });
    }
    return passed;
  });

  // Sort by relevance score (desc), then year (desc)
  validCandidates.sort((a, b) => {
    if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score;
    return (b.year || 0) - (a.year || 0);
  });

  // Truncate to budget
  result.questions = validCandidates.slice(0, budget);
  
  for (const q of result.questions) {
    if (q.retrieval_level === 'EXACT_NODE') result.retrieval_meta.exact_count++;
    else if (q.retrieval_level === 'PARENT_NODE') result.retrieval_meta.parent_count++;
    else if (q.retrieval_level === 'ANCESTOR_NODE') result.retrieval_meta.ancestor_count++;
    
    if (q.normalization_type === 'LEGACY_ALIAS') result.retrieval_meta.normalized_legacy_count++;
  }

  result.retrieval_meta.final_count = result.questions.length;
  return result;
}
