/**
 * src/components/visualStudio/ExamSketchRenderer.jsx
 *
 * Backwards-compatible Exam Sketch & Visual Grammar Renderer for UPSC/APPSC Mains (Phase 2D).
 * Wraps GrammarVisualRenderer with header controls and draw time badges.
 */

import React from 'react';
import { GrammarVisualRenderer, resolveVisualGrammar, estimateDrawTimeSeconds } from './GrammarVisualRenderer.jsx';

export function ExamSketchRenderer({
  schema = {},
  visual = {},
  mode = 'learn', // 'learn' | 'exam' | 'recall'
  drawTimeSeconds = null,
  onNodeClick = null
}) {
  if (!schema) return null;

  const grammar = resolveVisualGrammar(schema, visual);
  const estimatedTime = drawTimeSeconds || schema.targetDrawSeconds || estimateDrawTimeSeconds(grammar, schema.nodes?.length || 5);

  const grammarLabels = {
    hub_spoke: 'Hub & Spoke (Mind Map)',
    cause_effect: 'Cause & Effect Diagnostic',
    cycle: 'Closed Loop Cycle',
    timeline: 'Chronological Timeline',
    stakeholder_map: 'Stakeholder & Actor Matrix',
    institutional_web: 'Institutional Governance Web',
    decision_tree: 'Ethical Decision Tree',
    fishbone: 'Ishikawa Fishbone Diagram',
    process_diagram: 'Mechanism & Process Diagram',
    geography_sketch: 'Physical Process Diagram',
    map_sketch: 'Spatial Hotspot Map Sketch',
    pyramid: 'Hierarchical Pyramid',
    matrix: 'Comparative Matrix',
    flowchart: 'Sequential Flowchart'
  };

  return (
    <div style={styles.container}>
      {/* Header Bar */}
      <div style={styles.sketchHeader}>
        <div style={styles.badgeRow}>
          <span style={styles.grammarBadge}>
            📐 {grammarLabels[grammar] || 'Visual Grammar'}
          </span>
          <span style={styles.drawableBadge}>✏️ Pen-Drawable in Mains</span>
          {mode === 'recall' && (
            <span style={styles.recallBadge}>🧠 Active Recall Mode (Click to Reveal)</span>
          )}
        </div>
        <div style={styles.drawTime}>
          ⏱️ Target: {estimatedTime}s
        </div>
      </div>

      {/* SVG Grammar Canvas */}
      <div style={styles.canvasWrapper}>
        <GrammarVisualRenderer
          schema={schema}
          visual={visual}
          mode={mode}
          onNodeClick={onNodeClick}
        />
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column'
  },
  sketchHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    background: '#F8FAFC',
    borderBottom: '1px solid #E2E8F0',
    flexWrap: 'wrap',
    gap: '8px'
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  grammarBadge: {
    fontSize: '11px',
    fontWeight: 700,
    background: '#EFF6FF',
    color: '#1D4ED8',
    border: '1px solid #BFDBFE',
    borderRadius: '6px',
    padding: '3px 8px'
  },
  drawableBadge: {
    fontSize: '11px',
    fontWeight: 600,
    background: '#F1F5F9',
    color: '#475569',
    borderRadius: '6px',
    padding: '3px 8px'
  },
  recallBadge: {
    fontSize: '11px',
    fontWeight: 700,
    background: '#FEF3C7',
    color: '#B45309',
    border: '1px solid #FDE68A',
    borderRadius: '6px',
    padding: '3px 8px'
  },
  drawTime: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#0F172A',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    padding: '3px 10px'
  },
  canvasWrapper: {
    width: '100%',
    padding: '12px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflowX: 'auto'
  }
};

export default ExamSketchRenderer;
