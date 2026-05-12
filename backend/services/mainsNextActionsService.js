/**
 * mainsNextActionsService.js
 * Step 3: Next Action Engine (Patched)
 *
 * generateNextActions(userId, answerAttemptId?):
 *   1. Fetch weakness signals, filter by severity threshold (>= 1.5)
 *   2. Load existing actions for cooldown check (skip if updated < 24h ago)
 *   3. Map each canonical label → action rule
 *   4. Scale title/description by severity intensity
 *   5. Upsert with answer_attempt_id linkage
 *   6. Return top 3 — deduplicated by action_type (diversity)
 */

import {
  getActiveWeaknessSignals,
  upsertNextAction,
  getTopNextActions,
  getExistingNextActions,
} from "../repositories/mainsIntelligenceRepository.js";

// ── Thresholds ────────────────────────────────────────────────────────────────
const SEVERITY_THRESHOLD = 1.5;   // ignore signals below this — too fresh/weak
const COOLDOWN_HOURS     = 24;    // don't re-upsert actions touched within 24h

// ── Action rule map ───────────────────────────────────────────────────────────
// Maps canonical weakness_label → base action definition.
// Titles use "2 PYQs" / "2-3 questions" as the baseline — intensity scaling
// will adjust these upward for higher severity.
const ACTION_RULES = {
  // Component weaknesses
  "Weak examples": {
    action_type: "practice_pyq",
    title:       "Practice 2 PYQs adding examples",
    description: "Select recent Mains PYQs from your subject and write answers specifically focused on adding concrete real-world examples. Use UPSC toppers' example banks as reference.",
  },
  "Shallow analysis": {
    action_type: "deepen_analysis",
    title:       "Drill analytical depth on recent topic",
    description: "Pick your last Mains topic and write a 150-word analytical paragraph covering cause → effect → implication. Avoid descriptive writing.",
  },
  "Poor structure": {
    action_type: "structure_drill",
    title:       "Write a structured outline before your next answer",
    description: "Before writing your next full answer, spend 3 minutes creating a point-form outline: Intro → 3 Body Points → Conclusion. Submit the outline for review.",
  },
  "Weak introduction": {
    action_type: "intro_drill",
    title:       "Practise 3 strong introductions",
    description: "Write opening paragraphs for 3 past Mains questions using the hook → context → thesis framework. Keep each under 50 words.",
  },
  "Weak conclusion": {
    action_type: "rewrite_answer",
    title:       "Rewrite last answer conclusion",
    description: "Take your most recent evaluated answer and rewrite only its conclusion. Ensure it has a forward-looking statement and a crisp 1-line takeaway.",
  },
  "Poor presentation": {
    action_type: "presentation_drill",
    title:       "Format your next answer with headings and bullets",
    description: "In your next answer attempt, use sub-headings and bullet points for at least 2 body sections. Focus on white space and readable formatting.",
  },
  "Directive not addressed": {
    action_type: "directive_practice",
    title:       "Attempt 2-3 directive-focused questions",
    description: "Practice questions with explicit directives (Discuss, Analyze, Critically Examine). Write what the directive demands, then map your content to it before writing.",
  },

  // Dimension weaknesses
  "Economic angle": {
    action_type: "revise_notes",
    title:       "Revise economic dimension notes",
    description: "Review your economic angle reference notes (fiscal policy, growth indicators, sectoral impact). Integrate at least one economic point into your next answer attempt.",
  },
  "Social angle": {
    action_type: "revise_notes_social",
    title:       "Revise social dimension notes",
    description: "Review social impact frameworks (vulnerable groups, gender, access). Add a social angle paragraph to your next practice answer.",
  },
  "Environmental angle": {
    action_type: "revise_notes_env",
    title:       "Revise environmental dimension notes",
    description: "Review environmental framework notes (climate, biodiversity, SDGs). Integrate environmental impact analysis in your next answer.",
  },
  "Governance angle": {
    action_type: "revise_notes_gov",
    title:       "Revise governance dimension notes",
    description: "Review governance angle notes (accountability, transparency, federalism, institutions). Add a governance section to your next Mains answer.",
  },
  "Constitutional angle": {
    action_type: "revise_notes_const",
    title:       "Revise constitutional dimension notes",
    description: "Review constitutional provisions relevant to your topic. Quote at least one relevant Article or constitutional principle in your next answer.",
  },
  "Ethical angle": {
    action_type: "revise_notes_ethics",
    title:       "Revise ethical dimension notes",
    description: "Review ethical frameworks (deontology, consequentialism, virtue ethics). Apply one framework explicitly in your next answer.",
  },
  "Historical angle": {
    action_type: "revise_notes_hist",
    title:       "Revise historical dimension notes",
    description: "Note historical precedents relevant to your recent topic. Add a historical context paragraph in your next answer attempt.",
  },
  "International angle": {
    action_type: "revise_notes_intl",
    title:       "Revise international dimension notes",
    description: "Review comparative/global examples on your current topic. Add an international comparison or global framework in your next answer.",
  },
  "Gender angle": {
    action_type: "revise_notes_gender",
    title:       "Revise gender dimension notes",
    description: "Review gender impact frameworks. Add a gender-disaggregated analysis paragraph in your next answer attempt.",
  },
  "Scientific angle": {
    action_type: "revise_notes_sci",
    title:       "Revise scientific dimension notes",
    description: "Review relevant science/technology dimensions for your topic. Integrate a scientific basis or data point into your next answer.",
  },
};

// ── Intensity scaling ─────────────────────────────────────────────────────────
/**
 * Scale action title/description based on severity bracket.
 *
 * Brackets:
 *   sev >= 3.5 → CRITICAL: 5× reps, urgent prefix
 *   sev >= 2.5 → HIGH:     4× reps, high-priority prefix
 *   sev >= 2.0 → ELEVATED: 3× reps
 *   sev >= 1.5 → STANDARD: 2× reps (baseline, no change)
 *
 * Uses simple string replacement on baseline numbers in titles.
 */
function scaleActionByIntensity(rule, severity) {
  const sev = Number(severity);

  if (sev >= 3.5) {
    return {
      title: rule.title
        .replace("2 PYQs",        "5 PYQs")
        .replace("2-3 questions", "5 questions")
        .replace("3 questions",   "5 questions")
        .replace("Practise 3",    "Practise 5"),
      description: `CRITICAL — This weakness is heavily impacting your score across multiple attempts. ${rule.description}`,
    };
  }

  if (sev >= 2.5) {
    return {
      title: rule.title
        .replace("2 PYQs",        "4 PYQs")
        .replace("2-3 questions", "4 questions")
        .replace("3 questions",   "4 questions")
        .replace("Practise 3",    "Practise 4"),
      description: `High priority. ${rule.description}`,
    };
  }

  if (sev >= 2.0) {
    return {
      title: rule.title
        .replace("2 PYQs",        "3 PYQs")
        .replace("2-3 questions", "3 questions"),
      description: rule.description,
    };
  }

  // sev 1.5 – 1.9: standard baseline, no change
  return { title: rule.title, description: rule.description };
}

// ── Priority computation ──────────────────────────────────────────────────────
/**
 * Compute priority from weakness signal.
 *   sev >= 3.0                       → "high"  (repeated, compounding)
 *   sev >= 2.0 OR type="dimension"   → "high"  (dimension gaps always high)
 *   sev >= 1.5                       → "medium"
 *   else                             → "low"   (filtered out by threshold)
 */
function computePriority(signal) {
  const sev  = Number(signal.severity);
  const type = String(signal.weakness_type);

  if (sev >= 3.0)                         return "high";
  if (sev >= 2.0 || type === "dimension") return "high";
  if (sev >= 1.5)                         return "medium";
  return "low";
}

// ── Cooldown helper ───────────────────────────────────────────────────────────
/**
 * Build a cooldown map from existing actions.
 * Key: "action_type::source_weakness_label"
 * Value: updated_at Date
 */
function buildCooldownMap(existingActions) {
  const map = new Map();
  for (const a of existingActions) {
    const key = `${a.action_type}::${a.source_weakness_label}`;
    map.set(key, new Date(a.updated_at));
  }
  return map;
}

/**
 * Returns true if this action is still within its cooldown window
 * (was updated within the last COOLDOWN_HOURS hours).
 */
function isOnCooldown(actionType, weaknessLabel, cooldownMap) {
  const key         = `${actionType}::${weaknessLabel}`;
  const lastUpdated = cooldownMap.get(key);
  if (!lastUpdated) return false;

  const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
  return lastUpdated > cutoff;
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * generateNextActions(userId, answerAttemptId?)
 *
 * Patches applied:
 *   1. SEVERITY_THRESHOLD — skips signals below 1.5
 *   2. Cooldown — skips upsert if action was updated within last 24h
 *   3. Intensity scaling — scales title/description by severity bracket
 *   4. answer_attempt_id linkage — stored in mains_next_actions row
 *   5. Diversity — getTopNextActions uses ROW_NUMBER per action_type
 */
export async function generateNextActions(userId, answerAttemptId = null) {
  if (!userId || !String(userId).trim()) {
    throw new Error("Missing userId");
  }

  console.log("[MAINS INTELLIGENCE] generating next actions for:", userId);

  // Step 1: Fetch all weakness signals
  const allSignals = await getActiveWeaknessSignals(userId);
  console.log("[MAINS INTELLIGENCE] weakness signals found:", allSignals.length);

  // Step 2a: Filter by severity threshold
  const signals = allSignals.filter(s => Number(s.severity) >= SEVERITY_THRESHOLD);
  const filteredOut = allSignals.length - signals.length;
  if (filteredOut > 0) {
    console.log("[MAINS INTELLIGENCE] signals below threshold filtered out:", filteredOut);
  }

  // Step 2b: Build cooldown map from existing actions
  const existing     = await getExistingNextActions(userId);
  const cooldownMap  = buildCooldownMap(existing);

  let actionsUpserted = 0;
  let actionsCooledDown = 0;

  // Step 3: Map signal → rule → scale → upsert
  for (const signal of signals) {
    const label = signal.weakness_label;
    const rule  = ACTION_RULES[label];

    if (!rule) {
      console.log("[MAINS INTELLIGENCE] no action rule for weakness:", label);
      continue;
    }

    // Cooldown check — skip if recently updated
    if (isOnCooldown(rule.action_type, label, cooldownMap)) {
      console.log("[MAINS INTELLIGENCE] action on cooldown, skipping:", {
        label, action_type: rule.action_type, cooldown_hours: COOLDOWN_HOURS,
      });
      actionsCooledDown++;
      continue;
    }

    const priority  = computePriority(signal);
    const scaled    = scaleActionByIntensity(rule, signal.severity);

    console.log("[MAINS INTELLIGENCE] generating action:", {
      label,
      action_type:   rule.action_type,
      priority,
      severity:      signal.severity,
      intensity:     Number(signal.severity) >= 3.5 ? "CRITICAL"
                   : Number(signal.severity) >= 2.5 ? "HIGH"
                   : Number(signal.severity) >= 2.0 ? "ELEVATED"
                   : "STANDARD",
    });

    await upsertNextAction({
      userId,
      actionType:          rule.action_type,
      title:               scaled.title,
      description:         scaled.description,
      priority,
      sourceWeaknessLabel: label,
      sourceWeaknessType:  signal.weakness_type,
      sourceSeverity:      Number(signal.severity),
      paper:               signal.paper   || null,
      subject:             signal.subject || null,
      topic:               signal.topic   || null,
      answerAttemptId:     answerAttemptId || null,
    });

    actionsUpserted++;
  }

  // Step 4: Return top 3 (diverse — one per action_type)
  const topActions = await getTopNextActions(userId, 3);

  console.log("[MAINS INTELLIGENCE] next actions generated", {
    signalsTotal:       allSignals.length,
    signalsAboveThreshold: signals.length,
    actionsCooledDown,
    actionsUpserted,
    topActionsReturned: topActions.length,
  });

  return { actionsUpserted, topActions };
}
