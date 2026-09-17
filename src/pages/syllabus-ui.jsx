import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BACKEND_URL } from '../config';
import { count, numberText, percent, text } from './syllabus-intelligence';

export function apiUrl(path) {
  return `${String(BACKEND_URL || '').replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
export async function getJson(path, signal) {
  const response = await fetch(apiUrl(path), { credentials: 'include', cache: 'no-store', signal,
    headers: { Accept: 'application/json' } });
  let payload;
  try { payload = await response.json(); } catch (_) {
    const error = new Error(`The server returned an invalid response (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (!response.ok || payload?.ok === false) {
    const error = new Error(payload?.error || payload?.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}
export async function getJsonWithFallback(paths, signal) {
  let lastError;
  for (const path of paths) {
    try { return await getJson(path, signal); }
    catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      if (![404, 405].includes(error.status)) throw error;
    }
  }
  throw lastError || new Error('No supported syllabus endpoint was found.');
}
export function useSyllabusResource(loader, dependencies = []) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, data: null, error: '' });
    Promise.resolve().then(() => loader(controller.signal)).then((data) => {
      if (!controller.signal.aborted) setState({ loading: false, data, error: '' });
    }).catch((error) => {
      if (!controller.signal.aborted) setState((previous) => ({ ...previous, loading: false, error: error?.message || 'Unable to load data.' }));
    });
    return () => controller.abort();
    // The caller supplies stable dependencies; version is the explicit refresh trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, version]);
  const refresh = useCallback(() => setVersion((n) => n + 1), []);
  return { ...state, refresh };
}

const paths = {
  arrowRight: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  arrowLeft: <><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
  chevronRight: <path d="m9 6 6 6-6 6"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  book: <><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z"/><path d="M12 6v14"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  repeat: <><path d="M20 7v4h-4M4 17v-4h4"/><path d="M5 9a8 8 0 0 1 14-2l1 4M4 13l1 4a8 8 0 0 0 14-2"/></>,
  chart: <><path d="M4 20V4M4 20h16M8 16v-5M13 16V7M18 16V4"/></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/></>,
  alert: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17h.01"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  spark: <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>,
  file: <><path d="M6 3h8l4 4v14H6V3ZM14 3v5h4M9 12h6M9 16h6"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
  close: <path d="M6 6l12 12M18 6 6 18"/>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a8 8 0 0 1 14-2l1 5M4 12l1 5a8 8 0 0 0 14-2"/></>,
  list: <><path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
};
export function Icon({ name, size = 20, className = '' }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.info}</svg>;
}
export function Button({ to, children, variant = 'secondary', className = '', icon, ...props }) {
  const classes = `si-button si-button--${variant} ${className}`;
  const content = <>{icon && <Icon name={icon} size={17}/>}<span>{children}</span></>;
  if (to) return <Link className={classes} to={to} {...props}>{content}</Link>;
  return <button type="button" className={classes} {...props}>{content}</button>;
}
export function Badge({ children, tone = 'neutral', className = '' }) { return <span className={`si-badge si-badge--${tone} ${className}`}>{children}</span>; }
export function Progress({ value = 0, label = 'Progress', tone = 'blue' }) {
  return <div className={`si-progress si-progress--${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, count(value)))}><span style={{ width: percent(value) }}/></div>;
}
export function Metric({ label, value, helper, icon = 'chart', tone = 'blue', progress }) {
  return <article className="si-metric"><div className="si-metric__top"><span className={`si-icon si-icon--${tone}`}><Icon name={icon} size={20}/></span><span className="si-metric__label">{label}</span></div><strong className="si-metric__value">{value}</strong><p className="si-metric__helper">{helper}</p>{progress !== undefined && <Progress value={progress} label={label} tone={tone}/>}</article>;
}
export function SectionHeading({ title, description, action, id }) {
  return <div className="si-section-heading"><div><h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}
export function EmptyState({ title, description, action, icon = 'info' }) {
  return <div className="si-empty"><span className="si-empty__icon"><Icon name={icon} size={23}/></span><strong>{title}</strong>{description && <p>{description}</p>}{action}</div>;
}
export function ResourceState({ loading, error, onRetry, children, label = 'syllabus' }) {
  if (loading && !children) return <div className="si-loading" role="status"><span className="si-spinner"/>Loading {label}…</div>;
  if (error && !children) return <EmptyState icon="alert" title={`Unable to load ${label}`} description={error} action={<Button onClick={onRetry} icon="refresh">Try again</Button>}/>;
  return <>{children}</>;
}
export function SearchInput({ value, onChange, placeholder = 'Search topics or codes', id }) {
  return <label className="si-search"><Icon name="search" size={18}/><span className="si-sr-only">{placeholder}</span><input id={id} type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}/>{value && <button type="button" aria-label="Clear search" onClick={() => onChange('')}><Icon name="close" size={15}/></button>}</label>;
}
export function Select({ label, value, onChange, options, id }) {
  return <label className="si-field"><span className="si-field__label">{label}</span><select id={id} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><Icon name="chevronDown" size={15}/></label>;
}
export function Segmented({ options, value, onChange, label = 'View' }) {
  return <div className="si-segmented" role="group" aria-label={label}>{options.map((option) => <button key={option.value} type="button" className={value === option.value ? 'is-active' : ''} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}
export function Breadcrumbs({ items }) {
  return <nav className="si-breadcrumbs" aria-label="Breadcrumb">{items.filter(Boolean).map((item, index) => <React.Fragment key={`${item.label}-${index}`}>{index > 0 && <Icon name="chevronRight" size={14}/ >}{item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</React.Fragment>)}</nav>;
}
export function PageHeader({ eyebrow, title, description, children, breadcrumbs }) {
  return <header className="si-page-header">{breadcrumbs && <Breadcrumbs items={breadcrumbs}/>}<div className="si-page-header__row"><div>{eyebrow && <div className="si-eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{children && <div className="si-page-header__actions">{children}</div>}</div></header>;
}
export function CountLabel({ value, suffix }) { return <span>{numberText(value)} {text(suffix)}</span>; }
export function FilterReset({ onClick, disabled }) { return <Button icon="refresh" variant="ghost" onClick={onClick} disabled={disabled}>Reset</Button>; }
