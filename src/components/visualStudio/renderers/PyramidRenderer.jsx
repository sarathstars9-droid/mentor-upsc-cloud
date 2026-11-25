/**
 * src/components/visualStudio/renderers/PyramidRenderer.jsx
 *
 * Visual Grammar: PYRAMID (Hierarchical Tiered Structure)
 * Trapezoidal tiered layers from broad base to apex.
 * Perfect for: Governance Hierarchy, Maslow Needs, Jurisdiction Tiers, Data-to-Wisdom.
 */

import React, { useState } from 'react';
import { ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function PyramidRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealed, setRevealed] = useState({});

  const title = schema.title || 'Hierarchical Governance Pyramid';
  const rawLayers = schema.layers || schema.nodes || [
    { title: 'Apex: Supreme Court / Union Cabinet', desc: 'Constitutional interpretation & ultimate policy' },
    { title: 'Tier 2: High Courts & State Secretariats', desc: 'State-level adjudication & execution' },
    { title: 'Tier 3: District Administration (DM / SP)', desc: 'Field coordination & law enforcement' },
    { title: 'Base: Gram Panchayats & Ward Committees', desc: 'Grassroots participatory democracy' }
  ];

  const layers = renderMode === 'exam' ? rawLayers.slice(0, 4) : rawLayers;
  const numLayers = layers.length;

  const width = 640;
  const height = 380;
  const topY = 50;
  const bottomY = 340;
  const totalH = bottomY - topY;
  const layerH = totalH / numLayers;

  const topWidth = 120;
  const bottomWidth = 520;
  const centerX = width / 2;

  function toggleReveal(i) {
    setRevealed(prev => ({ ...prev, [i]: !prev[i] }));
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#FFFFFF' }}>
      <ExamDefs />

      <text x={centerX} y={26} textAnchor="middle" fill="#0F172A" fontSize={12} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
        ▲ {title.toUpperCase()}
      </text>

      {layers.map((layer, i) => {
        const y1 = topY + i * layerH;
        const y2 = y1 + layerH - 4;

        const fractionTop = i / numLayers;
        const fractionBottom = (i + 1) / numLayers;

        const wTop = topWidth + fractionTop * (bottomWidth - topWidth);
        const wBottom = topWidth + fractionBottom * (bottomWidth - topWidth);

        const xTopLeft = centerX - wTop / 2;
        const xTopRight = centerX + wTop / 2;
        const xBottomLeft = centerX - wBottom / 2;
        const xBottomRight = centerX + wBottom / 2;

        const pathD = `M ${xTopLeft} ${y1} L ${xTopRight} ${y1} L ${xBottomRight} ${y2} L ${xBottomLeft} ${y2} Z`;

        const isApex = i === 0;
        const fill = isApex ? '#EEF2FF' : (i % 2 === 1 ? '#F8FAFC' : '#FFFFFF');
        const stroke = isApex ? '#4338CA' : '#0A64F5';

        const titleText = typeof layer === 'string' ? layer : (layer.title || layer.name || `Tier ${i + 1}`);
        const descText = typeof layer === 'object' ? layer.desc : null;
        const isMasked = renderMode === 'recall' && !revealed[i];

        return (
          <g
            key={`pyramid-layer-${i}`}
            onClick={() => {
              if (renderMode === 'recall') toggleReveal(i);
              if (onNodeClick) onNodeClick(layer, i);
            }}
            style={{ cursor: renderMode === 'recall' ? 'pointer' : 'default' }}
          >
            <path
              d={pathD}
              fill={isMasked ? '#F1F5F9' : fill}
              stroke={isMasked ? '#94A3B8' : stroke}
              strokeWidth={isApex ? 2.5 : 1.75}
              strokeDasharray={isMasked ? '4 3' : 'none'}
            />
            <text
              x={centerX}
              y={(y1 + y2) / 2 + (descText && renderMode === 'learn' ? -3 : 4)}
              textAnchor="middle"
              fill={isMasked ? '#94A3B8' : '#0F172A'}
              fontSize={isApex ? 11.5 : 11}
              fontWeight={700}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {isMasked ? '???' : titleText}
            </text>
            {descText && !isMasked && renderMode === 'learn' && (
              <text
                x={centerX}
                y={(y1 + y2) / 2 + 12}
                textAnchor="middle"
                fill="#64748B"
                fontSize={9.5}
                fontWeight={500}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {descText}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
