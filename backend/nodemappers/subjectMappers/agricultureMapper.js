import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function agricultureMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("agriculture", text, tokens);

  const boostedTerms = ["agriculture", "msp", "cropping", "irrigation", "food security", "allied sectors"];

  return scoreCandidates({
    subjectKey: "agriculture",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
