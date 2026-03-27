import { resolveNode } from "../core/nodeResolver.js";

export function resolveForMentorLayer({ text = "", subject = "", context = {} }) {
  return resolveNode({
    text,
    subject,
    context,
    mode: "mentor_layer"
  });
}
