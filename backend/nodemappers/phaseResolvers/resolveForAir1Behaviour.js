import { resolveNode } from "../core/nodeResolver.js";

export function resolveForAir1Behaviour({ text = "", subject = "", context = {} }) {
  return resolveNode({
    text,
    subject,
    context,
    mode: "air1_behaviour"
  });
}
