import { resolveNode } from "../core/nodeResolver.js";

export function resolveForAnswerWriting({ text = "", subject = "", context = {} }) {
  return resolveNode({
    text,
    subject,
    context,
    mode: "answer_writing"
  });
}
