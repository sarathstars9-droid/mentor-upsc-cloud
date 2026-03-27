import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function socialJusticeMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("social_justice", text, tokens);

  const boostedTerms = ["social justice", "welfare", "education", "health", "vulnerable", "women", "children", "sc", "st", "obc"];

  return scoreCandidates({
    subjectKey: "social_justice",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
