import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function irMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("international_relations", text, tokens);

  const boostedTerms = ["india and world", "bilateral", "multilateral", "un", "foreign policy", "diaspora", "neighbourhood"];

  return scoreCandidates({
    subjectKey: "international_relations",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
