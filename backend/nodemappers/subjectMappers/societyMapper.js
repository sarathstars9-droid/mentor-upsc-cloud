import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function societyMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("society", text, tokens);

  const boostedTerms = ["society", "women", "globalization", "communalism", "regionalism", "secularism", "population"];

  return scoreCandidates({
    subjectKey: "society",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
