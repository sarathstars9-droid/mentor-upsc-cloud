import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function ethicsMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("ethics", text, tokens);

  const boostedTerms = ["ethics", "integrity", "aptitude", "attitude", "emotional intelligence", "probity", "values"];

  return scoreCandidates({
    subjectKey: "ethics",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
