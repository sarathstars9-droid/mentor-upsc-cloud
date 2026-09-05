import React, { useEffect, useMemo, useState } from "react";
import { BACKEND_URL } from "../../config.js";
import "../../styles/mains-paper-workspace.css";

export function PaperHero({ eyebrow, title, subtitle, stats = [], actions = [] }) {
  return (
    <section className="mpw-hero">
      <div className="mpw-hero__copy">
        <div className="mpw-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div className="mpw-hero__stats">
          {stats.map((item) => (
            <span key={`${item.label}-${item.value}`} className="mpw-stat-pill">
              <strong>{item.value}</strong>{item.label ? <span>{item.label}</span> : null}
            </span>
          ))}
        </div>
      </div>

      <div className="mpw-hero__actions" aria-label={`${title} tools`}>
        {actions.map((action) => (
          <button
            type="button"
            key={action.label}
            onClick={action.onClick}
            className={`mpw-tool-btn${action.active ? " is-active" : ""}`}
          >
            <span aria-hidden="true">{action.icon}</span>
            <span>{action.active ? action.activeLabel || action.label : action.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function ThemeSelector({ themes, activeTheme, onSelect, counts = {}, total = 0 }) {
  const items = [
    { id: "all", label: "All Themes", icon: "▦", desc: "View the complete paper", count: total },
    ...themes.map((theme) => ({ ...theme, count: counts[theme.id] || 0 })),
  ];

  return (
    <section className="mpw-section" aria-labelledby="mpw-browse-title">
      <div className="mpw-section__heading">
        <div>
          <div className="mpw-eyebrow">Browse</div>
          <h2 id="mpw-browse-title">Browse by Theme</h2>
        </div>
      </div>

      <div className="mpw-theme-grid">
        {items.map((item) => {
          const selected = activeTheme === item.id;
          return (
            <button
              type="button"
              key={item.id}
              className={`mpw-theme-card${selected ? " is-selected" : ""}`}
              onClick={() => onSelect(item.id)}
              aria-pressed={selected}
            >
              <span className="mpw-theme-card__icon" aria-hidden="true">{item.icon}</span>
              <span className="mpw-theme-card__title">{item.label}</span>
              <span className="mpw-theme-card__desc">{item.desc}</span>
              <span className="mpw-theme-card__count">{item.count} question{item.count === 1 ? "" : "s"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Segmented({ value, options, onChange, ariaLabel }) {
  return (
    <div className="mpw-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={value === option.value ? "is-active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({
  markFilter,
  setMarkFilter,
  sourceFilter,
  setSourceFilter,
  sourceOptions,
  sortOrder,
  setSortOrder,
  resultCount,
  onReset,
}) {
  return (
    <section className="mpw-filter-panel" aria-label="Question filters">
      <div className="mpw-filter-panel__top">
        <div>
          <div className="mpw-eyebrow">Filters</div>
          <h2>Refine Questions</h2>
        </div>
        <button type="button" className="mpw-text-btn" onClick={onReset}>Reset</button>
      </div>

      <div className="mpw-filter-row">
        <div className="mpw-filter-group">
          <span className="mpw-filter-label">Marks</span>
          <Segmented
            value={markFilter}
            onChange={setMarkFilter}
            ariaLabel="Marks"
            options={[
              { value: "all", label: "All" },
              { value: "10", label: "10M" },
              { value: "15", label: "15M" },
            ]}
          />
        </div>

        <div className="mpw-filter-group">
          <span className="mpw-filter-label">Source</span>
          <Segmented
            value={sourceFilter}
            onChange={setSourceFilter}
            ariaLabel="Question source"
            options={sourceOptions}
          />
        </div>

        <div className="mpw-filter-group mpw-filter-group--sort">
          <label className="mpw-filter-label" htmlFor="mpw-sort">Sort</label>
          <select id="mpw-sort" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="latest">Latest Year</option>
            <option value="oldest">Oldest Year</option>
          </select>
        </div>

        <div className="mpw-result-count">{resultCount} question{resultCount === 1 ? "" : "s"}</div>
      </div>
    </section>
  );
}

function QuestionAction({ q, onStart, state }) {
  const label = state.hasProcessedReview
    ? "View Review"
    : state.hasSavedAnswer
      ? "Continue Attempt"
      : "Start Writing";

  return (
    <button type="button" className="mpw-primary-btn" onClick={() => onStart(q)}>
      <span aria-hidden="true">✎</span>
      {label}
    </button>
  );
}

export function QuestionCard({ q, onStart, themeLabel }) {
  const [expanded, setExpanded] = useState(false);
  const [questionState, setQuestionState] = useState({
    hasAttempt: false,
    hasSavedAnswer: false,
    hasExternalReview: false,
    hasProcessedReview: false,
  });

  useEffect(() => {
    let alive = true;
    fetch(`${BACKEND_URL}/api/mains-answers?userId=user_1`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        const attempts = Array.isArray(data) ? data : [];
        const matchingAttempt = attempts.find(
          (a) => a.question?.substring(0, 50) === q.question?.substring(0, 50),
        );
        if (matchingAttempt) {
          setQuestionState({
            hasAttempt: true,
            hasSavedAnswer: !!matchingAttempt.answerText,
            hasExternalReview: false,
            hasProcessedReview: false,
          });
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [q.question]);

  const source = q.source || "PYQ";
  const hasDetails = Boolean(q.focus || q.structure || q.subparts?.length);

  return (
    <article className="mpw-question-card">
      <div className="mpw-question-card__meta">
        <span className={`mpw-badge ${source === "PYQ" ? "mpw-badge--primary" : "mpw-badge--neutral"}`}>{source}</span>
        {q.year ? <span className="mpw-badge mpw-badge--neutral">UPSC {q.year}</span> : null}
        {q.marks != null ? <span className="mpw-badge mpw-badge--neutral">{q.marks}M</span> : null}
        {themeLabel ? <span className="mpw-theme-tag">{themeLabel}</span> : null}
      </div>

      <div className="mpw-question-card__question">{q.question}</div>

      {q.subparts?.length ? (
        <div className="mpw-subparts">
          {q.subparts.map((part, index) => (
            <div className="mpw-subpart" key={`${part.label || index}-${index}`}>
              <span>({part.label || String.fromCharCode(97 + index)})</span>
              <p>{part.question}</p>
            </div>
          ))}
        </div>
      ) : null}

      {expanded && hasDetails ? (
        <div className="mpw-question-details">
          {q.focus ? <div><strong>Focus</strong><span>{q.focus}</span></div> : null}
          {q.structure ? <div><strong>Structure</strong><span>{q.structure}</span></div> : null}
        </div>
      ) : null}

      <div className="mpw-question-card__actions">
        <QuestionAction q={q} onStart={onStart} state={questionState} />
        {hasDetails ? (
          <button type="button" className="mpw-secondary-btn" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide Details" : "View Details"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="mpw-question-list" aria-label="Loading questions">
      {[1, 2, 3].map((item) => (
        <div className="mpw-skeleton" key={item}>
          <div className="mpw-skeleton__small" />
          <div className="mpw-skeleton__large" />
          <div className="mpw-skeleton__medium" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="mpw-state mpw-state--error">
      <strong>Couldn’t load questions</strong>
      <span>{message}</span>
      <button type="button" className="mpw-secondary-btn" onClick={onRetry}>Retry</button>
    </div>
  );
}

export function EmptyState({ title = "No questions match these filters", copy = "Try changing the theme or filters above." }) {
  return (
    <div className="mpw-state">
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}

export function Pagination({ page, pageCount, onChange }) {
  const pages = useMemo(() => {
    const candidates = new Set([1, pageCount, page - 1, page, page + 1]);
    return [...candidates].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  }, [page, pageCount]);

  if (pageCount <= 1) return null;

  return (
    <nav className="mpw-pagination" aria-label="Questions pagination">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Previous</button>
      {pages.map((item, index) => {
        const prev = pages[index - 1];
        const gap = prev && item - prev > 1;
        return (
          <React.Fragment key={item}>
            {gap ? <span className="mpw-pagination__gap">…</span> : null}
            <button
              type="button"
              className={item === page ? "is-active" : ""}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          </React.Fragment>
        );
      })}
      <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>Next ›</button>
    </nav>
  );
}
