import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function csatMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("csat", text, tokens);

  const boostedTerms = ["comprehension", "reasoning", "number system", "percentages", "averages", "data interpretation", "decision making"];

  return scoreCandidates({
    subjectKey: "csat",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
