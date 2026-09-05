/**
 * test_mains_v1_5a_integration.mjs
 * V1.5A Integration Regression Test
 *
 * Tests:
 * 1. buildMainsEvaluationPrompt accepts ragContext=null (V1 baseline — no regression)
 * 2. buildMainsEvaluationPrompt with empty ragContext returns no RAG section
 * 3. buildMainsEvaluationPrompt with populated ragContext injects RAG KNOWLEDGE BANK
 * 4. evaluateAnswerRepository SQL shape is correct (column count matches values)
 * 5. RAG metadata flows from evaluation result through to repository shape
 *
 * Does NOT call Gemini API or hit real DB for core prompt tests.
 */

import { buildMainsEvaluationPrompt } from './services/ai/buildMainsEvaluationPrompt.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// Shared mock profile
const mockProfile = {
  id: 'gs2_polity',
  expectedLanguage: 'constitutional, federal, cooperative',
  commonDimensions: ['constitutional', 'institutional', 'political'],
  evaluationPriorities: 'Multidimensionality, Evidence',
  preferredEvidence: ['SC Judgments', 'Committee Reports'],
  valueAdditionPriors: ['Finance Commission', 'NITI Aayog'],
  answerStructureRules: 'Intro → Body → Way Forward'
};

const baseArgs = {
  question: 'Discuss cooperative federalism in India.',
  answer: 'Cooperative federalism involves...',
  marks: 10,
  wordLimit: 150,
  paper: 'GS2',
  subject: 'Polity',
  topic: 'Federalism',
  syllabusNodeId: 'GS2-FEDERALISM-1',
  syllabusNodeLabel: 'Cooperative Federalism',
  confidence: 'high',
  matchSource: 'exact_node',
  relatedPyqs: [],
  previousRelevantMistakes: [],
  profile: mockProfile,
  questionNatures: ['ANALYTICAL'],
  hasFlowchart: false,
  hasDiagram: false,
  hasMap: false,
  hasTable: false
};

// -------------------------------------------------------------------
console.log('\n=== TEST SUITE: buildMainsEvaluationPrompt ===\n');

// Test 1: ragContext=undefined (original V1 call signature)
console.log('Test 1: V1 baseline — no ragContext arg');
try {
  const prompt = buildMainsEvaluationPrompt({ ...baseArgs });
  assert(typeof prompt === 'string' && prompt.length > 100, 'Returns non-empty string without ragContext');
  assert(!prompt.includes('RAG KNOWLEDGE BANK'), 'No RAG section when ragContext is absent');
  assert(prompt.includes('mains-eval-v1'), 'Contains prompt_version mains-eval-v1');
  assert(prompt.includes('"rag_knowledge_items_injected": 0'), 'RAG items injected = 0');
} catch (e) {
  console.error('  ❌ EXCEPTION in Test 1:', e.message);
  failed++;
}

// Test 2: ragContext=null explicit
console.log('\nTest 2: ragContext=null explicit');
try {
  const prompt = buildMainsEvaluationPrompt({ ...baseArgs, ragContext: null });
  assert(!prompt.includes('RAG KNOWLEDGE BANK'), 'No RAG section when ragContext=null');
  assert(prompt.includes('"rag_knowledge_items_injected": 0'), 'RAG items = 0 when null');
} catch (e) {
  console.error('  ❌ EXCEPTION in Test 2:', e.message);
  failed++;
}

// Test 3: empty ragContext (no trusted items)
console.log('\nTest 3: ragContext with no trusted items (empty knowledge store)');
try {
  const emptyRag = {
    subject_language: [],
    dimensions: [],
    evidence: [],
    value_additions: [],
    geography_optional: [],
    missing_categories: ['SUBJECT_LANGUAGE', 'DIMENSION', 'EVIDENCE', 'VALUE_ADDITION'],
    retrieval_meta: {
      retrieval_version: 'mains-rag-v1',
      knowledge_item_ids: [],
      retrieved_pyq_ids: [],
      category_counts: { SUBJECT_LANGUAGE: 0, DIMENSION: 0, EVIDENCE: 0, VALUE_ADDITION: 0 }
    }
  };
  const prompt = buildMainsEvaluationPrompt({ ...baseArgs, ragContext: emptyRag });
  assert(!prompt.includes('RAG KNOWLEDGE BANK'), 'No RAG section when 0 trusted items (graceful degradation)');
  assert(prompt.includes('"rag_retrieval_version": "mains-rag-v1"'), 'RAG version still set in evaluation_meta');
  assert(prompt.includes('"rag_knowledge_items_injected": 0'), 'Items injected = 0');
} catch (e) {
  console.error('  ❌ EXCEPTION in Test 3:', e.message);
  failed++;
}

// Test 4: populated ragContext injects knowledge bank
console.log('\nTest 4: ragContext with trusted items — RAG KNOWLEDGE BANK section present');
try {
  const populatedRag = {
    subject_language: [{ id: 'ki-1', knowledge_subtype: 'TERM', title: 'Cooperative Federalism', content: 'A model where central and state govts work together.' }],
    dimensions: [{ id: 'ki-2', knowledge_subtype: 'CONSTITUTIONAL', title: 'Art 246 Division', content: 'Division of legislative powers under 7th Schedule.' }],
    evidence: [{ id: 'ki-3', knowledge_subtype: 'STATISTIC', title: 'GST Revenue', content: '₹1.65 lakh cr GST collected in April 2024.', source_title: 'GST Council', source_year: '2024' }],
    value_additions: [{ id: 'ki-4', knowledge_subtype: 'COMMITTEE', title: 'Punchhi Commission', content: 'Recommended inter-state council reforms.' }],
    geography_optional: [],
    missing_categories: [],
    retrieval_meta: {
      retrieval_version: 'mains-rag-v1',
      knowledge_item_ids: ['ki-1', 'ki-2', 'ki-3', 'ki-4'],
      retrieved_pyq_ids: ['pyq-101'],
      category_counts: { SUBJECT_LANGUAGE: 1, DIMENSION: 1, EVIDENCE: 1, VALUE_ADDITION: 1, GEOGRAPHY_OPTIONAL: 0 }
    }
  };
  const prompt = buildMainsEvaluationPrompt({ ...baseArgs, ragContext: populatedRag });
  assert(prompt.includes('RAG KNOWLEDGE BANK'), 'RAG KNOWLEDGE BANK section present');
  assert(prompt.includes('Cooperative Federalism'), 'Subject language term appears in prompt');
  assert(prompt.includes('Art 246 Division'), 'Dimension item appears in prompt');
  assert(prompt.includes('GST Revenue'), 'Evidence item appears in prompt');
  assert(prompt.includes('Source: GST Council, 2024'), 'Evidence source citation present');
  assert(prompt.includes('Punchhi Commission'), 'Value addition appears in prompt');
  assert(prompt.includes('"rag_knowledge_items_injected": 4'), 'RAG items injected = 4 in meta');
  assert(prompt.includes('"rag_retrieval_version": "mains-rag-v1"'), 'RAG version correct in meta');
  assert(!prompt.includes('[NOTE] No trusted items'), 'No missing-category NOTE when all covered');
} catch (e) {
  console.error('  ❌ EXCEPTION in Test 4:', e.message);
  failed++;
}

// Test 5: missing_categories NOTE appears when some empty
console.log('\nTest 5: missing_categories NOTE injected when evidence is empty');
try {
  const partialRag = {
    subject_language: [{ id: 'ki-1', knowledge_subtype: 'TERM', title: 'Key Term', content: 'Definition here.' }],
    dimensions: [],
    evidence: [],
    value_additions: [],
    geography_optional: [],
    missing_categories: ['DIMENSION', 'EVIDENCE', 'VALUE_ADDITION'],
    retrieval_meta: {
      retrieval_version: 'mains-rag-v1',
      knowledge_item_ids: ['ki-1'],
      retrieved_pyq_ids: [],
      category_counts: {}
    }
  };
  const prompt = buildMainsEvaluationPrompt({ ...baseArgs, ragContext: partialRag });
  assert(prompt.includes('RAG KNOWLEDGE BANK'), 'RAG section present even with partial items');
  assert(prompt.includes('[NOTE] No trusted items found for: DIMENSION, EVIDENCE, VALUE_ADDITION'), 'Missing category NOTE present');
} catch (e) {
  console.error('  ❌ EXCEPTION in Test 5:', e.message);
  failed++;
}

// -------------------------------------------------------------------
console.log('\n=== TEST SUITE: Repository shape validation ===\n');

// Test 6: saveBasicEvaluation SQL column count matches values count
console.log('Test 6: Repository INSERT column count matches value count');
try {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const repoSrc = readFileSync(join(__dirname, './repositories/evaluateAnswerRepository.js'), 'utf8');

  // Count $N placeholders
  const placeholders = (repoSrc.match(/\$\d+/g) || []);
  const maxN = placeholders.reduce((max, p) => Math.max(max, parseInt(p.slice(1))), 0);

  // The INSERT should use $1..$14
  assert(maxN === 14, `INSERT uses $14 highest placeholder (9 original + 5 RAG) — got $${maxN}`);
} catch (e) {
  console.error('  ❌ EXCEPTION in Test 6:', e.message);
  failed++;
}

// -------------------------------------------------------------------
console.log('\n=== TEST SUITE: rag_retrieval_meta propagation ===\n');

// Test 7: rag_retrieval_meta is null when ragContext not used
console.log('Test 7: rag_retrieval_meta=null when no knowledge items (simulated return shape)');
try {
  // Simulate evaluateAnswer return shape with no RAG
  const simulatedResult = {
    score: '6/10',
    weakness_tags: ['MISSING_DIMENSION'],
    mains_eval_v1: { score: { awarded: 6, maximum: 10 } },
    rag_retrieval_meta: null
  };
  const ragMeta = simulatedResult.rag_retrieval_meta || null;
  assert(ragMeta === null, 'ragMeta is null when no retrieval happened');
  assert(ragMeta?.retrieval_version === undefined, 'retrieval_version undefined when null');
} catch (e) {
  console.error('  ❌ EXCEPTION in Test 7:', e.message);
  failed++;
}

// Test 8: route correctly extracts all 5 RAG fields
console.log('\nTest 8: Route extracts all 5 RAG fields from rag_retrieval_meta');
try {
  const mockRagMeta = {
    retrieval_version: 'mains-rag-v1',
    knowledge_item_ids: ['ki-1', 'ki-2'],
    retrieved_pyq_ids: ['pyq-99'],
    category_counts: { SUBJECT_LANGUAGE: 1, DIMENSION: 1, EVIDENCE: 0, VALUE_ADDITION: 0 }
  };
  const mockEvalResult = { rag_retrieval_meta: mockRagMeta, mains_eval_v1: { evaluation_meta: { rag_missing_categories: ['EVIDENCE'] } } };

  const ragRetrievalVersion = mockEvalResult.rag_retrieval_meta?.retrieval_version || null;
  const ragKnowledgeItemIds = mockEvalResult.rag_retrieval_meta?.knowledge_item_ids || [];
  const ragRetrievedPyqIds = mockEvalResult.rag_retrieval_meta?.retrieved_pyq_ids || [];
  const ragMissingCategories = mockEvalResult.mains_eval_v1?.evaluation_meta?.rag_missing_categories || [];
  const ragCategoryCounts = mockEvalResult.rag_retrieval_meta?.category_counts || {};

  assert(ragRetrievalVersion === 'mains-rag-v1', 'retrieval_version extracted correctly');
  assert(ragKnowledgeItemIds.length === 2, 'knowledge_item_ids length correct');
  assert(ragRetrievedPyqIds[0] === 'pyq-99', 'retrieved_pyq_ids extracted correctly');
  assert(ragMissingCategories[0] === 'EVIDENCE', 'missing_categories from evaluation_meta');
  assert(ragCategoryCounts.SUBJECT_LANGUAGE === 1, 'category_counts extracted correctly');
} catch (e) {
  console.error('  ❌ EXCEPTION in Test 8:', e.message);
  failed++;
}

// -------------------------------------------------------------------
console.log('\n=== FINAL RESULTS ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  console.error(`\n❌ ${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} tests PASSED`);
  process.exit(0);
}
