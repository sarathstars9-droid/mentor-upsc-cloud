/**
 * src/components/visualStudio/primitives/ExamPrimitives.jsx
 *
 * Deterministic, reusable SVG primitives for MentorOS Visual Grammar Renderers.
 * Supports pen-reproducible exam-drawable geometries and rich learn-mode visualizations.
 */

import React from 'react';

/**
 * ExamNode: Standard labeled node container (Rectangle, Rounded, Pill, Capsule, or Hexagon).
 */
export function ExamNode({
  x = 0,
  y = 0,
  width = 160,
  height = 40,
  rx = 6,
  label = '',
  sublabel = null,
  isMasked = false,
  isHighlighted = false,
  fill = '#FFFFFF',
  stroke = '#0A64F5',
  textColor = '#0F172A',
  badge = null,
  badgeFill = '#0A64F5',
  badgeTextColor = '#FFFFFF',
  onClick = null,
  fontSize = 12,
  fontWeight = 600,
  renderMode = 'learn'
}) {
  const isExam = renderMode === 'exam';
  const effectiveStroke = isMasked ? '#94A3B8' : (isHighlighted ? '#D97706' : stroke);
  const effectiveFill = isMasked ? '#F8FAFC' : (isHighlighted ? '#FEF3C7' : fill);
  const strokeDasharray = isMasked ? '4 3' : 'none';

  return (
    <g
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s ease' }}
      className="exam-node-primitive"
    >
      {/* Outer Glow / Shadow in Learn Mode */}
      {!isExam && !isMasked && (
        <rect
          x={x + 1}
          y={y + 1}
          width={width}
          height={height}
          rx={rx}
          fill="rgba(15, 23, 42, 0.04)"
        />
      )}

      {/* Main Box */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        fill={effectiveFill}
        stroke={effectiveStroke}
        strokeWidth={isHighlighted ? 2.5 : 1.75}
        strokeDasharray={strokeDasharray}
      />

      {/* Badge or Step Circle if provided */}
      {badge !== null && badge !== undefined && (
        <g>
          <circle
            cx={x + 14}
            cy={y + height / 2}
            r={8.5}
            fill={badgeFill}
          />
          <text
            x={x + 14}
            y={y + height / 2 + 3.5}
            textAnchor="middle"
            fill={badgeTextColor}
            fontSize={9}
            fontWeight={700}
            fontFamily="Inter, system-ui, sans-serif"
          >
            {badge}
          </text>
        </g>
      )}

      {/* Node Text */}
      <text
        x={badge !== null && badge !== undefined ? x + 28 : x + width / 2}
        y={sublabel ? y + height / 2 - 2 : y + height / 2 + 4}
        textAnchor={badge !== null && badge !== undefined ? 'start' : 'middle'}
        fill={isMasked ? '#94A3B8' : textColor}
        fontSize={fontSize}
        fontWeight={isMasked ? 500 : fontWeight}
        fontFamily="Inter, system-ui, sans-serif"
      >
        {isMasked ? '???' : label}
      </text>

      {/* Optional Sublabel */}
      {sublabel && !isMasked && !isExam && (
        <text
          x={badge !== null && badge !== undefined ? x + 28 : x + width / 2}
          y={y + height / 2 + 12}
          textAnchor={badge !== null && badge !== undefined ? 'start' : 'middle'}
          fill="#64748B"
          fontSize={fontSize - 2.5}
          fontWeight={500}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}

/**
 * ExamCircle: Circular node (ideal for hubs, central issues, and cycle nodes).
 */
export function ExamCircle({
  cx = 0,
  cy = 0,
  r = 45,
  label = '',
  sublabel = null,
  isMasked = false,
  isHighlighted = false,
  fill = '#EEF2FF',
  stroke = '#4338CA',
  textColor = '#1E1B4B',
  onClick = null,
  fontSize = 12,
  fontWeight = 700
}) {
  return (
    <g
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      className="exam-circle-primitive"
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={isMasked ? '#F8FAFC' : fill}
        stroke={isMasked ? '#94A3B8' : stroke}
        strokeWidth={isHighlighted ? 3 : 2}
        strokeDasharray={isMasked ? '4 3' : 'none'}
      />
      <text
        x={cx}
        y={sublabel ? cy - 4 : cy + 4}
        textAnchor="middle"
        fill={isMasked ? '#94A3B8' : textColor}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fontFamily="Inter, system-ui, sans-serif"
      >
        {isMasked ? '???' : label}
      </text>
      {sublabel && !isMasked && (
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          fill="#64748B"
          fontSize={fontSize - 2}
          fontWeight={500}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}

/**
 * ExamArrow: Crisp directional connector with optional label.
 */
export function ExamArrow({
  x1 = 0,
  y1 = 0,
  x2 = 0,
  y2 = 0,
  label = null,
  stroke = '#0A64F5',
  strokeWidth = 1.75,
  markerEnd = 'url(#grammarArrowBlue)',
  strokeDasharray = 'none',
  labelBackground = '#FFFFFF'
}) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <g className="exam-arrow-primitive">
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        markerEnd={markerEnd}
      />
      {label && (
        <g>
          <rect
            x={midX - (label.length * 3.5 + 4)}
            y={midY - 8}
            width={label.length * 7 + 8}
            height={16}
            rx={3}
            fill={labelBackground}
            stroke="#CBD5E1"
            strokeWidth={0.75}
          />
          <text
            x={midX}
            y={midY + 3.5}
            textAnchor="middle"
            fill="#475569"
            fontSize={9.5}
            fontWeight={600}
            fontFamily="Inter, system-ui, sans-serif"
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

/**
 * ExamCurve: Curved connector for cycles and web graphs.
 */
export function ExamCurve({
  startX = 0,
  startY = 0,
  controlX = 0,
  controlY = 0,
  endX = 0,
  endY = 0,
  label = null,
  stroke = '#0A64F5',
  strokeWidth = 1.75,
  markerEnd = 'url(#grammarArrowBlue)'
}) {
  const path = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
  return (
    <g className="exam-curve-primitive">
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        markerEnd={markerEnd}
      />
      {label && (
        <text
          x={controlX}
          y={controlY - 4}
          textAnchor="middle"
          fill="#475569"
          fontSize={9.5}
          fontWeight={600}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * ExamDefs: Common markers and filters to embed in SVG.
 */
export function ExamDefs() {
  return (
    <defs>
      <marker
        id="grammarArrowBlue"
        viewBox="0 0 10 10"
        refX="6"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0A64F5" />
      </marker>
      <marker
        id="grammarArrowIndigo"
        viewBox="0 0 10 10"
        refX="6"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#4338CA" />
      </marker>
      <marker
        id="grammarArrowEmerald"
        viewBox="0 0 10 10"
        refX="6"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669" />
      </marker>
      <marker
        id="grammarArrowAmber"
        viewBox="0 0 10 10"
        refX="6"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#D97706" />
      </marker>
      <marker
        id="grammarArrowRose"
        viewBox="0 0 10 10"
        refX="6"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#E11D48" />
      </marker>
    </defs>
  );
}
