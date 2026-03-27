import { resolveForPlanMapping } from "./phaseResolvers/resolveForPlanMapping.js";
import { resolveForPYQMapping } from "./phaseResolvers/resolveForPYQMapping.js";
import { resolveForPrelimsTest } from "./phaseResolvers/resolveForPrelimsTest.js";
import { resolveForMainsTest } from "./phaseResolvers/resolveForMainsTest.js";
import { resolveForMistakeBook } from "./phaseResolvers/resolveForMistakeBook.js";
import { resolveForRevision } from "./phaseResolvers/resolveForRevision.js";
import { resolveForWeeklyAnalytics } from "./phaseResolvers/resolveForWeeklyAnalytics.js";
import { resolveForAdaptivePlanner } from "./phaseResolvers/resolveForAdaptivePlanner.js";
import { resolveForKnowledgeLinkage } from "./phaseResolvers/resolveForKnowledgeLinkage.js";
import { resolveForMentorLayer } from "./phaseResolvers/resolveForMentorLayer.js";
import { resolveForAnswerWriting } from "./phaseResolvers/resolveForAnswerWriting.js";
import { resolveForAir1Behaviour } from "./phaseResolvers/resolveForAir1Behaviour.js";
import { resolveForInterview } from "./phaseResolvers/resolveForInterview.js";

export function resolveNodeMapping({
  mode = "plan",
  text = "",
  subject = "",
  context = {}
}) {
  const payload = { text, subject, context };

  switch (mode) {
    case "plan":
      return resolveForPlanMapping(payload);

    case "pyq":
      return resolveForPYQMapping(payload);

    case "prelims_test":
      return resolveForPrelimsTest(payload);

    case "mains_test":
      return resolveForMainsTest(payload);

    case "mistake_book":
      return resolveForMistakeBook(payload);

    case "revision":
      return resolveForRevision(payload);

    case "weekly_analytics":
      return resolveForWeeklyAnalytics(payload);

    case "adaptive_planner":
      return resolveForAdaptivePlanner(payload);

    case "knowledge_linkage":
      return resolveForKnowledgeLinkage(payload);

    case "mentor_layer":
      return resolveForMentorLayer(payload);

    case "answer_writing":
      return resolveForAnswerWriting(payload);

    case "air1_behaviour":
      return resolveForAir1Behaviour(payload);

    case "interview":
      return resolveForInterview(payload);

    default:
      return resolveForPlanMapping(payload);
  }
}