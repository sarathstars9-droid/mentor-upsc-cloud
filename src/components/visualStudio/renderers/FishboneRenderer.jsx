/**
 * src/components/visualStudio/renderers/FishboneRenderer.jsx
 *
 * Visual Grammar: FISHBONE (Ishikawa Root-Cause Categorization)
 * Horizontal central spine leading to Problem Head, with 4 diagonal category bones.
 * Perfect for: Multi-factorial problem diagnosis, Industrial bottlenecks, Governance failures.
 */

import React, { useState } from 'react';
import { ExamNode, ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function FishboneRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealed, setRevealed] = useState({});

  const problem = schema.problem || schema.head || schema.title || 'URBAN FLOODING';
  const categories = schema.categories || [
    { name: 'Hydrology / Climate', causes: ['Intense Cloudbursts', 'Sea Level Surge'] },
    { name: 'Drainage Systems', causes: ['Obsolete Sizing (12mm/hr)', 'Severe Siltation'] },
    { name: 'Urban Planning', causes: ['Wetland Encroachment', '80% Concretisation'] },
    { name: 'Governance / ULBs', causes: ['Multi-agency Jurisdictions', 'Delayed Desilting'] }
  ];

  const width = 640;
  const height = 380;
  const spineY = height / 2;
  const spineStartX = 40;
  const spineEndX = 480;

  function toggleReveal(id) {
    setRevealed(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#FFFFFF' }}>
      <ExamDefs />

      {/* Main Horizontal Spine */}
      <line
        x1={spineStartX}
        y1={spineY}
        x2={spineEndX + 20}
        y2={spineY}
        stroke="#0F172A"
        strokeWidth={3}
        markerEnd="url(#grammarArrowBlue)"
      />

      {/* Problem Head Box */}
      <ExamNode
        x={spineEndX + 20}
        y={spineY - 30}
        width={130}
        height={60}
        rx={8}
        label={problem}
        renderMode={renderMode}
        fill="#EFF6FF"
        stroke="#1D4ED8"
        textColor="#1E3A8A"
        fontSize={12}
        fontWeight={700}
      />

      {/* 4 Diagonal Bones (2 Top, 2 Bottom) */}
      {categories.map((cat, i) => {
        const isTop = i < 2;
        const colIdx = i % 2; // 0 or 1
        const spineAttachX = colIdx === 0 ? 180 : 360;
        const boneEndX = spineAttachX - 70;
        const boneEndY = isTop ? 40 : height - 40;

        const isMasked = renderMode === 'recall' && !revealed[`cat-${i}`];

        return (
          <g key={`bone-${i}`}>
            {/* Diagonal Bone Line */}
            <line
              x1={boneEndX}
              y1={boneEndY + (isTop ? 28 : 0)}
              x2={spineAttachX}
              y2={spineY}
              stroke="#0A64F5"
              strokeWidth={2}
            />

            {/* Category Header Node */}
            <ExamNode
              x={boneEndX - 65}
              y={isTop ? 15 : height - 45}
              width={130}
              height={30}
              rx={4}
              label={cat.name}
              renderMode={renderMode}
              fill="#F8FAFC"
              stroke="#0A64F5"
              textColor="#0F172A"
              fontSize={10.5}
              fontWeight={700}
            />

            {/* Cause Sub-lines and Labels */}
            {cat.causes && cat.causes.map((cause, ci) => {
              const subY = isTop ? 55 + ci * 28 : spineY + 30 + ci * 28;
              const subX1 = boneEndX + (isTop ? ci * 20 : (1 - ci) * 20);
              const subX2 = subX1 + 85;

              return (
                <g key={`sub-cause-${i}-${ci}`}>
                  <line
                    x1={subX1}
                    y1={subY}
                    x2={subX2}
                    y2={subY}
                    stroke="#94A3B8"
                    strokeWidth={1.25}
                    strokeDasharray="2 2"
                  />
                  <text
                    x={subX2 + 4}
                    y={subY + 3}
                    fill={isMasked ? '#94A3B8' : '#334155'}
                    fontSize={9}
                    fontWeight={500}
                    fontFamily="Inter, system-ui, sans-serif"
                    onClick={() => {
                      if (renderMode === 'recall') toggleReveal(`cat-${i}`);
                      if (onNodeClick) onNodeClick(cause, ci);
                    }}
                    style={{ cursor: renderMode === 'recall' ? 'pointer' : 'default' }}
                  >
                    {isMasked ? '???' : cause}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
