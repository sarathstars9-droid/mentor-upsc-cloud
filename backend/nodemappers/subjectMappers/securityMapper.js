import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function securityMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("security", text, tokens);

  const boostedTerms = ["security", "cyber", "terrorism", "money laundering", "organized crime", "border management"];

  return scoreCandidates({
    subjectKey: "security",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
