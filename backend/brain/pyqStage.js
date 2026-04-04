export function getStageFromQID(qid = "") {
  if (!qid) return "unknown";

  const id = qid.toUpperCase();

  // ✅ PRELIMS
  if (id.startsWith("PRE") || id.startsWith("PRELIMS")) {
    return "prelims";
  }

  // ✅ CSAT (prelims)
  if (id.startsWith("CSAT")) {
    return "prelims";
  }

  // ✅ MAINS (explicit prefixes)
  if (id.startsWith("MAINS_") || id.startsWith("MAIN_")) {
    return "mains";
  }

  // ✅ MAINS (GS papers direct format)
  if (
    id.startsWith("GS1") ||
    id.startsWith("GS2") ||
    id.startsWith("GS3") ||
    id.startsWith("GS4")
  ) {
    return "mains";
  }

  // ✅ MAINS (other papers)
  if (
    id.startsWith("ESSAY") ||
    id.startsWith("ETHICS") ||
    id.startsWith("OPTIONAL")
  ) {
    return "mains";
  }

  return "unknown";
}