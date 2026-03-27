import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function optionalGeographyMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("optional_geography", text, tokens);

  const boostedTerms = ["geomorphology", "climatology", "oceanography", "perspectives", "models", "settlements", "population geography"];

  return scoreCandidates({
    subjectKey: "optional_geography",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
