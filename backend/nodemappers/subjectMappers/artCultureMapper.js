import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function artCultureMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("art_culture", text, tokens);

  const boostedTerms = ["art", "culture", "architecture", "dance", "music", "painting", "sculpture"];

  return scoreCandidates({
    subjectKey: "art_culture",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
