import { resolveNode } from "../core/nodeResolver.js";

export function resolveForAdaptivePlanner({ text = "", subject = "", context = {} }) {
  return resolveNode({
    text,
    subject,
    context,
    mode: "adaptive_planner"
  });
}
