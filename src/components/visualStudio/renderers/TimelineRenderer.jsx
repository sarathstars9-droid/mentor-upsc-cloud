/**
 * src/components/visualStudio/renderers/TimelineRenderer.jsx
 *
 * Visual Grammar: TIMELINE (Chronological Milestone Sequence)
 * Continuous horizontal timeline axis with alternating milestone cards above and below.
 * Perfect for: Constitutional Evolution, Historical Acts, Treaties, Policy Milestones.
 */

import React, { useState } from 'react';
import { ExamNode, ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function TimelineRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealed, setRevealed] = useState({});

  const rawEvents = schema.events || schema.milestones || schema.nodes || [
    { year: '1773', title: 'Regulating Act', desc: 'Governor General of Bengal' },
    { year: '1858', title: 'Govt of India Act', desc: 'Crown Rule & Viceroy' },
    { year: '1909', title: 'Morley-Minto Reforms', desc: 'Separate Electorates' },
    { year: '1919', title: 'Montagu-Chelmsford', desc: 'Dyarchy in Provinces' },
    { year: '1935', title: 'GoI Act 1935', desc: 'Provincial Autonomy' }
  ];

  const events = renderMode === 'exam' ? rawEvents.slice(0, 5) : rawEvents;
  const numEvents = events.length;

  const width = 640;
  const height = 360;
  const axisY = height / 2;
  const startX = 60;
  const endX = width - 60;
  const stepX = numEvents > 1 ? (endX - startX) / (numEvents - 1) : 0;

  function toggleReveal(i) {
    setRevealed(prev => ({ ...prev, [i]: !prev[i] }));
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#FFFFFF' }}>
      <ExamDefs />

      {/* Main Continuous Horizontal Timeline Axis */}
      <line
        x1={startX - 20}
        y1={axisY}
        x2={endX + 30}
        y2={axisY}
        stroke="#0A64F5"
        strokeWidth={3}
        markerEnd="url(#grammarArrowBlue)"
      />

      {/* Milestone Points and Alternating Cards */}
      {events.map((evt, i) => {
        const x = startX + i * stepX;
        const isTop = i % 2 === 0;
        const cardY = isTop ? axisY - 110 : axisY + 40;
        const tickY = isTop ? axisY - 30 : axisY + 30;

        const year = typeof evt === 'object' ? (evt.year || evt.date || `T${i + 1}`) : `T${i + 1}`;
        const title = typeof evt === 'object' ? (evt.title || evt.label || '') : String(evt);
        const desc = typeof evt === 'object' ? evt.desc : null;
        const isMasked = renderMode === 'recall' && !revealed[i];

        return (
          <g key={`timeline-item-${i}`}>
            {/* Tick Connector line from Axis to Card */}
            <line
              x1={x}
              y1={axisY}
              x2={x}
              y2={isTop ? cardY + 54 : cardY}
              stroke="#94A3B8"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />

            {/* Axis Node Circle */}
            <circle
              cx={x}
              cy={axisY}
              r={7}
              fill="#FFFFFF"
              stroke="#0A64F5"
              strokeWidth={2.5}
            />

            {/* Date / Year Pill on Axis */}
            <rect
              x={x - 26}
              y={axisY - 10}
              width={52}
              height={20}
              rx={10}
              fill="#0A64F5"
            />
            <text
              x={x}
              y={axisY + 3.5}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize={10}
              fontWeight={700}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {isMasked ? '???' : year}
            </text>

            {/* Event Description Card */}
            <ExamNode
              x={x - 65}
              y={cardY}
              width={130}
              height={54}
              rx={6}
              label={title}
              sublabel={desc}
              isMasked={isMasked}
              renderMode={renderMode}
              fill="#F8FAFC"
              stroke="#0A64F5"
              fontSize={11}
              onClick={() => {
                if (renderMode === 'recall') toggleReveal(i);
                if (onNodeClick) onNodeClick(evt, i);
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
