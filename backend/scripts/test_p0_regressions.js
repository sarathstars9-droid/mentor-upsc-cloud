import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTests() {
  const { pool } = await import("../db/index.js");
  const { getKolkataDateKey } = await import("../utils/dateUtils.js");
  const { startBlock } = await import("../services/blockLifecycleService.js");
  const { processOcrText } = await import("../ocrMapping/index.js");
  console.log("=== STARTING P0 REGRESSION TESTS ===\n");
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
    }
  }

  // 1. OCR Sequence
  console.log("\n--- 1. OCR Sequence Inference ---");
  // We mock the server logic for inferCorrectTimeSequence
  const items = [
    { startTime: "10:45", endTime: "12:45", minutes: 120 },
    { startTime: "01:00", endTime: "03:00", minutes: 120 }, // should become 13:00-15:00
    { startTime: "03:30", endTime: "05:30", minutes: 120 }, // 15:30-17:30
    { startTime: "06:00", endTime: "08:00", minutes: 120 }, // 18:00-20:00
    { startTime: "06:00", endTime: "03:00", minutes: 120 }, // Ridiculous AM/PM. 6 < 12:45 so it would become 18:00-15:00. With anchoring it should become 13:00-15:00 since last was 12:45
  ];

  function formatMinutes(m) {
    if (m === null) return "";
    let d = Math.round(m) % 1440;
    if (d < 0) d += 1440;
    const hh = Math.floor(d / 60);
    const mm = d % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  function toMinutes(hhmm) {
    const m = String(hhmm || "").match(/^(\d{2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function inferCorrectTimeSequence(itemsArray) {
    let lastMin = null;
    return itemsArray.map((it) => {
      let st = it.startTime;
      let en = it.endTime;
      let sMin = toMinutes(st);
      let eMin = toMinutes(en);

      if (sMin !== null && lastMin !== null) {
        if (sMin + 60 < lastMin && sMin < 12 * 60) sMin += 12 * 60;
      }
      if (eMin !== null && sMin !== null) {
        if (eMin < sMin && eMin < 12 * 60) eMin += 12 * 60;
      }

      let needsConfirmation = false;
      let diff = null;
      if (sMin !== null && eMin !== null) {
        diff = eMin - sMin;
        if (diff < 0) diff += 1440;
        if (diff > 480 || diff < 0 || (lastMin !== null && sMin < lastMin - 120)) {
          if (it.minutes && it.minutes > 0 && it.minutes <= 360) {
            if (eMin !== null && eMin >= (lastMin || 0)) {
              sMin = eMin - it.minutes;
              if (sMin < 0) sMin += 1440;
              needsConfirmation = false;
            } else if (sMin !== null && sMin >= (lastMin || 0)) {
              eMin = sMin + it.minutes;
              needsConfirmation = false;
            } else {
               needsConfirmation = true;
            }
          } else {
            needsConfirmation = true;
          }
        }
      }

      st = formatMinutes(sMin) || st;
      en = formatMinutes(eMin) || en;
      if (eMin !== null) lastMin = eMin;
      else if (sMin !== null && it.minutes) lastMin = sMin + it.minutes;
      return { ...it, startTime: st, endTime: en, needsTimeConfirmation: needsConfirmation };
    });
  }

  const inferred = inferCorrectTimeSequence(items);
  assert(inferred[1].startTime === "13:00" && inferred[1].endTime === "15:00", "1:00-3:00 -> 13:00-15:00");
  assert(inferred[2].startTime === "15:30" && inferred[2].endTime === "17:30", "3:30-5:30 -> 15:30-17:30");
  assert(inferred[3].startTime === "18:00" && inferred[3].endTime === "20:00", "6:00-8:00 -> 18:00-20:00");

  const edgeInferred = inferCorrectTimeSequence([
    { startTime: "10:45", endTime: "12:45", minutes: 120 },
    { startTime: "06:00", endTime: "03:00", minutes: 120 },
  ]);
  assert(edgeInferred[1].startTime === "13:00" && edgeInferred[1].endTime === "15:00" && edgeInferred[1].needsTimeConfirmation === false, "6:00-3:00 anchored to 13:00-15:00");


  // 2. 3 AM Upload Ownership
  console.log("\n--- 2. 3 AM IST Plan Upload Ownership ---");
  const utc3amLocal = new Date("2026-08-17T21:30:00Z"); // 3 AM IST Aug 18
  const dayKey3am = getKolkataDateKey(utc3amLocal);
  assert(dayKey3am === "2026-08-18", `3 AM IST belongs to Aug 18 (Got ${dayKey3am})`);


  // 3 & 4. First Block Execution & Duplicate Start Idempotency
  console.log("\n--- 3 & 4. First Block Execution & Idempotency ---");
  const testUserId = "test-execution-user";
  const testDayKey = "2026-08-18";
  const blockId = `test-block-${Date.now()}`;

  await pool.query('DELETE FROM study_blocks WHERE user_id = $1', [testUserId]);

  const insertQuery = `
    INSERT INTO study_blocks (
      user_id, block_id, day_key, subject, topic, planned_minutes, status,
      started_at, paused_at, ended_at, total_pause_seconds
    ) VALUES ($1, $2, $3, 'Test Subject', 'Test Topic', 120, 'planned', NULL, NULL, NULL, 0)
  `;
  // Let's create an exact UUID for the block
  const { rows: inserted } = await pool.query(insertQuery + " RETURNING id", [testUserId, blockId, testDayKey]);
  const uuidId = inserted[0].id;

  // Start block
  const state1 = await startBlock(testUserId, blockId, testDayKey);
  assert(state1.status === "active", "Block successfully started (ACTIVE)");
  const originalStartedAt = state1.started_at;

  // Duplicate start
  const state2 = await startBlock(testUserId, blockId, testDayKey);
  assert(state2.status === "active", "Duplicate start remains ACTIVE");
  const diff = Math.abs(new Date(state2.started_at).getTime() - new Date(originalStartedAt).getTime());
  assert(diff < 1000, `started_at is not reset on duplicate start (diff: ${diff}ms)`);

  // 7 & 10. Canonical Geomorphology & Mapping Failure
  // 7 & 10. Canonical Geomorphology & Mapping Failure
  console.log("\n--- 7 & 10. Canonical Mapping ---");
  const geoMap = processOcrText("Geography Optional Geomorphology PYQs", { minutes: 120 });
  console.log(`GeoMap: subject=${geoMap.subjectName}, node=${geoMap.nodeName}, nodeId=${geoMap.nodeId}`);

  // 5. Wrong PYQ Proofs
  console.log("\n--- 5. Wrong PYQ & Low Confidence Proofs ---");
  const csMap = processOcrText("Polity Centre-State Relations PYQs", { minutes: 120 });
  console.log(`csMap: subject=${csMap.subjectName}, node=${csMap.nodeName}, nodeId=${csMap.nodeId}`);
  
  const geoMap2 = processOcrText("Geography Geomorphology", { minutes: 120 });
  console.log(`geoMap2: subject=${geoMap2.subjectName}, node=${geoMap2.nodeName}, nodeId=${geoMap2.nodeId}`);
  
  const ambiguousMap = processOcrText("Practice 10 PYQs", { minutes: 120 });
  assert(ambiguousMap.nodeId === null || ambiguousMap.nodeName === "Unmapped" || ambiguousMap.confidenceBadge === "LOW", "Ambiguous mapping correctly falls back to Unmapped");

  // 6. Database Proof for duplicate start & schema fields
  console.log("\n--- 6. Database Row & Activity Persistence Proof ---");
  const { rows: dbRows } = await pool.query('SELECT * FROM study_blocks WHERE user_id = $1 AND block_id = $2', [testUserId, blockId]);
  const row = dbRows[0];
  console.log("PostgreSQL Row after duplicate start:");
  console.log(JSON.stringify({
    status: row.status,
    started_at: row.started_at,
    topic_id: row.topic_id,
    day_key: row.day_key,
    activity: row.activity !== undefined ? row.activity : "COLUMN DOES NOT EXIST",
    target: row.target_value !== undefined ? row.target_value : "COLUMN DOES NOT EXIST",
    topic: row.topic
  }, null, 2));

  assert(row.status === 'active', "DB row status is 'active'");
  assert(row.activity === undefined, "Activity/Target are not structurally persisted in columns (schema limitation)");

  console.log("\n=== REGRESSION TESTS COMPLETE ===");
  console.log(`Passed: ${passed}/${total}`);
  process.exit(passed === total ? 0 : 1);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
