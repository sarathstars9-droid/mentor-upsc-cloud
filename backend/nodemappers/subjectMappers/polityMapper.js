import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function polityMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("polity", text, tokens);

  const boostedTerms = ["constitution", "parliament", "judiciary", "federalism", "amendment", "rights", "dpsp", "president", "governor", "ordinance", "election"];

  return scoreCandidates({
    subjectKey: "polity",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
