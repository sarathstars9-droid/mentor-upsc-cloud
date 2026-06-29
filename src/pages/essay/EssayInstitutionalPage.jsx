import { useState, useRef } from "react";

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }} style={{ background: copied ? "#1a3a1a" : "#1a1a1a", border: `1px solid ${copied ? "#22c55e" : "#333"}`, color: copied ? "#22c55e" : "#aaa", borderRadius: 5, padding: "4px 12px", fontSize: 11, cursor: "pointer", fontFamily: "monospace", transition: "all 0.2s" }}>{copied ? "✓ Copied" : "Copy Prompt"}</button>
  );
};

const PromptPanel = ({ title, prompt, visible }) => {
  if (!visible) return null;
  return (
    <div style={{ background: "#0a1a0a", border: "1px solid #1e3a1e", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</span>
        <CopyButton text={prompt} />
      </div>
      <pre style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af", whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0, background: "#050f05", borderRadius: 6, padding: 14, border: "1px solid #1a2e1a", maxHeight: 260, overflowY: "auto" }}>{prompt}</pre>
    </div>
  );
};

const SectionCard = ({ title, subtitle, children }) => (
  <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 10, padding: "20px 22px", marginBottom: 20 }}>
    {title && <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{title}</div>}
    {subtitle && <div style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>{subtitle}</div>}
    {children}
  </div>
);

const UploadCard = ({ title, helper, accept, file, onFile, onRemove }) => {
  const ref = useRef();
  return (
    <div style={{ background: "#0a0a0a", border: "1px dashed #2a2a2a", borderRadius: 8, padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      {!file ? (
        <div onClick={() => ref.current.click()} style={{ border: "1px dashed #333", borderRadius: 6, padding: "22px 0", textAlign: "center", cursor: "pointer", color: "#444", fontSize: 12 }}>
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

const EXTRACT_PROMPT = `You are a faithful UPSC answer reconstructor.

TASK: Extract and clean the handwritten/raw essay answer provided.

RULES:
- Do NOT rewrite into topper language or improve quality
- Keep exact meaning, wording, and intent of the original
- Preserve paragraph breaks, headings, and section structure faithfully
- Mark any unreadable or unclear portions as [unclear]
- Do not add information not present in the original
- Do not summarize — give the full essay text

INPUT: [Paste image description or raw essay text here]

OUTPUT: Return only the final cleaned essay with no commentary.`;

const EVALUATE_PROMPT = `You are a senior UPSC Essay paper evaluator.

TASK: Evaluate the provided essay against UPSC Essay paper standards.

STRUCTURE YOUR EVALUATION AS:
1. THEME INTERPRETATION — Has the writer correctly identified the central theme and all sub-themes?
2. INTRODUCTION — Quality of opening. Is it engaging (quote / anecdote / paradox / question)? Does it set the direction?
3. MULTIDIMENSIONALITY — Has the essay covered the required dimensions? (philosophical, social, economic, political, contemporary, Indian context, global perspective)
4. COHERENCE & FLOW — Does one section transition logically to the next? Is there a narrative thread?
5. PHILOSOPHICAL BREADTH — Are relevant thinkers, quotes, or philosophical frameworks used meaningfully?
6. EXAMPLES & DATA — Are examples specific, credible, and well-placed? Not just listed?
7. ORIGINALITY — Is there a unique perspective or memorable articulation? Or is it generic?
8. CONCLUSION — Does the conclusion synthesize the essay's thesis? Is it forward-looking and memorable?
9. STRUCTURAL GAPS — What important dimensions are missing?
10. LANGUAGE & EXPRESSION — Is the language appropriate for an essay? (Not GS answer style)
11. TOPPER-GRADE IMPROVEMENT — What would a top scorer restructure, add, or remove?
12. MARK ESTIMATE — Realistic score out of 125 with justification

Essay is judged on BREADTH + DEPTH + COHERENCE + ORIGINALITY. A well-structured ordinary essay beats a disorganized brilliant one. Be honest in your assessment.

TOPIC: [paste topic]
ESSAY: [paste cleaned essay]`;

export default function EssayInstitutionalPage() {
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
    textarea: { width: "100%", background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 6, color: "#ccc", fontSize: 12, padding: "10px 12px", fontFamily: "monospace", resize: "vertical", outline: "none", boxSizing: "border-box" },
    btn: (accent) => ({ background: accent ? "#f59e0b" : "#111", border: `1px solid ${accent ? "#f59e0b" : "#2a2a2a"}`, color: accent ? "#000" : "#aaa", borderRadius: 6, padding: "8px 16px", fontSize: 11, cursor: "pointer", fontFamily: "monospace", fontWeight: accent ? 700 : 500 }),
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  };

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>ESSAY · GS PAPER I · INSTITUTIONAL</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Essay Institutional</h1>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#555", maxWidth: 560 }}>
          Upload institutional essay tests, extract full handwritten essays, and evaluate against UPSC essay standards for structure, coherence, and originality.
        </p>
      </div>

      <div style={s.grid2}>
        <div>
          <SectionCard title="Upload Zone" subtitle="PDF, DOC, DOCX, TXT">
            <UploadCard title="Institutional Essay Question Paper" helper="No OCR needed. Direct document/text parsing workflow." accept=".pdf,.doc,.docx,.txt" file={qFile} onFile={setQFile} onRemove={() => setQFile(null)} />
            <UploadCard title="Model Essay / Topper Copy / Evaluation Scheme" helper="Upload model essay, topper answer copy, or evaluation notes." accept=".pdf,.doc,.docx,.txt" file={aFile} onFile={setAFile} onRemove={() => setAFile(null)} />
          </SectionCard>

          <SectionCard title="User Essay Input" subtitle="Upload photo or paste raw essay text">
            <span style={s.label}>Essay Photo</span>
            {!imgFile ? (
              <button onClick={() => imgRef.current.click()} style={{ ...s.btn(false), width: "100%", padding: "10px 0", textAlign: "center", marginBottom: 14 }}>⬆ Upload Essay Image</button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#111", borderRadius: 6, padding: "8px 12px", marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>🖼</span>
                <span style={{ flex: 1, fontSize: 12, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{imgFile.name}</span>
                <button onClick={() => setImgFile(null)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}>✕</button>
              </div>
            )}
            <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => setImgFile(e.target.files[0])} />

            <span style={s.label}>Paste Raw Essay Text</span>
            <textarea rows={7} value={rawAnswer} onChange={e => setRawAnswer(e.target.value)} placeholder="Paste your raw essay here..." style={{ ...s.textarea, marginBottom: 14 }} />

            <span style={s.label}>Paste ChatGPT Evaluation Result</span>
            <textarea rows={5} value={pastedEval} onChange={e => setPastedEval(e.target.value)} placeholder="Paste ChatGPT evaluation output here..." style={{ ...s.textarea, marginBottom: 16 }} />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => { setShowExtract(v => !v); setShowEvaluate(false); }} style={s.btn(false)}>📋 Extract User Essay</button>
              <button onClick={() => { setShowEvaluate(v => !v); setShowExtract(false); }} style={s.btn(true)}>⚡ Evaluate Essay</button>
            </div>
            <div style={{ fontSize: 10, color: "#444", marginTop: 8 }}>Essay evaluation covers theme interpretation, coherence, breadth, originality, and marks estimate out of 125.</div>
            <PromptPanel title="Extract Prompt" prompt={EXTRACT_PROMPT} visible={showExtract} />
            <PromptPanel title="Essay Evaluate Prompt" prompt={EVALUATE_PROMPT} visible={showEvaluate} />
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Saved User Essay" subtitle="Paste extracted essay here">
            <textarea rows={10} value={savedAnswer} onChange={e => setSavedAnswer(e.target.value)} placeholder="Paste extracted essay here to save locally..." style={s.textarea} />
            {savedAnswer && <div style={{ marginTop: 8 }}><CopyButton text={savedAnswer} /></div>}
          </SectionCard>

          <SectionCard title="Saved Evaluation" subtitle="Paste final evaluation here">
            <textarea rows={10} value={savedEval} onChange={e => setSavedEval(e.target.value)} placeholder="Paste ChatGPT essay evaluation here..." style={s.textarea} />
            {savedEval && <div style={{ marginTop: 8 }}><CopyButton text={savedEval} /></div>}
          </SectionCard>

          <div style={{ background: "#0a0f0a", border: "1px solid #1a2a1a", borderRadius: 8, padding: "12px 16px", fontSize: 11, color: "#444" }}>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>Tip: </span>
            Essay is evaluated out of 125. The evaluation prompt checks all 4 UPSC essay pillars: Breadth, Depth, Coherence, and Originality — plus a specific marks estimate with justification.
          </div>
        </div>
      </div>
    </div>
  );
}
