import { useState, useRef } from "react";

/* ── shared micro-components ── */
const StatChip = ({ label, value }) => (
  <div style={{
    display: "inline-flex", flexDirection: "column", alignItems: "center",
    background: "#111", border: "1px solid #2a2a2a", borderRadius: 6,
    padding: "6px 14px", minWidth: 90
  }}>
    <span style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", fontFamily: "monospace" }}>{value}</span>
    <span style={{ fontSize: 10, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>{label}</span>
  </div>
);

const SectionCard = ({ title, subtitle, children, style = {} }) => (
  <div style={{
    background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 10,
    padding: "20px 22px", marginBottom: 20, ...style
  }}>
    {title && <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{title}</div>}
    {subtitle && <div style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>{subtitle}</div>}
    {children}
  </div>
);

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };
  return (
    <button onClick={handle} style={{
      background: copied ? "#1a3a1a" : "#1a1a1a", border: `1px solid ${copied ? "#22c55e" : "#333"}`,
      color: copied ? "#22c55e" : "#aaa", borderRadius: 5, padding: "4px 12px", fontSize: 11,
      cursor: "pointer", fontFamily: "monospace", transition: "all 0.2s"
    }}>{copied ? "✓ Copied" : "Copy Prompt"}</button>
  );
};

const UploadCard = ({ title, helper, accept, file, onFile, onRemove }) => {
  const ref = useRef();
  return (
    <div style={{
      background: "#0a0a0a", border: "1px dashed #2a2a2a", borderRadius: 8,
      padding: 18, marginBottom: 16
    }}>
      <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      {!file ? (
        <div
          onClick={() => ref.current.click()}
          style={{
            border: "1px dashed #333", borderRadius: 6, padding: "22px 0", textAlign: "center",
            cursor: "pointer", color: "#444", fontSize: 12, transition: "border-color 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#555"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "#333"}
        >
          <div style={{ fontSize: 22, marginBottom: 6 }}>⬆</div>
          <div style={{ color: "#555" }}>Click to upload</div>
          <div style={{ fontSize: 10, color: "#333", marginTop: 4 }}>{accept.replace(/\./g, "").toUpperCase()}</div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#111", borderRadius: 6, padding: "10px 14px" }}>
          <span style={{ fontSize: 18 }}>📄</span>
          <span style={{ flex: 1, fontSize: 12, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
          <button onClick={onRemove} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, padding: 0 }}>✕</button>
        </div>
      )}
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }} onChange={e => onFile(e.target.files[0])} />
      <div style={{ fontSize: 10, color: "#444", marginTop: 8 }}>{helper}</div>
    </div>
  );
};

const PromptPanel = ({ title, prompt, visible }) => {
  if (!visible) return null;
  return (
    <div style={{
      background: "#0a1a0a", border: "1px solid #1e3a1e", borderRadius: 8,
      padding: 16, marginTop: 12
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</span>
        <CopyButton text={prompt} />
      </div>
      <pre style={{
        fontFamily: "monospace", fontSize: 11, color: "#9ca3af", whiteSpace: "pre-wrap",
        lineHeight: 1.7, margin: 0, background: "#050f05", borderRadius: 6, padding: 14,
        border: "1px solid #1a2e1a", maxHeight: 260, overflowY: "auto"
      }}>{prompt}</pre>
    </div>
  );
};

/* ── prompts ── */
const EXTRACT_PROMPT = `You are a faithful UPSC answer reconstructor.

TASK: Extract and clean the handwritten/raw answer provided.

RULES:
- Do NOT rewrite into topper language or improve quality
- Keep exact meaning, wording, and intent of the original
- Preserve paragraph breaks, numbering, headings, and bullet structure
- Mark any unreadable or unclear portions as [unclear]
- Do not add information not present in the original
- Do not summarize — give the full answer

INPUT: [Paste image description or raw answer text here]

OUTPUT: Return only the final cleaned answer with no commentary.`;

const EVALUATE_PROMPT = `You are a senior UPSC Mains evaluator with 15+ years of experience.

TASK: Evaluate the provided answer against the question.

STRUCTURE YOUR EVALUATION AS:
1. DEMAND OF QUESTION — What exactly is being asked? Keywords identified?
2. RELEVANCE — Is the answer addressing the core demand?
3. STRUCTURE — Introduction, body organization, conclusion quality
4. CONTENT DEPTH — Factual accuracy, examples, data, dimensions covered
5. MISSING DIMENSIONS — What important aspects were left out?
6. BALANCE — Multiple perspectives? Nuanced handling?
7. TOPPER-GRADE IMPROVEMENT — What would a top scorer add/restructure?
8. MARK ESTIMATE — Out of the question's full marks, realistic estimate with justification
9. REWRITTEN FRAMEWORK — Give a concise improved structural outline

Be precise. Be honest. Do not over-praise average answers.

QUESTION: [paste question]
ANSWER: [paste cleaned answer]`;

const STEPPER_STEPS = [
  "Upload Question Paper",
  "Upload Model Answer",
  "Extract User Answer",
  "Evaluate with ChatGPT",
  "Paste Saved Evaluation",
  "Sync to Mistakes / Revision",
];

export default function MainsInstitutionalPage() {
  const [qFile, setQFile] = useState(null);
  const [aFile, setAFile] = useState(null);
  const [imgFile, setImgFile] = useState(null);
  const [rawAnswer, setRawAnswer] = useState("");
  const [pastedEval, setPastedEval] = useState("");
  const [savedAnswer, setSavedAnswer] = useState("");
  const [savedEval, setSavedEval] = useState("");
  const [showExtract, setShowExtract] = useState(false);
  const [showEvaluate, setShowEvaluate] = useState(false);
  const imgRef = useRef();

  const s = {
    page: { background: "#080808", minHeight: "100vh", padding: "28px 32px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#e5e7eb" },
    label: { fontSize: 11, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block" },
    textarea: {
      width: "100%", background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 6,
      color: "#ccc", fontSize: 12, padding: "10px 12px", fontFamily: "monospace",
      resize: "vertical", outline: "none", boxSizing: "border-box"
    },
    btn: (accent = false) => ({
      background: accent ? "#f59e0b" : "#111", border: `1px solid ${accent ? "#f59e0b" : "#2a2a2a"}`,
      color: accent ? "#000" : "#aaa", borderRadius: 6, padding: "8px 16px", fontSize: 11,
      cursor: "pointer", fontFamily: "monospace", fontWeight: accent ? 700 : 500, letterSpacing: "0.05em"
    }),
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
    stepDot: (done) => ({
      width: 8, height: 8, borderRadius: "50%", background: done ? "#f59e0b" : "#2a2a2a",
      flexShrink: 0, marginTop: 5
    }),
  };

  return (
    <div style={s.page}>
      {/* HEADER */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>MAINS · INSTITUTIONAL</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Mains Institutional</h1>
        <p style={{ margin: "6px 0 18px", fontSize: 12, color: "#555", maxWidth: 560 }}>
          Structured institutional test workflow — upload papers, evaluate answers with ChatGPT, save notes, and sync to your mistake engine.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatChip label="Tests" value="0" />
          <StatChip label="Saved Evals" value="0" />
          <StatChip label="Pending Review" value="0" />
          <StatChip label="Mistakes Flagged" value="0" />
        </div>
      </div>

      <div style={s.grid2}>
        {/* LEFT COLUMN */}
        <div>
          {/* Upload blocks */}
          <SectionCard title="Upload Zone" subtitle="Accepted: PDF, DOC, DOCX, TXT">
            <UploadCard
              title="Institutional Question Paper"
              helper="No OCR needed. Direct document/text parsing workflow."
              accept=".pdf,.doc,.docx,.txt"
              file={qFile}
              onFile={setQFile}
              onRemove={() => setQFile(null)}
            />
            <UploadCard
              title="Model Answer / Evaluator Key"
              helper="Upload evaluator key, model answer, solution sheet, or notes."
              accept=".pdf,.doc,.docx,.txt"
              file={aFile}
              onFile={setAFile}
              onRemove={() => setAFile(null)}
            />
          </SectionCard>

          {/* User Answer block */}
          <SectionCard title="User Answer Input" subtitle="Upload photo or paste raw answer text">
            {/* Image upload */}
            <div style={{ marginBottom: 14 }}>
              <span style={s.label}>Answer Photo</span>
              {!imgFile ? (
                <button onClick={() => imgRef.current.click()} style={{ ...s.btn(), width: "100%", padding: "10px 0", textAlign: "center" }}>
                  ⬆ Upload Answer Image
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#111", borderRadius: 6, padding: "8px 12px" }}>
                  <span style={{ fontSize: 18 }}>🖼</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{imgFile.name}</span>
                  <button onClick={() => setImgFile(null)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}>✕</button>
                </div>
              )}
              <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => setImgFile(e.target.files[0])} />
            </div>

            {/* Raw answer textarea */}
            <div style={{ marginBottom: 14 }}>
              <span style={s.label}>Paste Raw Answer Text</span>
              <textarea rows={5} value={rawAnswer} onChange={e => setRawAnswer(e.target.value)}
                placeholder="Paste your raw answer here..." style={s.textarea} />
            </div>

            {/* ChatGPT eval paste */}
            <div style={{ marginBottom: 16 }}>
              <span style={s.label}>Paste ChatGPT Evaluation Result</span>
              <textarea rows={5} value={pastedEval} onChange={e => setPastedEval(e.target.value)}
                placeholder="Paste ChatGPT evaluation output here..." style={s.textarea} />
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => { setShowExtract(v => !v); setShowEvaluate(false); }} style={s.btn()}>
                📋 Ask ChatGPT to Extract Answer
              </button>
              <button onClick={() => { setShowEvaluate(v => !v); setShowExtract(false); }} style={s.btn(true)}>
                ⚡ Ask ChatGPT to Evaluate Answer
              </button>
            </div>
            <div style={{ fontSize: 10, color: "#444", marginTop: 8 }}>
              Buttons reveal copy-ready prompts — paste them directly into ChatGPT.
            </div>

            <PromptPanel title="Extract Prompt — Copy & Use in ChatGPT" prompt={EXTRACT_PROMPT} visible={showExtract} />
            <PromptPanel title="Evaluate Prompt — Copy & Use in ChatGPT" prompt={EVALUATE_PROMPT} visible={showEvaluate} />
          </SectionCard>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {/* Workflow Stepper */}
          <SectionCard title="Workflow Pipeline" subtitle="Your current stage in the evaluation loop">
            {STEPPER_STEPS.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
                <div style={s.stepDot(false)} />
                <div>
                  <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>
                    <span style={{ color: "#333", marginRight: 8 }}>{String(i + 1).padStart(2, "0")}</span>{step}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #1a1a1a", marginTop: 6, paddingTop: 10, fontSize: 10, color: "#444" }}>
              Step 6 (Mistake Sync) will be available in a future release.
            </div>
          </SectionCard>

          {/* Saved panels */}
          <SectionCard title="Saved User Answer" subtitle="Local preview — paste extracted answer here">
            <textarea rows={6} value={savedAnswer} onChange={e => setSavedAnswer(e.target.value)}
              placeholder="Paste extracted answer here to save locally..." style={s.textarea} />
            {savedAnswer && (
              <div style={{ marginTop: 8 }}>
                <CopyButton text={savedAnswer} />
              </div>
            )}
          </SectionCard>

          <SectionCard title="Saved Evaluation" subtitle="Local preview — paste final evaluation here">
            <textarea rows={7} value={savedEval} onChange={e => setSavedEval(e.target.value)}
              placeholder="Paste final ChatGPT evaluation here to save locally..." style={s.textarea} />
            {savedEval && (
              <div style={{ marginTop: 8 }}>
                <CopyButton text={savedEval} />
              </div>
            )}
          </SectionCard>

          <div style={{
            background: "#0a0f0a", border: "1px solid #1a2a1a", borderRadius: 8,
            padding: "12px 16px", fontSize: 11, color: "#444"
          }}>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>Future sync: </span>
            Saved evaluations will auto-tag weak questions and push to Mistakes engine in a later phase.
          </div>
        </div>
      </div>
    </div>
  );
}
