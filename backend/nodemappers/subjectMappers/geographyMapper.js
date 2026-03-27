import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function geographyMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("geography", text, tokens);

  const boostedTerms = ["geography", "monsoon", "climate", "geomorphology", "oceanography", "resources", "human geography"];

  return scoreCandidates({
    subjectKey: "geography",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
