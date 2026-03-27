import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function disasterMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("disaster_management", text, tokens);

  const boostedTerms = ["disaster", "ndrf", "mitigation", "preparedness", "response", "hazard"];

  return scoreCandidates({
    subjectKey: "disaster_management",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
