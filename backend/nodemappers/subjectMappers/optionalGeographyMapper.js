import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function optionalGeographyMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("optional_geography", text, tokens);

  const boostedTerms = [
    "geomorphology", "climatology", "oceanography", "perspectives",
    "models", "theories", "christaller", "von thunen", "rostow", "gravity model", "heartland",
    "economic geography", "world trade", "natural resources", "industrial location",
    "settlements", "population geography", "urbanization", "rural settlement",
    "regional planning", "growth pole", "core periphery"
  ];

  return scoreCandidates({
    subjectKey: "optional_geography",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
