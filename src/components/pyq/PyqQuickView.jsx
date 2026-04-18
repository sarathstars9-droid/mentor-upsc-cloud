import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BACKEND_URL } from "../../config";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function paperLabel(paper = "") {
  const p = String(paper || "").toLowerCase();
  if (p === "prelims") return "Prelims";
  if (p === "mains") return "Mains";
  if (p === "essay") return "Essay";
  if (p === "ethics") return "Ethics";
  if (p === "optional") return "Optional";
  if (p === "csat") return "CSAT";
  return p || "Paper";
}

function yearLabel(year) {
  return year ? String(year) : "Unknown Year";
}

function buildTimelineGroups(questions) {
  const map = new Map();

  for (const q of questions) {
    const year = Number(q.year) || 0;
    if (!map.has(year)) {
      map.set(year, []);
    }
    map.get(year).push(q);
  }

  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({
      year,
      label: year > 0 ? String(year) : "Unknown Year",
      items,
    }));
}

const GENERIC_LABELS = new Set([
  "", "general", "general topic", "theme_general",
  "unmapped", "unmapped_topic", "unmapped topic",
  "unknown", "unknown topic", "misc", "miscellaneous",
  "other", "others",
]);

function cleanLabel(v) {
  const s = String(v || "").trim();
  return GENERIC_LABELS.has(s.toLowerCase()) ? "" : s;
}

function buildTopicGroups(questions) {
  const map = new Map();
  const UNGROUPED = "__ungrouped__";

  for (const q of questions) {
    const key =
      cleanLabel(q.microTheme) ||
      cleanLabel(q.subtopic) ||
      cleanLabel(q.themeLabel) ||
      UNGROUPED;

    if (!map.has(key)) map.set(key, []);
    map.get(key).push(q);
  }

  const groups = [...map.entries()]
    .filter(([key]) => key !== UNGROUPED)
    .map(([topic, items]) => ({ topic, items }))
    .sort((a, b) => b.items.length - a.items.length);

  // Append ungrouped questions at the end without a misleading label
  const ungrouped = map.get(UNGROUPED) || [];
  if (ungrouped.length) {
    groups.push({ topic: "Other Questions", items: ungrouped });
  }

  return groups;
}

// ── Question stage helpers ────────────────────────────────────────────────────

function isMainsQuestion(paper) {
  const p = String(paper || "").toLowerCase().trim();
  // Matches "mains", "gs1 mains", "gs2 mains", "gs3 mains", "gs4 mains"
  // Explicitly excludes: prelims, csat, essay, ethics, optional
  return p === "mains" || /^gs[1-4](\s|$)/.test(p);
}

// Builds the question-context block prepended before any ChatGPT prompt body.
// Shared between Prelims and Mains buttons so the header is never duplicated.
function buildChatGPTHeader(q) {
  const year = q.year ? String(q.year) : "";
  const paperLbl = q.paper ? q.paper.charAt(0).toUpperCase() + q.paper.slice(1) : "";
  const subject = q.themeLabel || q.subtopic || q.microTheme || "";
  const optionLines =
    Array.isArray(q.options) && q.options.length
      ? q.options
          .map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const val = typeof opt === "object" ? (opt.value ?? opt.text ?? "") : opt;
            return `  ${letter}. ${val}`;
          })
          .join("\n")
      : "";
  const answerLine = q.answer ? `Correct Answer: ${String(q.answer).toUpperCase()}` : "";
  return [
    `UPSC PYQ | ${paperLbl}${year ? ` | ${year}` : ""}${subject ? ` | ${subject}` : ""}`,
    "",
    "Question:",
    q.questionText || "",
    ...(optionLines ? ["", "Options:", optionLines] : []),
    ...(answerLine ? ["", answerLine] : []),
    "",
    "---",
    "",
  ].join("\n");
}

// ── Mains AIR-1 Answer Writing prompt ────────────────────────────────────────
// Used ONLY when isMainsQuestion() is true. Embeds question context inline so
// the full prompt can be copied and pasted directly into ChatGPT.
function buildMainsPrompt(q) {
  const year = q.year ? String(q.year) : "";
  const paper = q.paper ? q.paper.charAt(0).toUpperCase() + q.paper.slice(1) : "Mains";
  const subject = q.themeLabel || q.subtopic || q.microTheme || "";

  return `UPSC PYQ | ${paper}${year ? ` | ${year}` : ""}${subject ? ` | ${subject}` : ""}

Question:
${q.questionText || ""}

---

You are an AIR-1 level UPSC CSE Mentor, evaluator, and answer-writing expert.

Your role is NOT to explain — but to:
Train the aspirant to THINK, STRUCTURE, and WRITE like a topper
Generate a high-scoring UPSC Mains answer (8+/10)
Think like an examiner awarding marks

Strictly follow UPSC sources: Laxmikanth, DD Basu, ARC, NCERT, Supreme Court judgments, current affairs.

---

FIRST OUTPUT (MANDATORY)

30-SECOND MINDMAP (WRITE FIRST)

Core Theme
→ Static Base
→ Key Dimensions (4–5 max)
→ Examples / Case laws / Data
→ Challenges
→ Way Forward

Also add:
"What to write" vs "What to avoid"

---

OUTPUT STRUCTURE (STRICT)

1. QUESTION SOURCE IDENTIFICATION
- Static core (exact source: Laxmikanth / DD Basu / NCERT / IGNOU)
- Current affairs linkage (case/event if relevant)
- PYQ theme repetition
- GS paper + micro-topic

2. DEMAND DECONSTRUCTION
- Directive (Explain / Critically examine / Discuss etc.)
- Core theme (1 line)
- Hidden dimensions (2–3 high-value points aspirants miss)
- What exactly to write for 8+ marks

3. TOPPER THINKING FLOW (30 sec mental model)
- Keywords spotted
- Dimensions quickly formed
- What to prioritize
- What to avoid (time traps / over-writing)

4. PERFECT ANSWER FRAMEWORK
Introduction (2 options): case law / definition / current hook
Body (max 5–6 dimensions): subheading + 1–2 crisp analytical lines each
  Include: Constitutional/legal | Analytical | Case law/example | Governance/ethics angle
Conclusion: forward-looking + constitutional values + balanced

5. FINAL MODEL ANSWER (150–220 WORDS)
- Crisp, structured, exam-ready
- Subheadings for each dimension
- 2–3 case laws and keywords (dignity, liberty, accountability, etc.)
- No fluff, no repetition — every line adds value

6. SUBJECT-SPECIFIC VALUE ADD
- GS1 → society examples
- GS2 → Articles, case laws, committees
- GS3 → data, reports, schemes
- GS4 → ethics dimensions, values

7. EVALUATOR'S MARKING LOGIC
- What fetches marks (structure, keywords, case laws)
- What gives extra edge (multi-dimensionality, balance)
- What loses marks (generic content, missing directive)

8. GS INTERLINKAGES (max 3, only if natural)
- GS1 → Society dimension
- GS2 → Constitutional/governance
- GS3 → Tech/economy
- GS4 → Ethics
Each = 1 line only

9. VALUE ADDITION
- 5 keywords
- 2 case laws / committees / reports
- 1 real-world example
- 1 diagram/flowchart suggestion

10. COMMON MISTAKES
- 4–5 typical aspirant errors
- Traps specific to this question

11. MEMORY HOOK
- Mnemonic / recall structure for exam

---

STRICT RULES:
No generic content
No philosophical writing
Stay within UPSC word limit
Every line must add marks
Answer should feel written in 7 minutes
Think like evaluator + mentor + topper`;
}

// ── Explanation renderer ──────────────────────────────────────────────────────
// Renders pasted explanation text as Markdown using react-markdown + remark-gfm.
// Raw text is never mutated — this is display-only transformation.

const mdComponents = {
  h1: ({ children }) => (
    <h1 style={{
      fontSize: 24, fontWeight: 800, color: "#fbbf24",
      borderBottom: "2px solid rgba(251,191,36,0.30)",
      paddingBottom: 8, marginTop: 24, marginBottom: 14,
      fontFamily: "inherit", letterSpacing: "0.01em", lineHeight: 1.3,
    }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{
      fontSize: 20, fontWeight: 800, color: "#fcd34d",
      marginTop: 22, marginBottom: 10, fontFamily: "inherit",
      lineHeight: 1.35, letterSpacing: "0.01em",
      borderLeft: "3px solid rgba(251,191,36,0.55)",
      paddingLeft: 10,
    }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{
      fontSize: 17, fontWeight: 700, color: "#e2c84b",
      marginTop: 18, marginBottom: 8, fontFamily: "inherit",
      lineHeight: 1.4,
    }}>{children}</h3>
  ),
  p: ({ children }) => (
    <p style={{
      fontSize: 15, color: "#e2e8f0", lineHeight: 1.80,
      margin: "0 0 13px 0",
    }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul style={{
      listStyle: "none", padding: 0, margin: "0 0 12px 0",
    }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{
      listStyleType: "decimal", paddingLeft: 20, margin: "0 0 12px 0",
    }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{
      display: "flex", gap: 9, marginBottom: 7, alignItems: "flex-start",
    }}>
      <span style={{ color: "#4ade80", flexShrink: 0, marginTop: 4, fontSize: 13 }}>▸</span>
      <span style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.70 }}>{children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong style={{ color: "#f8fafc", fontWeight: 800 }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ color: "#94a3b8", fontStyle: "italic" }}>{children}</em>
  ),
  hr: () => (
    <hr style={{
      border: "none",
      borderTop: "1px solid rgba(251,191,36,0.20)",
      margin: "16px 0",
    }} />
  ),
  blockquote: ({ children }) => (
    <blockquote style={{
      borderLeft: "3px solid rgba(251,191,36,0.50)",
      paddingLeft: 14, margin: "12px 0",
      color: "#94a3b8", fontStyle: "italic",
    }}>{children}</blockquote>
  ),
  pre: ({ children }) => (
    <pre style={{
      background: "rgba(0,0,0,0.40)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 8, padding: "12px 14px",
      overflowX: "auto", margin: "10px 0",
      fontSize: 13, lineHeight: 1.55,
    }}>{children}</pre>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code style={{
        background: "rgba(56,189,248,0.12)",
        color: "#67e8f9",
        borderRadius: 4, padding: "1px 6px",
        fontSize: 13, fontFamily: "monospace",
      }}>{children}</code>
    ) : (
      <code style={{ fontFamily: "monospace", fontSize: 13 }}>{children}</code>
    ),
};

// ── Parse explanation into labelled sections ──────────────────────────────────
// Splits on markdown H2/H3 headings. Returns [{title, content}] or null if
// there are no headings (caller falls back to single-body display).
function parseExplanationSections(text) {
  const lines = text.split("\n");
  const sections = [];
  let currentTitle = null;
  let currentLines = [];

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)/);
    if (heading) {
      if (currentLines.some((l) => l.trim())) {
        sections.push({ title: currentTitle || "Explanation", content: currentLines.join("\n").trim() });
      }
      currentTitle = heading[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.some((l) => l.trim())) {
    sections.push({ title: currentTitle || "Explanation", content: currentLines.join("\n").trim() });
  }

  return sections.length > 1 ? sections : null;
}

// ── Section icon map (best-effort label → icon) ───────────────────────────────
function sectionIcon(title = "") {
  const t = title.toLowerCase();
  if (t.includes("wrong") || t.includes("mistake") || t.includes("error")) return "❌";
  if (t.includes("logic") || t.includes("answer") || t.includes("correct") || t.includes("solution")) return "✅";
  if (t.includes("takeaway") || t.includes("remember") || t.includes("tip") || t.includes("conclusion")) return "💡";
  if (t.includes("analysis") || t.includes("approach")) return "🔍";
  if (t.includes("example")) return "📌";
  return "📖";
}

// ── Three "thinking prompts" shown below any explanation ──────────────────────
const THINKING_PROMPTS = [
  { icon: "❓", label: "Why did I get this wrong?", color: "#f87171" },
  { icon: "✅", label: "What is the correct logic?",  color: "#34d399" },
  { icon: "💡", label: "My key takeaway from this",   color: "#fbbf24" },
];

// ── ExplanationPanel — right-side slide-in ────────────────────────────────────
function ExplanationPanel({ text, onClose }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  // Trigger slide-in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") handleClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    setOpen(false);
    setTimeout(onClose, 280); // wait for slide-out animation
  }

  function handleCopy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const sections = parseExplanationSections(text);

  const btnBase = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 700,
    padding: "5px 12px",
    cursor: "pointer",
    color: "#94a3b8",
  };

  return createPortal(
    <>
      {/* Thin backdrop — only dims, doesn't block question view */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: open ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0)",
          transition: "background 0.28s ease",
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* ── Side panel ── */}
      <div
        style={{
          position: "fixed",
          top: 0, right: 0,
          width: "min(440px, 100vw)",
          height: "100vh",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          background: "#0a0f1e",
          borderLeft: "1px solid rgba(251,191,36,0.20)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.55)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {/* ── Top bar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid rgba(251,191,36,0.14)",
          background: "rgba(251,191,36,0.05)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>📚</span>
            <span style={{
              fontSize: 11, fontWeight: 800, color: "#fbbf24",
              letterSpacing: "0.14em", textTransform: "uppercase",
            }}>
              Learning Panel
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={handleCopy} style={{
              ...btnBase, color: copied ? "#34d399" : "#94a3b8",
              border: copied ? "1px solid rgba(52,211,153,0.30)" : btnBase.border,
            }}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
            <button type="button" onClick={handleClose} style={{ ...btnBase }}>
              ✕
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>

          {/* Explanation content */}
          <div style={{ padding: "20px 20px 4px" }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: "#475569",
              letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12,
            }}>
              Saved Explanation
            </div>

            {sections ? (
              /* ── Sectioned view ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sections.map(({ title, content }, i) => (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12, overflow: "hidden",
                  }}>
                    <div style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      background: "rgba(255,255,255,0.03)",
                      display: "flex", alignItems: "center", gap: 7,
                    }}>
                      <span style={{ fontSize: 14 }}>{sectionIcon(title)}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: "#cbd5e1",
                        letterSpacing: "0.06em",
                      }}>
                        {title}
                      </span>
                    </div>
                    <div style={{ padding: "12px 14px" }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                        {content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Full-text view ── */
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12, padding: "14px 16px",
              }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {text}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* ── Thinking prompts divider ── */}
          <div style={{
            padding: "18px 20px 6px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{
              fontSize: 9, fontWeight: 800, color: "#334155",
              letterSpacing: "0.14em", textTransform: "uppercase",
            }}>
              Reflect
            </span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>

          {/* ── Thinking prompts ── */}
          <div style={{ padding: "4px 20px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
            {THINKING_PROMPTS.map(({ icon, label, color }) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${color}18`,
                borderRadius: 10, padding: "11px 14px",
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 12, color: "#475569", fontStyle: "italic", lineHeight: 1.5 }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

        </div>

        {/* ── Footer close strip ── */}
        <div style={{
          flexShrink: 0,
          padding: "12px 18px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 10, color: "#1e293b", letterSpacing: "0.08em" }}>
            ESC to close
          </span>
          <button type="button" onClick={handleClose}
            style={{ ...btnBase, padding: "7px 18px", fontSize: 12 }}>
            Close Panel ›
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Prompt Preview Modal ──────────────────────────────────────────────────────
function PromptPreviewModal({ prompt, onClose, onToast }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleCopy() {
    navigator.clipboard?.writeText(prompt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleOpen() {
    window.open("https://chat.openai.com/", "_blank", "noopener,noreferrer");
    onToast?.("✅ Prompt copied — press Ctrl+V in ChatGPT");
    onClose();
  }

  // Show first 8 lines as preview
  const preview = prompt.split("\n").slice(0, 8).join("\n");

  const btnBase = {
    flex: 1, padding: "10px 0", borderRadius: 10,
    fontSize: 13, fontWeight: 700, cursor: "pointer",
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.78)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "clamp(48px, 8vh, 96px) 16px 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex", flexDirection: "column",
          width: "100%", maxWidth: 560,
          background: "#0f172a",
          border: "1px solid rgba(251,191,36,0.30)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.65)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "13px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(251,191,36,0.06)",
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 800, color: "#fbbf24",
            letterSpacing: "0.14em", textTransform: "uppercase",
          }}>
            AI Prompt Preview
          </span>
          <button type="button" onClick={onClose} style={{
            background: "none", border: "none", color: "#475569",
            fontSize: 16, cursor: "pointer", padding: "2px 6px", lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Preview — first 8 lines */}
        <div style={{
          maxHeight: 200, overflowY: "auto",
          padding: "14px 18px",
          background: "rgba(0,0,0,0.30)",
          flexShrink: 0,
        }}>
          <pre style={{
            margin: 0, fontSize: 12, color: "#64748b",
            lineHeight: 1.7, whiteSpace: "pre-wrap",
            fontFamily: "monospace",
          }}>
            {preview}
            {"\n…"}
          </pre>
        </div>

        {/* Helper hint */}
        <div style={{
          padding: "9px 18px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          fontSize: 11, color: "#334155",
          letterSpacing: "0.01em",
        }}>
          Copy prompt → Open ChatGPT → Press Ctrl+V → Get answer
        </div>

        {/* Actions */}
        <div style={{
          display: "flex", gap: 8, padding: "12px 18px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}>
          <button type="button" onClick={handleCopy} style={{
            ...btnBase,
            border: `1px solid ${copied ? "rgba(251,191,36,0.55)" : "rgba(251,191,36,0.35)"}`,
            background: copied ? "rgba(251,191,36,0.18)" : "rgba(251,191,36,0.08)",
            color: copied ? "#fde68a" : "#fbbf24",
          }}>
            {copied ? "✓ Copied!" : "Copy Prompt"}
          </button>
          <button type="button" onClick={handleOpen} style={{
            ...btnBase,
            border: "1px solid rgba(34,197,94,0.40)",
            background: "rgba(34,197,94,0.10)",
            color: "#86efac",
          }}>
            Open ChatGPT ↗
          </button>
          <button type="button" onClick={onClose} style={{
            ...btnBase, flex: "0 0 auto",
            padding: "10px 16px",
            border: "1px solid rgba(255,255,255,0.10)",
            background: "none",
            color: "#475569",
          }}>
            Skip
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ActionButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: active
          ? "1px solid rgba(96,165,250,0.50)"
          : "1px solid rgba(255,255,255,0.10)",
        background: active ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.04)",
        color: active ? "#dbeafe" : "#cbd5e1",
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ModePill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 12,
        border: active
          ? "1px solid rgba(96,165,250,0.45)"
          : "1px solid rgba(255,255,255,0.08)",
        background: active
          ? "linear-gradient(180deg, rgba(37,99,235,0.22) 0%, rgba(30,64,175,0.22) 100%)"
          : "rgba(255,255,255,0.04)",
        color: active ? "#eff6ff" : "#cbd5e1",
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: active ? "0 6px 18px rgba(37,99,235,0.16)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function FilterPill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: active
          ? "1px solid rgba(125,211,252,0.38)"
          : "1px solid rgba(255,255,255,0.10)",
        background: active
          ? "rgba(14,165,233,0.16)"
          : "rgba(255,255,255,0.03)",
        color: active ? "#e0f2fe" : "#cbd5e1",
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function renderOptionText(opt) {
  if (typeof opt === "string") return opt;
  if (opt == null) return "";
  return opt.text || opt.label || opt.value || String(opt);
}

function normalizeAnswerKey(answer) {
  if (answer == null) return "";
  const raw = String(answer).trim().toLowerCase();

  if (["a", "b", "c", "d"].includes(raw)) return raw;
  if (["1", "2", "3", "4"].includes(raw)) {
    return ["a", "b", "c", "d"][Number(raw) - 1] || "";
  }

  return raw;
}

function matchesReviewFilter(q, reviewFilter, answerVisibilityMap) {
  const hasOptions = Array.isArray(q.options) && q.options.length > 0;
  const hasAnswer = !!normalizeAnswerKey(q.answer);
  const isAnswerShown = !!answerVisibilityMap[q.id];

  switch (reviewFilter) {
    case "unread":
      return !q.isRead;
    case "read":
      return !!q.isRead;
    case "important":
      return !!q.isImportant;
    case "weak":
      return !!q.isWeak;
    case "with_options":
      return hasOptions;
    case "without_options":
      return !hasOptions;
    case "with_answer":
      return hasAnswer;
    case "without_answer":
      return !hasAnswer;
    case "answer_shown":
      return isAnswerShown;
    case "flagged":
      return !!q.isImportant || !!q.isWeak;
    default:
      return true;
  }
}

function QuestionCard({
  q,
  isAnswerShown = false,
  onSetAnswerShown,
  onToggleRead,
  onToggleWeak,
  onToggleImportant,
  initialExplanation = "",
  nodeId = "",
}) {
  const answerKey = normalizeAnswerKey(q.answer);
  const hasOptions = Array.isArray(q.options) && q.options.length > 0;
  const hasAnswer = !!answerKey;
  const isMains = isMainsQuestion(q.paper);

  const [savedExplanation, setSavedExplanation] = useState("");
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [promptPreview, setPromptPreview] = useState(null); // non-null → preview modal open

  // Hydrate from DB on first load (bulk fetch may complete after mount)
  const appliedInitialRef = useRef(false);
  useEffect(() => {
    if (!appliedInitialRef.current && initialExplanation) {
      appliedInitialRef.current = true;
      setSavedExplanation(initialExplanation);
    }
  }, [initialExplanation]);

  // Persist explanation to DB when user leaves the textarea
  async function saveExplanationToDB(text) {
    if (!text || !q.id) return;
    try {
      await fetch(`${BACKEND_URL}/api/pyq/explanations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user_1",
          questionId: q.id,
          nodeId: nodeId || "",
          explanationText: text,
          source: "chatgpt",
        }),
      });
    } catch (err) {
      console.error("[QuestionCard] explanation save failed (non-fatal):", err);
    }
  }

  function handleToggleAnswer() {
    onSetAnswerShown?.(q.id, !isAnswerShown);
  }

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        borderRadius: 18,
        padding: "18px 18px 16px",
        boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(59,130,246,0.14)",
            border: "1px solid rgba(96,165,250,0.24)",
            color: "#dbeafe",
          }}
        >
          {yearLabel(q.year)}
        </span>

        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(16,185,129,0.12)",
            border: "1px solid rgba(52,211,153,0.22)",
            color: "#d1fae5",
          }}
        >
          {paperLabel(q.paper)}
        </span>

        {q.questionNumber ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#e2e8f0",
            }}
          >
            Q{q.questionNumber}
          </span>
        ) : null}

        {cleanLabel(q.microTheme) ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(168,85,247,0.14)",
              border: "1px solid rgba(192,132,252,0.24)",
              color: "#f3e8ff",
              maxWidth: "100%",
            }}
          >
            {cleanLabel(q.microTheme).toUpperCase()}
          </span>
        ) : null}

        {!!q.isImportant ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(250,204,21,0.14)",
              border: "1px solid rgba(250,204,21,0.25)",
              color: "#fde68a",
            }}
          >
            IMPORTANT
          </span>
        ) : null}

        {!!q.isWeak ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(248,113,113,0.12)",
              border: "1px solid rgba(248,113,113,0.22)",
              color: "#fecaca",
            }}
          >
            REVISE
          </span>
        ) : null}

        {!!q.isRead ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.22)",
              color: "#bbf7d0",
            }}
          >
            READ
          </span>
        ) : null}
      </div>

      <div
        style={{
          fontSize: 16,
          lineHeight: 1.7,
          color: "#f8fafc",
          marginBottom: 14,
          whiteSpace: "pre-wrap",
        }}
      >
        {q.questionText}
      </div>

      {hasOptions ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {q.options.map((opt, idx) => {
            const optionLetter = String.fromCharCode(97 + idx);
            const isCorrect = isAnswerShown && answerKey === optionLetter;

            return (
              <div
                key={`${q.id}-opt-${idx}`}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: isCorrect
                    ? "rgba(16,185,129,0.14)"
                    : "rgba(255,255,255,0.03)",
                  border: isCorrect
                    ? "1px solid rgba(52,211,153,0.35)"
                    : "1px solid rgba(255,255,255,0.07)",
                  color: isCorrect ? "#ecfdf5" : "#dbe4f0",
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                <span style={{ fontWeight: 700, color: "#ffffff" }}>
                  {String.fromCharCode(65 + idx)}.
                </span>{" "}
                {renderOptionText(opt)}
                {isCorrect ? (
                  <span
                    style={{
                      marginLeft: 10,
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#86efac",
                    }}
                  >
                    ✓ Correct
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {isAnswerShown && hasAnswer ? (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(16,185,129,0.10)",
            border: "1px solid rgba(52,211,153,0.22)",
            color: "#d1fae5",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Correct Answer: {answerKey.toUpperCase()}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <ActionButton
          active={q.isRead}
          onClick={() => onToggleRead(q.id)}
        >
          {q.isRead ? "Read ✓" : "Mark Read"}
        </ActionButton>

        <ActionButton
          active={q.isImportant}
          onClick={() => onToggleImportant(q.id)}
        >
          {q.isImportant ? "Important ★" : "Important"}
        </ActionButton>

        <ActionButton
          active={q.isWeak}
          onClick={() => {
            const adding = !q.isWeak;
            onToggleWeak(q.id); // update localStorage progress
            if (adding) {
              fetch(`${BACKEND_URL}/api/revision-items`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: "user_1",
                  questionId: q.id,
                  questionText: q.questionText || "",
                  stage: q.paper || "prelims",
                  subject: nodeId || q.themeLabel || q.subtopic || null,
                  nodeId: nodeId || null,
                  year: q.year || null,
                  paper: q.paper || null,
                  priority: "medium",
                }),
              }).catch(() => {}); // non-fatal — localStorage is source of truth for UI
            } else {
              fetch(
                `${BACKEND_URL}/api/revision-items/by-question/${encodeURIComponent(q.id)}?userId=user_1`,
                { method: "DELETE" }
              ).catch(() => {});
            }
          }}
        >
          {q.isWeak ? "Revise Later ↺" : "Revise Later"}
        </ActionButton>

        {hasAnswer ? (
          <ActionButton
            active={isAnswerShown}
            onClick={handleToggleAnswer}
          >
            {isAnswerShown ? "Hide Answer" : "Show Answer"}
          </ActionButton>
        ) : null}
      </div>

      {/* Row 2: AI action buttons — Mains or Prelims button + Paste Explanation */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {isMains ? (
          /* ── Mains only: AIR-1 Answer Writing button ── */
          <button
            type="button"
            onClick={() => {
              const prompt = buildMainsPrompt(q);
              navigator.clipboard?.writeText(prompt).catch(() => {});
              setPromptPreview(prompt);
            }}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "13px 16px",
              borderRadius: 14,
              border: "1px solid rgba(251,191,36,0.45)",
              background: "linear-gradient(135deg, rgba(251,191,36,0.14) 0%, rgba(217,119,6,0.10) 100%)",
              color: "#fde68a",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.02em",
              cursor: "pointer",
              transition: "transform 0.1s, opacity 0.1s",
            }}
          >
            <span style={{ fontSize: 15 }}>✦</span>
            Generate AIR-1 Answer
          </button>
        ) : (
          /* ── Prelims / others: existing Ask ChatGPT button (unchanged) ── */
          <button
            type="button"
            onClick={() => {
              const body = [
                "You are a UPSC CSE Prelims expert mentor. Analyze this question and teach me how to solve it in the exam.",
                "",
                "1. What core concept is being tested?",
                "2. Why is the correct answer right?",
                "3. Eliminate each wrong option using UPSC prelims logic.",
                "4. How would a UPSC topper think through this under time pressure?",
                "5. Give one memory trick or exam shortcut for this concept.",
                "6. Does this pattern appear frequently in UPSC Prelims?",
                "",
                "Be accurate, concise, and exam-focused.",
              ].join("\n");
              const url = `https://chatgpt.com/?q=${encodeURIComponent(
                buildChatGPTHeader(q) + body
              )}`;
              window.open(url, "_blank", "noopener,noreferrer");
            }}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "13px 16px",
              borderRadius: 14,
              border: "1px solid rgba(16,185,129,0.40)",
              background: "linear-gradient(135deg, rgba(16,185,129,0.16) 0%, rgba(5,150,105,0.10) 100%)",
              color: "#6ee7b7",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.02em",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 15 }}>✦</span>
            Ask ChatGPT
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowPasteArea((prev) => !prev)}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "13px 16px",
            borderRadius: 14,
            border: "1px solid rgba(99,102,241,0.40)",
            background: showPasteArea
              ? "rgba(99,102,241,0.18)"
              : "rgba(99,102,241,0.08)",
            color: "#c4b5fd",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.02em",
            cursor: "pointer",
          }}
        >
          ✎ Paste Explanation
        </button>
      </div>

      {/* Micro guidance + copy-again fallback */}
      <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <span style={{ fontSize: 11, color: "#334155", letterSpacing: "0.01em" }}>
          {isMains
            ? "1. Click → 2. Paste in ChatGPT (Ctrl+V) → 3. Get full AIR-1 answer"
            : "Click to analyze this question in ChatGPT"}
        </span>
        {isMains && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(buildMainsPrompt(q)).catch(() => {});
              setToastMsg("✅ Copied again — press Ctrl+V in ChatGPT");
              setTimeout(() => setToastMsg(""), 2500);
            }}
            style={{
              background: "none", border: "none", padding: 0,
              color: "#475569", fontSize: 11, cursor: "pointer",
              textDecoration: "underline", textUnderlineOffset: 2,
            }}
          >
            Copy again
          </button>
        )}
      </div>

      {/* Paste area — shown when toggled */}
      {showPasteArea && (
        <div style={{ marginBottom: 10 }}>
          <textarea
            placeholder="Paste ChatGPT explanation here…"
            value={savedExplanation}
            onChange={(e) => setSavedExplanation(e.target.value)}
            onBlur={() => { if (savedExplanation) saveExplanationToDB(savedExplanation); }}
            style={{
              width: "100%",
              minHeight: 120,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(99,102,241,0.30)",
              borderRadius: 10,
              color: "#e2e8f0",
              fontSize: 13,
              padding: "10px 12px",
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          {savedExplanation && (
            <div style={{ fontSize: 11, color: "#6ee7b7", marginTop: 4 }}>
              ✓ Explanation saved — click View Explanation to read it
            </div>
          )}
        </div>
      )}

      {/* Saved explanation chip + modal trigger */}
      {savedExplanation && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#fbbf24",
            background: "rgba(251,191,36,0.10)",
            border: "1px solid rgba(251,191,36,0.25)",
            borderRadius: 999, padding: "4px 10px",
          }}>
            ✦ Explanation saved
          </span>
          <button
            type="button"
            onClick={() => setShowExplanationModal(true)}
            style={{
              padding: "6px 14px", borderRadius: 10,
              border: "1px solid rgba(251,191,36,0.35)",
              background: "rgba(251,191,36,0.08)",
              color: "#fde68a", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            Open Learning Panel →
          </button>
        </div>
      )}

      {/* Learning panel — slides in from right, question stays visible */}
      {showExplanationModal && (
        <ExplanationPanel
          text={savedExplanation}
          onClose={() => setShowExplanationModal(false)}
        />
      )}

      {/* Prompt preview modal */}
      {promptPreview && (
        <PromptPreviewModal
          prompt={promptPreview}
          onClose={() => setPromptPreview(null)}
          onToast={(msg) => {
            setToastMsg(msg);
            setTimeout(() => setToastMsg(""), 2600);
          }}
        />
      )}

      {/* Toast — clipboard copy confirmation with slide-up animation */}
      {toastMsg && (
        <>
          <style>{`
            @keyframes _toast_in {
              from { opacity: 0; transform: translateX(-50%) translateY(10px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0);    }
            }
          `}</style>
          <div style={{
            position: "fixed", bottom: 28, left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10001,
            background: "#0f172a",
            border: "1px solid rgba(251,191,36,0.50)",
            borderRadius: 12,
            padding: "12px 22px",
            fontSize: 14, fontWeight: 700,
            color: "#fde68a",
            boxShadow: "0 10px 32px rgba(0,0,0,0.60)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            animation: "_toast_in 0.22s ease-out",
          }}>
            {toastMsg}
          </div>
        </>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#cbd5e1",
          }}
        >
          {hasOptions ? `${q.options.length} options` : "No options"}
        </span>

        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: hasAnswer ? "#bbf7d0" : "#cbd5e1",
          }}
        >
          {hasAnswer ? "Answer available" : "Answer not available"}
        </span>
      </div>
    </div>
  );
}

export default function PyqQuickView({
  questions = [],
  total = 0,
  viewedCount = 0,
  timelineMode = "normal",
  setTimelineMode,
  selectedYear = "all",
  setSelectedYear,
  // selectedTheme / setSelectedTheme intentionally not used here —
  // topic filtering is done locally via selectedTopicGroup
  onToggleRead,
  onToggleWeak,
  onToggleImportant,
  explanationsMap = {},
  nodeId = "",
}) {
  const [reviewFilter, setReviewFilter] = useState("all");
  const [showMarkedOnly, setShowMarkedOnly] = useState(false);
  const [answerVisibilityMap, setAnswerVisibilityMap] = useState({});
  const [selectedTopicGroup, setSelectedTopicGroup] = useState("all");

  const timelineGroups = useMemo(() => buildTimelineGroups(questions), [questions]);
  const topicGroups = useMemo(() => buildTopicGroups(questions), [questions]);

  const stats = useMemo(() => {
    const totalVisible = questions.length;
    const read = questions.filter((q) => q.isRead).length;
    const unread = questions.filter((q) => !q.isRead).length;
    const important = questions.filter((q) => q.isImportant).length;
    const weak = questions.filter((q) => q.isWeak).length;
    const withOptions = questions.filter((q) => Array.isArray(q.options) && q.options.length > 0).length;
    const withAnswer = questions.filter((q) => !!normalizeAnswerKey(q.answer)).length;
    const answersShown = questions.filter((q) => !!answerVisibilityMap[q.id]).length;

    return {
      totalVisible,
      read,
      unread,
      important,
      weak,
      withOptions,
      withAnswer,
      answersShown,
      flagged: questions.filter((q) => q.isImportant || q.isWeak).length,
    };
  }, [questions, answerVisibilityMap]);

  const reviewFilteredQuestions = useMemo(() => {
    let items = [...questions];

    if (showMarkedOnly) {
      items = items.filter((q) => q.isImportant || q.isWeak);
    }

    items = items.filter((q) => matchesReviewFilter(q, reviewFilter, answerVisibilityMap));

    if (selectedTopicGroup !== "all") {
      items = items.filter(
        (q) =>
          (cleanLabel(q.microTheme) ||
            cleanLabel(q.subtopic) ||
            cleanLabel(q.themeLabel)) === selectedTopicGroup
      );
    }

    return items;
  }, [questions, reviewFilter, showMarkedOnly, answerVisibilityMap, selectedTopicGroup]);

  const filteredTimelineGroups = useMemo(
    () => buildTimelineGroups(reviewFilteredQuestions),
    [reviewFilteredQuestions]
  );

  const filteredTopicGroups = useMemo(
    () => buildTopicGroups(reviewFilteredQuestions),
    [reviewFilteredQuestions]
  );

  function handleSetAnswerShown(questionId, nextValue) {
    setAnswerVisibilityMap((prev) => ({
      ...prev,
      [questionId]: nextValue,
    }));
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
          borderRadius: 20,
          padding: "18px 18px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(180,205,255,0.72)",
                marginBottom: 6,
                fontWeight: 700,
              }}
            >
              Quick View
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#ffffff",
              }}
            >
              {reviewFilteredQuestions.length} visible questions
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: 4,
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <ModePill
                active={timelineMode === "normal"}
                onClick={() => { setTimelineMode?.("normal"); setSelectedTopicGroup("all"); }}
              >
                Flat
              </ModePill>

              <ModePill
                active={timelineMode === "timeline"}
                onClick={() => { setTimelineMode?.("timeline"); setSelectedTopicGroup("all"); }}
              >
                Timeline
              </ModePill>

              <ModePill
                active={timelineMode === "topic"}
                onClick={() => setTimelineMode?.("topic")}
              >
                By Topic
              </ModePill>
            </div>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                fontSize: 14,
                color: "#cbd5e1",
              }}
            >
              Viewed <strong style={{ color: "#fff" }}>{viewedCount}</strong> / {questions.length}
            </div>

            <div
              style={{
                fontSize: 14,
                color: "#cbd5e1",
              }}
            >
              Total in topic: <strong style={{ color: "#fff" }}>{total}</strong>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Visible now</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
              {reviewFilteredQuestions.length}
            </div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Read</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{stats.read}</div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Unread</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{stats.unread}</div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Important</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{stats.important}</div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Revise later</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{stats.weak}</div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>With answers</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{stats.withAnswer}</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <FilterPill active={reviewFilter === "all"} onClick={() => setReviewFilter("all")}>
            All
          </FilterPill>
          <FilterPill active={reviewFilter === "unread"} onClick={() => setReviewFilter("unread")}>
            Unread
          </FilterPill>
          <FilterPill active={reviewFilter === "read"} onClick={() => setReviewFilter("read")}>
            Read
          </FilterPill>
          <FilterPill active={reviewFilter === "important"} onClick={() => setReviewFilter("important")}>
            Important
          </FilterPill>
          <FilterPill active={reviewFilter === "weak"} onClick={() => setReviewFilter("weak")}>
            Revise Later
          </FilterPill>
          <FilterPill active={reviewFilter === "flagged"} onClick={() => setReviewFilter("flagged")}>
            Flagged
          </FilterPill>
          <FilterPill active={reviewFilter === "with_options"} onClick={() => setReviewFilter("with_options")}>
            With Options
          </FilterPill>
          <FilterPill active={reviewFilter === "with_answer"} onClick={() => setReviewFilter("with_answer")}>
            With Answers
          </FilterPill>
          <FilterPill active={reviewFilter === "without_answer"} onClick={() => setReviewFilter("without_answer")}>
            No Answers
          </FilterPill>
          <FilterPill active={reviewFilter === "answer_shown"} onClick={() => setReviewFilter("answer_shown")}>
            Answer Shown
          </FilterPill>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <FilterPill
            active={showMarkedOnly}
            onClick={() => setShowMarkedOnly((prev) => !prev)}
          >
            {showMarkedOnly ? "Review Marked Only ✓" : "Review Marked Only"}
          </FilterPill>

          {timelineMode === "timeline" ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedYear?.("all")}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  background:
                    selectedYear === "all"
                      ? "rgba(59,130,246,0.18)"
                      : "rgba(255,255,255,0.03)",
                  border:
                    selectedYear === "all"
                      ? "1px solid rgba(96,165,250,0.35)"
                      : "1px solid rgba(255,255,255,0.10)",
                  fontSize: 12,
                  color: selectedYear === "all" ? "#eff6ff" : "#cbd5e1",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                All Years
              </button>

              {timelineGroups.map((group) => (
                <button
                  type="button"
                  key={group.label}
                  onClick={() => setSelectedYear?.(group.year)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    background:
                      Number(selectedYear) === Number(group.year)
                        ? "rgba(59,130,246,0.18)"
                        : "rgba(59,130,246,0.08)",
                    border:
                      Number(selectedYear) === Number(group.year)
                        ? "1px solid rgba(96,165,250,0.35)"
                        : "1px solid rgba(96,165,250,0.18)",
                    fontSize: 12,
                    color: "#dbeafe",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {group.label} ({group.items.length})
                </button>
              ))}
            </>
          ) : timelineMode === "topic" ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedTopicGroup("all")}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: selectedTopicGroup === "all" ? "rgba(168,85,247,0.22)" : "rgba(255,255,255,0.03)",
                  border: selectedTopicGroup === "all" ? "1px solid rgba(192,132,252,0.50)" : "1px solid rgba(255,255,255,0.10)",
                  fontSize: 12,
                  color: selectedTopicGroup === "all" ? "#f3e8ff" : "#94a3b8",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                All Topics
              </button>
              {topicGroups.map((group) => {
                const active = selectedTopicGroup === group.topic;
                return (
                  <button
                    type="button"
                    key={group.topic}
                    onClick={() => setSelectedTopicGroup(active ? "all" : group.topic)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      background: active ? "rgba(168,85,247,0.22)" : "rgba(168,85,247,0.08)",
                      border: active ? "1px solid rgba(192,132,252,0.55)" : "1px solid rgba(192,132,252,0.18)",
                      fontSize: 12,
                      color: "#f3e8ff",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {group.topic} ({group.items.length})
                  </button>
                );
              })}
            </>
          ) : null}
        </div>
      </div>

      {reviewFilteredQuestions.length === 0 ? (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 18,
            padding: "24px",
            color: "#cbd5e1",
            fontSize: 16,
          }}
        >
          No questions match the current review filters.
        </div>
      ) : timelineMode === "timeline" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {filteredTimelineGroups.map((group) => (
            <section
              key={group.label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "10px 14px",
                  borderRadius: 16,
                  background:
                    "linear-gradient(180deg, rgba(18,30,60,0.92) 0%, rgba(11,20,40,0.92) 100%)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#ffffff",
                  }}
                >
                  {group.label}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "#cbd5e1",
                  }}
                >
                  {group.items.length} question{group.items.length > 1 ? "s" : ""}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {group.items.map((q) => (
                  <QuestionCard
                    key={q.id}
                    q={q}
                    isAnswerShown={!!answerVisibilityMap[q.id]}
                    onSetAnswerShown={handleSetAnswerShown}
                    onToggleRead={onToggleRead}
                    onToggleWeak={onToggleWeak}
                    onToggleImportant={onToggleImportant}
                    initialExplanation={explanationsMap[q.id]?.explanation_text || ""}
                    nodeId={nodeId}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : timelineMode === "topic" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {filteredTopicGroups.map((group) => (
            <section
              key={group.topic}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "10px 14px",
                  borderRadius: 16,
                  background:
                    "linear-gradient(180deg, rgba(18,30,60,0.92) 0%, rgba(11,20,40,0.92) 100%)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#ffffff",
                  }}
                >
                  {group.topic}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "#cbd5e1",
                  }}
                >
                  {group.items.length} question{group.items.length > 1 ? "s" : ""}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {group.items.map((q) => (
                  <QuestionCard
                    key={q.id}
                    q={q}
                    isAnswerShown={!!answerVisibilityMap[q.id]}
                    onSetAnswerShown={handleSetAnswerShown}
                    onToggleRead={onToggleRead}
                    onToggleWeak={onToggleWeak}
                    onToggleImportant={onToggleImportant}
                    initialExplanation={explanationsMap[q.id]?.explanation_text || ""}
                    nodeId={nodeId}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {reviewFilteredQuestions.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              isAnswerShown={!!answerVisibilityMap[q.id]}
              onSetAnswerShown={handleSetAnswerShown}
              onToggleRead={onToggleRead}
              onToggleWeak={onToggleWeak}
              onToggleImportant={onToggleImportant}
              initialExplanation={explanationsMap[q.id]?.explanation_text || ""}
              nodeId={nodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}