/**
 * src/components/visualStudio/renderers/InstitutionalWebRenderer.jsx
 *
 * Visual Grammar: INSTITUTIONAL WEB (Relational Multi-Tier Governance Network)
 * Relational multi-tier network connecting Union, States, Councils, and Local Bodies.
 * Perfect for: Federalism, Centre-State Relations, Separation of Powers, Regulatory Bodies.
 */

import React, { useState } from 'react';
import { ExamNode, ExamArrow, ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function InstitutionalWebRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealed, setRevealed] = useState({});

  const title = schema.title || 'Institutional Federal Architecture';
  const unionNode = schema.topTier || schema.union || 'UNION GOVERNMENT';
  const councils = schema.councils || schema.middleTier || [
    { name: 'Finance Commission', art: 'Art 280 (Tax Devolution)' },
    { name: 'GST Council', art: 'Art 279A (Tax Harmonisation)' },
    { name: 'Inter-State Council', art: 'Art 263 (Cooperative Dialogue)' }
  ];
  const statesNode = schema.bottomTier || schema.states || 'STATE GOVERNMENTS';
  const localNode = schema.subTier || schema.localBodies || 'LOCAL BODIES (PRIs & ULBs)';

  const width = 640;
  const height = 400;

  function toggleReveal(id) {
    setRevealed(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Top Union Node: x = 220, y = 20, w = 200, h = 38
  // Middle Councils: 3 nodes at y = 135 (x = 25, 230, 435, w = 180, h = 46)
  // States Node: x = 220, y = 260, w = 200, h = 38
  // Local Bodies: x = 220, y = 345, w = 200, h = 34

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#FFFFFF' }}>
      <ExamDefs />

      {/* Union -> 3 Councils Connectors */}
      {councils.map((_, i) => {
        const councilCenterX = 25 + i * 205 + 90;
        return (
          <ExamArrow
            key={`union-to-council-${i}`}
            x1={320}
            y1={58}
            x2={councilCenterX}
            y2={135}
            stroke="#4338CA"
            strokeWidth={1.75}
            markerEnd="url(#grammarArrowIndigo)"
          />
        );
      })}

      {/* 3 Councils -> States Connectors */}
      {councils.map((_, i) => {
        const councilCenterX = 25 + i * 205 + 90;
        return (
          <ExamArrow
            key={`council-to-states-${i}`}
            x1={councilCenterX}
            y1={181}
            x2={320}
            y2={260}
            stroke="#4338CA"
            strokeWidth={1.75}
            markerEnd="url(#grammarArrowIndigo)"
          />
        );
      })}

      {/* States -> Local Bodies Connector */}
      <ExamArrow
        x1={320}
        y1={298}
        x2={320}
        y2={345}
        stroke="#059669"
        strokeWidth={2}
        markerEnd="url(#grammarArrowEmerald)"
        label={renderMode === 'learn' ? '73rd & 74th CAA Devolution' : null}
      />

      {/* TOP TIER: UNION */}
      <ExamNode
        x={220}
        y={20}
        width={200}
        height={38}
        rx={6}
        label={typeof unionNode === 'string' ? unionNode : unionNode.name}
        renderMode={renderMode}
        fill="#EEF2FF"
        stroke="#4338CA"
        textColor="#312E81"
        fontSize={12}
        fontWeight={700}
      />

      {/* MIDDLE TIER: 3 CONSTITUTIONAL & STATUTORY COUNCILS */}
      {councils.map((c, i) => {
        const nodeX = 25 + i * 205;
        const name = typeof c === 'string' ? c : (c.name || `Council ${i + 1}`);
        const art = typeof c === 'object' ? c.art : null;
        const isMasked = renderMode === 'recall' && !revealed[`council-${i}`];

        return (
          <ExamNode
            key={`council-${i}`}
            x={nodeX}
            y={135}
            width={180}
            height={46}
            rx={6}
            label={name}
            sublabel={art}
            isMasked={isMasked}
            renderMode={renderMode}
            fill="#FFFFFF"
            stroke="#4338CA"
            textColor="#1E1B4B"
            fontSize={11.5}
            badge={`C${i + 1}`}
            badgeFill="#4338CA"
            onClick={() => {
              if (renderMode === 'recall') toggleReveal(`council-${i}`);
              if (onNodeClick) onNodeClick(c, i);
            }}
          />
        );
      })}

      {/* BOTTOM TIER: STATES */}
      <ExamNode
        x={220}
        y={260}
        width={200}
        height={38}
        rx={6}
        label={typeof statesNode === 'string' ? statesNode : statesNode.name}
        renderMode={renderMode}
        fill="#EEF2FF"
        stroke="#4338CA"
        textColor="#312E81"
        fontSize={12}
        fontWeight={700}
      />

      {/* SUB TIER: LOCAL BODIES */}
      <ExamNode
        x={220}
        y={345}
        width={200}
        height={34}
        rx={6}
        label={typeof localNode === 'string' ? localNode : localNode.name}
        renderMode={renderMode}
        fill="#ECFDF5"
        stroke="#059669"
        textColor="#065F46"
        fontSize={11}
        fontWeight={600}
      />
    </svg>
  );
}
