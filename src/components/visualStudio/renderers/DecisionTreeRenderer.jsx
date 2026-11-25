/**
 * src/components/visualStudio/renderers/DecisionTreeRenderer.jsx
 *
 * Visual Grammar: DECISION TREE (Branching Dilemma & Consequence Pathways)
 * Root Dilemma -> 2-3 Action Options -> Downstream Consequences & Ethical Verdict.
 * Perfect for: GS4 Ethics Case Studies, Strategic Policy Trade-offs, Governance Dilemmas.
 */

import React, { useState } from 'react';
import { ExamNode, ExamArrow, ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function DecisionTreeRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealed, setRevealed] = useState({});

  const rootQuestion = schema.root || schema.dilemma || schema.title || 'Ethical Dilemma: Decision Point';
  const rawBranches = schema.branches || schema.options || [
    {
      option: 'Option A: Stay Silent',
      consequence: 'Short-term loyalty, long-term moral injury & public harm',
      verdict: 'Unethical / Collusion',
      verdictType: 'negative'
    },
    {
      option: 'Option B: External Leak',
      consequence: 'Breaches official secrecy without procedural remediation',
      verdict: 'Procedural Violation',
      verdictType: 'warning'
    },
    {
      option: 'Option C: Whistleblower Act',
      consequence: 'Exposes illegality through formal statutory safeguards',
      verdict: 'Ethical & Legal Balance',
      verdictType: 'positive'
    }
  ];

  const branches = renderMode === 'exam' ? rawBranches.slice(0, 3) : rawBranches;
  const numBranches = branches.length;

  const width = 640;
  const height = 400;
  const rootX = 200;
  const rootY = 20;
  const rootW = 240;
  const rootH = 46;

  function toggleReveal(i) {
    setRevealed(prev => ({ ...prev, [i]: !prev[i] }));
  }

  const stepX = width / numBranches;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#FFFFFF' }}>
      <ExamDefs />

      {/* Root Node */}
      <ExamNode
        x={rootX}
        y={rootY}
        width={rootW}
        height={rootH}
        rx={8}
        label={rootQuestion}
        renderMode={renderMode}
        fill="#EEF2FF"
        stroke="#4338CA"
        textColor="#1E1B4B"
        fontSize={12}
        fontWeight={700}
        badge="?"
        badgeFill="#4338CA"
      />

      {/* Branching Options & Consequences */}
      {branches.map((b, i) => {
        const branchCenterX = stepX * i + stepX / 2;
        const optW = 180;
        const optX = branchCenterX - optW / 2;
        const optY = 120;
        const optH = 42;

        const consY = 220;
        const consH = 54;

        const verdY = 325;
        const verdH = 38;

        const isPositive = b.verdictType === 'positive';
        const isNegative = b.verdictType === 'negative';
        const strokeColor = isPositive ? '#059669' : (isNegative ? '#E11D48' : '#D97706');
        const fillColor = isPositive ? '#ECFDF5' : (isNegative ? '#FFF1F2' : '#FEF3C7');
        const textColor = isPositive ? '#065F46' : (isNegative ? '#881337' : '#78350F');

        const isMasked = renderMode === 'recall' && !revealed[i];

        return (
          <g key={`branch-${i}`}>
            {/* Root -> Option Line */}
            <ExamArrow
              x1={rootX + rootW / 2}
              y1={rootY + rootH}
              x2={branchCenterX}
              y2={optY}
              stroke="#64748B"
              strokeWidth={1.5}
            />

            {/* Option Node */}
            <ExamNode
              x={optX}
              y={optY}
              width={optW}
              height={optH}
              rx={6}
              label={b.option}
              renderMode={renderMode}
              fill="#FFFFFF"
              stroke="#0A64F5"
              textColor="#0F172A"
              badge={`O${i + 1}`}
              badgeFill="#0A64F5"
            />

            {/* Option -> Consequence Line */}
            <ExamArrow
              x1={branchCenterX}
              y1={optY + optH}
              x2={branchCenterX}
              y2={consY}
              stroke="#94A3B8"
              strokeWidth={1.5}
            />

            {/* Consequence Node */}
            <ExamNode
              x={optX}
              y={consY}
              width={optW}
              height={consH}
              rx={6}
              label={b.consequence}
              isMasked={isMasked}
              renderMode={renderMode}
              fill="#F8FAFC"
              stroke="#94A3B8"
              fontSize={10}
              onClick={() => {
                if (renderMode === 'recall') toggleReveal(i);
                if (onNodeClick) onNodeClick(b, i);
              }}
            />

            {/* Consequence -> Verdict Line */}
            <ExamArrow
              x1={branchCenterX}
              y1={consY + consH}
              x2={branchCenterX}
              y2={verdY}
              stroke={strokeColor}
              strokeWidth={1.75}
            />

            {/* Verdict Node */}
            <ExamNode
              x={optX}
              y={verdY}
              width={optW}
              height={verdH}
              rx={6}
              label={b.verdict}
              renderMode={renderMode}
              fill={fillColor}
              stroke={strokeColor}
              textColor={textColor}
              fontSize={11}
              fontWeight={700}
            />
          </g>
        );
      })}
    </svg>
  );
}
