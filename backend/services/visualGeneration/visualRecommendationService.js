/**
 * backend/services/visualGeneration/visualRecommendationService.js
 *
 * Deterministic Visual Recommendation Engine for UPSC & APPSC Knowledge Topics (Phase 2C).
 * Maps subject domains and exam dimensions to high-yield visual structures (3-5 visuals per topic).
 */

export const SUBJECT_VISUAL_MAP = {
  polity: ['exam_sketch', 'institutional_diagram', 'flowchart', 'comparison', 'timeline'],
  constitution: ['exam_sketch', 'institutional_diagram', 'flowchart', 'comparison', 'timeline'],
  governance: ['exam_sketch', 'stakeholder_map', 'institutional_diagram', 'process_diagram', 'dimension_wheel'],
  economy: ['exam_sketch', 'cause_effect', 'process_diagram', 'flowchart', 'chart'],
  banking: ['exam_sketch', 'cause_effect', 'process_diagram', 'flowchart', 'chart'],
  geography: ['exam_sketch', 'process_flow', 'cause_effect', 'concept_diagram', 'mindmap'],
  environment: ['exam_sketch', 'cause_effect', 'process_diagram', 'stakeholder_map', 'mindmap'],
  disaster: ['exam_sketch', 'cause_effect', 'process_flow', 'flowchart', 'stakeholder_map'],
  history: ['exam_sketch', 'timeline', 'comparison', 'hierarchy', 'mindmap'],
  art_culture: ['exam_sketch', 'timeline', 'comparison', 'hierarchy', 'mindmap'],
  science_tech: ['exam_sketch', 'process_diagram', 'process_flow', 'flowchart', 'mindmap'],
  clean_energy: ['exam_sketch', 'process_diagram', 'cause_effect', 'chart', 'flowchart'],
  agriculture: ['exam_sketch', 'process_diagram', 'cause_effect', 'stakeholder_map', 'flowchart'],
  international_relations: ['exam_sketch', 'stakeholder_map', 'timeline', 'comparison', 'cause_effect'],
  internal_security: ['exam_sketch', 'stakeholder_map', 'flowchart', 'cause_effect', 'institutional_diagram'],
  ethics: ['exam_sketch', 'stakeholder_map', 'comparison', 'flowchart', 'dimension_wheel'],
  appsc_state_economy: ['exam_sketch', 'flowchart', 'cause_effect', 'comparison', 'chart']
};

/**
 * Recommend 3 to 5 optimal visual types for a knowledge topic.
 */
export function recommendVisualTypesForTopic(topic) {
  if (!topic) return ['exam_sketch', 'mindmap', 'flowchart'];

  const subjectStr = String(topic.subject || '').toLowerCase();
  const titleStr = String(topic.title || topic.canonical_name || '').toLowerCase();
  const examContext = String(topic.exam_context || '').toLowerCase();
  const dimensions = Array.isArray(topic.dimensions) ? topic.dimensions.map(d => String(d).toLowerCase()) : [];

  const typesSet = new Set(['exam_sketch']); // Exam sketch is always priority #1

  if (examContext === 'appsc' && (subjectStr.includes('economy') || titleStr.includes('budget'))) {
    SUBJECT_VISUAL_MAP.appsc_state_economy.forEach(t => typesSet.add(t));
  } else if (subjectStr.includes('polity') || subjectStr.includes('constitution') || titleStr.includes('governor') || titleStr.includes('court') || titleStr.includes('parliament')) {
    SUBJECT_VISUAL_MAP.polity.forEach(t => typesSet.add(t));
  } else if (subjectStr.includes('economy') || subjectStr.includes('banking') || titleStr.includes('inflation') || titleStr.includes('gdp') || titleStr.includes('tax')) {
    SUBJECT_VISUAL_MAP.economy.forEach(t => typesSet.add(t));
  } else if (subjectStr.includes('disaster') || titleStr.includes('flood') || titleStr.includes('cyclone') || titleStr.includes('earthquake')) {
    SUBJECT_VISUAL_MAP.disaster.forEach(t => typesSet.add(t));
  } else if (subjectStr.includes('geography') || titleStr.includes('monsoon') || titleStr.includes('el nino') || titleStr.includes('river')) {
    SUBJECT_VISUAL_MAP.geography.forEach(t => typesSet.add(t));
  } else if (subjectStr.includes('environment') || titleStr.includes('biodiversity') || titleStr.includes('climate')) {
    SUBJECT_VISUAL_MAP.environment.forEach(t => typesSet.add(t));
  } else if (subjectStr.includes('science') || subjectStr.includes('energy') || titleStr.includes('hydrogen') || titleStr.includes('solar') || titleStr.includes('space')) {
    SUBJECT_VISUAL_MAP.science_tech.forEach(t => typesSet.add(t));
  } else if (subjectStr.includes('history') || subjectStr.includes('culture')) {
    SUBJECT_VISUAL_MAP.history.forEach(t => typesSet.add(t));
  } else if (subjectStr.includes('international') || titleStr.includes('bilateral') || titleStr.includes('treaty')) {
    SUBJECT_VISUAL_MAP.international_relations.forEach(t => typesSet.add(t));
  } else {
    typesSet.add('mindmap');
    typesSet.add('flowchart');
    typesSet.add('cause_effect');
  }

  // Dimension-based enhancements
  if (dimensions.some(d => d.includes('timeline') || d.includes('evolution') || d.includes('history'))) {
    typesSet.add('timeline');
  }
  if (dimensions.some(d => d.includes('stakeholder') || d.includes('governance') || d.includes('actor'))) {
    typesSet.add('stakeholder_map');
  }

  const result = Array.from(typesSet).slice(0, 5);
  return result;
}
