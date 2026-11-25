/**
 * src/components/visualStudio/renderers/CycleRenderer.jsx
 *
 * Visual Grammar: CYCLE (Closed Loop / Continuous Iterative Process)
 * Stages arranged in a circular orbit with clockwise connecting arrows.
 * Perfect for: Disaster Management Cycle, Policy Lifecycle, Nitrogen Cycle, etc.
 */

import React, { useState } from 'react';
import { ExamNode, ExamCurve, ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function CycleRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealed, setRevealed] = useState({});

  const title = schema.title || schema.centerLabel || 'Continuous Cycle';
  const stages = schema.stages || schema.nodes || [
    '1. Mitigation',
    '2. Preparedness',
    '3. Response',
    '4. Recovery'
  ];

  const width = 640;
  const height = 400;
  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = 195;
  const radiusY = 135;
  const numStages = stages.length;

  function toggleReveal(i) {
    setRevealed(prev => ({ ...prev, [i]: !prev[i] }));
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#FFFFFF' }}>
      <ExamDefs />

      {/* Center Label */}
      <g>
        <circle cx={centerX} cy={centerY} r={36} fill="#F8FAFC" stroke="#E2E8F0" strokeWidth={1.5} />
        <text
          x={centerX}
          y={centerY - 2}
          textAnchor="middle"
          fill="#475569"
          fontSize={11}
          fontWeight={700}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {title.toUpperCase().slice(0, 16)}
        </text>
        <text
          x={centerX}
          y={centerY + 12}
          textAnchor="middle"
          fill="#94A3B8"
          fontSize={8.5}
          fontWeight={600}
          fontFamily="Inter, system-ui, sans-serif"
        >
          ↻ CLOSED LOOP
        </text>
      </g>

      {/* Clockwise Curved Flow Connectors */}
      {stages.map((_, i) => {
        const nextIdx = (i + 1) % numStages;
        const angle1 = (i * 2 * Math.PI) / numStages - Math.PI / 2;
        const angle2 = (nextIdx * 2 * Math.PI) / numStages - Math.PI / 2;

        const x1 = centerX + (radiusX - 10) * Math.cos(angle1 + 0.25);
        const y1 = centerY + (radiusY - 10) * Math.sin(angle1 + 0.25);
        const x2 = centerX + (radiusX - 10) * Math.cos(angle2 - 0.25);
        const y2 = centerY + (radiusY - 10) * Math.sin(angle2 - 0.25);

        const midAngle = (angle1 + angle2) / 2 + (angle2 < angle1 ? Math.PI : 0);
        const ctrlX = centerX + (radiusX + 25) * Math.cos(midAngle);
        const ctrlY = centerY + (radiusY + 25) * Math.sin(midAngle);

        return (
          <ExamCurve
            key={`cycle-curve-${i}`}
            startX={x1}
            startY={y1}
            controlX={ctrlX}
            controlY={ctrlY}
            endX={x2}
            endY={y2}
            stroke="#0A64F5"
            strokeWidth={2}
          />
        );
      })}

      {/* Circular Stage Nodes */}
      {stages.map((stage, i) => {
        const angle = (i * 2 * Math.PI) / numStages - Math.PI / 2;
        const targetX = centerX + radiusX * Math.cos(angle);
        const targetY = centerY + radiusY * Math.sin(angle);

        const nodeW = 140;
        const nodeH = 38;
        const text = typeof stage === 'string' ? stage : (stage.label || stage.text || `Stage ${i + 1}`);
        const isMasked = renderMode === 'recall' && !revealed[i];

        return (
          <ExamNode
            key={`cycle-node-${i}`}
            x={targetX - nodeW / 2}
            y={targetY - nodeH / 2}
            width={nodeW}
            height={nodeH}
            rx={8}
            label={text}
            isMasked={isMasked}
            renderMode={renderMode}
            fill="#FFFFFF"
            stroke="#0A64F5"
            badge={i + 1}
            badgeFill="#0A64F5"
            onClick={() => {
              if (renderMode === 'recall') toggleReveal(i);
              if (onNodeClick) onNodeClick(stage, i);
            }}
          />
        );
      })}
    </svg>
  );
}
