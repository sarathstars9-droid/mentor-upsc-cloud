/**
 * src/components/visualStudio/renderers/StakeholderMapRenderer.jsx
 *
 * Visual Grammar: STAKEHOLDER MAP (Relational Actor Matrix)
 * Central decision-maker / issue surrounded by 4-6 key institutional actors and civil groups.
 * Perfect for: Urban Governance, Ethics Case Studies, Environmental Conflict, Public Policy.
 */

import React, { useState } from 'react';
import { ExamCircle, ExamNode, ExamArrow, ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function StakeholderMapRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealed, setRevealed] = useState({});

  const centralIssue = schema.centralIssue || schema.center || schema.title || 'Central Governance / Issue';
  const rawStakeholders = schema.stakeholders || schema.nodes || [
    { name: 'Citizens / RWAs', role: 'Vulnerability & Compliance' },
    { name: 'Urban Local Body (ULB)', role: 'Drainage & Zoning' },
    { name: 'State Government', role: 'Funding & Policy Framework' },
    { name: 'Private Real Estate', role: 'Catchment Encroachment' },
    { name: 'NDMA / SDRF', role: 'Disaster Standard Protocols' }
  ];

  const stakeholders = renderMode === 'exam' ? rawStakeholders.slice(0, 5) : rawStakeholders;
  const numActors = stakeholders.length;

  const width = 640;
  const height = 400;
  const centerX = width / 2;
  const centerY = height / 2;
  const hubRadius = 52;
  const orbitX = 210;
  const orbitY = 145;

  function toggleReveal(i) {
    setRevealed(prev => ({ ...prev, [i]: !prev[i] }));
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#FFFFFF' }}>
      <ExamDefs />

      {/* Stakeholder Influence Connectors */}
      {stakeholders.map((actor, i) => {
        const angle = (i * 2 * Math.PI) / numActors - Math.PI / 2;
        const targetX = centerX + orbitX * Math.cos(angle);
        const targetY = centerY + orbitY * Math.sin(angle);

        const startX = centerX + hubRadius * Math.cos(angle);
        const startY = centerY + hubRadius * Math.sin(angle);

        return (
          <ExamArrow
            key={`stakeholder-link-${i}`}
            x1={startX}
            y1={startY}
            x2={targetX}
            y2={targetY}
            stroke="#D97706"
            strokeWidth={1.75}
            markerEnd="url(#grammarArrowAmber)"
            label={renderMode === 'learn' && typeof actor === 'object' ? actor.interaction : null}
          />
        );
      })}

      {/* Central Actor / Issue Hub */}
      <ExamCircle
        cx={centerX}
        cy={centerY}
        r={hubRadius}
        label={centralIssue}
        fill="#FEF3C7"
        stroke="#B45309"
        textColor="#78350F"
        fontSize={11.5}
        fontWeight={700}
      />

      {/* Peripheral Stakeholder Nodes */}
      {stakeholders.map((actor, i) => {
        const angle = (i * 2 * Math.PI) / numActors - Math.PI / 2;
        const targetX = centerX + orbitX * Math.cos(angle);
        const targetY = centerY + orbitY * Math.sin(angle);

        const nodeW = renderMode === 'exam' ? 130 : 150;
        const nodeH = renderMode === 'exam' ? 34 : 42;
        const actorName = typeof actor === 'string' ? actor : (actor.name || actor.label || `Actor ${i + 1}`);
        const actorRole = typeof actor === 'object' ? actor.role : null;
        const isMasked = renderMode === 'recall' && !revealed[i];

        return (
          <ExamNode
            key={`actor-${i}`}
            x={targetX - nodeW / 2}
            y={targetY - nodeH / 2}
            width={nodeW}
            height={nodeH}
            rx={6}
            label={actorName}
            sublabel={actorRole}
            isMasked={isMasked}
            renderMode={renderMode}
            fill="#FFFFFF"
            stroke="#D97706"
            textColor="#0F172A"
            badge={`S${i + 1}`}
            badgeFill="#D97706"
            onClick={() => {
              if (renderMode === 'recall') toggleReveal(i);
              if (onNodeClick) onNodeClick(actor, i);
            }}
          />
        );
      })}
    </svg>
  );
}
