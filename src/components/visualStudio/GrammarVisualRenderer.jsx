/**
 * src/components/visualStudio/GrammarVisualRenderer.jsx
 *
 * Master Dispatcher for MentorOS Visual Grammar Renderers (Phase 2D).
 * Routes schemas to dedicated geometric SVG visual renderers based on visualGrammar.
 */

import React from 'react';
import { HubSpokeRenderer } from './renderers/HubSpokeRenderer.jsx';
import { CauseEffectRenderer } from './renderers/CauseEffectRenderer.jsx';
import { CycleRenderer } from './renderers/CycleRenderer.jsx';
import { TimelineRenderer } from './renderers/TimelineRenderer.jsx';
import { StakeholderMapRenderer } from './renderers/StakeholderMapRenderer.jsx';
import { InstitutionalWebRenderer } from './renderers/InstitutionalWebRenderer.jsx';
import { DecisionTreeRenderer } from './renderers/DecisionTreeRenderer.jsx';
import { FishboneRenderer } from './renderers/FishboneRenderer.jsx';
import { GeographySketchRenderer } from './renderers/GeographySketchRenderer.jsx';
import { MapSketchRenderer } from './renderers/MapSketchRenderer.jsx';
import { PyramidRenderer } from './renderers/PyramidRenderer.jsx';
import { MatrixRenderer } from './renderers/MatrixRenderer.jsx';
import { ProcessDiagramRenderer } from './renderers/ProcessDiagramRenderer.jsx';
import { FlowchartRenderer } from './renderers/FlowchartRenderer.jsx';

/**
 * Normalizes grammar identifier from schema or visual metadata.
 */
export function resolveVisualGrammar(schema = {}, visual = {}) {
  const grammar = (
    schema.visualGrammar ||
    schema.grammar ||
    schema.renderer ||
    visual.visual_grammar ||
    visual.visual_type ||
    'flowchart'
  ).toLowerCase().trim();

  // Normalize mapping
  if (grammar.includes('hub') || grammar.includes('mind_map') || grammar.includes('radial')) return 'hub_spoke';
  if (grammar.includes('cause') || grammar.includes('diagnostic')) return 'cause_effect';
  if (grammar.includes('cycle') || grammar.includes('loop')) return 'cycle';
  if (grammar.includes('timeline') || grammar.includes('chronology')) return 'timeline';
  if (grammar.includes('stakeholder') || grammar.includes('actor')) return 'stakeholder_map';
  if (grammar.includes('institutional') || grammar.includes('web') || grammar.includes('federalism')) return 'institutional_web';
  if (grammar.includes('decision') || grammar.includes('tree') || grammar.includes('dilemma')) return 'decision_tree';
  if (grammar.includes('fishbone') || grammar.includes('ishikawa')) return 'fishbone';
  if (grammar.includes('geography') || grammar.includes('monsoon') || grammar.includes('enso')) return 'geography_sketch';
  if (grammar.includes('process') || grammar.includes('hydrogen') || grammar.includes('mechanism') || grammar.includes('transmission')) return 'process_diagram';
  if (grammar.includes('map')) return 'map_sketch';
  if (grammar.includes('pyramid') || grammar.includes('tier') || grammar.includes('hierarchy')) return 'pyramid';
  if (grammar.includes('matrix') || grammar.includes('comparison') || grammar.includes('grid')) return 'matrix';

  // Fallback for legacy EXAM_SKETCH: check node structure or default to hub_spoke / flowchart
  if (grammar === 'exam_sketch' || grammar === 'flowchart') {
    if (schema.causes || schema.effects) return 'cause_effect';
    if (schema.stages && (schema.inputs || schema.outputs || schema.feedback)) return 'process_diagram';
    if (schema.stages) return 'cycle';
    if (schema.events) return 'timeline';
    if (schema.stakeholders) return 'stakeholder_map';
    if (schema.councils || schema.middleTier) return 'institutional_web';
    if (schema.branches) return 'decision_tree';
    if (schema.categories) return 'fishbone';
    if (schema.layers) return 'pyramid';
    if (schema.spokes || (schema.nodes && schema.nodes.length >= 5 && !schema.connections)) return 'hub_spoke';
    return 'flowchart';
  }

  return 'flowchart';
}

/**
 * Estimated draw time in seconds based on visual grammar.
 */
export function estimateDrawTimeSeconds(grammar = 'hub_spoke', nodeCount = 5) {
  switch (grammar) {
    case 'hub_spoke': return 25;
    case 'cause_effect': return 35;
    case 'cycle': return 30;
    case 'timeline': return 30;
    case 'stakeholder_map': return 35;
    case 'institutional_web': return 40;
    case 'decision_tree': return 35;
    case 'fishbone': return 35;
    case 'process_diagram': return 40;
    case 'geography_sketch': return 50;
    case 'map_sketch': return 60;
    case 'pyramid': return 25;
    case 'matrix': return 40;
    case 'flowchart':
    default:
      return Math.min(45, Math.max(20, nodeCount * 7));
  }
}

export function GrammarVisualRenderer({
  schema = {},
  visual = {},
  mode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const grammar = resolveVisualGrammar(schema, visual);

  switch (grammar) {
    case 'hub_spoke':
      return <HubSpokeRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
    case 'cause_effect':
      return <CauseEffectRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
    case 'cycle':
      return <CycleRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
    case 'timeline':
      return <TimelineRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
    case 'stakeholder_map':
      return <StakeholderMapRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
    case 'institutional_web':
      return <InstitutionalWebRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
    case 'decision_tree':
      return <DecisionTreeRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
    case 'fishbone':
      return <FishboneRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
    case 'process_diagram':
      return <ProcessDiagramRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
    case 'geography_sketch':
      return <GeographySketchRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
    case 'map_sketch':
      return <MapSketchRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
    case 'pyramid':
      return <PyramidRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
    case 'matrix':
      return <MatrixRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
    case 'flowchart':
    default:
      return <FlowchartRenderer schema={schema} renderMode={mode} onNodeClick={onNodeClick} />;
  }
}

export default GrammarVisualRenderer;
