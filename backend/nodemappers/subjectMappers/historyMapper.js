import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function historyMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("history", text, tokens);

  const boostedTerms = ["ancient", "medieval", "modern india", "freedom struggle", "colonial", "post independence"];

  return scoreCandidates({
    subjectKey: "history",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
