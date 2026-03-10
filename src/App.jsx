// src/App.jsx
import { useMemo, useState, useEffect } from "react";
import { BACKEND_URL } from "./config";
import { BLOCK_STATUS } from "./blockConstants";

/* =========================================================
   UPSC Mentor OS (Production UI)
   - Frontend -> Backend proxy (/api/sheets) -> Apps Script (NO CORS)
   - OCR + mapping + analyze-day + loop-detect via backend (:8787)
   ========================================================= */

/* ---------------- Google Sheets POST (via Backend Proxy) ---------------- */
async function post(action, payload = {}) {
  const res = await fetch(`${BACKEND_URL}/api/sheets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: true, raw: text };
  }
}

/* ---------------- Local Backend: Text → Syllabus Map ---------------- */
async function mapTextToSyllabus(text) {
  const t = String(text || "").trim();
  if (!t) return null;

  const res = await fetch(`${BACKEND_URL}/api/map-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: t }),
  });

  const outText = await res.text();
  try {
    return JSON.parse(outText);
  } catch {
    return { ok: false, message: "Backend did not return JSON", raw: outText };
  }
}

/* ---------------- Local Backend: Plan Photo Parse ---------------- */
async function parsePlanPhoto(file, date) {
  const form = new FormData();
  form.append("photo", file);
  form.append("date", date);

  const res = await fetch(`${BACKEND_URL}/api/plan-photo`, {
    method: "POST",
    body: form,
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, message: "Backend did not return JSON", raw: text };
  }
}

/* ---------------- Local Backend: Analyze Day ---------------- */
async function analyzeDay(payload) {
  const res = await fetch(`${BACKEND_URL}/api/analyze-day`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, message: "Backend did not return JSON", raw: text };
  }
}

/* ---------------- Local Backend: Loop Detect ---------------- */
async function loopDetect(payload) {
  const res = await fetch(`${BACKEND_URL}/api/loop-detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, message: "Backend did not return JSON", raw: text };
  }
}

/* ---------------- Dates ---------------- */
const DEFAULT_PRELIMS = "2026-05-24";
const DEFAULT_MAINS = "2026-08-21";

function daysLeft(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  const diff = Math.round(
    (d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.max(0, diff);
}



/* ---------------- Mapping fields for Sheets ---------------- */
function buildMappingFields(mapOut) {
  const mappingCode = mapOut?.mapping?.code ? String(mapOut.mapping.code) : "";
  const mappingPath = mapOut?.mapping?.path ? String(mapOut.mapping.path) : "";

  const matches = Array.isArray(mapOut?.matches) ? mapOut.matches : [];
  const codes = matches
    .map((m) => m?.code)
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");
  const paths = matches
    .map((m) => m?.path)
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");
  const names = matches
    .map((m) => m?.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");

  return {
    mappingCode,
    mappingPath,
    matchesCodes: codes,
    matchesPaths: paths,
    matchesNames: names,
  };
}

function buildPlanItemMappingPath(it) {
  const m = it?.mapped;
  if (!m) return "";
  const parts = [m.gsPaper, m.gsHeading, m.macroTheme, m.microTheme].filter(
    Boolean
  );
  return parts.join(" > ");
}

function buildTodayBlocksFromParsed(out) {
  const items = Array.isArray(out?.items) ? out.items : [];

  return items.map((it, index) => ({
    BlockId: makeStableBlockId(out?.date || "", it, index),
    Date: out?.date || "",
    PlannedSubject: it?.subject || "Unknown",
    PlannedTopic: it?.topic || "",
    PlannedStart: it?.startTime || "",
    PlannedEnd: it?.endTime || "",
    PlannedMinutes: Number(it?.minutes || 0),

    ActualSubject: "",
    ActualTopic: "",
    ActualStart: "",
    ActualEnd: "",
    ActualMinutes: 0,

    PauseCount: 0,
    TotalPauseMinutes: 0,
    LastPauseAt: "",
    LastResumeAt: "",

    Status: BLOCK_STATUS.PLANNED,
    CompletionStatus: "",
    TopicMatchStatus: "",
    DelayMinutes: 0,
    GraceState: "",

    OutputType: "",
    OutputCount: 0,
    FocusRating: "",
    InterruptionReason: "",
    ReviewNotes: "",

    BacklogBucket: "",
    CarriedToNextDay: "no",
    CarryTargetDate: "",
    ParentBlockId: "",

    SyllabusTop1Code: it?.mapped?.code ? String(it.mapped.code) : "",
    SyllabusTop1Path: buildPlanItemMappingPath(it),
    Top3Codes: "",
    Top3Paths: "",
    Top3Names: "",

    MasterySignal: "",
    ConfidenceScore: "",
    FakeStudyRisk: "",

    PlanSource: "photo_ocr",
  }));
}

function formatTimeOnly(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function hhmmToMinutes(hhmm) {
  const s = String(hhmm || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function todayMinutesNow() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function playReminderBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.05;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      ctx.close();
    }, 350);
  } catch (err) {
    console.warn("Reminder beep failed:", err);
  }
}

function speakReminder(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    utter.volume = 0.9;
    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.warn("Speech reminder failed:", err);
  }
}



async function ensureNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

function showBrowserNotification(title, body) {

  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {

    new Notification(title, {
      body: body,
      silent: false
    });

  }

}

async function updateBlockAction(action, payload) {
  return post(action, { payload });
}

function makeStableBlockId(dateStr, it, index) {
  const d = String(dateStr || "");
  const s = String(it?.startTime || it?.start || "").replace(/[^\dA-Za-z]/g, "");
  const subj = String(it?.subject || "Unknown").replace(/\W+/g, "_").slice(0, 20);
  return `${d}__${s}__${subj}__${index + 1}`;
}

function sumActualMinutes(blocks) {
  return (blocks || []).reduce((sum, block) => {
    return sum + (Number(block?.ActualMinutes || 0) || 0);
  }, 0);
}

function nowMinutesOfDay() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export default function App() {
  const [prelimsDate] = useState(DEFAULT_PRELIMS);
  const [mainsDate] = useState(DEFAULT_MAINS);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [planMin, setPlanMin] = useState(360);
  const [doneMin, setDoneMin] = useState(0);
  const [csatMin, setCsatMin] = useState(60);
  const [reflection, setReflection] = useState("");
  

  const [review, setReview] = useState({
    planCompleted: "Partial",
    wentWell: "",
    wentWrongReason: "Distraction",
    wentWrongText: "",
    extraDone: "No",
    extraText: "",
    extraMinutes: 0,
  });

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [weekly, setWeekly] = useState(null);
  const [alertPermission, setAlertPermission] = useState("unknown");
const [reminderState, setReminderState] = useState({});

  const [planPhoto, setPlanPhoto] = useState(null);
  const [parsedPlan, setParsedPlan] = useState(null);

  const [mappingResult, setMappingResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loops, setLoops] = useState(null);

  const [todayBlocks, setTodayBlocks] = useState([]);
  useEffect(() => {

  if (!date) return;

  async function loadBlocks() {

    try {

      const res = await post("getBlocksForDate", { date });

      if (res?.blocks) {

       const mapped = res.blocks.map((b) => ({
  BlockId: b.BlockId,

  PlannedSubject: b.Subject || "Unknown",
  PlannedTopic: b.Topic || "",
  PlannedStart: b.Start || "",
  PlannedEnd: b.End || "",
  PlannedMinutes: Number(b.Minutes || 0),

  ActualStart: b.ActualStart || "",
  ActualEnd: b.ActualEnd || "",
  ActualMinutes: Number(b.ActualMinutes || 0),

  PauseCount: Number(b.PauseCount || 0),
  TotalPauseMinutes: Number(b.TotalPauseMinutes || 0),
  LastPauseAt: b.LastPauseAt || "",
  LastResumeAt: b.LastResumeAt || "",

  Status: b.Status || "planned",
  CompletionStatus: b.CompletionStatus || "",
  TopicMatchStatus: b.TopicMatchStatus || "",

  OutputType: b.OutputType || "",
  OutputCount: Number(b.OutputCount || 0),
  FocusRating: b.FocusRating || "",
  InterruptionReason: b.InterruptionReason || "",
  ReviewNotes: b.ReviewNotes || "",
  BacklogBucket: b.BacklogBucket || "",

  ActualSubject: b.ActualSubject || "",
  ActualTopic: b.ActualTopic || "",

  SyllabusTop1Code: b.MappingCode || "",
  SyllabusTop1Path: b.MappingPath || "",
}));

        setTodayBlocks(mapped);

      }

    } catch (err) {
      console.error("loadBlocks failed", err);
    }

  }

  loadBlocks();

}, [date]);

useEffect(() => {
  setDoneMin(sumActualMinutes(todayBlocks));
}, [todayBlocks]);

useEffect(() => {
  if (!todayBlocks.length) return;

  const timerId = setInterval(() => {
    setReminderState((prev) => {
      const next = { ...prev };
      const nowMin = nowMinutesOfDay();
      let changed = false;

      function fireStartReminder(block, stage) {
        const subject = block.PlannedSubject || "Study";
        const topic = block.PlannedTopic || "No topic";

        let speechText = "";
        let bodyText = "";

        if (stage === "start_now") {
          speechText = `${subject} block should start now`;
          bodyText = `${subject}: ${topic}`;
        } else if (stage === "not_started_3") {
          speechText = `${subject} block not started yet`;
          bodyText = `${subject} still not started.`;
        } else if (stage === "please_begin_5") {
          speechText = `Please begin ${subject} practice`;
          bodyText = `Please begin ${subject} now.`;
        } else if (stage === "paused_too_long") {
          speechText = `${subject} block is paused too long. Please resume now`;
          bodyText = `${subject} has been paused too long.`;
        } else {
          return;
        }

        showBrowserNotification("UPSC Mentor OS", bodyText);
        playReminderBeep();
        speakReminder(speechText);
        setStatus(`⏰ ${speechText}`);
      }

      for (const block of todayBlocks) {
        if (!block?.BlockId) continue;

        const blockId = block.BlockId;
        const plannedStartMin = hhmmToMinutes(block.PlannedStart);
        if (plannedStartMin === null) continue;

        const delta = nowMin - plannedStartMin;
        const current = next[blockId] || {
          start_now: false,
          not_started_3: false,
          please_begin_5: false,
          paused_too_long: false,
        };

        const hasStarted =
          block.Status === BLOCK_STATUS.ACTIVE ||
          block.Status === BLOCK_STATUS.PAUSED ||
          block.Status === BLOCK_STATUS.COMPLETED ||
          block.Status === BLOCK_STATUS.PARTIAL ||
          block.Status === BLOCK_STATUS.MISSED ||
          block.Status === (BLOCK_STATUS.SKIPPED || "skipped") ||
          !!block.ActualStart;

        if (!hasStarted && block.Status === BLOCK_STATUS.PLANNED) {
          if (delta >= 0 && !current.start_now) {
            fireStartReminder(block, "start_now");
            current.start_now = true;
            changed = true;
          }

          if (delta >= 3 && !current.not_started_3) {
            fireStartReminder(block, "not_started_3");
            current.not_started_3 = true;
            changed = true;
          }

          if (delta >= 5 && !current.please_begin_5) {
            fireStartReminder(block, "please_begin_5");
            current.please_begin_5 = true;
            changed = true;
          }
        }

        if (block.Status === BLOCK_STATUS.PAUSED && block.LastPauseAt && !current.paused_too_long) {
          const pausedAt = new Date(block.LastPauseAt);
          if (!Number.isNaN(pausedAt.getTime())) {
            const minsPaused = Math.max(0, Math.round((Date.now() - pausedAt.getTime()) / 60000));
            if (minsPaused >= 10) {
              fireStartReminder(block, "paused_too_long");
              current.paused_too_long = true;
              changed = true;
            }
          }
        }

        next[blockId] = current;
      }

      return changed ? next : prev;
    });
  }, 30000);

  return () => clearInterval(timerId);
}, [todayBlocks]);

const [activeReviewBlock, setActiveReviewBlock] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    completionStatus: "",
    topicMatchStatus: "",
    outputType: "",
    outputCount: 0,
    focusRating: "",
    interruptionReason: "",
    reviewNotes: "",
    backlogBucket: "",
  });

  const dPre = daysLeft(prelimsDate);
  const dMains = daysLeft(mainsDate);

  const completionToday = useMemo(() => {
    const p = Number(planMin) || 0;
    const d = Number(doneMin) || 0;
    if (p <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((d / p) * 100)));
  }, [planMin, doneMin]);

  const dailyMotivation = useMemo(() => {
    if (completionToday >= 80) {
      return "Excellent consistency today. This is topper behaviour.";
    }
    if (completionToday >= 50) {
      return "Good effort. Tomorrow tighten execution.";
    }
    return "No guilt. Reset tomorrow. Small correction makes big change.";
  }, [completionToday]);

  function autoFillFromParsed(out) {
    if (out?.date) setDate(out.date);

    const total = Number(out?.totalMinutes ?? 0);
    if (total > 0) setPlanMin(total);

    const items = Array.isArray(out?.items) ? out.items : [];

    const csat = items.reduce((sum, it) => {
      const subj = String(it?.subject ?? "").toLowerCase();
      const topic = String(it?.topic ?? it?.task ?? "").toLowerCase();
      const mins = Number(it?.minutes ?? 0) || 0;

      const isCsat =
        subj.includes("csat") ||
        topic.includes("csat") ||
        topic.includes("quant") ||
        topic.includes("reasoning") ||
        topic.includes("rc") ||
        topic.includes("comprehension") ||
        topic.includes("aptitude") ||
        topic.includes("number system") ||
        topic.includes("seating arrangement");

      return sum + (isCsat ? mins : 0);
    }, 0);

    if (csat > 0) setCsatMin(csat);

    setDoneMin(0);
    setReflection("Plan auto-filled from photo. Edit if needed.");
    setAnalysis(null);
    setMappingResult(null);
    setLoops(null);
  }

  function plannedMinFromParsed(out) {
    const total = Number(out?.totalMinutes ?? 0);
    if (total > 0) return total;
    const items = Array.isArray(out?.items) ? out.items : [];
    return items.reduce((s, x) => s + (Number(x?.minutes) || 0), 0);
  }

  async function handleStartBlock(blockId) {
  const nowIso = new Date().toISOString();

  try {
    await updateBlockAction("startBlock", {
      blockId,
      actualStart: nowIso,
    });

    setTodayBlocks((prev) =>
      prev.map((block) =>
        block.BlockId === blockId
          ? {
              ...block,
              Status: BLOCK_STATUS.ACTIVE,
              ActualStart: nowIso,
            }
          : block
      )
    );
  } catch (e) {
    console.error("startBlock failed", e);
    setStatus("❌ startBlock failed");
  }
}
  async function handlePauseBlock(blockId) {
  const nowIso = new Date().toISOString();

  try {
    await updateBlockAction("pauseBlock", {
      blockId,
      pausedAt: nowIso,
    });

    setTodayBlocks((prev) =>
      prev.map((block) =>
        block.BlockId === blockId
          ? {
              ...block,
              Status: BLOCK_STATUS.PAUSED,
              LastPauseAt: nowIso,
              PauseCount: Number(block.PauseCount || 0) + 1,
            }
          : block
      )
    );
  } catch (e) {
    console.error("pauseBlock failed", e);
    setStatus("❌ pauseBlock failed");
  }
}

 async function handleResumeBlock(blockId) {
  const nowIso = new Date().toISOString();

  try {
    const res = await updateBlockAction("resumeBlock", {
      blockId,
      resumedAt: nowIso,
    });

    const totalPauseMinutes =
      res?.result?.totalPauseMinutes ?? null;

    setTodayBlocks((prev) =>
      prev.map((block) =>
        block.BlockId === blockId
          ? {
              ...block,
              Status: BLOCK_STATUS.ACTIVE,
              LastResumeAt: nowIso,
              TotalPauseMinutes:
                totalPauseMinutes !== null
                  ? totalPauseMinutes
                  : block.TotalPauseMinutes,
            }
          : block
      )
    );
  } catch (e) {
    console.error("resumeBlock failed", e);
    setStatus("❌ resumeBlock failed");
  }
}

  function handleStopBlock(block) {
    setActiveReviewBlock(block);
    setReviewForm({
      completionStatus: "",
      topicMatchStatus: "",
      outputType: "",
      outputCount: 0,
      focusRating: "",
      interruptionReason: "",
      reviewNotes: "",
      backlogBucket: "",
    });
  }

  async function handleSubmitReview() {
  if (!activeReviewBlock) return;

  const actualEndIso = new Date().toISOString();

  try {
    const res = await updateBlockAction("completeBlock", {
      blockId: activeReviewBlock.BlockId,
      actualEnd: actualEndIso,
      actualSubject: activeReviewBlock.ActualSubject || activeReviewBlock.PlannedSubject,
      actualTopic: activeReviewBlock.ActualTopic || activeReviewBlock.PlannedTopic,
      completionStatus: reviewForm.completionStatus,
      topicMatchStatus: reviewForm.topicMatchStatus,
      outputType: reviewForm.outputType,
      outputCount: Number(reviewForm.outputCount || 0),
      focusRating: reviewForm.focusRating,
      interruptionReason: reviewForm.interruptionReason,
      reviewNotes: reviewForm.reviewNotes,
      backlogBucket: reviewForm.backlogBucket,
    });

    const actualMinutes =
      res?.result?.actualMinutes ?? 0;

    const finalStatus =
      reviewForm.completionStatus === "completed"
        ? BLOCK_STATUS.COMPLETED
        : reviewForm.completionStatus === "partial"
        ? BLOCK_STATUS.PARTIAL
        : BLOCK_STATUS.MISSED;

    setTodayBlocks((prev) =>
      prev.map((block) =>
        block.BlockId === activeReviewBlock.BlockId
          ? {
              ...block,
              Status: finalStatus,
              ActualEnd: actualEndIso,
              ActualMinutes: actualMinutes,
              CompletionStatus: reviewForm.completionStatus,
              TopicMatchStatus: reviewForm.topicMatchStatus,
              OutputType: reviewForm.outputType,
              OutputCount: Number(reviewForm.outputCount || 0),
              FocusRating: reviewForm.focusRating,
              InterruptionReason: reviewForm.interruptionReason,
              ReviewNotes: reviewForm.reviewNotes,
              BacklogBucket: reviewForm.backlogBucket,
            }
          : block
      )
    );

    setActiveReviewBlock(null);
  } catch (e) {
    console.error("completeBlock failed", e);
    setStatus("❌ completeBlock failed");
  }
}

  async function onSetup() {
    setBusy(true);
    setStatus("Setting up sheets (Phase 2 tabs included)...");
    try {
      await post("setup");
      setStatus(
        "✅ Setup triggered. Check tabs: SETTINGS, DAILY_LOG, WEEKLY_DASHBOARD, SCHEDULE_BLOCKS, DAILY_REVIEW."
      );
    } catch (e) {
      setStatus("❌ Setup failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDaily() {
    setBusy(true);
    setStatus("Saving daily log...");
    setMappingResult(null);

    try {
      const basePayload = {
        date,
        planMin: Number(planMin) || 0,
        doneMin: Number(doneMin) || 0,
        csatMin: Number(csatMin) || 0,
        reflection: String(reflection || "").trim(),
      };

      let mappingFields = {
        mappingCode: "",
        mappingPath: "",
        matchesCodes: "",
        matchesPaths: "",
        matchesNames: "",
      };

      if (basePayload.reflection) {
        try {
          const mapOut = await mapTextToSyllabus(basePayload.reflection);
          setMappingResult(mapOut);
          mappingFields = buildMappingFields(mapOut);
        } catch (e) {
          console.warn("mapTextToSyllabus failed:", e);
        }
      }

      await post("logDaily", { ...basePayload, ...mappingFields });
      setStatus("✅ Saved to Sheets (DAILY_LOG) with mapping + top matches.");
    } catch (e) {
      setStatus("❌ Save failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function onAnalyzeOnly() {
    setBusy(true);
    setStatus("Generating Daily Push Targets...");
    setAnalysis(null);

    try {
      const payload = {
        date,
        planMin: Number(planMin) || 0,
        doneMin: Number(doneMin) || 0,
        csatMin: Number(csatMin) || 0,
        reflection: String(reflection || "").trim(),
      };

      const out = await analyzeDay(payload);
      if (!out?.ok) {
        setStatus("❌ Analyze-Day failed: " + (out?.message || "unknown"));
      } else {
        setAnalysis(out);
        setStatus("✅ Daily Push Targets generated.");
      }
    } catch (e) {
      setStatus("❌ Analyze-Day error: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function onWeeklyRollup() {
    setBusy(true);
    setStatus("Generating weekly dashboard row...");
    try {
      await post("weeklyRollup");
      setWeekly({ message: "✅ Weekly rollup triggered. Check WEEKLY_DASHBOARD sheet." });
      setStatus("✅ Weekly dashboard updated. Check Google Sheet → WEEKLY_DASHBOARD.");
    } catch (e) {
      setStatus("❌ Weekly rollup failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function onParsePhoto() {
    if (!planPhoto) {
      setStatus("❌ Please choose a plan photo first.");
      return;
    }
    setBusy(true);
    setStatus("Reading plan photo… (time blocks)");

    try {
      const out = await parsePlanPhoto(planPhoto, date);
      if (!out?.ok) {
        setStatus("❌ Could not parse: " + (out?.message || "unknown"));
        return;
      }

      setParsedPlan(out);
	  setReminderState({});
      setTodayBlocks(buildTodayBlocksFromParsed(out));
      autoFillFromParsed(out);

      setStatus("Saving schedule blocks to Sheets…");
      const items = Array.isArray(out?.items) ? out.items : [];

      const blocksPayload = items.map((it, idx) => ({
  blockId: makeStableBlockId(out.date || date, it, idx),
  startTime: it.startTime || "",
  endTime: it.endTime || "",
  minutes: Number(it.minutes || 0),
  subject: it.subject || "Unknown",
  topic: it.topic || "",
  mappingCode: it?.mapped?.code ? String(it.mapped.code) : "",
  mappingPath: buildPlanItemMappingPath(it),
  topMatchesCodes: "",
}));

      const saveBlocksOut = await post("saveScheduleBlocks", {
        date: out.date || date,
        items: blocksPayload,
      });

      if (!saveBlocksOut?.ok) {
        console.warn("saveScheduleBlocks failed:", saveBlocksOut);
        setStatus("⚠️ Parsed OK, but saveScheduleBlocks failed. Check DEBUG_LOG.");
        return;
      }

      setStatus("Syncing calendar events (15m + 5m reminders)...");
      await post("syncCalendarFromBlocks", { date: out.date || date });

      setStatus("Syncing fixed reminders (4:30 AM + 10:05 PM)...");
      await post("syncFixedReminders", { date: out.date || date });

      setStatus("✅ Parsed + saved + calendar synced.");
    } catch (e) {
      setStatus("❌ Photo parse failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveNightReview() {
    setBusy(true);
    setStatus("Saving night review...");

    try {
      const plannedMin = Number(planMin) || plannedMinFromParsed(parsedPlan);

      const baseReviewPayload = {
        date,
        plannedMin,
        doneMin: Number(doneMin) || 0,
        csatMin: Number(csatMin) || 0,
        planCompleted: review.planCompleted,
        wentWell: review.wentWell,
        wentWrongReason: review.wentWrongReason,
        wentWrongText: review.wentWrongText,
        extraDone: review.extraDone,
        extraText: review.extraText,
        extraMinutes: Number(review.extraMinutes) || 0,
        loopFlags: "",
        tomorrowCorrection: "",
      };

      const saveOut = await post("saveDailyReview", baseReviewPayload);
      if (!saveOut?.ok) {
        setStatus("❌ saveDailyReview failed. Check DEBUG_LOG.");
        console.log("saveDailyReview out:", saveOut);
        return;
      }

      setStatus("Running Loop Detector...");
      const loopOut = await loopDetect({
        date,
        planMin: plannedMin,
        doneMin: Number(doneMin) || 0,
        csatMin: Number(csatMin) || 0,
        reflection: String(reflection || "").trim(),
        review,
      });

      setLoops(loopOut?.ok ? loopOut : null);

      if (loopOut?.ok) {
        await post("saveDailyReview", {
          ...baseReviewPayload,
          loopFlags: String(loopOut.loopFlagsText || ""),
          tomorrowCorrection: String(loopOut.tomorrowCorrection || ""),
        });
      }

      const reflectionCombined =
        `Reflection: ${String(reflection || "").trim()}\n` +
        `Went well: ${review.wentWell}\n` +
        `Went wrong: ${review.wentWrongReason}${
          review.wentWrongText ? " — " + review.wentWrongText : ""
        }\n` +
        `Extra beyond plan: ${review.extraDone}${
          review.extraDone === "Yes"
            ? ` — ${review.extraText} (${Number(review.extraMinutes) || 0} min)`
            : ""
        }\n` +
        `LoopFlags: ${String(loopOut?.loopFlagsText || "").trim()}`;

      setStatus("Running Analyze-Day (night data)...");
      const analyzeOut = await analyzeDay({
        date,
        planMin: plannedMin,
        doneMin: Number(doneMin) || 0,
        csatMin: Number(csatMin) || 0,
        reflection: reflectionCombined,
      });

      if (analyzeOut?.ok) {
        setAnalysis(analyzeOut);
        setStatus("✅ Night review saved + Loops detected + Analyze-Day generated.");
      } else {
        setStatus(
          "⚠️ Night review saved + loops done, but Analyze-Day failed: " +
            (analyzeOut?.message || "unknown")
        );
      }
    } catch (e) {
      setStatus("❌ Night review failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  const advice = analysis?.advice || null;
  const activeFlags = Array.isArray(loops?.flags) ? loops.flags : [];
  const todayTriggered = Array.isArray(loops?.todayTriggered) ? loops.todayTriggered : [];

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 4 }}>UPSC Mentor OS (Production)</h1>

      <div style={{ opacity: 0.85, marginBottom: 16 }}>
        Days left → Prelims: <b>{dPre}</b> | Mains: <b>{dMains}</b>
      </div>
	  <div style={{ opacity: 0.75, marginBottom: 8 }}>
  Alerts: <b>{alertPermission}</b>
</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <button disabled={busy} onClick={onSetup}>Setup Sheets</button>
        <button disabled={busy} onClick={onSaveDaily}>Save Daily Log</button>
        <button disabled={busy} onClick={onAnalyzeOnly}>Analyze Day Only</button>
        <button disabled={busy} onClick={onWeeklyRollup}>Weekly Rollup</button>
		<button
  disabled={busy}
  onClick={async () => {
    const perm = await ensureNotificationPermission();
    setStatus(`Notification permission: ${perm}`);
  }}
>
  Enable Alerts
</button>
      </div>

      {status && (
        <div
          style={{
            marginBottom: 16,
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          {status}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section style={{ padding: 12, border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12 }}>
          {todayBlocks.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                Today Blocks ({todayBlocks.length})
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {todayBlocks.map((block) => (
                  <div
                    key={block.BlockId}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>
                          {block.PlannedSubject || "Unknown Subject"}
                        </div>
                        <div style={{ opacity: 0.9, marginTop: 2 }}>
                          {block.PlannedTopic || "No topic"}
                        </div>
                      </div>

                      <div style={{ textAlign: "right", minWidth: 120 }}>
                        <div>
                          {block.PlannedStart || "--:--"} → {block.PlannedEnd || "--:--"}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>
                          {block.PlannedMinutes || 0} min
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        fontSize: 13,
                        opacity: 0.9,
                      }}
                    >
                      <div>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontWeight: 600,
                            fontSize: 12,
                            background:
                              block.Status === "completed"
                                ? "#1f8f4a"
                                : block.Status === "partial"
                                ? "#c79b00"
                                : block.Status === "missed"
                                ? "#b52a2a"
                                : block.Status === "active"
                                ? "#1b6edc"
                                : block.Status === "paused"
                                ? "#c26a00"
                                : "#444",
                            color: "#fff",
                          }}
                        >
                          {block.Status || "planned"}
                        </span>
                      </div>

                      <div>
                        Mapping: <b>{block.SyllabusTop1Code || "—"}</b>
                      </div>
                    </div>

                    {(block.ActualStart || block.ActualEnd || Number(block.ActualMinutes || 0) > 0) && (
                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 12,
                          fontSize: 12,
                          opacity: 0.9,
                        }}
                      >
                        {block.ActualStart && (
                          <div>
                            Started: <b>{formatTimeOnly(block.ActualStart)}</b>
                          </div>
                        )}

                        {block.ActualEnd && (
                          <div>
                            Ended: <b>{formatTimeOnly(block.ActualEnd)}</b>
                          </div>
                        )}

                        <div>
                          Actual: <b>{Number(block.ActualMinutes || 0)} min</b>
                        </div>

                        <div>
                          Pause: <b>{Number(block.TotalPauseMinutes || 0)} min</b>
                        </div>

                        <div>
                          Pauses: <b>{Number(block.PauseCount || 0)}</b>
                        </div>
                      </div>
                    )}

                    {block.SyllabusTop1Path && (
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                        {block.SyllabusTop1Path}
                      </div>
                    )}

                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {block.Status === BLOCK_STATUS.PLANNED && (
                        <button onClick={() => handleStartBlock(block.BlockId)}>
                          Start
                        </button>
                      )}

                      {block.Status === BLOCK_STATUS.ACTIVE && (
                        <>
                          <button onClick={() => handlePauseBlock(block.BlockId)}>
                            Pause
                          </button>
                          <button onClick={() => handleStopBlock(block)}>Stop</button>
                          <span style={{ fontSize: 13, opacity: 0.9 }}>Active</span>
                        </>
                      )}

                      {block.Status === BLOCK_STATUS.PAUSED && (
                        <>
                          <button onClick={() => handleResumeBlock(block.BlockId)}>
                            Resume
                          </button>
                          <button onClick={() => handleStopBlock(block)}>Stop</button>
                          <span style={{ fontSize: 13, opacity: 0.9 }}>
                            Paused ({block.PauseCount || 0})
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <hr style={{ margin: "16px 0", opacity: 0.25 }} />
            </div>
          )}

          <h2 style={{ marginTop: 0 }}>Daily Log</h2>

          <label>
            Date<br />
            <input value={date} onChange={(e) => setDate(e.target.value)} type="date" />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <label>
              Plan Minutes<br />
              <input type="number" value={planMin} onChange={(e) => setPlanMin(e.target.value)} />
            </label>

            <label>
              Done Minutes<br />
              <input type="number" value={doneMin} onChange={(e) => setDoneMin(e.target.value)} />
            </label>

            <label>
              CSAT Minutes<br />
              <input type="number" value={csatMin} onChange={(e) => setCsatMin(e.target.value)} />
            </label>

            <div>
              <div>Completion Today: <b>{completionToday}%</b></div>
              <div style={{ marginTop: 6, opacity: 0.85 }}>{dailyMotivation}</div>
            </div>
          </div>

          <label style={{ display: "block", marginTop: 12 }}>
            Reflection (THIS is your study text)<br />
            <textarea
              rows={4}
              style={{ width: "100%" }}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="What you studied today..."
            />
          </label>

          {advice && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Daily Push Targets</div>
              <div
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ marginBottom: 8, opacity: 0.95 }}>
                  <b>Coach Note:</b> {advice.coachNote || ""}
                </div>

                <div style={{ fontWeight: 800, marginBottom: 6 }}>Pushes</div>
                <ul style={{ marginTop: 0, paddingLeft: 18 }}>
                  {(advice.pushes || []).map((p, idx) => (
                    <li key={idx} style={{ marginBottom: 6 }}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <hr style={{ margin: "16px 0", opacity: 0.25 }} />

          <h3 style={{ margin: 0, marginBottom: 8 }}>Plan Photo → Parse (OCR)</h3>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPlanPhoto(e.target.files?.[0] || null)}
          />
          <div style={{ marginTop: 8 }}>
            <button disabled={busy} onClick={onParsePhoto}>
              Parse Plan Photo (Save Blocks + Sync Calendar)
            </button>
          </div>

          {parsedPlan && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Parsed Output (debug)</div>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.06)",
                  maxHeight: 260,
                  overflow: "auto",
                }}
              >
                {JSON.stringify(parsedPlan, null, 2)}
              </pre>
            </div>
          )}
        </section>

        <section style={{ padding: 12, border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Weekly Dashboard</h2>

          {!weekly ? (
            <div style={{ opacity: 0.8 }}>
              Click <b>Weekly Rollup</b> to generate the weekly row. (See it in Google Sheet.)
            </div>
          ) : (
            <div style={{ opacity: 0.9 }}>{weekly.message}</div>
          )}

          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Night Review (after 10 PM)</div>

            <div style={{ display: "grid", gap: 10 }}>
              <label>
                Planned targets completed?<br />
                <select
                  value={review.planCompleted}
                  onChange={(e) => setReview({ ...review, planCompleted: e.target.value })}
                >
                  <option value="Yes">Yes</option>
                  <option value="Partial">Partial</option>
                  <option value="No">No</option>
                </select>
              </label>

              <label>
                What went well today?<br />
                <textarea
                  rows={2}
                  style={{ width: "100%" }}
                  value={review.wentWell}
                  onChange={(e) => setReview({ ...review, wentWell: e.target.value })}
                />
              </label>

              <label>
                What went wrong today?<br />
                <select
                  value={review.wentWrongReason}
                  onChange={(e) => setReview({ ...review, wentWrongReason: e.target.value })}
                >
                  <option>Distraction</option>
                  <option>Overplanning</option>
                  <option>Fatigue</option>
                  <option>CSAT avoidance</option>
                  <option>Low focus</option>
                  <option>Phone</option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                Optional detail (1–2 lines)<br />
                <textarea
                  rows={2}
                  style={{ width: "100%" }}
                  value={review.wentWrongText}
                  onChange={(e) => setReview({ ...review, wentWrongText: e.target.value })}
                />
              </label>

              <label>
                Did you cover anything extra beyond plan?<br />
                <select
                  value={review.extraDone}
                  onChange={(e) => setReview({ ...review, extraDone: e.target.value })}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </label>

              {review.extraDone === "Yes" && (
                <>
                  <label>
                    What extra did you do?<br />
                    <textarea
                      rows={2}
                      style={{ width: "100%" }}
                      value={review.extraText}
                      onChange={(e) => setReview({ ...review, extraText: e.target.value })}
                    />
                  </label>

                  <label>
                    How many extra minutes?<br />
                    <input
                      type="number"
                      value={review.extraMinutes}
                      min={0}
                      onChange={(e) =>
                        setReview({ ...review, extraMinutes: Number(e.target.value || 0) })
                      }
                    />
                  </label>
                </>
              )}

              <button disabled={busy} onClick={onSaveNightReview}>
                Save Night Review + Loops + Analyze Day
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Loop Detector</div>

            {!loops ? (
              <div style={{ opacity: 0.8 }}>
                Run Night Review to generate loops.
              </div>
            ) : (
              <>
                <div style={{ opacity: 0.9, marginBottom: 8 }}>
                  Active loops: <b>{activeFlags.length}</b> | Window days: <b>{loops.windowDays ?? "NA"}</b>
                </div>

                {String(loops.loopFlagsText || "").trim() && (
                  <div style={{ marginBottom: 8 }}>
                    <b>Loop Flags:</b> {loops.loopFlagsText}
                  </div>
                )}

                {String(loops.tomorrowCorrection || "").trim() && (
                  <div style={{ marginBottom: 10 }}>
                    <b>Tomorrow correction:</b> {loops.tomorrowCorrection}
                  </div>
                )}

                {activeFlags.length > 0 ? (
                  <ol style={{ marginTop: 0, paddingLeft: 18 }}>
                    {activeFlags.map((f, idx) => (
                      <li key={idx} style={{ marginBottom: 10 }}>
                        <div>
                          <b>{f.severity}</b> — <b>{f.title}</b>{" "}
                          <span style={{ opacity: 0.8 }}>({f.code})</span>
                        </div>
                        {f.evidence && (
                          <div style={{ opacity: 0.85, fontSize: 13 }}>{f.evidence}</div>
                        )}
                        {f.fix && (
                          <div style={{ opacity: 0.95, marginTop: 4 }}>
                            <b>Fix:</b> {f.fix}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div style={{ opacity: 0.85 }}>No active loops detected ✅</div>
                )}

                {todayTriggered.length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer" }}>Debug: triggered today</summary>
                    <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>
                      {JSON.stringify(todayTriggered, null, 2)}
                    </pre>
                  </details>
                )}
              </>
            )}
          </div>

          <div style={{ marginTop: 14, opacity: 0.8, fontSize: 13 }}>
            <div>
              Backend: <b>{BACKEND_URL}</b> (health: <b>/health</b>)
            </div>
            <div style={{ marginTop: 6 }}>
              Sheets: Apps Script URL is behind backend proxy (<b>/api/sheets</b>)
            </div>
          </div>
        </section>
      </div>

      {activeReviewBlock && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#111",
              color: "#fff",
              padding: 20,
              borderRadius: 12,
              width: 520,
              maxWidth: "92vw",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Block Review</h3>

            <div style={{ marginBottom: 12 }}>
              <b>{activeReviewBlock.PlannedSubject}</b> — {activeReviewBlock.PlannedTopic}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <label>
                Was this block completed?<br />
                <select
                  value={reviewForm.completionStatus}
                  onChange={(e) =>
                    setReviewForm((f) => ({ ...f, completionStatus: e.target.value }))
                  }
                >
                  <option value="">Select</option>
                  <option value="completed">Completed</option>
                  <option value="partial">Partial</option>
                  <option value="missed">Missed</option>
                </select>
              </label>

              <label>
                Did you study the planned topic?<br />
                <select
                  value={reviewForm.topicMatchStatus}
                  onChange={(e) =>
                    setReviewForm((f) => ({ ...f, topicMatchStatus: e.target.value }))
                  }
                >
                  <option value="">Select</option>
                  <option value="as_planned">Yes, as planned</option>
                  <option value="partially_changed">Partially changed</option>
                  <option value="different_topic">Completely different topic</option>
                  <option value="not_studied">Did not study</option>
                </select>
              </label>

              <label>
                What was the output?<br />
                <select
                  value={reviewForm.outputType}
                  onChange={(e) =>
                    setReviewForm((f) => ({ ...f, outputType: e.target.value }))
                  }
                >
                  <option value="">Select</option>
                  <option value="notes">Notes</option>
                  <option value="revision">Revision</option>
                  <option value="mcqs">MCQs</option>
                  <option value="answer_writing">Answer writing</option>
                  <option value="test">Test</option>
                  <option value="nothing_substantial">Nothing substantial</option>
                </select>
              </label>

              <label>
                Focus quality?<br />
                <select
                  value={reviewForm.focusRating}
                  onChange={(e) =>
                    setReviewForm((f) => ({ ...f, focusRating: e.target.value }))
                  }
                >
                  <option value="">Select</option>
                  <option value="deep">Deep</option>
                  <option value="average">Average</option>
                  <option value="distracted">Distracted</option>
                </select>
              </label>

              <label>
                Reason if partial/missed?<br />
                <select
                  value={reviewForm.interruptionReason}
                  onChange={(e) =>
                    setReviewForm((f) => ({ ...f, interruptionReason: e.target.value }))
                  }
                >
                  <option value="">Select</option>
                  <option value="sleep">Sleep</option>
                  <option value="low_energy">Low energy</option>
                  <option value="phone_distraction">Phone distraction</option>
                  <option value="work_teaching">Work/teaching interruption</option>
                  <option value="poor_planning">Poor planning</option>
                  <option value="health">Health</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                Leftover action<br />
                <select
                  value={reviewForm.backlogBucket}
                  onChange={(e) =>
                    setReviewForm((f) => ({ ...f, backlogBucket: e.target.value }))
                  }
                >
                  <option value="">Select</option>
                  <option value="recover_today">Recover today</option>
                  <option value="move_to_tomorrow">Move to tomorrow</option>
                  <option value="weekly_backlog">Weekly backlog</option>
                  <option value="drop">Drop</option>
                </select>
              </label>

              <label>
                Notes<br />
                <textarea
                  rows={3}
                  style={{ width: "100%" }}
                  value={reviewForm.reviewNotes}
                  onChange={(e) =>
                    setReviewForm((f) => ({ ...f, reviewNotes: e.target.value }))
                  }
                />
              </label>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <button onClick={() => setActiveReviewBlock(null)}>Cancel</button>
              <button onClick={handleSubmitReview}>Submit Review</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}