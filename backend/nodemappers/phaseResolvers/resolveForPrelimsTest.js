import { resolveNode } from "../core/nodeResolver.js";

export function resolveForPrelimsTest({ text = "", subject = "", context = {} }) {
  return resolveNode({
    text,
    subject,
    context,
    mode: "prelims_test"
  });
}
