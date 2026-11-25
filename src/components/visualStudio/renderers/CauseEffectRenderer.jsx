/**
 * src/components/visualStudio/renderers/CauseEffectRenderer.jsx
 *
 * Visual Grammar: CAUSE & EFFECT (Tripartite Diagnostic Flow)
 * Left column: 2-3 Causes
 * Center: Core Central Issue Box
 * Right column: 2-3 Impact / Consequences
 * Bottom: Policy Response / Blue-Green Solution
 */

import React, { useState } from 'react';
import { ExamNode, ExamArrow, ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function CauseEffectRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealed, setRevealed] = useState({});

  const causes = schema.causes || schema.drivers || ['Heavy Precipitation', 'Encroached Wetlands', 'Inadequate Drains'];
  const issue = schema.issue || schema.centralProblem || schema.title || 'URBAN FLOODING';
  const effects = schema.effects || schema.impacts || ['Economic Disruption', 'Waterborne Disease', 'Traffic Paralysis'];
  const responses = schema.responses || schema.solutions || ['Sponge Cities & NDMA Drainage Masterplan'];

  const width = 640;
  const height = 380;

  function toggleReveal(id) {
    setRevealed(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Left Causes: x = 20, width = 160
  // Center Issue: x = 240, width = 160, y = 110, height = 54
  // Right Effects: x = 460, width = 160
  // Bottom Response: x = 200, width = 240, y = 290, height = 44

  const causeNodes = causes.slice(0, 3);
  const effectNodes = effects.slice(0, 3);
  const responseText = Array.isArray(responses) ? responses.join(' • ') : responses;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#FFFFFF' }}>
      <ExamDefs />

      {/* Column Section Headers in Learn Mode */}
      {renderMode === 'learn' && (
        <g>
          <text x={100} y={24} textAnchor="middle" fill="#64748B" fontSize={11} fontWeight={700} letterSpacing="0.05em">
            ROOT CAUSES
          </text>
          <text x={320} y={24} textAnchor="middle" fill="#0A64F5" fontSize={11} fontWeight={700} letterSpacing="0.05em">
            CENTRAL CRISIS
          </text>
          <text x={540} y={24} textAnchor="middle" fill="#E11D48" fontSize={11} fontWeight={700} letterSpacing="0.05em">
            CONSEQUENCES
          </text>
        </g>
      )}

      {/* Cause Connectors -> Center Issue */}
      {causeNodes.map((_, i) => {
        const startY = 50 + i * 65 + 18;
        const targetY = 137;
        return (
          <ExamArrow
            key={`cause-arrow-${i}`}
            x1={180}
            y1={startY}
            x2={240}
            y2={targetY}
            stroke="#0A64F5"
            strokeWidth={1.75}
          />
        );
      })}

      {/* Center Issue Connectors -> Effects */}
      {effectNodes.map((_, i) => {
        const targetY = 50 + i * 65 + 18;
        const startY = 137;
        return (
          <ExamArrow
            key={`effect-arrow-${i}`}
            x1={400}
            y1={startY}
            x2={460}
            y2={targetY}
            stroke="#E11D48"
            strokeWidth={1.75}
            markerEnd="url(#grammarArrowRose)"
          />
        );
      })}

      {/* Center Issue -> Bottom Solution Connector */}
      <ExamArrow
        x1={320}
        y1={164}
        x2={320}
        y2={290}
        stroke="#059669"
        strokeWidth={2}
        markerEnd="url(#grammarArrowEmerald)"
        label={renderMode === 'learn' ? 'Mitigation / Strategy' : null}
      />

      {/* Left Cause Nodes */}
      {causeNodes.map((cause, i) => {
        const text = typeof cause === 'string' ? cause : (cause.label || cause.text || `Cause ${i + 1}`);
        const isMasked = renderMode === 'recall' && !revealed[`cause-${i}`];
        return (
          <ExamNode
            key={`cause-${i}`}
            x={20}
            y={50 + i * 65}
            width={160}
            height={36}
            rx={6}
            label={text}
            isMasked={isMasked}
            renderMode={renderMode}
            fill="#F8FAFC"
            stroke="#0A64F5"
            textColor="#0F172A"
            badge={`C${i + 1}`}
            badgeFill="#0A64F5"
            onClick={() => {
              if (renderMode === 'recall') toggleReveal(`cause-${i}`);
              if (onNodeClick) onNodeClick(cause, i);
            }}
          />
        );
      })}

      {/* Central Crisis Box */}
      <ExamNode
        x={240}
        y={110}
        width={160}
        height={54}
        rx={8}
        label={issue}
        renderMode={renderMode}
        fill="#EFF6FF"
        stroke="#1D4ED8"
        textColor="#1E3A8A"
        fontSize={13}
        fontWeight={700}
        isHighlighted={true}
      />

      {/* Right Effect Nodes */}
      {effectNodes.map((effect, i) => {
        const text = typeof effect === 'string' ? effect : (effect.label || effect.text || `Effect ${i + 1}`);
        const isMasked = renderMode === 'recall' && !revealed[`effect-${i}`];
        return (
          <ExamNode
            key={`effect-${i}`}
            x={460}
            y={50 + i * 65}
            width={160}
            height={36}
            rx={6}
            label={text}
            isMasked={isMasked}
            renderMode={renderMode}
            fill="#FFF1F2"
            stroke="#E11D48"
            textColor="#881337"
            badge={`E${i + 1}`}
            badgeFill="#E11D48"
            onClick={() => {
              if (renderMode === 'recall') toggleReveal(`effect-${i}`);
              if (onNodeClick) onNodeClick(effect, i);
            }}
          />
        );
      })}

      {/* Bottom Solution Node */}
      <ExamNode
        x={180}
        y={290}
        width={280}
        height={46}
        rx={8}
        label={responseText}
        sublabel={renderMode === 'learn' ? 'Resilience & Policy Recommendation' : null}
        renderMode={renderMode}
        fill="#ECFDF5"
        stroke="#059669"
        textColor="#065F46"
        badge="✓"
        badgeFill="#059669"
        fontSize={12}
        fontWeight={700}
      />
    </svg>
  );
}
