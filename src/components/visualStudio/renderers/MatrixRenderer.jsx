/**
 * src/components/visualStudio/renderers/MatrixRenderer.jsx
 *
 * Visual Grammar: MATRIX (Multi-Criteria Comparative Grid)
 * 2x2 or 3x3 comparative framework comparing dimensions against criteria.
 * Perfect for: Constitutional Comparison, Federal vs Unitary, Fiscal Policy Trade-offs.
 */

import React, { useState } from 'react';
import { ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function MatrixRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealed, setRevealed] = useState({});

  const title = schema.title || 'Comparative Matrix Framework';
  const columns = schema.columns || ['Dimension', 'Model A (Centralised)', 'Model B (Cooperative)'];
  const rows = schema.rows || [
    { label: 'Taxation Powers', col1: 'Union Monopoly (Surcharge/Cess)', col2: 'GST Council Equal Consensus' },
    { label: 'Disaster Relief', col1: 'Top-down SDRF / NDRF approvals', col2: 'Pre-allocated devolution formula' },
    { label: 'Local Autonomy', col1: 'Executive state discretion', col2: 'Mandatory State Finance Comm.' }
  ];

  const width = 640;
  const height = 360;

  function toggleReveal(i, j) {
    const key = `${i}-${j}`;
    setRevealed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const startX = 30;
  const startY = 50;
  const colW = (width - 60) / columns.length;
  const rowH = (height - 80) / (rows.length + 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#FFFFFF' }}>
      <ExamDefs />

      <text x={width / 2} y={26} textAnchor="middle" fill="#0F172A" fontSize={12} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
        ▦ {title.toUpperCase()}
      </text>

      {/* Column Headers */}
      {columns.map((col, c) => (
        <g key={`col-header-${c}`}>
          <rect
            x={startX + c * colW}
            y={startY}
            width={colW}
            height={rowH}
            fill="#EEF2FF"
            stroke="#C7D2FE"
            strokeWidth={1.5}
          />
          <text
            x={startX + c * colW + colW / 2}
            y={startY + rowH / 2 + 4}
            textAnchor="middle"
            fill="#312E81"
            fontSize={11}
            fontWeight={700}
            fontFamily="Inter, system-ui, sans-serif"
          >
            {col}
          </text>
        </g>
      ))}

      {/* Matrix Body Rows */}
      {rows.map((row, r) => {
        const y = startY + (r + 1) * rowH;
        const cells = [row.label, row.col1, row.col2];

        return (
          <g key={`row-${r}`}>
            {cells.map((cellText, c) => {
              const x = startX + c * colW;
              const isLabelCol = c === 0;
              const isMasked = renderMode === 'recall' && !isLabelCol && !revealed[`${r}-${c}`];

              return (
                <g
                  key={`cell-${r}-${c}`}
                  onClick={() => {
                    if (renderMode === 'recall' && !isLabelCol) toggleReveal(r, c);
                    if (onNodeClick) onNodeClick(cellText, r, c);
                  }}
                  style={{ cursor: renderMode === 'recall' && !isLabelCol ? 'pointer' : 'default' }}
                >
                  <rect
                    x={x}
                    y={y}
                    width={colW}
                    height={rowH}
                    fill={isLabelCol ? '#F8FAFC' : (isMasked ? '#F1F5F9' : '#FFFFFF')}
                    stroke="#E2E8F0"
                    strokeWidth={1}
                  />
                  <text
                    x={x + colW / 2}
                    y={y + rowH / 2 + 4}
                    textAnchor="middle"
                    fill={isMasked ? '#94A3B8' : (isLabelCol ? '#0F172A' : '#334155')}
                    fontSize={isLabelCol ? 10.5 : 10}
                    fontWeight={isLabelCol ? 700 : 500}
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    {isMasked ? '???' : cellText}
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
