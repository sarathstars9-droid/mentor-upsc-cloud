import { resolveNode } from "../core/nodeResolver.js";

export function resolveForPYQMapping({ text = "", subject = "", context = {} }) {
  return resolveNode({
    text,
    subject,
    context,
    mode: "pyq"
  });
}
