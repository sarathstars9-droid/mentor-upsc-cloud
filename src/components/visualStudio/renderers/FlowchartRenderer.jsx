/**
 * src/components/visualStudio/renderers/FlowchartRenderer.jsx
 *
 * Visual Grammar: FLOWCHART (Sequential Step-by-Step Algorithm / Procedure)
 * Clean vertical/horizontal sequential flow.
 * Perfect for: Statutory Procedure, Bill Passage, Judicial Appeal Pathway, Policy Execution.
 */

import React, { useState } from 'react';
import { ExamNode, ExamArrow, ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function FlowchartRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealed, setRevealed] = useState({});

  const title = schema.title || 'Procedural Flowchart';
  const rawNodes = schema.nodes || [
    '1. Policy Problem Identification',
    '2. Inter-Ministerial Consultation',
    '3. Cabinet Approval & Drafting',
    '4. Parliamentary Scrutiny & Standing Comm.',
    '5. Presidential Assent & Gazetted Rules'
  ];

  const nodes = renderMode === 'exam' ? rawNodes.slice(0, 5) : rawNodes;
  const numNodes = nodes.length;

  const width = 640;
  const nodeW = 320;
  const nodeH = 38;
  const startX = width / 2 - nodeW / 2;
  const startY = 50;
  const stepY = 60;
  const height = Math.max(340, startY + numNodes * stepY + 30);

  function toggleReveal(i) {
    setRevealed(prev => ({ ...prev, [i]: !prev[i] }));
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#FFFFFF' }}>
      <ExamDefs />

      <text x={width / 2} y={26} textAnchor="middle" fill="#0F172A" fontSize={12} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
        ↓ {title.toUpperCase()}
      </text>

      {/* Sequential Arrows */}
      {nodes.slice(0, -1).map((_, i) => {
        const y1 = startY + i * stepY + nodeH;
        const y2 = startY + (i + 1) * stepY;
        const x = width / 2;

        return (
          <ExamArrow
            key={`flow-arrow-${i}`}
            x1={x}
            y1={y1}
            x2={x}
            y2={y2}
            stroke="#0A64F5"
            strokeWidth={1.75}
          />
        );
      })}

      {/* Flow Nodes */}
      {nodes.map((node, i) => {
        const y = startY + i * stepY;
        const text = typeof node === 'string' ? node : (node.label || node.text || `Step ${i + 1}`);
        const sub = typeof node === 'object' ? node.sublabel : null;
        const isMasked = renderMode === 'recall' && !revealed[i];

        return (
          <ExamNode
            key={`flow-node-${i}`}
            x={startX}
            y={y}
            width={nodeW}
            height={nodeH}
            rx={6}
            label={text}
            sublabel={sub}
            isMasked={isMasked}
            renderMode={renderMode}
            fill="#FFFFFF"
            stroke="#0A64F5"
            badge={i + 1}
            badgeFill="#0A64F5"
            onClick={() => {
              if (renderMode === 'recall') toggleReveal(i);
              if (onNodeClick) onNodeClick(node, i);
            }}
          />
        );
      })}
    </svg>
  );
}
