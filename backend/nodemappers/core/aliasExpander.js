import { normalizeText } from "./normalizeText.js";
import { tokenizeTopic } from "./tokenizeTopic.js";

export const ALIAS_MAP = {
  "biotech": "biotechnology",
  "gen tech": "genetic technology",
  "science tech": "science and technology",
  "science and tech": "science and technology",
  "s&t": "science and technology",
  "number system": "number system"
};

export function expandAliasesForSubject(subjectKey = "", text = "", tokens = []) {
  let expandedText = String(text || "").toLowerCase();
  let expandedTokens = Array.isArray(tokens) ? [...tokens] : [];

  for (const [alias, fullForm] of Object.entries(ALIAS_MAP)) {
    const re = new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    expandedText = expandedText.replace(re, fullForm);
  }

  expandedTokens = expandedTokens.map((token) => {
    const key = String(token || "").toLowerCase();
    return ALIAS_MAP[key] || key;
  });

  return {
    text: expandedText,
    tokens: expandedTokens
  };
}