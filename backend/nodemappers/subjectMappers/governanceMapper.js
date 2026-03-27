import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function governanceMapper({ text, tokens, candidates, context = {} }) {
  const expanded = expandAliasesForSubject("governance", text, tokens);

  const boostedTerms = ["governance", "accountability", "citizen charter", "e governance", "transparency", "service delivery"];

  return scoreCandidates({
    subjectKey: "governance",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}
