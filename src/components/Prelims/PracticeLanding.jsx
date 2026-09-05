import React from "react";
import { BrainCircuit, Sparkles, Target, BookOpen, Layers, ListTree } from "lucide-react";

function QuickCard({ title, desc, onClick, disabled, primary = false, icon: Icon }) {
  return (
    <button
      type="button"
      className={`mos-pr-quick${primary ? " mos-pr-quick--primary" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {Icon ? <Icon size={16} strokeWidth={1.9} /> : null}
        <div className="mos-pr-quick__title">{title}</div>
      </div>
      <div className="mos-pr-quick__desc">{desc}</div>
    </button>
  );
}

function toneForPriority(priority = "") {
  const p = String(priority).toLowerCase();
  if (p.includes("critical")) return "danger";
  if (p.includes("high")) return "warning";
  return "primary";
}

export default function PracticeLanding({
  weakAreaSuggestion,
  adaptiveActions = [],
  adaptiveActionsLoading = false,
  builderLoading = false,
  subjects = [],
  selectedSubjectId = "",
  onStartRecommended,
  onPreviewRecommended,
  onStartAdaptive,
  onPracticeAction,
  onQuickWeak,
  onQuickSubject,
  onQuickTopic,
  onQuickSubtopic,
}) {
  const rec = weakAreaSuggestion || {};
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId)?.label || selectedSubjectId;
  const hasRec = !!rec.hasData;
  const recommendedTitle = hasRec ? rec.subject : selectedSubject ? `Start with ${selectedSubject}` : "Take your first smart test";
  const recommendedTopic = hasRec ? rec.topic : "MentorOS will learn from your first attempt";
  const priorityTone = toneForPriority(rec.priority);
  const firstAction = adaptiveActions[0] || null;

  return (
    <div className="mos-practice-home">
      <div className="mos-practice-page-head">
        <div>
          <h1>Practice</h1>
          <p>Practice what matters most. MentorOS adapts the next test from your mistakes, risk and revision signals.</p>
        </div>
        <span className="mos-pr-badge mos-pr-badge--primary"><Sparkles size={13} /> Adaptive practice</span>
      </div>

      <section className="mos-practice-card mos-pr-recommend">
        <div className="mos-pr-recommend__top">
          <div style={{ minWidth: 0 }}>
            <div className="mos-practice-eyebrow"><Target size={14} /> Mentor recommends</div>
            <div className="mos-pr-recommend__title">{recommendedTitle}</div>
            {recommendedTopic ? <div className="mos-pr-recommend__topic">{recommendedTopic}</div> : null}
          </div>
          <div className="mos-pr-target">
            <span>Target accuracy</span>
            <strong>85%+</strong>
          </div>
        </div>

        <div className="mos-pr-recommend__facts">
          {rec.accuracy != null ? (
            <div className="mos-pr-fact"><strong>{Math.round(rec.accuracy)}%</strong><span>Recent accuracy</span></div>
          ) : null}
          {rec.lastRevisedDays != null ? (
            <div className="mos-pr-fact"><strong>{rec.lastRevisedDays} days</strong><span>Since revision</span></div>
          ) : null}
          {rec.mistakes != null ? (
            <div className="mos-pr-fact"><strong>{rec.mistakes}</strong><span>Recorded mistakes</span></div>
          ) : null}
          {rec.priority ? (
            <div className="mos-pr-fact">
              <span className={`mos-pr-badge mos-pr-badge--${priorityTone}`}>{rec.priority}</span>
              <span style={{ marginTop: 5 }}>Mentor priority</span>
            </div>
          ) : null}
          <div className="mos-pr-fact"><strong>10 Q</strong><span>Recommended set</span></div>
        </div>

        {Array.isArray(rec.whyBullets) && rec.whyBullets.length > 0 ? (
          <div className="mos-pr-why">
            <div className="mos-pr-why__label">Why this test?</div>
            <ul>
              {rec.whyBullets.slice(0, 3).map((item, idx) => <li key={`${item}_${idx}`}>{item}</li>)}
            </ul>
          </div>
        ) : (
          <div className="mos-pr-why">
            <div className="mos-pr-why__label">How MentorOS learns</div>
            <ul>
              <li>Complete a test to unlock a recommendation based on accuracy, mistakes and revision gaps.</li>
            </ul>
          </div>
        )}

        <div className="mos-pr-recommend__actions">
          <button type="button" className="mos-pr-btn mos-pr-btn--primary mos-pr-btn--large" onClick={onStartRecommended} disabled={builderLoading}>
            {builderLoading ? "Preparing test…" : "Start Recommended Test"}
          </button>
          <button type="button" className="mos-pr-btn mos-pr-btn--large" onClick={onPreviewRecommended}>
            Build my own test
          </button>
        </div>
      </section>

      <div className="mos-pr-two-col">
        <section className="mos-practice-card mos-pr-adaptive">
          <div className="mos-pr-adaptive__icon"><BrainCircuit size={22} /></div>
          <div className="mos-pr-adaptive__body">
            <div className="mos-pr-adaptive__title">Adaptive Weakness Test</div>
            <div className="mos-pr-adaptive__copy">A mixed set built automatically from the areas where your score can improve fastest.</div>
          </div>
          <button type="button" className="mos-pr-btn" onClick={onStartAdaptive} disabled={builderLoading}>
            Start adaptive test
          </button>
        </section>

        <section className="mos-practice-card mos-pr-next-action">
          <div className="mos-practice-section-head">
            <h3>Next action</h3>
            {adaptiveActionsLoading ? <span className="mos-practice-small mos-practice-muted">Updating…</span> : null}
          </div>
          {firstAction ? (
            <div className="mos-pr-next-action__row">
              <div className="mos-pr-next-action__copy">
                <div className="mos-pr-next-action__title">{firstAction.actionText || firstAction.subject || "Practice weak area"}</div>
                <div className="mos-pr-next-action__desc">
                  {firstAction.nodeId ? String(firstAction.nodeId).replaceAll("_", " ") : "MentorOS selected this from your recent evidence."}
                </div>
                <div className="mos-pr-next-action__meta">
                  {firstAction.accuracyPercent != null ? `Accuracy ${firstAction.accuracyPercent}%` : ""}
                  {firstAction.wrongCount != null ? `${firstAction.accuracyPercent != null ? " · " : ""}${firstAction.wrongCount} wrong` : ""}
                </div>
              </div>
              <button type="button" className="mos-pr-btn" onClick={() => onPracticeAction?.(firstAction)}>Practice</button>
            </div>
          ) : (
            <div className="mos-practice-small mos-practice-muted">Complete more questions and MentorOS will place your next best action here.</div>
          )}
        </section>
      </div>

      <section>
        <div className="mos-practice-section-head">
          <div>
            <h2>Build your practice</h2>
            <div className="mos-practice-small mos-practice-muted" style={{ marginTop: 3 }}>Choose how precise you want the test to be.</div>
          </div>
        </div>
        <div className="mos-pr-quick-grid">
          <QuickCard title="AI Weak Area" desc="Let MentorOS choose the highest-value weak area." onClick={onQuickWeak} disabled={builderLoading} primary icon={BrainCircuit} />
          <QuickCard title="Full Subject" desc="Practice across all available PYQs in one subject." onClick={onQuickSubject} icon={BookOpen} />
          <QuickCard title="Topic-wise" desc="Focus on one topic and build depth." onClick={onQuickTopic} icon={Layers} />
          <QuickCard title="Subtopic-wise" desc="Target micro-themes for precision practice." onClick={onQuickSubtopic} icon={ListTree} />
        </div>
      </section>
    </div>
  );
}
