/**
 * mainsActionCompletionService.js
 * Step 4: Action Completion + Revision Engine
 *
 * completeAction(userId, actionId, status):
 *   1. Fetch the action, validate ownership
 *   2. Update action status (completed | skipped)
 *   3. On "completed":
 *      a. Reduce severity in mains_weakness_signals (GREATEST(sev - 0.5, 0))
 *      b. Increment revision_count, update last_seen_at
 *      c. Create a revision_item in revision_items (dedup by source_id)
 *   4. On "skipped":
 *      a. Mark is_done = TRUE, no severity change, no revision item
 *   5. Return updated action + weakness state + revision item (if created)
 *
 * Logs:
 *   [MAINS INTELLIGENCE] action completed
 *   [MAINS INTELLIGENCE] weakness adjusted
 */

import {
  getNextActionById,
  updateNextActionStatus,
  reduceWeaknessSeverity,
} from "../repositories/mainsIntelligenceRepository.js";
import { upsertRevisionItem } from "../repositories/revisionRepository.js";

const VALID_STATUSES = new Set(["completed", "skipped", "pending"]);

/**
 * completeAction(userId, actionId, status)
 *
 * @param {string} userId    - must match action.user_id
 * @param {string} actionId  - UUID of mains_next_actions row
 * @param {string} status    - "completed" | "skipped" | "pending" (undo)
 * @returns {{ action, weaknessSignal, revisionItem }}
 */
export async function completeAction(userId, actionId, status) {
  // ── Validate inputs ────────────────────────────────────────────────────────
  if (!userId || !String(userId).trim())   throw new Error("Missing userId");
  if (!actionId || !String(actionId).trim()) throw new Error("Missing actionId");
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid status: "${status}". Must be completed | skipped | pending`);
  }

  // ── 1. Fetch action ────────────────────────────────────────────────────────
  const action = await getNextActionById(actionId);
  if (!action) {
    throw new Error(`Action not found: ${actionId}`);
  }

  // Authorization: user can only update their own actions
  if (action.user_id !== userId) {
    throw new Error("Unauthorized: action does not belong to this user");
  }

  console.log("[MAINS INTELLIGENCE] action status update:", {
    actionId,
    from: action.status,
    to:   status,
    label: action.source_weakness_label,
  });

  // ── 2. Update action status ────────────────────────────────────────────────
  const updatedAction = await updateNextActionStatus(actionId, status);

  console.log("[MAINS INTELLIGENCE] action completed", {
    actionId,
    status,
    title:   updatedAction.title,
    weakness: updatedAction.source_weakness_label,
  });

  let weaknessSignal = null;
  let revisionItem   = null;

  // ── 3. Completion side-effects ─────────────────────────────────────────────
  if (status === "completed") {
    // a + b: Reduce severity, increment revision_count
    weaknessSignal = await reduceWeaknessSeverity({
      userId,
      paper:         action.paper         || "UNKNOWN",
      subject:       action.subject       || "UNKNOWN",
      topic:         action.topic         || "UNKNOWN",
      weaknessType:  action.source_weakness_type,
      weaknessLabel: action.source_weakness_label,
    });

    if (weaknessSignal) {
      console.log("[MAINS INTELLIGENCE] weakness adjusted", {
        label:          weaknessSignal.weakness_label,
        newSeverity:    weaknessSignal.severity,
        revisionCount:  weaknessSignal.revision_count,
      });
    } else {
      // Signal may have been deleted or doesn't match — log but don't fail
      console.warn("[MAINS INTELLIGENCE] weakness signal not found for severity reduction:", {
        label: action.source_weakness_label,
        type:  action.source_weakness_type,
      });
    }

    // c: Create revision item — deduped by source_id (action UUID)
    const revisionTitle   = `[Mains] ${action.title}`;
    const revisionContent =
      `Weakness: ${action.source_weakness_label} (${action.source_weakness_type}).\n` +
      `${action.description}\n` +
      `Paper: ${action.paper || "—"} | Subject: ${action.subject || "—"} | Topic: ${action.topic || "—"}`;

    revisionItem = await upsertRevisionItem({
      user_id:     userId,
      source_type: "mains_action",
      source_id:   actionId,           // dedup key — one revision item per action
      source_ref:  actionId,
      stage:       "mains",
      subject:     action.subject || "Mains",
      title:       revisionTitle,
      content:     revisionContent,
      priority:    action.priority,
      status:      "pending",
      revision_count: 0,
      review_count:   0,
      interval_days:  1,
    });

    console.log("[MAINS INTELLIGENCE] revision item created", {
      revisionItemId: revisionItem?.id,
      title:          revisionTitle,
    });
  }

  // "skipped" → is_done = TRUE but no severity reduction, no revision item
  // "pending"  → undo — is_done = FALSE, no side-effects

  return {
    action:        updatedAction,
    weaknessSignal,
    revisionItem,
  };
}
