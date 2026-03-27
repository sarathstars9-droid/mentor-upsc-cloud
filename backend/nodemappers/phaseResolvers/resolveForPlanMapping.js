import { resolveNode } from "../core/nodeResolver.js";

export function resolveForPlanMapping({ text = "", subject = "", context = {} }) {
  return resolveNode({
    text,
    subject,
    context,
    mode: "plan"
  });
}
