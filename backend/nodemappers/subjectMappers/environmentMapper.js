import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function environmentMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("environment", text, tokens);

  const boostedTerms = ["environment", "ecology", "climate change", "biodiversity", "conservation", "pollution", "protected areas"];

  return scoreCandidates({
    subjectKey: "environment",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
