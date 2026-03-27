import { resolveNode } from "../core/nodeResolver.js";

export function resolveForMistakeBook({ text = "", subject = "", context = {} }) {
  return resolveNode({
    text,
    subject,
    context,
    mode: "mistake_book"
  });
}
