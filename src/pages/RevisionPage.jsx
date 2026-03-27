const REVISION_STORAGE_KEY = "prelims_revision_queue_v1";

function readQueue() {
  try {
    const raw = localStorage.getItem(REVISION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function RevisionPage() {
  const items = readQueue();

  return (
    <div style={page}>
      <div style={headerCard}>
        <div style={kicker}>PHASE 3A</div>
        <h2 style={{ margin: 0 }}>Revision Tracker</h2>
        <p style={sub}>Auto-generated revision intelligence from prelims mistakes, weak themes, and repeated problem areas.</p>
      </div>

      {!items.length ? (
        <div style={panel}>Revision intelligence will appear here after you complete prelims tests.</div>
      ) : (
        <div style={{ ...panel, maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Priority Queue</div>
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((item) => (
              <div key={item.id} style={rowCard}>
                <strong>{item.entityLabel}</strong>
                <span>{item.entityType}</span>
                <span>{item.action}</span>
                <span>Score: {item.priorityScore}</span>
                <span>Repeats: {item.repeatCount || 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const page = {
  minHeight: "100vh",
  background: "#0b1020",
  color: "#e5e7eb",
  padding: "24px 16px 56px",
};

const headerCard = {
  maxWidth: 1200,
  margin: "0 auto 18px",
  padding: 20,
  borderRadius: 20,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const panel = {
  padding: 18,
  borderRadius: 18,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const kicker = { fontSize: 12, opacity: 0.75, marginBottom: 8 };
const sub = { margin: "8px 0 0", fontSize: 14, opacity: 0.8 };

const rowCard = {
  padding: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  display: "grid",
  gridTemplateColumns: "1.5fr 0.8fr 0.8fr 0.8fr 0.6fr",
  gap: 10,
  alignItems: "center",
};
