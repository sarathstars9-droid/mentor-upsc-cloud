// backend/services/mainsKnowledgeBuilderService.js
// V1.5B Knowledge Builder: On-demand generation of missing knowledge candidates.

import { generateAIContent } from './aiAdapterService.js';
import * as knowledgeService from './mainsKnowledgeService.js';

const VALID_TYPES = ['SUBJECT_LANGUAGE', 'DIMENSION', 'EVIDENCE', 'VALUE_ADDITION', 'GEOGRAPHY_OPTIONAL'];

function getPromptForCategory(category, questionIntelligence, queryText, existingContext) {
  const { paper, subject, topic, micro_topic, syllabus_node_id } = questionIntelligence || {};
  const baseContext = `
You are an expert UPSC Mains content curator.
Your task is to generate a highly specific, accurate candidate for the MentorOS Mains Knowledge Bank.

Context:
Paper: ${paper || 'Unknown'}
Subject: ${subject || 'Unknown'}
Topic: ${topic || 'Unknown'}
Micro Topic: ${micro_topic || 'Unknown'}
Syllabus Node ID: ${syllabus_node_id || 'Unknown'}
Triggering Query: ${queryText || 'Unknown'}
`;

  let specificInstructions = '';
  switch (category) {
    case 'SUBJECT_LANGUAGE':
      specificInstructions = `
Category: SUBJECT_LANGUAGE
Generate concise, UPSC-ready disciplinary terminology for this exact syllabus node.
Return a structured JSON object representing the candidate:
{
  "title": "The exact disciplinary term (e.g., 'Cooperative Federalism')",
  "content": "A highly precise 1-2 sentence definition/explanation ready for use in answers.",
  "knowledge_subtype": "TERM",
  "structured_content": {
    "meaning": "Meaning or use",
    "example_sentence": "Example sentence using the term in a Mains context",
    "avoid": "Common misuse to avoid (optional)"
  },
  "tags": ["tag1", "tag2"],
  "confidence_level": "high|medium|low",
  "confidence_reasoning": "Brief reason for this choice"
}`;
      break;

    case 'DIMENSION':
      specificInstructions = `
Category: DIMENSION
Generate a meaningful analytical dimension, not just a generic heading.
Return a structured JSON object:
{
  "title": "The specific dimension (e.g., 'Fiscal Asymmetry' rather than just 'Fiscal')",
  "content": "Why this dimension is critically relevant to this topic.",
  "knowledge_subtype": "ANALYTICAL",
  "structured_content": {
    "relevance": "Why relevant",
    "how_to_use": "How a candidate can use it in their answer"
  },
  "tags": ["tag1", "tag2"],
  "confidence_level": "high|medium|low",
  "confidence_reasoning": "Brief reason"
}`;
      break;

    case 'EVIDENCE':
      specificInstructions = `
Category: EVIDENCE
Generate a specific evidence NEED or concrete candidate (like a statistic, report, judgment, case study).
IMPORTANT: Do NOT fabricate sources or numbers. If you propose evidence but do not have the exact verifiable source, you MUST indicate that a source is required.
Return a structured JSON object:
{
  "title": "Short title of the evidence (e.g., '15th FC Devolution Rate' or 'SC Judgment on Federalism')",
  "content": "The claim or data point.",
  "knowledge_subtype": "STATISTIC",
  "structured_content": {},
  "tags": ["tag1"],
  "source_required": true,
  "suggested_source_type": "The type of source needed (e.g., 'Finance Commission Report', 'Supreme Court Judgment')",
  "confidence_level": "high|medium|low",
  "confidence_reasoning": "Brief reason"
}`;
      break;

    case 'VALUE_ADDITION':
      specificInstructions = `
Category: VALUE_ADDITION
Generate a useful value addition (like an institutional flow, interlinkage, or framework). 
Reuse existing visual schema vocabulary where appropriate.
Return a structured JSON object:
{
  "title": "Title of the value addition (e.g., 'Finance Commission Mechanism Flow')",
  "content": "Detailed explanation of the value addition.",
  "knowledge_subtype": "INSTITUTIONAL",
  "structured_content": {
    "placement": "Intro, Body, or Conclusion",
    "why_useful": "Why it elevates the answer",
    "visual_schema": "If applicable, describe the diagram (e.g. 'Hub-and-spoke', 'Flowchart', 'Table')",
    "draw_time_seconds": 30
  },
  "tags": ["tag1"],
  "confidence_level": "high|medium|low",
  "confidence_reasoning": "Brief reason"
}`;
      break;

    case 'GEOGRAPHY_OPTIONAL':
      specificInstructions = `
Category: GEOGRAPHY_OPTIONAL
Generate disciplinary geographical material (concept, theory, thinker, model).
This must be specific to Geography Optional and NOT generic GS geography.
Return a structured JSON object:
{
  "title": "Title (e.g., 'Penck\\'s Slope Replacement Theory')",
  "content": "Disciplinary explanation of the concept.",
  "knowledge_subtype": "THEORY",
  "structured_content": {
    "application": "How to apply in an answer",
    "criticism": "Key criticisms (e.g. Davisian view)",
    "diagram_possibility": "Potential for a diagram/map",
    "example": "India/world example if relevant"
  },
  "tags": ["tag1"],
  "confidence_level": "high|medium|low",
  "confidence_reasoning": "Brief reason"
}`;
      break;
  }

  return baseContext + '\n' + specificInstructions + '\n\nOutput ONLY valid JSON without markdown wrapping or backticks. Do not add any text outside the JSON.';
}

export async function buildKnowledgeCandidate({
  userId,
  questionIntelligence = {},
  knowledgeType,
  knowledgeSubtype,
  queryText,
  existingContext,
  requestedBy = 'system'
}) {
  if (!VALID_TYPES.includes(knowledgeType)) {
    throw new Error(`Invalid knowledgeType: ${knowledgeType}`);
  }

  const prompt = getPromptForCategory(knowledgeType, questionIntelligence, queryText, existingContext);

  let generatedData;
  const provider = process.env.MAINS_KNOWLEDGE_BUILDER_PROVIDER || process.env.MENTOR_AI_PROVIDER || 'gemini';
  const apiKey = process.env.MAINS_KNOWLEDGE_BUILDER_API_KEY || process.env.MENTOR_AI_API_KEY || process.env.GEMINI_API_KEY || 'mocked';
  const model = process.env.MAINS_KNOWLEDGE_BUILDER_MODEL || process.env.MENTOR_AI_MODEL || 'gemini-1.5-pro';

  try {
    generatedData = await generateAIContent({
      provider,
      apiKey,
      model,
      systemPrompt: prompt,
      userMessage: '' // Prompt encapsulates everything
    });
  } catch (error) {
    console.error('[mainsKnowledgeBuilder] AI Provider failure:', error);
    throw new Error('AI_PROVIDER_FAILURE');
  }

  // Validate basic schema
  if (!generatedData || !generatedData.title || !generatedData.content) {
    throw new Error('MALFORMED_AI_OUTPUT');
  }

  // Value Addition Visual Schema
  if (knowledgeType === 'VALUE_ADDITION') {
    const validSchemas = ['PROCESS_FLOW', 'BRANCHING_FLOW', 'CYCLE', 'STAKEHOLDER_WHEEL', 'COMPARISON_TABLE', 'SIMPLE_GRAPH', 'MAP_REQUIRED'];
    if (generatedData.structured_content && generatedData.structured_content.visual_schema) {
      if (!validSchemas.includes(generatedData.structured_content.visual_schema)) {
        generatedData.structured_content.visual_schema = null;
      }
    }
  }

  // Duplicate Check
  const duplicate = await knowledgeService.checkDuplicateKnowledgeItem(
    questionIntelligence.syllabus_node_id,
    knowledgeType,
    generatedData.knowledge_subtype || knowledgeSubtype,
    generatedData.title
  );

  if (duplicate) {
    return {
      status: 'DUPLICATE',
      message: 'A similar candidate already exists.',
      existing_id: duplicate.id,
      candidate: null
    };
  }

  // Trust Classification & Default States
  let verificationStatus = 'UNVERIFIED';
  let lifecycleStatus = 'PENDING_REVIEW';
  let is_active = false;
  let sourceRequired = false;
  let sourceReference = null;
  let suggestedSourceType = null;

  if (knowledgeType === 'EVIDENCE') {
    verificationStatus = 'SOURCE_REQUIRED';
    sourceRequired = true;
    suggestedSourceType = generatedData.suggested_source_type || 'Unknown';
    // Evidence is never directly active
  }

  // Build the DB candidate object
  const candidatePayload = {
    paper: questionIntelligence.paper || 'Unknown',
    subject: questionIntelligence.subject || 'Unknown',
    topic: questionIntelligence.topic || 'Unknown',
    micro_topic: questionIntelligence.micro_topic || null,
    syllabus_node_id: questionIntelligence.syllabus_node_id || null,
    knowledge_type: knowledgeType,
    knowledge_subtype: generatedData.knowledge_subtype || knowledgeSubtype || null,
    title: generatedData.title,
    content: generatedData.content,
    structured_content: generatedData.structured_content || {},
    tags: Array.isArray(generatedData.tags) ? generatedData.tags : [],
    
    source_type: sourceRequired ? 'AI_GENERATED_SOURCE_REQUIRED' : 'AI_GENERATED',
    source_reference: sourceReference,
    source_title: suggestedSourceType,
    
    verification_status: verificationStatus,
    lifecycle_status: lifecycleStatus,
    is_active: is_active,
    
    generated_by_model: `${provider}/${model}`,
    prompt_version: 'mains-knowledge-builder-v1'
  };

  try {
    const savedItem = await knowledgeService.createKnowledgeItem(candidatePayload);
    
    // Return structured candidate output
    return {
      status: 'CREATED',
      candidate: {
        id: savedItem.id,
        schema_version: 'mains-knowledge-candidate-v1',
        taxonomy: {
          paper: savedItem.paper,
          subject: savedItem.subject,
          topic: savedItem.topic,
          micro_topic: savedItem.micro_topic,
          syllabus_node_id: savedItem.syllabus_node_id
        },
        knowledge_type: savedItem.knowledge_type,
        knowledge_subtype: savedItem.knowledge_subtype,
        title: savedItem.title,
        content: savedItem.content,
        structured_content: savedItem.structured_content,
        tags: savedItem.tags,
        source: {
          source_required: sourceRequired,
          suggested_source_type: suggestedSourceType,
          source_reference: savedItem.source_reference,
          source_title: savedItem.source_title,
          source_year: savedItem.source_year
        },
        confidence: {
          level: generatedData.confidence_level || 'low',
          reasoning: generatedData.confidence_reasoning || ''
        },
        trust_recommendation: {
          verification_status: savedItem.verification_status,
          lifecycle_status: savedItem.lifecycle_status
        },
        generation_meta: {
          provider: provider,
          model: model,
          prompt_version: savedItem.prompt_version
        }
      }
    };
  } catch (err) {
    console.error('[mainsKnowledgeBuilder] Failed to save candidate:', err);
    throw err;
  }
}
