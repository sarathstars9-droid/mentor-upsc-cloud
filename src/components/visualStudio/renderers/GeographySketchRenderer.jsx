/**
 * src/components/visualStudio/renderers/GeographySketchRenderer.jsx
 *
 * Visual Grammar: GEOGRAPHY / PROCESS DIAGRAM (Physical & Atmospheric Spatial Mechanism)
 * Communicates spatial and atmospheric processes (e.g. El Niño Walker Cell, Monsoon circulation).
 * Uses real spatial regions, atmospheric circulation loops, convection cells, and ocean isotherms.
 */

import React, { useState } from 'react';
import { ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function GeographySketchRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealed, setRevealed] = useState({});

  const title = schema.title || 'El Niño Southern Oscillation (ENSO) & Indian Monsoon Mechanism';
  const process = schema.process || 'El Niño (Warm Phase)';

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
      <text x={320} y={24} textAnchor="middle" fill="#0F172A" fontSize={12} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
        {title.toUpperCase()}
      </text>

      {/* ── 1. PACIFIC OCEAN BASIN & LANDMASS REGIONS ── */}
      {/* West Pacific / Indo-Australian Region (Left) */}
      <rect x={40} y={260} width={130} height={100} rx={6} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={1.5} />
      <text x={105} y={285} textAnchor="middle" fill="#334155" fontSize={11} fontWeight={700}>
        INDONESIA / INDIA
      </text>
      <text x={105} y={305} textAnchor="middle" fill="#64748B" fontSize={9.5} fontWeight={500}>
        (Western Pacific Basin)
      </text>
      <rect x={55} y={320} width={100} height={26} rx={4} fill="#FFF1F2" stroke="#E11D48" strokeWidth={1} />
      <text x={105} y={337} textAnchor="middle" fill="#881337" fontSize={9.5} fontWeight={700}>
        {isMasked('high-pressure') ? '???' : 'High Pressure (Drought)'}
      </text>

      {/* Central / Eastern Pacific Ocean (Center & Right) */}
      <rect x={180} y={270} width={300} height={90} rx={4} fill="#E0F2FE" stroke="#0284C7" strokeWidth={1.5} />
      <text x={330} y={295} textAnchor="middle" fill="#0369A1" fontSize={11} fontWeight={700}>
        CENTRAL & EASTERN PACIFIC OCEAN
      </text>
      {/* Thermocline / Warm Pool */}
      <path d="M 180 340 Q 330 310 480 345 L 480 360 L 180 360 Z" fill="#FDE68A" opacity="0.6" />
      <text x={330} y={345} textAnchor="middle" fill="#92400E" fontSize={9.5} fontWeight={700}>
        {isMasked('warm-pool') ? '???' : 'Displaced Warm Water Pool (Thermocline Deepens)'}
      </text>

      {/* South American Coast / Peru (Right) */}
      <rect x={490} y={260} width={110} height={100} rx={6} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={1.5} />
      <text x={545} y={285} textAnchor="middle" fill="#334155" fontSize={11} fontWeight={700}>
        PERU COAST
      </text>
      <text x={545} y={305} textAnchor="middle" fill="#64748B" fontSize={9.5} fontWeight={500}>
        (Eastern Pacific)
      </text>
      <rect x={500} y={320} width={90} height={26} rx={4} fill="#ECFDF5" stroke="#059669" strokeWidth={1} />
      <text x={545} y={337} textAnchor="middle" fill="#065F46" fontSize={9.5} fontWeight={700}>
        {isMasked('low-pressure') ? '???' : 'Low Pressure'}
      </text>

      {/* ── 2. ATMOSPHERIC WALKER CIRCULATION CELL (REVERSED) ── */}
      {/* Rising Air over East Pacific (Convection) */}
      <line x1={545} y1={255} x2={545} y2={100} stroke="#E11D48" strokeWidth={2.5} markerEnd="url(#grammarArrowRose)" />
      <text x={570} y={180} fill="#BE123C" fontSize={9.5} fontWeight={700}>
        {isMasked('convection') ? '???' : 'Rising Warm Air (Convection)'}
      </text>

      {/* Upper Atmospheric Flow eastward to west */}
      <line x1={530} y1={90} x2={120} y2={90} stroke="#0A64F5" strokeWidth={2.5} markerEnd="url(#grammarArrowBlue)" />
      <text x={330} y={80} textAnchor="middle" fill="#1D4ED8" fontSize={10} fontWeight={700}>
        Upper Tropospheric Wind (Weakened / Reversed Walker Cell)
      </text>

      {/* Sinking Air over Indonesia / India (Subsidence) */}
      <line x1={105} y1={100} x2={105} y2={255} stroke="#0A64F5" strokeWidth={2.5} markerEnd="url(#grammarArrowBlue)" />
      <text x={70} y={180} textAnchor="end" fill="#1E40AF" fontSize={9.5} fontWeight={700}>
        {isMasked('subsidence') ? '???' : 'Descending Air (Subsidence)'}
      </text>

      {/* Weakened Surface Trade Winds */}
      <line x1={180} y1={240} x2={470} y2={240} stroke="#D97706" strokeWidth={2} strokeDasharray="5 3" markerEnd="url(#grammarArrowAmber)" />
      <text x={325} y={232} textAnchor="middle" fill="#B45309" fontSize={9.5} fontWeight={600}>
        Weakened / Reversed Easterly Trade Winds → El Niño
      </text>

      {/* ── 3. TELECONNECTION IMPACT BOX ── */}
      <rect x={40} y={370} width={560} height={24} rx={4} fill="#FEF3C7" stroke="#F59E0B" strokeWidth={1} />
      <text x={320} y={386} textAnchor="middle" fill="#78350F" fontSize={9.5} fontWeight={700}>
        IMPACT ON MONSOON: Subsidence over Indian Ocean suppresses monsoon trough formation → High Probability of Deficit / Erratic Monsoon
      </text>
    </svg>
  );
}
