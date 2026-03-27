function SegmentedButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: active
          ? "1px solid rgba(96,165,250,0.65)"
          : "1px solid rgba(255,255,255,0.08)",
        background: active ? "rgba(59,130,246,0.20)" : "rgba(255,255,255,0.04)",
        color: active ? "#eff6ff" : "#cbd5e1",
        padding: "10px 14px",
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      {children}
    </button>
  );
}

export default function PyqControlBar({
  paperFilter,
  setPaperFilter,
  viewMode,
  setViewMode,
  sortMode,
  setSortMode,
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        borderRadius: 18,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase" }}>
            Paper
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <SegmentedButton
              active={paperFilter === "prelims"}
              onClick={() => setPaperFilter("prelims")}
            >
              Prelims
            </SegmentedButton>

            <SegmentedButton
              active={paperFilter === "mains"}
              onClick={() => setPaperFilter("mains")}
            >
              Mains
            </SegmentedButton>

            <SegmentedButton
              active={paperFilter === "both"}
              onClick={() => setPaperFilter("both")}
            >
              Both
            </SegmentedButton>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase" }}>
            View Mode
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <SegmentedButton
              active={viewMode === "quick"}
              onClick={() => setViewMode("quick")}
            >
              Quick View
            </SegmentedButton>

            <SegmentedButton
              active={viewMode === "analysis"}
              onClick={() => setViewMode("analysis")}
            >
              Analysis Mode
            </SegmentedButton>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase" }}>
            Sort
          </div>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            style={{
              background: "rgba(15,23,42,0.9)",
              color: "#e5e7eb",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: 14,
              outline: "none",
            }}
          >
            <option value="latest">Latest first</option>
            <option value="oldest">Oldest first</option>
            <option value="random">Random</option>
          </select>
        </div>
      </div>
    </div>
  );
}