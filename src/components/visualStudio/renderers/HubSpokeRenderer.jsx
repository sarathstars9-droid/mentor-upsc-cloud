/**
 * src/components/visualStudio/renderers/HubSpokeRenderer.jsx
 *
 * Visual Grammar: HUB & SPOKE (Mind Map / Radial Multidimensional Layout)
 * Center central concept with radial spokes placed symmetrically around it.
 */

import React, { useState } from 'react';
import { ExamCircle, ExamNode, ExamArrow, ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function HubSpokeRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealedSpokes, setRevealedSpokes] = useState({});

  const centerText = schema.center || schema.centerLabel || schema.title || 'Central Topic';
  const rawSpokes = schema.spokes || schema.nodes || [
    'Dimension A', 'Dimension B', 'Dimension C', 'Dimension D', 'Dimension E'
  ];

  // In exam mode: max 5-6 spokes with crisp concise wording
  const spokes = renderMode === 'exam' ? rawSpokes.slice(0, 6) : rawSpokes;
  const numSpokes = spokes.length;

  const width = 640;
  const height = 400;
  const centerX = width / 2;
  const centerY = height / 2;
  const hubRadius = renderMode === 'exam' ? 44 : 48;
  const orbitRadiusX = renderMode === 'exam' ? 200 : 210;
  const orbitRadiusY = renderMode === 'exam' ? 140 : 150;

  function toggleReveal(index) {
    setRevealedSpokes(prev => ({ ...prev, [index]: !prev[index] }));
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#FFFFFF' }}>
      <ExamDefs />

      {/* Orbit Guideline Circle (subtle in learn mode) */}
      {renderMode === 'learn' && (
        <ellipse
          cx={centerX}
          cy={centerY}
          rx={orbitRadiusX}
          ry={orbitRadiusY}
          fill="none"
          stroke="#F1F5F9"
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
      )}

      {/* Spoke Connectors */}
      {spokes.map((spoke, i) => {
        const angle = (i * 2 * Math.PI) / numSpokes - Math.PI / 2;
        const targetX = centerX + orbitRadiusX * Math.cos(angle);
        const targetY = centerY + orbitRadiusY * Math.sin(angle);

        // Calculate connector line start at hub perimeter
        const lineStartX = centerX + hubRadius * Math.cos(angle);
        const lineStartY = centerY + hubRadius * Math.sin(angle);

        return (
          <ExamArrow
            key={`spoke-line-${i}`}
            x1={lineStartX}
            y1={lineStartY}
            x2={targetX}
            y2={targetY}
            stroke="#0A64F5"
            strokeWidth={1.75}
            label={typeof spoke === 'object' && spoke.edgeLabel ? spoke.edgeLabel : null}
          />
        );
      })}

      {/* Central Hub */}
      <ExamCircle
        cx={centerX}
        cy={centerY}
        r={hubRadius}
        label={centerText}
        fill="#EFF6FF"
        stroke="#1D4ED8"
        textColor="#1E3A8A"
        fontSize={renderMode === 'exam' ? 11 : 12}
        fontWeight={700}
      />

      {/* Outer Spoke Nodes */}
      {spokes.map((spoke, i) => {
        const angle = (i * 2 * Math.PI) / numSpokes - Math.PI / 2;
        const targetX = centerX + orbitRadiusX * Math.cos(angle);
        const targetY = centerY + orbitRadiusY * Math.sin(angle);

        const nodeW = renderMode === 'exam' ? 120 : 140;
        const nodeH = 34;
        const nodeX = targetX - nodeW / 2;
        const nodeY = targetY - nodeH / 2;

        const spokeText = typeof spoke === 'string' ? spoke : (spoke.label || spoke.text || `Dimension ${i + 1}`);
        const subtext = typeof spoke === 'object' ? spoke.sublabel : null;
        const isMasked = renderMode === 'recall' && !revealedSpokes[i];

        return (
          <ExamNode
            key={`spoke-node-${i}`}
            x={nodeX}
            y={nodeY}
            width={nodeW}
            height={nodeH}
            rx={6}
            label={spokeText}
            sublabel={subtext}
            isMasked={isMasked}
            renderMode={renderMode}
            fill="#FFFFFF"
            stroke="#0A64F5"
            badge={i + 1}
            badgeFill="#0A64F5"
            onClick={() => {
              if (renderMode === 'recall') toggleReveal(i);
              if (onNodeClick) onNodeClick(spoke, i);
            }}
          />
        );
      })}
    </svg>
  );
}
