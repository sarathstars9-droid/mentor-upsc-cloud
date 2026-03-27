import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function essayMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("essay", text, tokens);

  const boostedTerms = ["essay", "theme", "philosophy", "society", "technology", "development"];

  return scoreCandidates({
    subjectKey: "essay",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
