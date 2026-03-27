import { resolveNode } from "../core/nodeResolver.js";

export function resolveForInterview({ text = "", subject = "", context = {} }) {
  return resolveNode({
    text,
    subject,
    context,
    mode: "interview"
  });
}
