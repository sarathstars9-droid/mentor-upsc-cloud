import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function economyMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("economy", text, tokens);

  const boostedTerms = ["economy", "inflation", "banking", "monetary policy", "fiscal policy", "balance of payments", "frbm", "growth", "budget"];

  return scoreCandidates({
    subjectKey: "economy",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
