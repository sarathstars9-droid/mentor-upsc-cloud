import { useEffect, useMemo, useState } from "react";
import { BACKEND_URL } from "../config";

const STATUS_COLORS = {
  critical: "#ff6b6b",
  lagging: "#f59e0b",
  balanced: "#38bdf8",
  strong: "#22c55e",
  "exam ready": "#14b8a6",
};

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pct(value) {
  const n = safeNum(value, 0);
  return `${Math.max(0, Math.min(100, Math.round(n)))}%`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function formatShortDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function normalizeStatusLabel(status) {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return "Balanced";
  if (s === "exam_ready") return "Exam Ready";
  return s
    .split(/[\s_-]+/)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
}

function statusColor(status) {
  const s = String(status || "").trim().toLowerCase().replace("_", " ");
  return STATUS_COLORS[s] || "#8b9bb4";
}

function ProgressBar({ label, value, subtext }) {
  const width = Math.max(0, Math.min(100, safeNum(value, 0)));

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 13, opacity: 0.84 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{pct(width)}</span>
      </div>

      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${width}%`,
            height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, rgba(96,165,250,0.95), rgba(34,197,94,0.95))",
          }}
        />
      </div>

      {subtext ? (
        <div style={{ fontSize: 12, opacity: 0.65 }}>{subtext}</div>
      ) : null}
    </div>
  );
}

function TopStatCard({ label, value, subtext }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 18,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        minHeight: 108,
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.72, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, opacity: 0.62 }}>{subtext}</div>
    </div>
  );
}

function SectionCard({ title, right, children }) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 20,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function PaperCard({ paper }) {
  const progress = paper?.progress || {};
  const totals = paper?.totals || {};
  const pyq = paper?.pyq || {};
  const status = normalizeStatusLabel(paper?.status);

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 18,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
            {paper?.paperLabel || paper?.paperKey || "Paper"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.66 }}>
            {paper?.subtitle || "Preparation coverage"}
          </div>
        </div>

        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            background: statusColor(paper?.status),
            whiteSpace: "nowrap",
          }}
        >
          {status}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <ProgressBar
          label="Syllabus"
          value={progress.syllabusPercent}
          subtext={`${safeNum(totals.coveredNodes)} / ${safeNum(totals.totalNodes)} covered`}
        />
        <ProgressBar
          label="PYQ"
          value={progress.pyqPercent}
          subtext={`${safeNum(pyq.attemptedPyqs)} / ${safeNum(pyq.totalPyqs)} attempted`}
        />
        <ProgressBar
          label="Revision"
          value={progress.revisionPercent}
          subtext={`${safeNum(totals.revisedNodes)} revised`}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <MetricMini label="Untouched" value={safeNum(totals.untouchedNodes)} />
        <MetricMini label="Weak Zones" value={safeNum(paper?.weakZonesCount)} />
        <MetricMini label="Readiness" value={safeNum(paper?.readinessScore)} />
      </div>

      <div style={{ fontSize: 12, opacity: 0.65 }}>
        Last activity: {formatDateTime(paper?.lastActivityAt)}
      </div>
    </div>
  );
}

function MetricMini({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: 12,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.66, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function SmallBarList({ rows, labelKey = "paper", valueKey = "value" }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {(rows || []).map((row, idx) => {
        const label = row?.[labelKey] || `Item ${idx + 1}`;
        const value = safeNum(row?.[valueKey], 0);
        return (
          <div key={`${label}-${idx}`} style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 13 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{pct(value)}</span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, value))}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, rgba(168,85,247,0.95), rgba(59,130,246,0.95))",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FiltersBar({ filters, onChange, paperOptions }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 12,
      }}
    >
      <select value={filters.paper} onChange={(e) => onChange("paper", e.target.value)} style={filterStyle}>
        <option value="ALL">All Papers</option>
        {paperOptions.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>

      <select value={filters.status} onChange={(e) => onChange("status", e.target.value)} style={filterStyle}>
        <option value="ALL">All Status</option>
        <option value="critical">Critical</option>
        <option value="lagging">Lagging</option>
        <option value="balanced">Balanced</option>
        <option value="strong">Strong</option>
        <option value="exam_ready">Exam Ready</option>
      </select>

      <select value={filters.activitySource} onChange={(e) => onChange("activitySource", e.target.value)} style={filterStyle}>
        <option value="ALL">All Sources</option>
        <option value="ocr">OCR</option>
        <option value="focus">Focus</option>
        <option value="night_extra_review">Night Extra</option>
        <option value="pyq_test">PYQ Test</option>
        <option value="institutional_test">Institutional</option>
      </select>

      <input
        style={filterStyle}
        value={filters.search}
        onChange={(e) => onChange("search", e.target.value)}
        placeholder="Search paper / topic / node"
      />
    </div>
  );
}

const filterStyle = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  padding: "12px 14px",
  outline: "none",
};

function CoverageTable({ rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: 1300,
        }}
      >
        <thead>
          <tr>
            {[
              "Paper",
              "Total Nodes",
              "Touched",
              "In Progress",
              "Covered",
              "Revised",
              "Mastered",
              "Untouched",
              "Total PYQs",
              "Attempted",
              "Correct %",
              "PYQs Revised",
              "Sectionals",
              "Full Tests",
              "Institutionals",
              "Weak Zones",
              "Last Activity",
              "Readiness",
              "Status",
            ].map((head) => (
              <th
                key={head}
                style={{
                  textAlign: "left",
                  fontSize: 12,
                  opacity: 0.72,
                  padding: "12px 10px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  whiteSpace: "nowrap",
                }}
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {(rows || []).map((row) => (
            <tr key={row.paperKey || row.paperLabel}>
              <td style={cellStyleStrong}>{row.paperLabel || row.paperKey}</td>
              <td style={cellStyle}>{safeNum(row.totalNodes)}</td>
              <td style={cellStyle}>{safeNum(row.touchedNodes)}</td>
              <td style={cellStyle}>{safeNum(row.inProgressNodes)}</td>
              <td style={cellStyle}>{safeNum(row.coveredNodes)}</td>
              <td style={cellStyle}>{safeNum(row.revisedNodes)}</td>
              <td style={cellStyle}>{safeNum(row.masteredNodes)}</td>
              <td style={cellStyle}>{safeNum(row.untouchedNodes)}</td>
              <td style={cellStyle}>{safeNum(row.totalPyqs)}</td>
              <td style={cellStyle}>{safeNum(row.attemptedPyqs)}</td>
              <td style={cellStyle}>{pct(row.correctPercent)}</td>
              <td style={cellStyle}>{safeNum(row.revisedPyqs)}</td>
              <td style={cellStyle}>{safeNum(row.sectionalTests)}</td>
              <td style={cellStyle}>{safeNum(row.fullTests)}</td>
              <td style={cellStyle}>{safeNum(row.institutionalTests)}</td>
              <td style={cellStyle}>{safeNum(row.weakZones)}</td>
              <td style={cellStyle}>{formatShortDate(row.lastActivityAt)}</td>
              <td style={cellStyleStrong}>{safeNum(row.readinessScore)}</td>
              <td style={cellStyle}>
                <span
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                    background: statusColor(row.status),
                    whiteSpace: "nowrap",
                  }}
                >
                  {normalizeStatusLabel(row.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle = {
  padding: "12px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const cellStyleStrong = {
  ...cellStyle,
  fontWeight: 700,
};

function ListPanel({ items, renderItem, emptyLabel = "Nothing yet." }) {
  if (!items?.length) {
    return <div style={{ fontSize: 14, opacity: 0.66 }}>{emptyLabel}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            padding: 14,
            borderRadius: 14,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}

function buildFallbackDashboard(raw) {
  const summary = raw?.summary || {};
  const papers = Array.isArray(raw?.papers) ? raw.papers : [];
  const tableRows = Array.isArray(raw?.tableRows) ? raw.tableRows : papers.map((paper) => ({
    paperKey: paper.paperKey,
    paperLabel: paper.paperLabel,
    totalNodes: paper?.totals?.totalNodes || 0,
    touchedNodes: paper?.totals?.touchedNodes || 0,
    inProgressNodes: paper?.totals?.inProgressNodes || 0,
    coveredNodes: paper?.totals?.coveredNodes || 0,
    revisedNodes: paper?.totals?.revisedNodes || 0,
    masteredNodes: paper?.totals?.masteredNodes || 0,
    untouchedNodes: paper?.totals?.untouchedNodes || 0,
    totalPyqs: paper?.pyq?.totalPyqs || 0,
    attemptedPyqs: paper?.pyq?.attemptedPyqs || 0,
    correctPercent: paper?.pyq?.correctPercent || 0,
    revisedPyqs: paper?.pyq?.revisedPyqs || 0,
    sectionalTests: paper?.tests?.sectionalCount || 0,
    fullTests: paper?.tests?.fullTestCount || 0,
    institutionalTests: paper?.tests?.institutionalTestCount || 0,
    weakZones: paper?.weakZonesCount || 0,
    lastActivityAt: paper?.lastActivityAt || null,
    readinessScore: paper?.readinessScore || 0,
    status: paper?.status || "balanced",
  }));

  return {
    meta: raw?.meta || {},
    summary: {
      overallSyllabusCoveragePercent: summary.overallSyllabusCoveragePercent || 0,
      overallPyqCoveragePercent: summary.overallPyqCoveragePercent || 0,
      overallRevisionPercent: summary.overallRevisionPercent || 0,
      overallReadinessScore: summary.overallReadinessScore || 0,
      untouchedNodes: summary.untouchedNodes || 0,
      weakClusters: summary.weakClusters || 0,
    },
    papers,
    tableRows,
    charts: raw?.charts || {
      syllabusByPaper: papers.map((p) => ({
        paper: p.paperLabel,
        value: p?.progress?.syllabusPercent || 0,
      })),
      pyqByPaper: papers.map((p) => ({
        paper: p.paperLabel,
        value: p?.progress?.pyqPercent || 0,
      })),
    },
    weakZones: raw?.weakZones || [],
    untouchedZones: raw?.untouchedZones || [],
    recentActivity: raw?.recentActivity || [],
    nextActions: raw?.nextActions || [],
  };
}

export default function SyllabusPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [filters, setFilters] = useState({
    paper: "ALL",
    status: "ALL",
    activitySource: "ALL",
    search: "",
  });

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const primary = await fetch(`${BACKEND_URL}/api/syllabus/dashboard`);
        let data = null;

        if (primary.ok) {
          data = await primary.json();
        } else {
          const fallback = await fetch(`${BACKEND_URL}/api/syllabus`);
          if (!fallback.ok) {
            throw new Error("Failed to load syllabus dashboard");
          }
          const raw = await fallback.json();
          data = buildFallbackDashboard(raw);
        }

        if (!ignore) {
          setDashboard(buildFallbackDashboard(data));
        }
      } catch (err) {
        if (!ignore) {
          setError(err?.message || "Failed to load syllabus dashboard");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  const paperOptions = useMemo(() => {
    const rows = dashboard?.papers || [];
    return rows.map((x) => ({
      value: x.paperKey,
      label: x.paperLabel,
    }));
  }, [dashboard]);

  const filteredPapers = useMemo(() => {
    const rows = dashboard?.papers || [];
    const q = String(filters.search || "").trim().toLowerCase();

    return rows.filter((row) => {
      if (filters.paper !== "ALL" && row.paperKey !== filters.paper) return false;
      if (filters.status !== "ALL" && String(row.status || "").toLowerCase() !== filters.status) return false;

      if (!q) return true;

      const hay = [
        row.paperKey,
        row.paperLabel,
        row.subtitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [dashboard, filters]);

  const filteredTableRows = useMemo(() => {
    const rows = dashboard?.tableRows || [];
    const q = String(filters.search || "").trim().toLowerCase();

    return rows.filter((row) => {
      if (filters.paper !== "ALL" && row.paperKey !== filters.paper) return false;
      if (filters.status !== "ALL" && String(row.status || "").toLowerCase() !== filters.status) return false;
      if (!q) return true;

      return `${row.paperKey || ""} ${row.paperLabel || ""}`.toLowerCase().includes(q);
    });
  }, [dashboard, filters]);

  const filteredRecentActivity = useMemo(() => {
    const rows = dashboard?.recentActivity || [];
    const q = String(filters.search || "").trim().toLowerCase();

    return rows.filter((row) => {
      if (filters.paper !== "ALL" && row.paperKey !== filters.paper) return false;
      if (filters.activitySource !== "ALL" && row.source !== filters.activitySource) return false;
      if (!q) return true;

      return `${row.label || ""} ${row.paperKey || ""} ${(row.mappedNodeIds || []).join(" ")}`.toLowerCase().includes(q);
    });
  }, [dashboard, filters]);

  const filteredWeakZones = useMemo(() => {
    const rows = dashboard?.weakZones || [];
    const q = String(filters.search || "").trim().toLowerCase();

    return rows.filter((row) => {
      if (filters.paper !== "ALL" && row.paperKey !== filters.paper) return false;
      if (!q) return true;

      return `${row.topicLabel || ""} ${row.reason || ""} ${row.nodeId || ""}`.toLowerCase().includes(q);
    });
  }, [dashboard, filters]);

  const filteredUntouchedZones = useMemo(() => {
    const rows = dashboard?.untouchedZones || [];
    const q = String(filters.search || "").trim().toLowerCase();

    return rows.filter((row) => {
      if (filters.paper !== "ALL" && row.paperKey !== filters.paper) return false;
      if (!q) return true;

      return `${row.topicLabel || ""} ${row.nodeId || ""}`.toLowerCase().includes(q);
    });
  }, [dashboard, filters]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const summary = dashboard?.summary || {};
  const charts = dashboard?.charts || {};

  return (
    <div style={{ padding: 22, display: "grid", gap: 18 }}>
      <div
        style={{
          padding: 24,
          borderRadius: 24,
          background: "linear-gradient(135deg, rgba(59,130,246,0.16), rgba(168,85,247,0.12))",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.72, marginBottom: 8 }}>UPSC Coverage Command Center</div>
        <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 8 }}>Syllabus Intelligence Dashboard</div>
        <div style={{ fontSize: 14, opacity: 0.72, maxWidth: 840, lineHeight: 1.6 }}>
          Track syllabus completion, PYQ exposure, revision depth, test evidence, untouched zones,
          and weak clusters across Prelims, Mains, CSAT, Essay, Ethics, and Geography Optional.
        </div>

        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            marginTop: 16,
            fontSize: 12,
            opacity: 0.8,
          }}
        >
          <span>Last activity: {formatDateTime(dashboard?.meta?.lastActivityAt)}</span>
          <span>Generated: {formatDateTime(dashboard?.meta?.generatedAt)}</span>
          <span>Date range: {dashboard?.meta?.dateRange || "all"}</span>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            padding: 18,
            borderRadius: 18,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          Loading syllabus dashboard...
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            padding: 18,
            borderRadius: 18,
            background: "rgba(255,107,107,0.12)",
            border: "1px solid rgba(255,107,107,0.24)",
            color: "#ffd5d5",
          }}
        >
          {error}
        </div>
      ) : null}

      {!loading && !error && dashboard ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            <TopStatCard
              label="Overall Syllabus Coverage"
              value={pct(summary.overallSyllabusCoveragePercent)}
              subtext="Node-level syllabus completion"
            />
            <TopStatCard
              label="Overall PYQ Coverage"
              value={pct(summary.overallPyqCoveragePercent)}
              subtext="Question exposure across papers"
            />
            <TopStatCard
              label="Revision Progress"
              value={pct(summary.overallRevisionPercent)}
              subtext="Depth of revisit and reinforcement"
            />
            <TopStatCard
              label="Readiness Score"
              value={safeNum(summary.overallReadinessScore)}
              subtext="Merged from study + PYQ + tests"
            />
            <TopStatCard
              label="Untouched Nodes"
              value={safeNum(summary.untouchedNodes)}
              subtext="Topics still not entered properly"
            />
            <TopStatCard
              label="Weak Clusters"
              value={safeNum(summary.weakClusters)}
              subtext="Urgent danger areas"
            />
          </div>

          <SectionCard title="Filters">
            <FiltersBar filters={filters} onChange={updateFilter} paperOptions={paperOptions} />
          </SectionCard>

          <SectionCard
            title="Paper Readiness Grid"
            right={<div style={{ fontSize: 12, opacity: 0.64 }}>{filteredPapers.length} papers</div>}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              {filteredPapers.map((paper) => (
                <PaperCard key={paper.paperKey} paper={paper} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Coverage Table">
            <CoverageTable rows={filteredTableRows} />
          </SectionCard>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <SectionCard title="Syllabus Completion by Paper">
              <SmallBarList rows={charts.syllabusByPaper || []} />
            </SectionCard>

            <SectionCard title="PYQ Coverage by Paper">
              <SmallBarList rows={charts.pyqByPaper || []} />
            </SectionCard>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <SectionCard title="Weak Zones">
              <ListPanel
                items={filteredWeakZones}
                emptyLabel="No weak zones found for current filters."
                renderItem={(item) => (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 800 }}>{item.topicLabel || item.nodeId}</div>
                      <div
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: item.priority === "high" ? "rgba(255,107,107,0.18)" : "rgba(245,158,11,0.16)",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {String(item.priority || "medium").toUpperCase()}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.72 }}>{item.reason}</div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>
                      {item.paperKey} • {item.nodeId} • {item.evidenceType}
                    </div>
                    <div style={{ fontSize: 13 }}>
                      <b>Action:</b> {item.suggestedAction}
                    </div>
                  </div>
                )}
              />
            </SectionCard>

            <SectionCard title="Untouched / Overdue Zones">
              <ListPanel
                items={filteredUntouchedZones}
                emptyLabel="No untouched zones found for current filters."
                renderItem={(item) => (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 800 }}>{item.topicLabel || item.nodeId}</div>
                      <div
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: item.priority === "high" ? "rgba(255,107,107,0.18)" : "rgba(59,130,246,0.16)",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {String(item.priority || "medium").toUpperCase()}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.66 }}>
                      {item.paperKey} • {item.nodeId}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.76 }}>
                      Linked PYQs: <b>{safeNum(item.linkedPyqCount)}</b> • Days pending: <b>{safeNum(item.daysPending)}</b> • Suggested block: <b>{safeNum(item.suggestedBlockMinutes)} min</b>
                    </div>
                  </div>
                )}
              />
            </SectionCard>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <SectionCard title="Recent Activity Feed">
              <ListPanel
                items={filteredRecentActivity}
                emptyLabel="No recent activity found for current filters."
                renderItem={(item) => (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 800 }}>{item.label}</div>
                      <div style={{ fontSize: 12, opacity: 0.64 }}>{formatDateTime(item.time)}</div>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.68 }}>
                      {item.paperKey} • {item.source} • {item.activityType}
                    </div>
                    {!!item.mappedNodeIds?.length && (
                      <div style={{ fontSize: 12, opacity: 0.64 }}>
                        Nodes: {item.mappedNodeIds.join(", ")}
                      </div>
                    )}
                  </div>
                )}
              />
            </SectionCard>

            <SectionCard title="Next Actions">
              <ListPanel
                items={dashboard?.nextActions || []}
                emptyLabel="No next actions generated yet."
                renderItem={(item) => (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 800 }}>{item.label}</div>
                      <div
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: item.priority === "high" ? "rgba(255,107,107,0.18)" : "rgba(34,197,94,0.16)",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {String(item.priority || "medium").toUpperCase()}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.78 }}>{item.action}</div>
                  </div>
                )}
              />
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}