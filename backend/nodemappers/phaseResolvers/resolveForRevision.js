import { resolveNode } from "../core/nodeResolver.js";

export function resolveForRevision({ text = "", subject = "", context = {} }) {
  return resolveNode({
    text,
    subject,
    context,
    mode: "revision"
  });
}
