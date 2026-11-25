/**
 * src/components/visualStudio/renderers/ProcessDiagramRenderer.jsx
 *
 * Visual Grammar: PROCESS / MECHANISM DIAGRAM (Phase 2D.1)
 * Communicates technical, economic, and institutional transformation mechanisms.
 * Multi-stream geometry: Inputs Converge -> Transformation Stages & Byproduct Splits -> Diverse Outputs & Feedback Loops.
 */

import React, { useState } from 'react';
import { ExamNode, ExamArrow, ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function ProcessDiagramRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealed, setRevealed] = useState({});

  const title = schema.title || 'Process Mechanism Architecture';
  const inputs = Array.isArray(schema.inputs) && schema.inputs.length > 0
    ? schema.inputs
    : [
        { label: 'Renewable Power', subtext: 'Solar & Wind Generation' },
        { label: 'De-mineralised Water', subtext: 'Electrolyte Medium' }
      ];

  const stages = Array.isArray(schema.stages) && schema.stages.length > 0
    ? schema.stages
    : [
        {
          name: 'Electrolysis Conversion',
          mechanism: 'PEM / Alkaline Cell Split',
          byproducts: [{ label: 'Green Oxygen (O2)', type: 'byproduct' }]
        },
        {
          name: 'Purification & Compression',
          mechanism: 'Moisture Stripping & 350-700 bar Storage',
          byproducts: []
        }
      ];

  const outputs = Array.isArray(schema.outputs) && schema.outputs.length > 0
    ? schema.outputs
    : [
        { label: 'Hard-to-Abate Industry', subtext: 'Green Steel & Refineries' },
        { label: 'Agriculture & Chemicals', subtext: 'Green Ammonia & Urea' },
        { label: 'Long-Haul Transport', subtext: 'Heavy Mobility & Fuel Cells' }
      ];

  const feedback = Array.isArray(schema.feedback) && schema.feedback.length > 0
    ? schema.feedback
    : [{ label: 'Grid Balancing & Peak Power via Fuel Cells', from: 'Storage', to: 'Input Grid' }];

  const width = 640;
  const height = 400;

  function toggleReveal(id) {
    setRevealed(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const isMasked = (id) => renderMode === 'recall' && !revealed[id];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#FFFFFF' }}>
      <ExamDefs />

      {/* Header Banner */}
      <text x={320} y={22} textAnchor="middle" fill="#0F172A" fontSize={12} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
        {title.toUpperCase()}
      </text>

      {/* ── 1. COLUMN SECTION HEADERS (Learn Mode) ── */}
      {renderMode === 'learn' && (
        <g>
          <text x={75} y={42} textAnchor="middle" fill="#0284C7" fontSize={10} fontWeight={700} letterSpacing="0.05em">
            PRIMARY INPUTS
          </text>
          <text x={260} y={42} textAnchor="middle" fill="#0A64F5" fontSize={10} fontWeight={700} letterSpacing="0.05em">
            CONVERSION CORE
          </text>
          <text x={430} y={42} textAnchor="middle" fill="#059669" fontSize={10} fontWeight={700} letterSpacing="0.05em">
            LOGISTICS & VECTOR
          </text>
          <text x={565} y={42} textAnchor="middle" fill="#7C3AED" fontSize={10} fontWeight={700} letterSpacing="0.05em">
            END-USE MARKETS
          </text>
        </g>
      )}

      {/* ── 2. INPUT STREAMS (Left) ── */}
      {inputs.map((inp, idx) => {
        const y = 80 + idx * 80;
        const id = `input-${idx}`;
        const label = typeof inp === 'string' ? inp : inp.label;
        const sub = typeof inp === 'object' ? inp.subtext : '';

        return (
          <g key={id} onClick={() => onNodeClick?.(inp)}>
            <ExamNode
              x={15}
              y={y}
              width={120}
              height={48}
              title={label}
              subtitle={renderMode === 'learn' ? sub : ''}
              fill="#F0F9FF"
              stroke="#0284C7"
              textColor="#0369A1"
              isMasked={isMasked(id)}
              onToggleMask={() => toggleReveal(id)}
              renderMode={renderMode}
            />
            {/* Connector into Conversion Core */}
            <ExamArrow
              startX={135}
              startY={y + 24}
              endX={190}
              endY={130}
              stroke="#0284C7"
              strokeWidth={2}
            />
          </g>
        );
      })}

      {/* ── 3. CONVERSION CORE / TRANSFORMATION (Center-Left) ── */}
      <g onClick={() => onNodeClick?.(stages[0])}>
        <ExamNode
          x={190}
          y={95}
          width={140}
          height={70}
          title={typeof stages[0] === 'string' ? stages[0] : (stages[0]?.name || 'Conversion Stage')}
          subtitle={renderMode === 'learn' ? (stages[0]?.mechanism || '') : ''}
          fill="#EFF6FF"
          stroke="#2563EB"
          textColor="#1D4ED8"
          isMasked={isMasked('stage-0')}
          onToggleMask={() => toggleReveal('stage-0')}
          renderMode={renderMode}
        />
      </g>

      {/* Byproduct Split (Upper Branch) */}
      <ExamArrow
        startX={260}
        startY={95}
        endX={260}
        endY={65}
        stroke="#059669"
        strokeWidth={1.5}
      />
      <rect x={205} y={48} width={110} height={20} rx={4} fill="#ECFDF5" stroke="#059669" strokeWidth={1} />
      <text x={260} y={62} textAnchor="middle" fill="#065F46" fontSize={8.5} fontWeight={700}>
        {isMasked('byproduct-0') ? '???' : 'Byproduct: O2 Stream'}
      </text>

      {/* Main Stream Connector into Transport / Second Stage */}
      <ExamArrow
        startX={330}
        startY={130}
        endX={375}
        endY={130}
        stroke="#2563EB"
        strokeWidth={2.5}
      />

      {/* ── 4. VECTOR / INTERMEDIATE STORAGE (Center-Right) ── */}
      <g onClick={() => onNodeClick?.(stages[1] || {})}>
        <ExamNode
          x={375}
          y={105}
          width={110}
          height={52}
          title={stages[1]?.name || 'H2 Vector'}
          subtitle={renderMode === 'learn' ? (stages[1]?.mechanism || 'Storage & Grid') : ''}
          fill="#F5F3FF"
          stroke="#7C3AED"
          textColor="#5B21B6"
          isMasked={isMasked('stage-1')}
          onToggleMask={() => toggleReveal('stage-1')}
          renderMode={renderMode}
        />
      </g>

      {/* ── 5. DISPERSED OUTPUTS (Right) ── */}
      {outputs.map((out, idx) => {
        const y = 65 + idx * 72;
        const id = `output-${idx}`;
        const label = typeof out === 'string' ? out : out.label;
        const sub = typeof out === 'object' ? out.subtext : '';

        return (
          <g key={id} onClick={() => onNodeClick?.(out)}>
            {/* Fan-out Connector from Vector Storage */}
            <ExamArrow
              startX={485}
              startY={130}
              endX={515}
              endY={y + 22}
              stroke="#7C3AED"
              strokeWidth={1.8}
            />

            <ExamNode
              x={515}
              y={y}
              width={115}
              height={44}
              title={label}
              subtitle={renderMode === 'learn' ? sub : ''}
              fill="#FAF5FF"
              stroke="#9333EA"
              textColor="#6B21A8"
              isMasked={isMasked(id)}
              onToggleMask={() => toggleReveal(id)}
              renderMode={renderMode}
            />
          </g>
        );
      })}

      {/* ── 6. BOTTOM FEEDBACK / RE-ELECTRIFICATION LOOP ── */}
      {feedback.map((fb, idx) => {
        const label = typeof fb === 'string' ? fb : fb.label;
        return (
          <g key={`feedback-${idx}`}>
            {/* Feedback Return Path: Storage (430, 160) -> Down (290) -> Left (80) -> Inputs (80, 210) */}
            <path
              d="M 430 160 L 430 310 L 75 310 L 75 215"
              fill="none"
              stroke="#D97706"
              strokeWidth={2}
              strokeDasharray="6 4"
              markerEnd="url(#grammarArrowAmber)"
            />
            {/* Feedback Badge */}
            <rect x={150} y={298} width={260} height={24} rx={4} fill="#FEF3C7" stroke="#F59E0B" strokeWidth={1} />
            <text x={280} y={314} textAnchor="middle" fill="#92400E" fontSize={9.5} fontWeight={700}>
              {isMasked('feedback') ? '???' : `FEEDBACK: ${label}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
