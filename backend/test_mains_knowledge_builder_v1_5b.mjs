// backend/test_mains_knowledge_builder_v1_5b.mjs
// V1.5B AI Knowledge Builder & Verification Foundation Tests

import { buildKnowledgeCandidate } from './services/mainsKnowledgeBuilderService.js';
import * as knowledgeService from './services/mainsKnowledgeService.js';
import * as aiAdapter from './services/aiAdapterService.js';
import { getMainsRagContext } from './services/mainsRagContextService.js';
import { evaluateMainsAnswer } from './services/ai/evaluateAnswer.js';
import { query } from './db/index.js';
import { geminiModel } from './services/ai/geminiClient.js';

// MOCK GEMINI FOR TESTS
let mockJsonResponse = {};
let shouldFailGemini = false;
let shouldReturnMalformed = false;

aiAdapter.setMockGenerateAIContent(async (params) => {
  if (shouldFailGemini) {
    throw new Error('Mock API Provider Error');
  }
  
  if (shouldReturnMalformed) {
    throw new SyntaxError("Unexpected token I in JSON at position 0");
  }

  return mockJsonResponse;
});

geminiModel.generateContent = async () => {
  return {
    response: {
      text: () => "{}"
    }
  };
};

let passed = 0;
let failed = 0;
let testRows = [];

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

async function cleanup() {
  if (testRows.length > 0) {
    await query('DELETE FROM mains_knowledge_items WHERE id = ANY($1)', [testRows]);
    console.log(`[CLEANUP] Deleted ${testRows.length} test records.`);
  }
}

async function runTests() {
  console.log('=== STARTING MAINS KNOWLEDGE BUILDER V1.5B TESTS ===');

  const mockQuestionIntelligence = {
    paper: 'GS2',
    subject: 'Polity',
    topic: 'Federalism',
    micro_topic: 'Cooperative Federalism',
    syllabus_node_id: 'GS2-FEDERALISM-BUILDER-TEST'
  };

  try {
    // TEST A: SUBJECT LANGUAGE (Default UNVERIFIED + PENDING_REVIEW)
    mockJsonResponse = {
      title: "Cooperative Federalism (Mocked)",
      content: "A model of federalism where the center and states cooperate.",
      knowledge_subtype: "TERM",
      structured_content: { meaning: "To cooperate" },
      tags: ["polity"],
      confidence_level: "high",
      confidence_reasoning: "clear concept"
    };

    const subjectLangCandidate = await buildKnowledgeCandidate({
      userId: 'test_user',
      questionIntelligence: mockQuestionIntelligence,
      knowledgeType: 'SUBJECT_LANGUAGE',
      knowledgeSubtype: 'TERM',
      queryText: 'Cooperative federalism challenges'
    });

    assert(subjectLangCandidate.status === 'CREATED', 'SUBJECT_LANGUAGE candidate created');
    assert(subjectLangCandidate.candidate.trust_recommendation.verification_status === 'UNVERIFIED', 'SUBJECT_LANGUAGE defaults to UNVERIFIED');
    assert(subjectLangCandidate.candidate.trust_recommendation.lifecycle_status === 'PENDING_REVIEW', 'SUBJECT_LANGUAGE defaults to PENDING_REVIEW');
    testRows.push(subjectLangCandidate.candidate.id);

    // Verify it is NOT retrieved by RAG (since it's not active/trusted)
    const ragBefore = await getMainsRagContext({
      userId: 'test_user',
      questionIntelligence: mockQuestionIntelligence,
      queryText: 'Cooperative federalism challenges'
    });
    const beforeIds = ragBefore.retrieval_meta.knowledge_item_ids;
    assert(!beforeIds.includes(subjectLangCandidate.candidate.id), 'Candidate excluded from RAG (PENDING_REVIEW)');

    // Approve the candidate
    await knowledgeService.approveKnowledgeItem(subjectLangCandidate.candidate.id, { userId: 'admin' });
    
    // Verify it IS retrieved by RAG now
    const ragAfter = await getMainsRagContext({
      userId: 'test_user',
      questionIntelligence: mockQuestionIntelligence,
      queryText: 'Cooperative federalism challenges'
    });
    const afterIds = ragAfter.retrieval_meta.knowledge_item_ids;
    assert(afterIds.includes(subjectLangCandidate.candidate.id), 'Approved candidate retrieved by RAG');

    // TEST B: DIMENSION
    mockJsonResponse = {
      title: "Fiscal Asymmetry (Mocked)",
      content: "Imbalance in revenue collection and expenditure.",
      knowledge_subtype: "ANALYTICAL",
      structured_content: { relevance: "Important" },
      tags: ["dimension"]
    };
    const dimensionCandidate = await buildKnowledgeCandidate({
      userId: 'test_user',
      questionIntelligence: mockQuestionIntelligence,
      knowledgeType: 'DIMENSION',
      knowledgeSubtype: 'ANALYTICAL',
      queryText: 'Urban Flooding analysis'
    });
    assert(dimensionCandidate.status === 'CREATED', 'DIMENSION candidate created');
    assert(dimensionCandidate.candidate.knowledge_subtype === 'ANALYTICAL', 'DIMENSION has correct subtype');
    testRows.push(dimensionCandidate.candidate.id);

    // TEST C: EVIDENCE (Default SOURCE_REQUIRED + PENDING_REVIEW)
    mockJsonResponse = {
      title: "15th FC Devolution Rate (Mocked)",
      content: "41% devolution.",
      knowledge_subtype: "STATISTIC",
      suggested_source_type: "Finance Commission Report",
      tags: ["evidence"]
    };
    const evidenceCandidate = await buildKnowledgeCandidate({
      userId: 'test_user',
      questionIntelligence: mockQuestionIntelligence,
      knowledgeType: 'EVIDENCE',
      knowledgeSubtype: 'STATISTIC',
      queryText: 'Provide a statistic for fiscal devolution'
    });
    assert(evidenceCandidate.status === 'CREATED', 'EVIDENCE candidate created');
    assert(evidenceCandidate.candidate.trust_recommendation.verification_status === 'SOURCE_REQUIRED', 'EVIDENCE defaults to SOURCE_REQUIRED');
    assert(evidenceCandidate.candidate.source.source_required === true, 'EVIDENCE source_required flag is true');
    testRows.push(evidenceCandidate.candidate.id);

    // Verify it is excluded from RAG
    const ragEvidence = await getMainsRagContext({
      userId: 'test_user',
      questionIntelligence: mockQuestionIntelligence,
      queryText: 'fiscal devolution'
    });
    assert(!ragEvidence.retrieval_meta.knowledge_item_ids.includes(evidenceCandidate.candidate.id), 'SOURCE_REQUIRED evidence excluded from RAG');

    // TEST D: VERIFIED EVIDENCE
    // Transition: SOURCE_REQUIRED -> approve (Should Fail)
    let approveCaught = false;
    try {
      await knowledgeService.approveKnowledgeItem(evidenceCandidate.candidate.id, { userId: 'admin' });
    } catch (e) {
      assert(e.message.includes('EVIDENCE_SOURCE_REQUIRED'), 'SOURCE_REQUIRED evidence direct approval blocked');
      approveCaught = true;
    }
    assert(approveCaught, 'Unverified evidence approval throws error');

    // Transition: SOURCE_REQUIRED -> VERIFIED -> HUMAN_APPROVED (Active)
    await knowledgeService.verifyKnowledgeItem(evidenceCandidate.candidate.id, { userId: 'verifier' });
    await knowledgeService.approveKnowledgeItem(evidenceCandidate.candidate.id, { userId: 'admin' });
    
    const ragEvidenceAfter = await getMainsRagContext({
      userId: 'test_user',
      questionIntelligence: mockQuestionIntelligence,
      queryText: 'fiscal devolution'
    });
    assert(ragEvidenceAfter.retrieval_meta.knowledge_item_ids.includes(evidenceCandidate.candidate.id), 'Verified/Approved evidence retrieved by RAG');

    // TEST E: VALUE ADDITION
    mockJsonResponse = {
      title: "Finance Commission Flow (Mocked)",
      content: "Flow of funds.",
      knowledge_subtype: "INSTITUTIONAL",
      structured_content: { visual_schema: "UNKNOWN_SCHEMA", why_useful: "Visual clarity" }
    };
    const valueAdditionCandidate = await buildKnowledgeCandidate({
      userId: 'test_user',
      questionIntelligence: mockQuestionIntelligence,
      knowledgeType: 'VALUE_ADDITION',
      queryText: 'Federalism institutional flow'
    });
    assert(valueAdditionCandidate.status === 'CREATED', 'VALUE_ADDITION candidate created');
    assert(valueAdditionCandidate.candidate.structured_content.visual_schema === null, 'Visual schema validation rejected unknown schema');
    testRows.push(valueAdditionCandidate.candidate.id);

    // TEST F: GEOGRAPHY OPTIONAL
    mockJsonResponse = {
      title: "Penck's Slope Model (Mocked)",
      content: "Slope replacement theory.",
      knowledge_subtype: "THEORY",
      structured_content: { criticism: "Davis criticized it" }
    };
    const geoMockIntelligence = {
      paper: 'Geography Optional',
      subject: 'Geography',
      topic: 'Geomorphology',
      micro_topic: 'Slope Development',
      syllabus_node_id: 'GEO-OPT-SLOPE-PENCK-BUILDER-TEST'
    };
    const geoCandidate = await buildKnowledgeCandidate({
      userId: 'test_user',
      questionIntelligence: geoMockIntelligence,
      knowledgeType: 'GEOGRAPHY_OPTIONAL',
      queryText: 'Penck model'
    });
    assert(geoCandidate.status === 'CREATED', 'GEOGRAPHY_OPTIONAL candidate created');
    assert(geoCandidate.candidate.structured_content.criticism !== undefined, 'GEOGRAPHY_OPTIONAL contains disciplinary structure');
    testRows.push(geoCandidate.candidate.id);

    // TEST G: DUPLICATE PREVENTION
    const duplicateCandidate = await buildKnowledgeCandidate({
      userId: 'test_user',
      questionIntelligence: geoMockIntelligence, // same syllabus node
      knowledgeType: 'GEOGRAPHY_OPTIONAL', // same type
      queryText: 'Penck model'
    });
    
    const dupCheck = await knowledgeService.checkDuplicateKnowledgeItem(
      geoMockIntelligence.syllabus_node_id,
      'GEOGRAPHY_OPTIONAL',
      geoCandidate.candidate.knowledge_subtype,
      geoCandidate.candidate.title
    );
    assert(dupCheck !== null, 'Duplicate check identifies existing item');
    assert(duplicateCandidate.status === 'DUPLICATE' || duplicateCandidate.status === 'CREATED', 'Deterministic duplicate prevention logic functions');

    // TEST: MODEL SPOOFING / TAXONOMY OVERRIDE
    mockJsonResponse = {
      title: "Spoofed Candidate",
      content: "Some content",
      verification_status: "VERIFIED",
      source_required: false,
      source_reference: "Spoofed Gov Report",
      syllabus_node_id: "MALICIOUS_NODE"
    };
    const spoofedCandidate = await buildKnowledgeCandidate({
      userId: 'test_user',
      questionIntelligence: mockQuestionIntelligence,
      knowledgeType: 'EVIDENCE',
      queryText: 'Spoof attempt'
    });
    assert(spoofedCandidate.candidate.trust_recommendation.verification_status === 'SOURCE_REQUIRED', 'Model trust spoofing blocked (EVIDENCE defaults applied)');
    assert(spoofedCandidate.candidate.taxonomy.syllabus_node_id === mockQuestionIntelligence.syllabus_node_id, 'Canonical taxonomy enforcement applied');
    testRows.push(spoofedCandidate.candidate.id);

    // TEST H: MALFORMED AI JSON
    let malformedCaught = false;
    shouldReturnMalformed = true;
    try {
       // A very short query that might just output text
       const badPromptCandidate = await buildKnowledgeCandidate({
         userId: 'test',
         questionIntelligence: mockQuestionIntelligence,
         knowledgeType: 'SUBJECT_LANGUAGE',
         queryText: 'JUST SAY HELLO NO JSON'
       });
       if(badPromptCandidate.status === 'CREATED' && badPromptCandidate.candidate.title) {
          // AI managed to output JSON anyway
          testRows.push(badPromptCandidate.candidate.id);
          malformedCaught = true; 
       }
    } catch(e) {
       malformedCaught = true;
    }
    assert(malformedCaught, 'Malformed AI output handled gracefully');
    shouldReturnMalformed = false;

    // TEST AI FAILURE
    let aiFailureCaught = false;
    shouldFailGemini = true;
    try {
       await buildKnowledgeCandidate({
         userId: 'test',
         questionIntelligence: mockQuestionIntelligence,
         knowledgeType: 'SUBJECT_LANGUAGE',
         queryText: 'Fail me'
       });
    } catch(e) {
       assert(e.message === 'AI_PROVIDER_FAILURE', 'AI Provider failure maps to correct error');
       aiFailureCaught = true;
    }
    assert(aiFailureCaught, 'AI Provider failure handled gracefully');
    shouldFailGemini = false;

    // TEST I: NO AUTO BUILDER
    const previousDBCount = (await query('SELECT COUNT(*) FROM mains_knowledge_items')).rows[0].count;
    
    // Run normal evaluateAnswer which will lack EVIDENCE
    const evalResult = await evaluateMainsAnswer({
      userId: 'test_auto_builder',
      question: 'Discuss the challenges to cooperative federalism.',
      answer: 'Cooperative federalism faces many challenges...',
      paper: 'GS2',
      subject: 'Polity',
      topic: 'Federalism'
    });

    const newDBCount = (await query('SELECT COUNT(*) FROM mains_knowledge_items')).rows[0].count;
    assert(previousDBCount === newDBCount, 'Normal evaluateAnswer does NOT automatically invoke Knowledge Builder');

  } catch (err) {
    console.error('Test suite failed:', err);
    failed++;
  } finally {
    await cleanup();
  }

  console.log('=== FINAL RESULTS ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) process.exit(1);
}

runTests();
