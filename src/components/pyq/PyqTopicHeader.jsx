export default function PyqTopicHeader({ topic }) {
  if (!topic) return null;

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        borderRadius: 20,
        padding: "20px 22px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#94a3b8",
          marginBottom: 10,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {topic.subject} • {topic.parentTopic}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              lineHeight: 1.15,
              color: "#f8fafc",
            }}
          >
            {topic.topicName}
          </h1>

          <div
            style={{
              marginTop: 10,
              fontSize: 14,
              color: "#cbd5e1",
            }}
          >
            Syllabus Node:{" "}
            <span style={{ color: "#93c5fd", fontWeight: 600 }}>
              {topic.syllabusNodeId}
            </span>
          </div>
        </div>

        <div
          style={{
            minWidth: 140,
            borderRadius: 16,
            padding: "14px 16px",
            background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(96,165,250,0.25)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#bfdbfe",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Total PYQs
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#eff6ff",
            }}
          >
            {topic.totalQuestions}
          </div>
        </div>
      </div>
    </div>
  );
}