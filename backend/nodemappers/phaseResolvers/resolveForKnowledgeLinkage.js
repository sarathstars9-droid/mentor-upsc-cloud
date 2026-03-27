import { resolveNode } from "../core/nodeResolver.js";

export function resolveForKnowledgeLinkage({ text = "", subject = "", context = {} }) {
  return resolveNode({
    text,
    subject,
    context,
    mode: "knowledge_linkage"
  });
}
