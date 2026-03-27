import { resolveNodeMapping } from "../nodemappers/index.js";

export function mapPlanItemToMicroTheme(topic, subject, extra = {}) {
  return resolveNodeMapping({
    mode: "plan",
    text: topic,
    subject,
    context: extra
  });
}

export function mapPYQToMicroTheme(pyq) {
  const text = [
    pyq.question || "",
    pyq.theme || "",
    pyq.subTopic || "",
    ...(pyq.keywords || [])
  ].join(" ");

  return resolveNodeMapping({
    mode: "pyq",
    text,
    subject: pyq.paper === "OPTIONAL" ? "Optional Geography" : pyq.paper,
    context: {
      source: "pyq",
      year: pyq.year,
      paper: pyq.paper,
      marks: pyq.marks,
      directive: pyq.directive || ""
    }
  });
}
