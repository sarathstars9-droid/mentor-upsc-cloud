import { expandAliasesForSubject } from "../core/aliasExpander.js";
import { scoreCandidates } from "../core/scoreMatcher.js";

export function map({ text, tokens = [], candidates = [], context = {} }) {
  const expanded = expandAliasesForSubject("science_tech", text, tokens);

  const boostedTerms = [
    "biotechnology",
    "biotech",
    "genetic",
    "genetics",
    "dna",
    "rna",
    "gene",
    "genomics",
    "proteomics",
    "stem",
    "stem cell",
    "crispr",
    "dbt"
  ];

  return scoreCandidates({
    subjectKey: "science_tech",
    text: expanded.text,
    tokens: expanded.tokens,
    candidates,
    boostedTerms,
    context
  });
}

export const scienceTechMapper = map;