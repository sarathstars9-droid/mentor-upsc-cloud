/**
 * backend/services/visualGeneration/visualPromptBuilder.js
 *
 * Prompt Engineer for Structured UPSC & APPSC Visual Knowledge Generation (Phase 2D).
 * Enforces visual grammar semantics, zero-hallucination, strict JSON-only outputs, and verified evidence constraints.
 */

export function buildVisualGenerationPrompt({
  topic,
  visualType,
  examContext = 'both',
  region = null,
  verifiedEvidence = []
}) {
  const safeEvidence = verifiedEvidence.filter(e => 
    e.verification_status === 'verified_current' || e.verification_status === 'verified_historical'
  );

  const evidenceText = safeEvidence.length > 0 
    ? safeEvidence.map(e => `- [${e.is_official ? 'OFFICIAL' : 'VERIFIED'}] ${e.title}: ${e.value_text} (${e.source_name || ''}, ${e.data_period || ''})`).join('\n')
    : 'No quantitative statistics currently verified. You MUST use STATIC conceptual knowledge and NOT invent numbers or percentages.';

  const grammar = visualType.toLowerCase();

  let schemaInstructions = '';
  if (grammar === 'hub_spoke' || grammar === 'mindmap') {
    schemaInstructions = `
You are generating a HUB & SPOKE (Mind Map) visual diagram.
JSON Schema:
{
  "recommendedGrammar": "hub_spoke",
  "visualGrammar": "hub_spoke",
  "title": "Title of diagram",
  "center": "Central Topic Name",
  "spokes": [
    { "label": "Dimension 1", "sublabel": "2-3 word detail" },
    { "label": "Dimension 2", "sublabel": "2-3 word detail" },
    { "label": "Dimension 3", "sublabel": "2-3 word detail" },
    { "label": "Dimension 4", "sublabel": "2-3 word detail" },
    { "label": "Dimension 5", "sublabel": "2-3 word detail" }
  ],
  "targetDrawSeconds": 25
}
`;
  } else if (grammar === 'cause_effect') {
    schemaInstructions = `
You are generating a CAUSE & EFFECT tripartite diagnostic visual diagram.
JSON Schema:
{
  "recommendedGrammar": "cause_effect",
  "visualGrammar": "cause_effect",
  "title": "Title of diagnostic diagram",
  "issue": "CENTRAL CRISIS / ISSUE",
  "causes": ["Root Cause 1", "Root Cause 2", "Root Cause 3"],
  "effects": ["Consequence 1", "Consequence 2", "Consequence 3"],
  "responses": ["Key Policy / Technical Solution"],
  "targetDrawSeconds": 35
}
`;
  } else if (grammar === 'cycle') {
    schemaInstructions = `
You are generating a CLOSED LOOP CYCLE diagram.
JSON Schema:
{
  "recommendedGrammar": "cycle",
  "visualGrammar": "cycle",
  "title": "Title of cycle",
  "centerLabel": "Cycle Core",
  "stages": ["1. Stage Name", "2. Stage Name", "3. Stage Name", "4. Stage Name"],
  "targetDrawSeconds": 30
}
`;
  } else if (grammar === 'timeline') {
    schemaInstructions = `
You are generating a CHRONOLOGICAL TIMELINE diagram.
JSON Schema:
{
  "recommendedGrammar": "timeline",
  "visualGrammar": "timeline",
  "title": "Title of timeline",
  "events": [
    { "year": "Year/Date", "title": "Milestone Name", "desc": "Concise significance" }
  ],
  "targetDrawSeconds": 30
}
`;
  } else if (grammar === 'stakeholder_map') {
    schemaInstructions = `
You are generating a STAKEHOLDER & ACTOR MATRIX diagram.
JSON Schema:
{
  "recommendedGrammar": "stakeholder_map",
  "visualGrammar": "stakeholder_map",
  "title": "Title of stakeholder map",
  "centralIssue": "Central Decision / Governance Point",
  "stakeholders": [
    { "name": "Actor / Entity", "role": "Mandate / Responsibility" }
  ],
  "targetDrawSeconds": 35
}
`;
  } else if (grammar === 'institutional_web') {
    schemaInstructions = `
You are generating an INSTITUTIONAL GOVERNANCE WEB diagram.
JSON Schema:
{
  "recommendedGrammar": "institutional_web",
  "visualGrammar": "institutional_web",
  "title": "Title of governance web",
  "topTier": "Top Sovereign / Union Authority",
  "councils": [
    { "name": "Council/Commission Name", "art": "Constitutional Article & Role" }
  ],
  "bottomTier": "State / Regional Level",
  "subTier": "Grassroots / Local Bodies",
  "targetDrawSeconds": 40
}
`;
  } else if (grammar === 'decision_tree') {
    schemaInstructions = `
You are generating an ETHICAL DECISION TREE diagram.
JSON Schema:
{
  "recommendedGrammar": "decision_tree",
  "visualGrammar": "decision_tree",
  "title": "Title of decision tree",
  "root": "Core Dilemma / Decision Question",
  "branches": [
    {
      "option": "Option 1: Action Pathway",
      "consequence": "Direct consequence of action",
      "verdict": "Ethical / Legal Evaluation",
      "verdictType": "positive" // "positive" | "negative" | "warning"
    }
  ],
  "targetDrawSeconds": 35
}
`;
  } else if (grammar === 'fishbone') {
    schemaInstructions = `
You are generating an ISHIKAWA FISHBONE DIAGRAM.
JSON Schema:
{
  "recommendedGrammar": "fishbone",
  "visualGrammar": "fishbone",
  "title": "Title of fishbone analysis",
  "problem": "CORE BOTTLENECK / PROBLEM",
  "categories": [
    { "name": "Category 1", "causes": ["Sub-cause A", "Sub-cause B"] }
  ],
  "targetDrawSeconds": 35
}
`;
  } else if (grammar === 'matrix' || grammar === 'comparison') {
    schemaInstructions = `
You are generating a COMPARATIVE MATRIX diagram.
JSON Schema:
{
  "recommendedGrammar": "matrix",
  "visualGrammar": "matrix",
  "title": "Title of comparison",
  "columns": ["Dimension", "Model A", "Model B"],
  "rows": [
    { "label": "Parameter 1", "col1": "Detail A", "col2": "Detail B" }
  ],
  "targetDrawSeconds": 40
}
`;
  } else {
    schemaInstructions = `
You are generating a SEQUENTIAL FLOWCHART diagram.
JSON Schema:
{
  "recommendedGrammar": "flowchart",
  "visualGrammar": "flowchart",
  "title": "Title of process",
  "nodes": ["1. Step One", "2. Step Two", "3. Step Three", "4. Step Four"],
  "targetDrawSeconds": 30
}
`;
  }

  const systemPrompt = `You are the MentorOS Visual Knowledge Engine for UPSC Civil Services and APPSC Examinations.
Your mission is to produce exam-ready visual diagram structures in strict JSON format.

CRITICAL CONSTRAINTS:
1. Output ONLY valid, parsable JSON. No markdown backticks, no explanations outside the JSON.
2. Do NOT invent statistics, rankings, or dates. Use ONLY the verified evidence provided below.
3. Keep all node labels concise, high-density, and directly usable in exam answer scripts.
4. Language: Clear, professional exam-standard English.

TOPIC DETAILS:
- Title: ${topic.title || topic.canonical_name}
- Subject Domain: ${topic.subject || 'General Studies'}
- Exam Context: ${examContext.toUpperCase()}
- Region: ${region || topic.region || 'India'}
- Summary: ${topic.summary || 'Exam syllabus node'}
- Key Dimensions: ${JSON.stringify(topic.dimensions || [])}

VERIFIED EVIDENCE BASE:
${evidenceText}

SCHEMA INSTRUCTIONS:
${schemaInstructions}
`;

  const userMessage = `Generate the structured JSON diagram for topic "${topic.title || topic.canonical_name}" with visual grammar "${visualType}". Ensure zero hallucination and strict compliance with the requested schema.`;

  return { systemPrompt, userMessage };
}
