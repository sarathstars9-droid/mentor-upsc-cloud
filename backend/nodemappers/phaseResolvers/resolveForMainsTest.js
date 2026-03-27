import { resolveNode } from "../core/nodeResolver.js";

export function resolveForMainsTest({ text = "", subject = "", context = {} }) {
  return resolveNode({
    text,
    subject,
    context,
    mode: "mains_test"
  });
}
