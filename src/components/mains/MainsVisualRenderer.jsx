/**
 * src/components/mains/MainsVisualRenderer.jsx
 *
 * Lightweight SVG visual schema renderer for UPSC Mains diagrams.
 * Visual style: white background, dark blue pen-like strokes, simple arrows,
 * no shadows/gradients, highly reproducible by candidates.
 */

import React from "react";

export function MainsVisualRenderer({ schema, drawTimeSeconds }) {
  if (!schema || typeof schema !== "object" || !schema.renderer) return null;

  const { renderer, nodes = [], edges = [], description = "" } = schema;

  if (renderer === "MAP_REQUIRED" || renderer === "MAP" || renderer === "GEOGRAPHICAL_SKETCH" || renderer === "GEOGRAPHICAL_SKETCH_REQUIRED") {
    return (
      <div style={styles.mapContainer}>
        <div style={styles.mapTitle}>🗺️ {renderer.includes("MAP") ? "MAP" : "GEOGRAPHICAL SKETCH"} RECOMMENDED</div>
        <div style={styles.mapDesc}>{description || "Specific drawing required based on instructions."}</div>
        {drawTimeSeconds && (
          <div style={styles.drawTime}>Approx. draw time: {drawTimeSeconds} sec</div>
        )}
      </div>
    );
  }

  // Aliases for unified subtypes
  const activeRenderer = renderer === "CONCEPT_DIAGRAM" ? "PROCESS_FLOW" 
    : renderer === "PROCESS_CYCLE" ? "CYCLE"
    : renderer === "COMPARISON_CHART" ? "COMPARISON_TABLE"
    : renderer;

  const width = 600;
  const height = 220;

  return (
    <div style={styles.container}>
      <div style={styles.svgWrapper}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="100%"
          style={{ background: "#ffffff" }}
        >
          {/* Grid lines or markers if needed */}
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0A64F5" />
            </marker>
            <filter id="handDrawn" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>

          {/* Render individual layouts */}
          {activeRenderer === "PROCESS_FLOW" && renderProcessFlow(nodes, edges, width, height)}
          {activeRenderer === "BRANCHING_FLOW" && renderBranchingFlow(nodes, edges, width, height)}
          {activeRenderer === "CYCLE" && renderCycle(nodes, edges, width, height)}
          {activeRenderer === "STAKEHOLDER_WHEEL" && renderStakeholderWheel(nodes, edges, width, height)}
          {activeRenderer === "COMPARISON_TABLE" && renderComparisonTable(nodes, width, height)}
          {activeRenderer === "SIMPLE_GRAPH" && renderSimpleGraph(nodes, width, height)}
          {activeRenderer === "TIMELINE" && renderTimeline(schema.events || nodes, width, height)}
          {activeRenderer === "TABLE" && renderTable(nodes, width, height)}
          {activeRenderer === "BAR_CHART" && renderBarChart(schema.data, width, height)}
          {activeRenderer === "LINE_GRAPH" && renderLineGraph(schema.data, width, height)}
          {activeRenderer === "PIE_CHART" && renderPieChart(schema.data, width, height)}
        </svg>
      </div>

      <div style={styles.meta}>
        <div style={styles.desc}>{description}</div>
        {drawTimeSeconds && (
          <div style={styles.drawTime}>Approx. draw time: {drawTimeSeconds} sec</div>
        )}
      </div>
    </div>
  );
}

// ─── LAYOUT RENDERERS ────────────────────────────────────────────────────────

function renderProcessFlow(nodes, edges, width, height) {
  const count = nodes.length || 3;
  const paddingX = 40;
  const step = (width - paddingX * 2) / Math.max(1, count - 1);
  const boxW = 100;
  const boxH = 40;
  const y = height / 2 - boxH / 2;

  return (
    <>
      {nodes.map((node, i) => {
        const x = paddingX + i * step - boxW / 2;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={boxW}
              height={boxH}
              rx={6}
              fill="none"
              stroke="#0A64F5"
              strokeWidth={2}
             filter="url(#handDrawn)" />
            <text
              x={x + boxW / 2}
              y={y + boxH / 2 + 5}
              textAnchor="middle"
              fill="#101828"
              fontSize={10}
              fontWeight={600}
            >
              {truncate(node, 16)}
            </text>
            {/* Draw sequential arrow to next node */}
            {i < count - 1 && (
              <line
                x1={x + boxW}
                y1={y + boxH / 2}
                x2={paddingX + (i + 1) * step - boxW / 2 - 8}
                y2={y + boxH / 2}
                stroke="#0A64F5"
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
               filter="url(#handDrawn)" />
            )}
          </g>
        );
      })}
    </>
  );
}

// eslint-disable-next-line no-unused-vars
function renderBranchingFlow(nodes, edges, width, height) {
  const root = nodes[0] || "Root";
  const leaves = nodes.slice(1);
  const leafCount = leaves.length || 3;
  
  const rootX = width / 2;
  const rootY = 40;
  const rootW = 120;
  const rootH = 36;

  const paddingX = 60;
  const stepY = 120;
  const stepX = (width - paddingX * 2) / Math.max(1, leafCount - 1);
  const leafW = 100;
  const leafH = 34;

  return (
    <>
      {/* Root Node */}
      <g>
        <rect
          x={rootX - rootW / 2}
          y={rootY}
          width={rootW}
          height={rootH}
          rx={4}
          fill="none"
          stroke="#0A64F5"
          strokeWidth={2}
         filter="url(#handDrawn)" />
        <text
          x={rootX}
          y={rootY + rootH / 2 + 4}
          textAnchor="middle"
          fill="#101828"
          fontSize={10}
          fontWeight={700}
        >
          {truncate(root, 18)}
        </text>
      </g>

      {/* Leaves */}
      {leaves.map((leaf, i) => {
        const leafX = paddingX + i * stepX;
        const leafY = rootY + stepY;
        return (
          <g key={i}>
            {/* Branching line */}
            <path
              d={`M ${rootX} ${rootY + rootH} C ${rootX} ${rootY + rootH + 30}, ${leafX} ${leafY - 30}, ${leafX} ${leafY - 4}`}
              fill="none"
              stroke="#0A64F5"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
             filter="url(#handDrawn)" />
            <rect
              x={leafX - leafW / 2}
              y={leafY}
              width={leafW}
              height={leafH}
              rx={4}
              fill="none"
              stroke="#0A64F5"
              strokeWidth={1.5}
             filter="url(#handDrawn)" />
            <text
              x={leafX}
              y={leafY + leafH / 2 + 4}
              textAnchor="middle"
              fill="#101828"
              fontSize={9}
              fontWeight={600}
            >
              {truncate(leaf, 16)}
            </text>
          </g>
        );
      })}
    </>
  );
}

function renderCycle(nodes, edges, width, height) {
  const count = nodes.length || 3;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 65;
  const boxW = 85;
  const boxH = 34;

  return (
    <>
      {nodes.map((node, i) => {
        const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        // Arrow drawing from current node to next node
        const nextAngle = (((i + 1) % count) * 2 * Math.PI) / count - Math.PI / 2;
        const startX = centerX + (radius - 5) * Math.cos(angle + 0.3);
        const startY = centerY + (radius - 5) * Math.sin(angle + 0.3);
        const endX = centerX + (radius - 5) * Math.cos(nextAngle - 0.3);
        const endY = centerY + (radius - 5) * Math.sin(nextAngle - 0.3);

        return (
          <g key={i}>
            <rect
              x={x - boxW / 2}
              y={y - boxH / 2}
              width={boxW}
              height={boxH}
              rx={6}
              fill="#ffffff"
              stroke="#0A64F5"
              strokeWidth={1.5}
             filter="url(#handDrawn)" />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fill="#101828"
              fontSize={9}
              fontWeight={600}
            >
              {truncate(node, 14)}
            </text>
            <path
              d={`M ${startX} ${startY} Q ${centerX + (radius - 20) * Math.cos((angle + nextAngle) / 2)} ${centerY + (radius - 20) * Math.sin((angle + nextAngle) / 2)} ${endX} ${endY}`}
              fill="none"
              stroke="#0A64F5"
              strokeWidth={1.2}
              markerEnd="url(#arrow)"
             filter="url(#handDrawn)" />
          </g>
        );
      })}
    </>
  );
}

function renderStakeholderWheel(nodes, edges, width, height) {
  const hub = nodes[0] || "Hub";
  const spokes = nodes.slice(1);
  const spokeCount = spokes.length || 4;

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 70;
  
  const hubW = 100;
  const hubH = 34;
  const spokeW = 80;
  const spokeH = 30;

  return (
    <>
      {/* Central Hub */}
      <rect
        x={centerX - hubW / 2}
        y={centerY - hubH / 2}
        width={hubW}
        height={hubH}
        rx={6}
        fill="#ffffff"
        stroke="#0A64F5"
        strokeWidth={2}
       filter="url(#handDrawn)" />
      <text
        x={centerX}
        y={centerY + 4}
        textAnchor="middle"
        fill="#101828"
        fontSize={10}
        fontWeight={700}
      >
        {truncate(hub, 16)}
      </text>

      {spokes.map((spoke, i) => {
        const angle = (i * 2 * Math.PI) / spokeCount;
        const x = centerX + radius * 1.5 * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        return (
          <g key={i}>
            {/* Connecting Line */}
            <line
              x1={centerX + (hubW / 2.5) * Math.cos(angle)}
              y1={centerY + (hubH / 2.5) * Math.sin(angle)}
              x2={x - (spokeW / 2.5) * Math.cos(angle)}
              y2={y - (spokeH / 2.5) * Math.sin(angle)}
              stroke="#0A64F5"
              strokeWidth={1.5}
             filter="url(#handDrawn)" />
            <rect
              x={x - spokeW / 2}
              y={y - spokeH / 2}
              width={spokeW}
              height={spokeH}
              rx={4}
              fill="#ffffff"
              stroke="#0A64F5"
              strokeWidth={1.2}
             filter="url(#handDrawn)" />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fill="#101828"
              fontSize={9}
              fontWeight={600}
            >
              {truncate(spoke, 14)}
            </text>
          </g>
        );
      })}
    </>
  );
}

function renderComparisonTable(nodes, width, height) {
  const rowCount = Math.max(2, nodes.length);
  const cellW = width / 2 - 40;
  const cellH = 34;
  const startY = height / 2 - (rowCount * cellH) / 2;

  return (
    <g transform="translate(40, 0)">
      {nodes.map((node, i) => {
        const y = startY + i * cellH;
        return (
          <g key={i}>
            {/* Left box */}
            <rect
              x={0}
              y={y}
              width={cellW}
              height={cellH}
              fill="none"
              stroke="#0A64F5"
              strokeWidth={1}
             />
            <text
              x={12}
              y={y + cellH / 2 + 4}
              fill="#101828"
              fontSize={10}
              fontWeight={i === 0 ? 700 : 500}
            >
              {truncate(node, 24)}
            </text>

            {/* Right placeholder box for aspirant completion */}
            <rect
              x={cellW}
              y={y}
              width={cellW}
              height={cellH}
              fill="none"
              stroke="#0A64F5"
              strokeWidth={1}
             />
            <text
              x={cellW + 12}
              y={y + cellH / 2 + 4}
              fill="#9CA3AF"
              fontSize={10}
              fontStyle="italic"
            >
              {i === 0 ? "Parameters/Detail" : "Comparison criteria..."}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function renderSimpleGraph(nodes, width, height) {
  const startX = 60;
  const endX = width - 60;
  const startY = height - 40;
  const endY = 40;

  return (
    <g>
      {/* Y-axis */}
      <line
        x1={startX}
        y1={startY}
        x2={startX}
        y2={endY}
        stroke="#0A64F5"
        strokeWidth={2}
        markerEnd="url(#arrow)"
       filter="url(#handDrawn)" />
      <text
        x={startX - 10}
        y={endY + 5}
        textAnchor="end"
        fill="#101828"
        fontSize={9}
        fontWeight={700}
      >
        {nodes[0] || "Y-Axis"}
      </text>

      {/* X-axis */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={startY}
        stroke="#0A64F5"
        strokeWidth={2}
        markerEnd="url(#arrow)"
       filter="url(#handDrawn)" />
      <text
        x={endX}
        y={startY + 16}
        textAnchor="middle"
        fill="#101828"
        fontSize={9}
        fontWeight={700}
      >
        {nodes[1] || "X-Axis"}
      </text>

      {/* Graph line path (Curve representing trend) */}
      <path
        d={`M ${startX + 10} ${startY - 15} Q ${startX + 120} ${endY + 20} ${endX - 30} ${endY + 50}`}
        fill="none"
        stroke="#0A64F5"
        strokeWidth={2}
       filter="url(#handDrawn)" />
    </g>
  );
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 2) + ".." : str;
}

function renderTimeline(events, width, height) {
  if (!events || !events.length) return null;
  const count = events.length;
  const paddingX = 60;
  const stepX = (width - paddingX * 2) / Math.max(1, count - 1);
  const startY = height / 2;

  return (
    <g>
      <line x1={paddingX - 20} y1={startY} x2={width - paddingX + 20} y2={startY} stroke="#0A64F5" strokeWidth={2} filter="url(#handDrawn)" />
      {events.map((ev, i) => {
        const x = paddingX + i * stepX;
        const isTop = i % 2 === 0;
        const tickY = startY + (isTop ? -10 : 10);
        const textY = startY + (isTop ? -20 : 25);
        const descY = startY + (isTop ? -32 : 37);

        // Normalize ev to handle both string array and object array
        const year = typeof ev === "string" ? `Event ${i+1}` : ev.year;
        const desc = typeof ev === "string" ? ev : ev.description;

        return (
          <g key={i}>
            <line x1={x} y1={startY} x2={x} y2={tickY} stroke="#0A64F5" strokeWidth={2} filter="url(#handDrawn)" />
            <circle cx={x} cy={startY} r={4} fill="#ffffff" stroke="#0A64F5" strokeWidth={1.5} filter="url(#handDrawn)" />
            <text x={x} y={textY} textAnchor="middle" fill="#101828" fontSize={10} fontWeight={700}>{year}</text>
            <text x={x} y={descY} textAnchor="middle" fill="#6B7280" fontSize={9}>{truncate(desc, 20)}</text>
          </g>
        );
      })}
    </g>
  );
}

function renderTable(nodes, width, height) {
  return renderComparisonTable(nodes, width, height); // Reuse simple comparison table for TABLE type
}

function renderBarChart(data, width, height) {
  if (!data || !data.length) return null;
  const count = data.length;
  const paddingX = 60;
  const paddingY = 40;
  const maxVal = Math.max(...data.map(d => typeof d.value === "number" ? d.value : parseFloat(d.value) || 10));
  
  const stepX = (width - paddingX * 2) / count;
  const barW = Math.min(40, stepX - 10);
  
  return (
    <g>
      <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#0A64F5" strokeWidth={1.5} />
      <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="#0A64F5" strokeWidth={1.5} />
      
      {data.map((d, i) => {
        const val = typeof d.value === "number" ? d.value : parseFloat(d.value) || 0;
        const barH = maxVal > 0 ? (val / maxVal) * (height - paddingY * 2) : 0;
        const x = paddingX + i * stepX + stepX / 2 - barW / 2;
        const y = height - paddingY - barH;
        
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill="rgba(10, 100, 245, 0.1)" stroke="#0A64F5" strokeWidth={1.5} />
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fill="#101828" fontSize={9} fontWeight={600}>{val}</text>
            <text x={x + barW / 2} y={height - paddingY + 12} textAnchor="middle" fill="#6B7280" fontSize={9}>{truncate(d.label, 12)}</text>
          </g>
        );
      })}
    </g>
  );
}

function renderLineGraph(data, width, height) {
  if (!data || !data.length) return null;
  const count = data.length;
  const paddingX = 60;
  const paddingY = 40;
  const maxVal = Math.max(...data.map(d => typeof d.value === "number" ? d.value : parseFloat(d.value) || 10));
  
  const stepX = (width - paddingX * 2) / Math.max(1, count - 1);
  
  const points = data.map((d, i) => {
    const val = typeof d.value === "number" ? d.value : parseFloat(d.value) || 0;
    const x = paddingX + i * stepX;
    const y = height - paddingY - (maxVal > 0 ? (val / maxVal) * (height - paddingY * 2) : 0);
    return { x, y, val, label: d.label };
  });

  const pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");

  return (
    <g>
      <line x1={paddingX} y1={height - paddingY} x2={width - paddingX + 20} y2={height - paddingY} stroke="#0A64F5" strokeWidth={1.5} />
      <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="#0A64F5" strokeWidth={1.5} />
      
      <path d={pathD} fill="none" stroke="#0A64F5" strokeWidth={2} />
      
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="#ffffff" stroke="#0A64F5" strokeWidth={1.5}  />
          <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#101828" fontSize={9} fontWeight={600}>{p.val}</text>
          <text x={p.x} y={height - paddingY + 12} textAnchor="middle" fill="#6B7280" fontSize={9}>{truncate(p.label, 12)}</text>
        </g>
      ))}
    </g>
  );
}

function renderPieChart(data, width, height) {
  if (!data || !data.length) return null;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 40;
  
  const total = data.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0) || 1;
  let currentAngle = -Math.PI / 2;

  return (
    <g>
      {data.map((d, i) => {
        const val = parseFloat(d.value) || 0;
        const angle = (val / total) * 2 * Math.PI;
        const nextAngle = currentAngle + angle;
        
        const x1 = centerX + radius * Math.cos(currentAngle);
        const y1 = centerY + radius * Math.sin(currentAngle);
        const x2 = centerX + radius * Math.cos(nextAngle);
        const y2 = centerY + radius * Math.sin(nextAngle);
        
        const largeArcFlag = angle > Math.PI ? 1 : 0;
        const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
        
        const midAngle = currentAngle + angle / 2;
        const textX = centerX + (radius + 20) * Math.cos(midAngle);
        const textY = centerY + (radius + 20) * Math.sin(midAngle);
        
        currentAngle = nextAngle;
        
        return (
          <g key={i}>
            <path d={pathData} fill="none" stroke="#0A64F5" strokeWidth={1.5} />
            <text x={textX} y={textY} textAnchor="middle" fill="#101828" fontSize={9} fontWeight={600}>
              {truncate(d.label, 15)} ({Math.round((val/total)*100)}%)
            </text>
          </g>
        );
      })}
    </g>
  );
}

const styles = {
  container: {
    background: "#ffffff",
    border: "1px solid var(--mos-border, #EAECF0)",
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 12,
  },
  svgWrapper: {
    height: 220,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    borderTop: "1px solid var(--mos-border, #EAECF0)",
    padding: "10px 14px",
    background: "#FAFBFB",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  desc: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: 500,
  },
  drawTime: {
    fontSize: 10,
    color: "#0A64F5",
    fontWeight: 700,
    letterSpacing: "0.03em",
  },
  mapContainer: {
    background: "#FAFBFB",
    border: "1px dashed var(--mos-border, #EAECF0)",
    borderRadius: 8,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 12,
  },
  mapTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: "#0A64F5",
    letterSpacing: "0.05em",
  },
  mapDesc: {
    fontSize: 13,
    color: "#101828",
    lineHeight: 1.5,
  },
};
