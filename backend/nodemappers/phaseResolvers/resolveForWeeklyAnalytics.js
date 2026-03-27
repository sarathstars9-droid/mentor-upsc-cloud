import { resolveNode } from "../core/nodeResolver.js";

export function resolveForWeeklyAnalytics({ text = "", subject = "", context = {} }) {
  return resolveNode({
    text,
    subject,
    context,
    mode: "weekly_analytics"
  });
}
