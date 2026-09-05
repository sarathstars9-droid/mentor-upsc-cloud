import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../../config.js";
import HandwrittenSheetReviewPanel from "../../components/HandwrittenSheetReviewPanel.jsx";
import "../../styles/ethics-workspace.css";

const ETHICS_CATS = [
  { id: "GS4-ETH-HV", label: "Ethics & Human Interface", icon: "◉", desc: "Essence, determinants, consequences, human values" },
  { id: "GS4-ETH-ATT", label: "Attitude", icon: "◎", desc: "Content, structure, function, persuasion and behaviour" },
  { id: "GS4-ETH-APPLIED", label: "Aptitude & Foundational Values", icon: "◇", desc: "Integrity, impartiality, objectivity, empathy and courage" },
  { id: "GS4-ETH-EI", label: "Emotional Intelligence", icon: "◌", desc: "Self-awareness, empathy and administrative application" },
  { id: "GS4-ETH-THINK", label: "Moral Thinkers", icon: "◫", desc: "Indian and world thinkers, ideas and ethical application" },
  { id: "GS4-ETH-GOV", label: "Civil Service Values", icon: "▦", desc: "Public service, accountability and ethical governance" },
  { id: "GS4-ETH-PROB", label: "Probity in Governance", icon: "◇", desc: "Transparency, integrity, RTI, codes and corruption" },
  { id: "GS4-ETH-CS", label: "Case Studies", icon: "▤", desc: "Stakeholders, dilemmas, options, decisions and implementation" },
];

function normalizeCategoryId(q) {
  const nid = String(q?.syllabusNodeId || q?.nodeId || "").trim();
  if (nid === "GS4-ETH-HUM" || nid === "GS4-ETH-FOUND") return "GS4-ETH-HV";
  if (nid === "GS4-ETH-ATTITUDE") return "GS4-ETH-ATT";
  if (nid === "GS4-ETH-CONFLICT") return "GS4-ETH-GOV";
  if (nid.startsWith("GS4-CASE-") || q?.type === "CASE_STUDY") return "GS4-ETH-CS";
  if (nid.startsWith("GS4-ETH-AP-")) return "GS4-ETH-APPLIED";
  return nid;
}

function questionText(answer) {
  let text = String(answer?.question || answer?.questionText || answer?.prompt || answer?.verifiedQuestionText || "").trim();
  if (!text || text.startsWith("Ethics case study") || text.includes("[object Object]")) {
    return "Ethics answer";
  }
  return text;
}

function isEthicsAnswer(answer) {
  const blob = [answer?.paper, answer?.subject, answer?.workspace, answer?.question].filter(Boolean).join(" ").toLowerCase();
  return blob.includes("gs4") || blob.includes("gs 4") || blob.includes("ethic") || blob.includes("integrity");
}

function wordLimitFor(q) {
  const direct = Number(q?.wordLimit || q?.word_limit || q?.words);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const marks = Number(q?.marks);
  if (marks === 10) return 150;
  if (marks >= 15) return 250;
  return null;
}

export default function EthicsPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recommendationIndex, setRecommendationIndex] = useState(0);
  const [showWhy, setShowWhy] = useState(false);
  const [showHandwritten, setShowHandwritten] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      fetch(`${BACKEND_URL}/api/subject-pyq?subject=ethics`, { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject(new Error(`Questions ${r.status}`))),
      fetch(`${BACKEND_URL}/api/mains-answers?userId=user_1`, { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject(new Error(`Answers ${r.status}`))),
    ]).then(([qResult, aResult]) => {
      if (!alive) return;
      if (qResult.status === "fulfilled") setQuestions(Array.isArray(qResult.value?.questions) ? qResult.value.questions : []);
      if (aResult.status === "fulfilled") setAnswers(Array.isArray(aResult.value) ? aResult.value : []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const ethicsAnswers = useMemo(() => answers.filter(isEthicsAnswer), [answers]);
  const attempted = useMemo(() => new Set(ethicsAnswers.map(a => questionText(a).toLowerCase()).filter(Boolean)), [ethicsAnswers]);
  const queue = useMemo(() => {
    const sorted = [...questions].sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    const unattempted = sorted.filter(q => !attempted.has(String(q.question || "").trim().toLowerCase()));
    const theory10 = unattempted.filter(q => q.type !== "CASE_STUDY" && normalizeCategoryId(q) !== "GS4-ETH-CS" && Number(q.marks) === 10);
    return theory10.length ? theory10 : (unattempted.length ? unattempted : sorted);
  }, [questions, attempted]);
  const recommendation = queue.length ? queue[recommendationIndex % queue.length] : null;

  const counts = useMemo(() => {
    const map = Object.fromEntries(ETHICS_CATS.map(c => [c.id, 0]));
    questions.forEach(q => {
      const id = normalizeCategoryId(q);
      if (id in map) map[id] += 1;
    });
    return map;
  }, [questions]);

  const caseCount = counts["GS4-ETH-CS"] || 0;
  const theoryCount = questions.filter(q => normalizeCategoryId(q) !== "GS4-ETH-CS" && q.type !== "CASE_STUDY").length;
  const thinkerCount = counts["GS4-ETH-THINK"] || 0;
  const recent = ethicsAnswers.slice(0, 4);

  const hasSufficientEvidence = ethicsAnswers.filter(a => a.evaluation || a.basicReview || a.score != null).length >= 3;
  const hasWeaknessSignals = ethicsAnswers.filter(a => (a.score != null && Number(a.score) < 8) || a.isWeak || a.needsRevision).length > 0;

  function startQuestion(q) {
    if (!q) return navigate("/ethics/pyq");
    const category = ETHICS_CATS.find(c => c.id === normalizeCategoryId(q));
    const normalized = {
      id: q.id,
      paper: "GS4",
      year: q.year || null,
      question: q.question,
      marks: q.marks != null ? String(q.marks) : "",
      wordLimit: wordLimitFor(q),
      structure: q.structure || q.type || "",
      focus: category?.label || "Ethics",
      priority: "UPSC Ethics PYQ · High Priority",
      subparts: Array.isArray(q.subparts) ? q.subparts : [],
      syllabusNodeId: normalizeCategoryId(q),
      nodeId: normalizeCategoryId(q),
      source: `UPSC ${q.year || ""}`.trim(),
    };
    navigate("/mains/answer-writing", {
      state: {
        paper: "GS4",
        mode: "PYQ",
        year: q.year || null,
        topic: category?.label || "Ethics",
        syllabusNodeId: normalizeCategoryId(q),
        questions: [normalized],
        currentIndex: 0,
        question: normalized,
      },
    });
  }

  const practices = [
    { icon: "▣", name: "Theory PYQs", desc: "Practice UPSC GS4 theory by syllabus area and question type.", foot: `${theoryCount} questions`, onClick: () => navigate("/ethics/pyq?mode=theory") },
    { icon: "▤", name: "Case Study Lab", desc: "Practice stakeholder mapping, dilemmas, options and administrative resolution.", foot: `${caseCount} cases`, onClick: () => navigate("/ethics/pyq?category=GS4-ETH-CS&type=CASE_STUDY") },
    { icon: "◫", name: "Thinkers & Quotes", desc: "Use thinkers as reasoning tools — not as decorative name-dropping.", foot: `${thinkerCount} questions`, onClick: () => navigate("/ethics/pyq?category=GS4-ETH-THINK") },
    { icon: "✎", name: "Handwritten Review", desc: "Upload a handwritten GS4 answer, verify OCR, then evaluate it.", foot: "Upload & review", onClick: () => setShowHandwritten(v => !v) },
  ];

  return (
    <div className="eth-page">
      <div className="eth-shell">
        <header>
          <div className="eth-kicker">Mains · GS Paper IV</div>
          <h1 className="eth-title">Ethics, Integrity & Aptitude</h1>
          <p className="eth-subtitle">Theory, thinkers, public-service values, probity and case-study execution — organized around what UPSC actually tests.</p>
          <div className="eth-meta-row">
            <span className="eth-meta-pill"><span className="eth-meta-dot" />{loading ? "Loading PYQs…" : `${questions.length} PYQs`}</span>
            <span className="eth-meta-pill">{caseCount} Case Studies</span>
            <span className="eth-meta-pill">{thinkerCount} Thinker-linked</span>
            <span className="eth-meta-pill">{ethicsAnswers.length} {ethicsAnswers.length === 1 ? "answer recorded" : "answers recorded"}</span>
          </div>
        </header>

        <section className="eth-section">
          <div className="eth-card eth-next">
            <div className="eth-next-label"><span>Next Action</span><span>{recommendation ? "Unattempted PYQ queue" : "Build your GS4 baseline"}</span></div>
            {recommendation ? (
              <>
                <div className="eth-next-question">{recommendation.question}</div>
                <div className="eth-next-reason">Write it under exam conditions, then evaluate for ethical dimensions, examples, administrative application and conclusion quality.</div>
                <div className="eth-next-meta">
                  {recommendation.year && <span className="eth-meta-pill">UPSC {recommendation.year}</span>}
                  {recommendation.marks != null && <span className="eth-meta-pill">{recommendation.marks} marks</span>}
                  {wordLimitFor(recommendation) && <span className="eth-meta-pill">~{wordLimitFor(recommendation)} words</span>}
                  <span className="eth-meta-pill">{ETHICS_CATS.find(c => c.id === normalizeCategoryId(recommendation))?.label || "GS4"}</span>
                </div>
                <div className="eth-next-actions">
                  <button className="eth-btn eth-btn-primary" onClick={() => startQuestion(recommendation)}>Start Answer</button>
                  <button className="eth-btn" onClick={() => { setRecommendationIndex(i => queue.length ? (i + 1) % queue.length : 0); setShowWhy(false); }}>Change</button>
                  <button className="eth-btn eth-btn-ghost" onClick={() => setShowWhy(v => !v)}>Why this?</button>
                </div>
                {showWhy && <div className="eth-question-details" style={{ marginTop: 14, maxWidth: 720 }}>MentorOS is selecting from your current unattempted Ethics PYQ queue, prioritising a standard theory answer where possible so timing, structure and example quality can be measured cleanly.</div>}
              </>
            ) : (
              <>
                <div className="eth-next-question">Start with one real UPSC Ethics PYQ</div>
                <div className="eth-next-reason">Once your Ethics PYQs load, MentorOS can recommend the next unattempted question instead of showing a fabricated practice task.</div>
                <div className="eth-next-actions"><button className="eth-btn eth-btn-primary" onClick={() => navigate("/ethics/pyq")}>Open Ethics PYQs</button></div>
              </>
            )}
          </div>
        </section>

        <section className="eth-section">
          <div className="eth-section-head"><div><h2 className="eth-section-title">Practice</h2><p className="eth-section-copy">Choose the specific GS4 skill you want to train.</p></div></div>
          <div className="eth-practice-grid">
            {practices.map(p => <button key={p.name} className="eth-card eth-practice-card" onClick={p.onClick} style={{ textAlign: "left", color: "inherit", font: "inherit" }}><span className="eth-icon-box">{p.icon}</span><span className="eth-practice-name">{p.name}</span><span className="eth-practice-desc">{p.desc}</span><span className="eth-practice-foot"><span>{p.foot}</span><span className="eth-arrow">→</span></span></button>)}
          </div>
          <div className="eth-card eth-upload-wrap" hidden={!showHandwritten}>
            <HandwrittenSheetReviewPanel workspace="ethics" subject="Ethics, Integrity & Aptitude" paper="GS Paper IV" answerType="ethics" defaultMarks={15} />
          </div>
        </section>

        <section className="eth-section">
          <div className="eth-section-head"><div><h2 className="eth-section-title">Browse by Syllabus Area</h2><p className="eth-section-copy">Jump directly into the GS4 capability you want to build.</p></div><button className="eth-link-button" onClick={() => navigate("/ethics/pyq")}>View all PYQs →</button></div>
          <div className="eth-syllabus-grid">
            {ETHICS_CATS.map(cat => <button key={cat.id} className="eth-syllabus-card" onClick={() => navigate(`/ethics/pyq?category=${encodeURIComponent(cat.id)}`)}><div className="eth-syllabus-icon">{cat.icon}</div><div className="eth-syllabus-name">{cat.label}</div><div className="eth-syllabus-count">{counts[cat.id] || 0} questions</div></button>)}
          </div>
        </section>

        <section className="eth-section eth-two-col">
          <div className="eth-card eth-panel">
            <h3 className="eth-panel-title">{hasSufficientEvidence ? "Ethics Practice Intelligence" : "Ethics Answer Frameworks"}</h3>
            <div className="eth-framework-list">
              <div className="eth-framework-row"><div className="eth-framework-index">01</div><div><div className="eth-framework-main">Theory: Concept → Definition → Example → Administrative application</div><div className="eth-framework-sub">A GS4 theory answer should move from moral language to public-service relevance.</div></div></div>
              <div className="eth-framework-row"><div className="eth-framework-index">02</div><div><div className="eth-framework-main">Case: Stakeholders → Conflict → Options → Trade-offs → Decision</div><div className="eth-framework-sub">The final decision must be ethical, feasible, lawful and administratively implementable.</div></div></div>
              <div className="eth-framework-row"><div className="eth-framework-index">03</div><div><div className="eth-framework-main">Thinker: Idea → Link to demand → Relevant application</div><div className="eth-framework-sub">Use thinkers to sharpen reasoning; avoid decorative name-dropping.</div></div></div>
            </div>
          </div>
          <div className="eth-card eth-panel">
            <h3 className="eth-panel-title">Thinkers for Answers</h3>
            <div className="eth-thinkers">
              {["Gandhi", "Kant", "Aristotle", "Rawls", "Vivekananda", "Ambedkar"].map(t => (
                <button
                  key={t}
                  type="button"
                  className="eth-thinker eth-thinker-btn"
                  onClick={() => navigate(`/ethics/pyq?category=GS4-ETH-THINK&search=${encodeURIComponent(t)}`)}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="eth-section-copy" style={{ marginTop: 14 }}>Open the thinker-linked PYQ bank when you want to practise applying ideas to a real demand.</p>
            <button className="eth-link-button" style={{ marginTop: 10 }} onClick={() => navigate("/ethics/pyq?category=GS4-ETH-THINK")}>Explore thinker PYQs →</button>
          </div>
        </section>

        <section className="eth-section eth-review-grid">
          <div className="eth-card eth-review-card">
            <div className="eth-section-head" style={{ marginBottom: 12 }}><div><h2 className="eth-section-title">Recent Work</h2><p className="eth-section-copy">Your latest recorded GS4 attempts.</p></div></div>
            {recent.length ? (
              <div style={{ overflowX: "auto" }}>
                <table className="eth-recent-table">
                  <thead><tr><th>Question</th><th>Type</th><th>Score</th><th>Status</th></tr></thead>
                  <tbody>
                    {recent.map((a, i) => {
                      const txt = questionText(a);
                      const displayTxt = txt.length > 90 ? `${txt.slice(0, 90)}…` : txt;
                      return (
                        <tr key={a.id || i}>
                          <td>{displayTxt}</td>
                          <td>{a.answerSourceType || a.mode || "Answer"}</td>
                          <td>{a.score ?? a.marksAwarded ?? a.evaluation?.score ?? "—"}</td>
                          <td>{a.status || (a.evaluation ? "Reviewed" : "Recorded")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="eth-empty">
                <div className="eth-empty-title">No Ethics attempts recorded yet</div>
                <div className="eth-empty-copy">Your real GS4 activity will appear here after you write and save answers. No placeholder activity is shown.</div>
              </div>
            )}
          </div>
          <div className="eth-card eth-review-card">
            <div className="eth-section-head" style={{ marginBottom: 12 }}><div><h2 className="eth-section-title">Review & Repair</h2><p className="eth-section-copy">Turn evaluation feedback into the next practice action.</p></div></div>
            {ethicsAnswers.length >= 3 ? <div className="eth-framework-list"><div className="eth-framework-row"><div className="eth-framework-index">✓</div><div><div className="eth-framework-main">Enough attempts to begin pattern review</div><div className="eth-framework-sub">Open Ethics Mistakes to revisit weak questions, repeated reasoning gaps and your revision queue.</div></div></div></div> : <div className="eth-empty"><div className="eth-empty-title">Build a small evidence base first</div><div className="eth-empty-copy">Complete at least a few GS4 answers before treating any weakness pattern as reliable.</div></div>}
            <button className={`eth-btn ${hasWeaknessSignals ? "eth-btn-primary" : ""}`} style={{ marginTop: 14 }} onClick={() => navigate("/ethics/mistakes")}>Open Ethics Mistakes</button>
          </div>
        </section>
      </div>
    </div>
  );
}
