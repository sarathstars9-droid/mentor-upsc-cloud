import { normalizeText } from "./normalizeText.js";

export function tokenizeTopic(text = "") {
  return normalizeText(text)
    .split(" ")
    .map(s => s.trim())
    .filter(Boolean);
}

export function detectBestSubjectKey({ text = "", subject = "", context = {} }) {
  const raw = `${subject} ${text} ${context?.paper || ""}`.toLowerCase();

  if (raw.includes("polity") || raw.includes("constitution") || raw.includes("parliament") || raw.includes("rights")) return "polity";
  if (raw.includes("governance")) return "governance";
  if (raw.includes("social justice") || raw.includes("welfare") || raw.includes("vulnerable sections")) return "social_justice";
  if (raw.includes("international relations") || raw.includes("bilateral") || raw.includes("foreign policy")) return "international_relations";

  if (raw.includes("economy") || raw.includes("inflation") || raw.includes("banking") || raw.includes("fiscal") || raw.includes("bop") || raw.includes("frbm")) return "economy";
  if (raw.includes("agriculture") || raw.includes("cropping") || raw.includes("msp") || raw.includes("irrigation")) return "agriculture";
  if (raw.includes("environment") || raw.includes("biodiversity") || raw.includes("climate") || raw.includes("ecology")) return "environment";
  if (raw.includes("science") || raw.includes("technology") || raw.includes("biotechnology") || raw.includes("space") || raw.includes("ai ") || raw.includes("robotics")) return "science_tech";
  if (raw.includes("security") || raw.includes("terror") || raw.includes("cyber") || raw.includes("border management")) return "security";
  if (raw.includes("disaster")) return "disaster_management";

  if (raw.includes("history") || raw.includes("ancient") || raw.includes("medieval") || raw.includes("modern india")) return "history";
  if (raw.includes("art") || raw.includes("culture")) return "art_culture";
  if (raw.includes("geography") || raw.includes("monsoon") || raw.includes("geomorphology")) return "geography";
  if (raw.includes("society") || raw.includes("women") || raw.includes("globalization") || raw.includes("communalism")) return "society";

  if (raw.includes("essay")) return "essay";
  if (raw.includes("ethics") || raw.includes("integrity") || raw.includes("aptitude")) return "ethics";
  if (raw.includes("optional")) return "optional_geography";
  if (raw.includes("csat") || raw.includes("reasoning") || raw.includes("number system") || raw.includes("comprehension")) return "csat";

  return "polity";
}
