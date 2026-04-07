import { query } from "../db/index.js";

function getPriority(mistake) {
    if (mistake.must_revise) return "high";
    if (mistake.answer_status === "wrong") return "high";
    if (mistake.answer_status === "unattempted") return "medium";
    return "low";
}

async function backfillRevisionItems() {
    const { rows: mistakes } = await query(
        `SELECT *
         FROM mistakes
         ORDER BY created_at ASC`
    );

    console.log(`[REVISION BACKFILL] mistakes found: ${mistakes.length}`);

    let inserted = 0;
    let updated = 0;

    for (const m of mistakes) {
        if (!m.user_id || !m.question_id || !m.stage) {
            console.warn("[REVISION BACKFILL] skipped invalid row", {
                id: m.id,
                user_id: m.user_id,
                question_id: m.question_id,
                stage: m.stage,
            });
            continue;
        }

        const sql = `
  INSERT INTO revision_items (
    user_id,
    source_type,
    source_id,
    source_ref,
    question_id,
    stage,
    subject,
    node_id,
    title,
    content,
    question_text,
    status,
    priority,
    revision_count,
    review_count,
    interval_days,
    last_reviewed_at,
    next_review_at
  )
  VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
  )
  ON CONFLICT (user_id, question_id, stage)
  DO UPDATE SET
    source_type = EXCLUDED.source_type,
    source_id = EXCLUDED.source_id,
    source_ref = EXCLUDED.source_ref,
    subject = EXCLUDED.subject,
    node_id = EXCLUDED.node_id,
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    question_text = EXCLUDED.question_text,
    priority = EXCLUDED.priority,
    updated_at = NOW()
  RETURNING (xmax = 0) AS inserted;
`;

        const values = [
            m.user_id,
            m.source_type || "prelims_pyq",
            m.source_ref || m.question_id || null,
            m.source_ref || null,
            m.question_id,
            m.stage,
            m.subject || null,
            m.node_id || null,
            m.question_text || m.question_id || "Revision Item",
            m.question_text || null,
            m.question_text || null,
            "pending",
            getPriority(m),
            0,
            0,
            1,
            null,
            new Date().toISOString(),
        ];

        const result = await query(sql, values);
        if (result.rows[0]?.inserted) inserted += 1;
        else updated += 1;
    }

    console.log("[REVISION BACKFILL] done", {
        totalMistakes: mistakes.length,
        inserted,
        updated,
    });

    const summary = await query(
        `SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE priority = 'high') AS high_priority
         FROM revision_items`
    );

    console.log("[REVISION BACKFILL] revision_items summary", summary.rows[0]);
}

backfillRevisionItems()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("[REVISION BACKFILL ERROR]", err);
        process.exit(1);
    });
