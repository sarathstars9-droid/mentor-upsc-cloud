import { SUBJECT_MAPPER_REGISTRY } from "../registry.js";
import { buildUnifiedCandidatePool } from "./scoreMatcher.js";
import { detectBestSubjectKey } from "./tokenizeTopic.js";
import { finalizeConfidence } from "./confidenceEngine.js";
import { fallbackMapper } from "./fallbackMapper.js";

export function resolveNode({
  text = "",
  subject = "",
  context = {},
  mode = "plan"
}) {
  const subjectKey = detectBestSubjectKey({ text, subject, context });
  const mapper = SUBJECT_MAPPER_REGISTRY[subjectKey];

  if (!mapper) {
    return fallbackMapper({ text, subject, context, mode });
  }

  const candidates = buildUnifiedCandidatePool({
    subjectKey,
    text,
    context
  });

  const scored = mapper({
    text,
    tokens: [],
    candidates,
    context
  });

  const best = finalizeConfidence({
    text,
    subject,
    subjectKey,
    scored,
    context,
    mode
  });

  return best;
}