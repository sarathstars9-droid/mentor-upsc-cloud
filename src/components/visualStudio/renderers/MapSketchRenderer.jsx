/**
 * src/components/visualStudio/renderers/MapSketchRenderer.jsx
 *
 * Visual Grammar: MAP SKETCH (Spatial Hotspot & Exam Outline Geometry)
 * Hand-drawable recognizable geographical outline with annotated points, zones, and arrows.
 * Supported Outlines: 'india' | 'andhra_pradesh' | 'world'
 */

import React, { useState } from 'react';
import { ExamDefs } from '../primitives/ExamPrimitives.jsx';

export function MapSketchRenderer({
  schema = {},
  renderMode = 'learn', // 'learn' | 'exam' | 'recall'
  onNodeClick = null
}) {
  const [revealed, setRevealed] = useState({});

  const region = schema.region || 'india';
  const title = schema.title || 'India: Vulnerability & Urban Flood Hotspots Map';
  const hotspots = schema.hotspots || [
    { name: 'Mumbai', desc: 'Mithi River basin encroachment & high tide drainage lock', x: 140, y: 220 },
    { name: 'Chennai', desc: 'Cooum/Adyar floodplain concretisation & Pallikaranai wetland loss', x: 230, y: 285 },
    { name: 'Bengaluru', desc: 'Encroached Rajakaluve stormwater drains & interconnecting lakes', x: 200, y: 265 },
    { name: 'Kolkata', desc: 'East Kolkata Wetlands reclamation & tidal siltation', x: 380, y: 170 },
    { name: 'Delhi', desc: 'Yamuna floodplain encroachments & obsolete stormwater drains', x: 195, y: 110 }
  ];

  const width = 640;
  const height = 400;

  function toggleReveal(id) {
    setRevealed(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Simplified recognizable pen-drawable India SVG outline
  const indiaOutline = `
    M 170 30 
    C 195 20, 230 40, 245 70 
    C 260 90, 290 85, 330 95 
    C 380 90, 420 120, 470 125 
    C 490 140, 480 170, 440 170 
    C 410 180, 390 195, 370 205 
    C 350 220, 330 250, 300 280 
    C 270 310, 240 350, 230 380 
    C 215 350, 185 300, 160 250 
    C 140 210, 110 185, 90 160 
    C 80 140, 95 110, 130 95 
    C 150 85, 155 50, 170 30 Z
  `;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#FFFFFF' }}>
      <ExamDefs />

      {/* Title */}
      <text x={20} y={24} fill="#0F172A" fontSize={12} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
        📍 {title}
      </text>

      {/* Map Outline Base */}
      <g transform="translate(40, 0)">
        {/* Shaded Mainland Outline */}
        <path
          d={indiaOutline}
          fill="#F8FAFC"
          stroke="#0A64F5"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Coastal Flood Inundation Shading */}
        <path
          d="M 90 160 C 120 200, 160 260, 230 380 C 260 320, 340 220, 370 205"
          fill="none"
          stroke="#38BDF8"
          strokeWidth={6}
          opacity={0.3}
        />

        {/* Hotspot Markers and Connecting Annotation Lines */}
        {hotspots.map((spot, i) => {
          const isMasked = renderMode === 'recall' && !revealed[i];

          return (
            <g key={`hotspot-${i}`}>
              {/* Pulse / Target Ring */}
              <circle cx={spot.x} cy={spot.y} r={8} fill="#FEE2E2" stroke="#EF4444" strokeWidth={1.5} />
              <circle cx={spot.x} cy={spot.y} r={3.5} fill="#DC2626" />

              {/* Pin Label on Map */}
              <text
                x={spot.x + 10}
                y={spot.y + 4}
                fill="#0F172A"
                fontSize={10.5}
                fontWeight={700}
                fontFamily="Inter, system-ui, sans-serif"
                onClick={() => {
                  if (renderMode === 'recall') toggleReveal(i);
                  if (onNodeClick) onNodeClick(spot, i);
                }}
                style={{ cursor: renderMode === 'recall' ? 'pointer' : 'default' }}
              >
                {isMasked ? '???' : `${i + 1}. ${spot.name}`}
              </text>
            </g>
          );
        })}
      </g>

      {/* Right Legend / Key Box */}
      <g transform="translate(430, 60)">
        <rect x={0} y={0} width={195} height={310} rx={6} fill="#F8FAFC" stroke="#E2E8F0" strokeWidth={1} />
        <text x={14} y={22} fill="#0F172A" fontSize={11} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
          EXAM HOTSPOT DIAGNOSTIC
        </text>

        {hotspots.map((spot, i) => {
          const isMasked = renderMode === 'recall' && !revealed[i];

          return (
            <g key={`legend-${i}`} transform={`translate(10, ${36 + i * 54})`}>
              <circle cx={6} cy={8} r={5.5} fill="#DC2626" />
              <text x={6} y={11} textAnchor="middle" fill="#FFFFFF" fontSize={8} fontWeight={700}>
                {i + 1}
              </text>
              <text x={18} y={10} fill="#0F172A" fontSize={10} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
                {spot.name}
              </text>
              <text x={18} y={24} fill="#64748B" fontSize={8.5} fontWeight={500} fontFamily="Inter, system-ui, sans-serif">
                {isMasked ? 'Click to reveal mechanism' : spot.desc.slice(0, 36) + '...'}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
