/**
 * backend/services/visualKnowledge/visualGrammarSchemas.js
 *
 * Semantic Grammar Definitions, Schema Validators, and Recommendation Engine (Phase 2D).
 * Ensures AI and Visual Studio reason and structure visualizations according to real visual grammars.
 */

export const VISUAL_GRAMMARS = {
  HUB_SPOKE: 'hub_spoke',
  CAUSE_EFFECT: 'cause_effect',
  CYCLE: 'cycle',
  TIMELINE: 'timeline',
  STAKEHOLDER_MAP: 'stakeholder_map',
  INSTITUTIONAL_WEB: 'institutional_web',
  DECISION_TREE: 'decision_tree',
  FISHBONE: 'fishbone',
  PROCESS_DIAGRAM: 'process_diagram',
  GEOGRAPHY_SKETCH: 'geography_sketch',
  MAP_SKETCH: 'map_sketch',
  PYRAMID: 'pyramid',
  MATRIX: 'matrix',
  FLOWCHART: 'flowchart',
  CHART: 'chart'
};

/**
 * Estimated draw time in seconds by grammar.
 */
export const GRAMMAR_DRAW_TIMES = {
  [VISUAL_GRAMMARS.HUB_SPOKE]: 25,
  [VISUAL_GRAMMARS.CAUSE_EFFECT]: 35,
  [VISUAL_GRAMMARS.CYCLE]: 30,
  [VISUAL_GRAMMARS.TIMELINE]: 30,
  [VISUAL_GRAMMARS.STAKEHOLDER_MAP]: 35,
  [VISUAL_GRAMMARS.INSTITUTIONAL_WEB]: 40,
  [VISUAL_GRAMMARS.DECISION_TREE]: 35,
  [VISUAL_GRAMMARS.FISHBONE]: 35,
  [VISUAL_GRAMMARS.PROCESS_DIAGRAM]: 40,
  [VISUAL_GRAMMARS.GEOGRAPHY_SKETCH]: 50,
  [VISUAL_GRAMMARS.MAP_SKETCH]: 60,
  [VISUAL_GRAMMARS.PYRAMID]: 25,
  [VISUAL_GRAMMARS.MATRIX]: 40,
  [VISUAL_GRAMMARS.FLOWCHART]: 30,
  [VISUAL_GRAMMARS.CHART]: 45
};

/**
 * Grammar Recommendation Engine based on directive and question demand.
 */
export function recommendGrammarForDemand({
  topicTitle = '',
  subject = '',
  directive = '',
  questionText = ''
} = {}) {
  const text = `${topicTitle} ${subject} ${directive} ${questionText}`.toLowerCase();

  // 1. Chronology / Evolution / History -> Timeline
  if (text.includes('trace') || text.includes('evolution') || text.includes('chronology') || text.includes('history of') || text.includes('milestones') || text.includes('timeline')) {
    return {
      recommendedGrammar: VISUAL_GRAMMARS.TIMELINE,
      reason: 'Question requires tracing chronological evolution and institutional milestones.',
      targetDrawSeconds: GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.TIMELINE]
    };
  }

  // 2. Technical Mechanisms / Energy / Supply Chains / Transmission -> Process Diagram
  if (text.includes('hydrogen') || text.includes('electrolysis') || text.includes('monetary transmission') || text.includes('supply chain') || text.includes('value chain') || text.includes('energy system') || text.includes('refining process') || text.includes('mechanism of transmission')) {
    return {
      recommendedGrammar: VISUAL_GRAMMARS.PROCESS_DIAGRAM,
      reason: 'Question involves multi-stream input transformation, conversion stages, byproducts, and logistics vectors.',
      targetDrawSeconds: GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.PROCESS_DIAGRAM]
    };
  }

  // 3. Comparison / Models / Evaluation -> Matrix
  if (text.includes('compare') || text.includes('contrast') || text.includes('versus') || text.includes('vs') || text.includes('differences between') || text.includes('comparative')) {
    return {
      recommendedGrammar: VISUAL_GRAMMARS.MATRIX,
      reason: 'Question demands multi-criteria comparative evaluation across structured parameters.',
      targetDrawSeconds: GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.MATRIX]
    };
  }

  // 4. Actors / Responsibilities / Conflicts / Ethics -> Stakeholder Map
  if (text.includes('stakeholder') || text.includes('actors') || text.includes('who is responsible') || text.includes('interest group') || (text.includes('ethics') && !text.includes('dilemma'))) {
    return {
      recommendedGrammar: VISUAL_GRAMMARS.STAKEHOLDER_MAP,
      reason: 'Question demands mapping interconnected institutional actors, roles, and civil stakeholders.',
      targetDrawSeconds: GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.STAKEHOLDER_MAP]
    };
  }

  // 5. Federalism / Inter-governmental / Separation of Powers -> Institutional Web
  if (text.includes('federalism') || text.includes('centre-state') || text.includes('center-state') || text.includes('finance commission') || text.includes('gst council') || text.includes('inter-state council')) {
    return {
      recommendedGrammar: VISUAL_GRAMMARS.INSTITUTIONAL_WEB,
      reason: 'Question examines multi-tier relational governance between Union, States, and constitutional councils.',
      targetDrawSeconds: GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.INSTITUTIONAL_WEB]
    };
  }

  // 6. Ethical Dilemma / Options / Trade-offs -> Decision Tree
  if (text.includes('dilemma') || text.includes('course of action') || text.includes('options available') || text.includes('decision tree') || text.includes('ethical choices')) {
    return {
      recommendedGrammar: VISUAL_GRAMMARS.DECISION_TREE,
      reason: 'Question involves ethical choice pathways, risk branching, and consequence verdicts.',
      targetDrawSeconds: GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.DECISION_TREE]
    };
  }

  // 7. Root Causes / Multi-factorial Diagnosis -> Fishbone
  if (text.includes('root cause') || text.includes('bottlenecks') || text.includes('systemic failures') || text.includes('fishbone') || text.includes('ishikawa')) {
    return {
      recommendedGrammar: VISUAL_GRAMMARS.FISHBONE,
      reason: 'Question requires categorising multi-factorial root causes leading to a central systemic bottleneck.',
      targetDrawSeconds: GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.FISHBONE]
    };
  }

  // 8. Physical Geography / Atmosphere / Ocean / Monsoon -> Geography Process Sketch
  if (text.includes('el nino') || text.includes('monsoon') || text.includes('circulation') || text.includes('walker cell') || text.includes('upwelling') || text.includes('physical mechanism')) {
    return {
      recommendedGrammar: VISUAL_GRAMMARS.GEOGRAPHY_SKETCH,
      reason: 'Question requires physical-spatial atmospheric/oceanic process visualization with convection & isotherms.',
      targetDrawSeconds: GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.GEOGRAPHY_SKETCH]
    };
  }

  // 9. Spatial Hotspots / Zones / Maps -> Map Sketch
  if (text.includes('spatial') || text.includes('hotspots') || text.includes('regions') || text.includes('corridors') || text.includes('geographical distribution') || text.includes('map')) {
    return {
      recommendedGrammar: VISUAL_GRAMMARS.MAP_SKETCH,
      reason: 'Question requires annotated geographic outline with risk hotspot overlays and spatial annotations.',
      targetDrawSeconds: GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.MAP_SKETCH]
    };
  }

  // 10. Closed Loop / Disaster / Lifecycle -> Cycle
  if (text.includes('cycle') || text.includes('disaster management') || text.includes('loop') || text.includes('lifecycle') || text.includes('circular economy')) {
    return {
      recommendedGrammar: VISUAL_GRAMMARS.CYCLE,
      reason: 'Question represents a continuous closed-loop iterative cycle.',
      targetDrawSeconds: GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.CYCLE]
    };
  }

  // 11. Causes, Impacts & Solutions -> Cause-Effect
  if (text.includes('causes') || text.includes('impact') || text.includes('consequences') || text.includes('remedies') || text.includes('mitigation')) {
    return {
      recommendedGrammar: VISUAL_GRAMMARS.CAUSE_EFFECT,
      reason: 'Question demands structured diagnostic flow from root causes through crisis to policy remedies.',
      targetDrawSeconds: GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.CAUSE_EFFECT]
    };
  }

  // 12. Hierarchy / Tiers -> Pyramid
  if (text.includes('hierarchy') || text.includes('tiers') || text.includes('pyramid') || text.includes('structure of')) {
    return {
      recommendedGrammar: VISUAL_GRAMMARS.PYRAMID,
      reason: 'Question outlines hierarchical institutional tiers from broad base to apex.',
      targetDrawSeconds: GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.PYRAMID]
    };
  }

  // Default: Multidimensional Hub & Spoke
  return {
    recommendedGrammar: VISUAL_GRAMMARS.HUB_SPOKE,
    reason: 'Multidimensional topic exploration radiating from a central core concept.',
    targetDrawSeconds: GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.HUB_SPOKE]
  };
}
