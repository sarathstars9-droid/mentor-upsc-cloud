import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { BACKEND_URL } from "../config";
import { BLOCK_STATUS } from "../blockConstants";
import { getRealStreakFromBlocks } from "../utils/dashboard";
import SyllabusRadar from "../components/plan/SyllabusRadar.jsx";
import FocusModeModal from "../components/plan/FocusModeModal.jsx";
import { theme } from "../theme/theme";
import StopConfirmModal from "../components/plan/StopConfirmModal.jsx";
import BlockReviewModal from "../components/plan/BlockReviewModal.jsx";
import {
  daysLeft,
  getCompletionPercent,
  getDailyMotivation,
  buildTodayBlocksFromParsed,
  formatTimeOnly,
  hhmmToMinutes,
  sumActualMinutes,
  nowMinutesOfDay,
  getDisplayStatus,
  getStatusBadgeColor,
  plannedMinFromParsed,
  sumCsatMinutesFromParsed,
  buildApprovedOcrBlocks,
  buildScheduleBlocksPayload,
} from "../utils/studyEngine";

/* =========================================================
   UPSC Mentor OS (Production UI)
   - Frontend -> Backend proxy (/api/sheets) -> Apps Script (NO CORS)
   - OCR + mapping + analyze-day + loop-detect via backend

   Phase 2 UX rules enforced here:
   1. Focus Mode stays open after Start and shows active Pause/Stop
   2. Stop requires confirmation before Block Review opens
   3. OCR approval happens before save/calendar/downstream actions
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
    return { ok: false, message: "Backend proxy did not return JSON", raw: text };
  }
}

async function loadSyllabusRadar(blocks) {
  const res = await fetch(`${BACKEND_URL}/api/syllabus-progress`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ blocks }),
  });

  const data = await res.json();
  return data;
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

function getTodayLocalDate() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
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
      body,
      silent: false,
    });
  }
}

async function updateBlockAction(action, payload) {
  return post(action, { payload });
}

function getEffectiveBlockStatus(block) {
  const raw = String(block?.Status || "").trim().toLowerCase();

  if (block?.ActualEnd) {
    if (
      raw === BLOCK_STATUS.PARTIAL ||
      raw === BLOCK_STATUS.MISSED ||
      raw === BLOCK_STATUS.SKIPPED
    ) {
      return raw;
    }
    return BLOCK_STATUS.COMPLETED;
  }

  if (raw === "review_pending") return "review_pending";

  if (block?.LastPauseAt && !block?.ActualEnd) return BLOCK_STATUS.PAUSED;
  if (block?.ActualStart && !block?.ActualEnd) return BLOCK_STATUS.ACTIVE;

  if (raw) return raw;

  return BLOCK_STATUS.PLANNED;
}

export default function PlanPage() {
  const [prelimsDate] = useState(DEFAULT_PRELIMS);
  const [mainsDate] = useState(DEFAULT_MAINS);

  const studyBlocksRef = useRef(null);
  const nightReviewRef = useRef(null);
  const loopDetectorRef = useRef(null);

  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [pendingStopBlock, setPendingStopBlock] = useState(null);

  const [date, setDate] = useState(getTodayLocalDate());
  const [planMin, setPlanMin] = useState(360);
  const [doneMin, setDoneMin] = useState(0);
  const [csatMin, setCsatMin] = useState(60);
  const [reflection, setReflection] = useState("");
  const [syllabusRadar, setSyllabusRadar] = useState(null);

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
  const [ocrApprovalOpen, setOcrApprovalOpen] = useState(false);
  const [ocrDraftBlocks, setOcrDraftBlocks] = useState([]);
  const [ocrPreviewReminderBlocks, setOcrPreviewReminderBlocks] = useState([]);

  const [activeReviewBlock, setActiveReviewBlock] = useState(null);
  const streakToday = getRealStreakFromBlocks(todayBlocks, doneMin);

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

  const currentBlock = useMemo(() => {
    if (!todayBlocks.length) return null;

    const visibleBlocks = todayBlocks.filter(
      (b) => getEffectiveBlockStatus(b) !== "review_pending"
    );

    if (!visibleBlocks.length) return null;

    const active = visibleBlocks.find(
      (b) => getEffectiveBlockStatus(b) === BLOCK_STATUS.ACTIVE
    );
    if (active) return active;

    const paused = visibleBlocks.find(
      (b) => getEffectiveBlockStatus(b) === BLOCK_STATUS.PAUSED
    );
    if (paused) return paused;

    const planned = visibleBlocks.find(
      (b) => getEffectiveBlockStatus(b) === BLOCK_STATUS.PLANNED
    );
    if (planned) return planned;

    const upcoming = visibleBlocks.find(
      (b) => getEffectiveBlockStatus(b) === BLOCK_STATUS.UPCOMING
    );
    if (upcoming) return upcoming;

    return visibleBlocks[0] || null;
  }, [todayBlocks]);

  useEffect(() => {
    if (!("Notification" in window)) {
      setAlertPermission("unsupported");
      return;
    }
    setAlertPermission(Notification.permission);
  }, []);

  const loadBlocksForDate = useCallback(
    async (targetDate = date) => {
      try {
        const res = await post("getBlocksForDate", { date: targetDate });

        if (!res?.ok && !res?.blocks) {
          console.warn("getBlocksForDate failed:", res);
          return;
        }

        const blocks = Array.isArray(res?.blocks) ? res.blocks : [];

        const mapped = blocks.map((b) => ({
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

          Status:
            String(b.Status || "").trim().toLowerCase() ||
            (b.ActualEnd
              ? BLOCK_STATUS.COMPLETED
              : b.LastPauseAt
                ? BLOCK_STATUS.PAUSED
                : b.ActualStart
                  ? BLOCK_STATUS.ACTIVE
                  : BLOCK_STATUS.PLANNED),
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
        setReminderState((prev) => {
          const next = {};

          for (const block of mapped) {
            const blockId = block.BlockId;
            if (!blockId) continue;

            const blockStatus = getDisplayStatus(block.Status);
            const old = prev[blockId] || {};

            if (
              blockStatus === BLOCK_STATUS.COMPLETED ||
              blockStatus === BLOCK_STATUS.PARTIAL ||
              blockStatus === BLOCK_STATUS.MISSED ||
              blockStatus === BLOCK_STATUS.SKIPPED
            ) {
              next[blockId] = {
                start_now: true,
                not_started_3: true,
                please_begin_5: true,
                paused_too_long: true,
              };
              continue;
            }

            if (blockStatus === BLOCK_STATUS.ACTIVE) {
              next[blockId] = {
                ...old,
                start_now: true,
                not_started_3: true,
                please_begin_5: true,
                paused_too_long: false,
              };
              continue;
            }

            if (blockStatus === BLOCK_STATUS.PAUSED) {
              next[blockId] = {
                ...old,
                start_now: true,
                not_started_3: true,
                please_begin_5: true,
                paused_too_long: old.paused_too_long || false,
              };
              continue;
            }

            next[blockId] = {
              start_now: old.start_now || false,
              not_started_3: old.not_started_3 || false,
              please_begin_5: old.please_begin_5 || false,
              paused_too_long: false,
            };
          }

          return next;
        });
        if (mapped.length > 0) {
          const totalPlanned = mapped.reduce(
            (sum, block) => sum + Number(block.PlannedMinutes || 0),
            0
          );
          if (totalPlanned > 0) {
            setPlanMin(totalPlanned);
          }
        }

        try {
          const radarData = await loadSyllabusRadar(mapped);
          if (radarData?.radar) {
            setSyllabusRadar(radarData.radar);
          }
        } catch (err) {
          console.warn("Radar load failed", err);
        }
      } catch (err) {
        console.error("loadBlocksForDate failed", err);
      }
    },
    [date]
  );
  useEffect(() => {
    setReminderState({});
  }, [date]);
  useEffect(() => {
    if (!date) return;
    loadBlocksForDate(date);
  }, [date, loadBlocksForDate]);

  useEffect(() => {
    function handleWindowFocus() {
      loadBlocksForDate(date);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadBlocksForDate(date);
      }
    }

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [date, loadBlocksForDate]);

  useEffect(() => {
    if (!date) return;

    const id = setInterval(() => {
      loadBlocksForDate(date);
    }, 20000);

    return () => clearInterval(id);
  }, [date, loadBlocksForDate]);

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

          const blockStatus = getDisplayStatus(block.Status);

          const hasStarted =
            blockStatus === BLOCK_STATUS.ACTIVE ||
            blockStatus === BLOCK_STATUS.PAUSED ||
            blockStatus === BLOCK_STATUS.COMPLETED ||
            blockStatus === BLOCK_STATUS.PARTIAL ||
            blockStatus === BLOCK_STATUS.MISSED ||
            blockStatus === BLOCK_STATUS.SKIPPED ||
            blockStatus === "skipped" ||
            !!block.ActualStart;

          if (!hasStarted && blockStatus === BLOCK_STATUS.PLANNED) {
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

          if (blockStatus === BLOCK_STATUS.PAUSED && block.LastPauseAt && !current.paused_too_long) {
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

  const dPre = daysLeft(prelimsDate);
  const dMains = daysLeft(mainsDate);

  const completionToday = useMemo(() => {
    return getCompletionPercent(planMin, doneMin);
  }, [planMin, doneMin]);

  const dailyMotivation = useMemo(() => {
    return getDailyMotivation(completionToday);
  }, [completionToday]);

  const spotlightMessage = useMemo(() => {
    if (!currentBlock) {
      return "Upload a plan photo or create today’s blocks to begin execution.";
    }

    const statusValue = getDisplayStatus(currentBlock.Status);

    if (statusValue === BLOCK_STATUS.ACTIVE) {
      return "This is the block that matters now. Protect it.";
    }

    if (statusValue === BLOCK_STATUS.PAUSED) {
      return "Resume calmly. Momentum returns faster than you think.";
    }

    if (statusValue === BLOCK_STATUS.PLANNED) {
      return "Start the next meaningful block. One clean start changes the day.";
    }

    return "Stay steady. Execution is built one block at a time.";
  }, [currentBlock]);

  function autoFillFromParsed(out) {
    if (out?.date) setDate(out.date);

    const total = Number(out?.totalMinutes ?? 0);
    if (total > 0) setPlanMin(total);

    const csat = sumCsatMinutesFromParsed(out);
    if (csat > 0) setCsatMin(csat);

    setDoneMin(0);
    setReflection("Plan auto-filled from photo. Edit if needed.");
    setAnalysis(null);
    setMappingResult(null);
    setLoops(null);
  }

  async function handleStartBlock(blockId, options = {}) {
    const { openFocus = true } = options;
    const nowIso = new Date().toISOString();

    if (openFocus) {
      setSpotlightOpen(true);
    }

    setTodayBlocks((prev) =>
      prev.map((b) =>
        b.BlockId === blockId
          ? {
            ...b,
            Status: BLOCK_STATUS.ACTIVE,
            ActualStart: b.ActualStart || nowIso,
          }
          : b
      )
    );

    setReminderState((prev) => ({
      ...prev,
      [blockId]: {
        ...(prev[blockId] || {}),
        start_now: true,
        not_started_3: true,
        please_begin_5: true,
        paused_too_long: false,
      },
    }));

    setStatus("✅ Block started. Focus Mode is active.");

    try {
      const out = await updateBlockAction("startBlock", {
        blockId,
        actualStart: nowIso,
      });

      if (!out?.ok) {
        setStatus(`❌ startBlock failed: ${out?.message || "unknown"}`);
        await loadBlocksForDate(date);
        return;
      }

      await loadBlocksForDate(date);
    } catch (e) {
      console.error("startBlock failed", e);
      setStatus("❌ startBlock failed");
      await loadBlocksForDate(date);
    }
  }

  async function handlePauseBlock(blockId) {
    const nowIso = new Date().toISOString();

    setTodayBlocks((prev) =>
      prev.map((b) =>
        b.BlockId === blockId
          ? {
            ...b,
            Status: BLOCK_STATUS.PAUSED,
            LastPauseAt: nowIso,
            PauseCount: Number(b.PauseCount || 0) + 1,
          }
          : b
      )
    );

    try {
      const out = await updateBlockAction("pauseBlock", {
        blockId,
        pausedAt: nowIso,
      });

      if (!out?.ok) {
        console.error("pauseBlock failed", out);
        setStatus(`❌ pauseBlock failed: ${out?.message || "unknown"}`);
        await loadBlocksForDate(date);
        return;
      }

      await loadBlocksForDate(date);
      setStatus("⏸️ Block paused.");
    } catch (e) {
      console.error("pauseBlock error", e);
      setStatus("❌ pauseBlock failed");
      await loadBlocksForDate(date);
    }
  }
  async function handleResumeBlock(blockId) {
    const nowIso = new Date().toISOString();

    // Optimistic UI update
    setTodayBlocks((prev) =>
      prev.map((b) =>
        b.BlockId === blockId
          ? {
            ...b,
            Status: BLOCK_STATUS.ACTIVE,
            LastResumeAt: nowIso,
          }
          : b
      )
    );

    try {
      const res = await updateBlockAction("resumeBlock", {
        blockId,
        resumedAt: nowIso,
      });

      if (!res?.ok) {
        setStatus(`❌ resumeBlock failed: ${res?.message || "unknown"}`);
        await loadBlocksForDate(date);
        return;
      }

      setReminderState((prev) => ({
        ...prev,
        [blockId]: {
          ...(prev[blockId] || {}),
          paused_too_long: false,
        },
      }));

      await loadBlocksForDate(date);
      setSpotlightOpen(true);
      setStatus("▶️ Block resumed.");
    } catch (e) {
      console.error("resumeBlock failed", e);
      setStatus("❌ resumeBlock failed");
      await loadBlocksForDate(date);
    }
  }

  function requestStopBlock(block) {
    if (!block) return;
    setPendingStopBlock(block);
    setStopConfirmOpen(true);
  }

  function handleStopBlock(block) {
    if (!block) return;

    const blockId = block.BlockId;

    setStopConfirmOpen(false);
    setPendingStopBlock(null);
    setSpotlightOpen(false);

    setTodayBlocks((prev) =>
      prev.map((b) =>
        b.BlockId === blockId
          ? {
            ...b,
            Status: "review_pending",
          }
          : b
      )
    );

    setActiveReviewBlock({
      ...block,
      Status: "review_pending",
    });

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

    if (!reviewForm.completionStatus) {
      setStatus("❌ Please select block completion status.");
      return;
    }

    if (!reviewForm.topicMatchStatus) {
      setStatus("❌ Please select topic match status.");
      return;
    }

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

      if (!res?.ok) {
        setStatus(`❌ completeBlock failed: ${res?.message || "unknown"}`);
        return;
      }

      await loadBlocksForDate(date);

      setActiveReviewBlock(null);
      setPendingStopBlock(null);
      setStopConfirmOpen(false);
      setSpotlightOpen(false);

      setTimeout(() => {
        setStatus("✅ Block review saved.");
      }, 0);
    } catch (e) {
      console.error("completeBlock failed", e);
      setStatus("❌ completeBlock failed");
    }
  }

  async function onSetup() {
    setBusy(true);
    setStatus("Setting up sheets (Phase 2 tabs included)...");

    try {
      const out = await post("setup");
      if (!out?.ok) {
        setStatus("❌ Setup failed: " + (out?.message || "unknown"));
        return;
      }

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

      const out = await post("logDaily", { ...basePayload, ...mappingFields });
      if (!out?.ok) {
        setStatus("❌ Save failed: " + (out?.message || "unknown"));
        return;
      }

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
      const out = await post("weeklyRollup");
      if (!out?.ok) {
        setStatus("❌ Weekly rollup failed: " + (out?.message || "unknown"));
        return;
      }

      setWeekly({ message: "✅ Weekly rollup triggered. Check WEEKLY_DASHBOARD sheet." });
      setStatus("✅ Weekly dashboard updated. Check Google Sheet → WEEKLY_DASHBOARD.");
    } catch (e) {
      setStatus("❌ Weekly rollup failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveOcrBlocks() {
    const approvedBlocks = buildApprovedOcrBlocks(date, ocrDraftBlocks);

    if (!approvedBlocks.length) {
      setStatus("❌ No OCR blocks to approve.");
      return;
    }

    const blocksPayload = buildScheduleBlocksPayload(approvedBlocks);
    const reminderBlocksToRegister = approvedBlocks.map((block, index) => {
      const existing = ocrPreviewReminderBlocks[index] || {};
      return {
        ...existing,
        blockId: block.BlockId,
        BlockId: block.BlockId,
        subject: block.PlannedSubject,
        plannedSubject: block.PlannedSubject,
        topic: block.PlannedTopic,
        plannedTopic: block.PlannedTopic,
        start: block.PlannedStart,
        plannedStart: block.PlannedStart,
        end: block.PlannedEnd,
        plannedEnd: block.PlannedEnd,
        minutes: Number(block.PlannedMinutes || 0),
        plannedMinutes: Number(block.PlannedMinutes || 0),
      };
    });

    setBusy(true);
    setStatus("Saving approved schedule blocks...");

    try {
      const saveBlocksOut = await post("saveScheduleBlocks", {
        date,
        items: blocksPayload,
      });

      if (!saveBlocksOut?.ok) {
        setStatus("❌ saveScheduleBlocks failed. Nothing else was synced.");
        return;
      }

      setStatus("Syncing approved calendar events...");
      const calOut = await post("syncCalendarFromBlocks", { date });
      if (!calOut?.ok) {
        console.warn("syncCalendarFromBlocks failed:", calOut);
      }

      setStatus("Syncing fixed reminders...");
      const fixedOut = await post("syncFixedReminders", { date });
      if (!fixedOut?.ok) {
        console.warn("syncFixedReminders failed:", fixedOut);
      }

      if (reminderBlocksToRegister.length > 0) {
        setStatus("Registering approved reminder blocks...");
        const regRes = await fetch(`${BACKEND_URL}/api/schedule/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dayKey: date,
            userId: "moulika",
            blocks: reminderBlocksToRegister,
          }),
        });

        const regText = await regRes.text();
        let regOut;
        try {
          regOut = JSON.parse(regText);
        } catch {
          regOut = { ok: false, raw: regText };
        }

        if (!regOut?.ok) {
          console.warn("schedule/register failed:", regOut);
        }
      }

      setOcrApprovalOpen(false);
      setOcrDraftBlocks([]);
      setOcrPreviewReminderBlocks([]);
      setParsedPlan(null);
      setReminderState({});

      await loadBlocksForDate(date);

      setStatus("✅ Approved plan saved, calendar synced, and reminders registered.");
    } catch (e) {
      setStatus("❌ OCR approval save failed: " + (e?.message || String(e)));
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
      autoFillFromParsed(out);

      const draftBlocks = buildTodayBlocksFromParsed(out);
      setOcrDraftBlocks(draftBlocks);

      const previewBlocks = Array.isArray(out?.reminderEngine?.previewBlocks)
        ? out.reminderEngine.previewBlocks
        : [];
      setOcrPreviewReminderBlocks(previewBlocks);

      setOcrApprovalOpen(true);

      setStatus(
        out?.approvalRequired
          ? "OCR parsed. Please review and approve before saving."
          : "OCR parsed successfully."
      );
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
        `Went wrong: ${review.wentWrongReason}${review.wentWrongText ? " — " + review.wentWrongText : ""
        }\n` +
        `Extra beyond plan: ${review.extraDone}${review.extraDone === "Yes"
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

  function scrollToSection(ref) {
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function updateOcrDraftBlock(index, patch) {
    setOcrDraftBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, ...patch } : block))
    );
  }

  function removeOcrDraftBlock(index) {
    setOcrDraftBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="page-wrap">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">Daily Execution System</div>
          <h1 className="hero-title">
            Welcome back, <span className="hero-title-accent">Moulika</span>
          </h1>
          <div className="hero-subtitle">
            Quiet consistency compounds. The system handles the structure. You focus on execution.
          </div>

          <div className="hero-meta">
            <div className="hero-pill">Prelims in {dPre} days</div>
            <div className="hero-pill">Mains in {dMains} days</div>
            <div className="hero-pill">Alerts: {alertPermission}</div>
            <div className="hero-pill">🔥 {streakToday} Day Streak</div>
          </div>
        </div>

        <div className="hero-panel">
          <div>
            <div className="hero-panel-label">Today Completion</div>
            <div className="hero-panel-value">{completionToday}%</div>
          </div>
          <div className="hero-panel-note">{dailyMotivation}</div>
        </div>
      </section>

      {currentBlock && (
        <div className="spotlight-card" style={{ padding: "20px 24px", minHeight: "unset" }}>
          <div className="spotlight-left">
            <div className="spotlight-label">Current Block Spotlight</div>

            {!currentBlock ? (
              <>
                <div className="spotlight-title" style={{ fontSize: 28, lineHeight: 1.1 }}>
                  No active block yet
                </div>
                <div className="spotlight-subtitle" style={{ fontSize: 16, marginTop: 6 }}>
                  {spotlightMessage}
                </div>
              </>
            ) : (
              <>
                <div className="spotlight-title" style={{ fontSize: 28, lineHeight: 1.1 }}>
                  {currentBlock.PlannedSubject || "Unknown Subject"}
                </div>

                <div className="spotlight-subtitle" style={{ fontSize: 16, marginTop: 6 }}>
                  {currentBlock.PlannedTopic || "No topic"}
                </div>

                <div className="spotlight-meta">
                  <span className="spotlight-chip">
                    {currentBlock?.PlannedStart || "--:--"} → {currentBlock?.PlannedEnd || "--:--"}
                  </span>

                  <span className="spotlight-chip">
                    {currentBlock?.PlannedMinutes || 0} min
                  </span>

                  <span
                    className="spotlight-chip spotlight-status"
                    style={{
                      background:
                        getDisplayStatus(currentBlock?.Status) === BLOCK_STATUS.ACTIVE
                          ? "rgba(59, 130, 246, 0.22)"
                          : getDisplayStatus(currentBlock?.Status) === BLOCK_STATUS.PAUSED
                            ? "rgba(245, 158, 11, 0.22)"
                            : getDisplayStatus(currentBlock?.Status) === BLOCK_STATUS.COMPLETED
                              ? "rgba(34, 197, 94, 0.22)"
                              : getDisplayStatus(currentBlock?.Status) === BLOCK_STATUS.PARTIAL
                                ? "rgba(168, 85, 247, 0.22)"
                                : getDisplayStatus(currentBlock?.Status) === BLOCK_STATUS.MISSED ||
                                  getDisplayStatus(currentBlock?.Status) === BLOCK_STATUS.SKIPPED
                                  ? "rgba(249, 115, 22, 0.22)"
                                  : "rgba(148, 163, 184, 0.18)",
                      color:
                        getDisplayStatus(currentBlock?.Status) === BLOCK_STATUS.ACTIVE
                          ? "#93c5fd"
                          : getDisplayStatus(currentBlock?.Status) === BLOCK_STATUS.PAUSED
                            ? "#fcd34d"
                            : getDisplayStatus(currentBlock?.Status) === BLOCK_STATUS.COMPLETED
                              ? "#86efac"
                              : getDisplayStatus(currentBlock?.Status) === BLOCK_STATUS.PARTIAL
                                ? "#d8b4fe"
                                : getDisplayStatus(currentBlock?.Status) === BLOCK_STATUS.MISSED ||
                                  getDisplayStatus(currentBlock?.Status) === BLOCK_STATUS.SKIPPED
                                  ? "#fdba74"
                                  : "#cbd5e1",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {getDisplayStatus(currentBlock?.Status)}
                  </span>
                </div>

                <div className="spotlight-note" style={{ marginTop: 8, fontSize: 14 }}>
                  {spotlightMessage}
                </div>
              </>
            )}
          </div>

          <div className="spotlight-right">
            {currentBlock && getEffectiveBlockStatus(currentBlock) === BLOCK_STATUS.PLANNED && (
              <button
                disabled={busy}
                onClick={() => handleStartBlock(currentBlock.BlockId, { openFocus: true })}
              >
                {busy ? "Processing..." : "Start Block"}
              </button>
            )}

            {currentBlock && getDisplayStatus(currentBlock.Status) === BLOCK_STATUS.ACTIVE && (
              <>
                <button disabled={busy} onClick={() => handlePauseBlock(currentBlock.BlockId)}>
                  {busy ? "Processing..." : "Pause"}
                </button>
                <button disabled={busy} onClick={() => requestStopBlock(currentBlock)}>
                  Stop
                </button>
              </>
            )}

            {currentBlock && getDisplayStatus(currentBlock.Status) === BLOCK_STATUS.PAUSED && (
              <>
                <button disabled={busy} onClick={() => handleResumeBlock(currentBlock.BlockId)}>
                  {busy ? "Processing..." : "Resume"}
                </button>
                <button disabled={busy} onClick={() => requestStopBlock(currentBlock)}>
                  Stop
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="quick-nav-bar">
        <button onClick={() => scrollToSection(studyBlocksRef)}>Today’s Study Blocks</button>
        <button onClick={() => scrollToSection(nightReviewRef)}>Night Review</button>
        <button onClick={() => scrollToSection(loopDetectorRef)}>Loop Detector</button>
      </div>

      <div className="plan-card" style={{ background: theme.colors.card }}>
        <div className="section-shell">
          <div className="section-kicker">Execution</div>
          <h3 className="section-headline">Daily Actions</h3>
          <p className="section-support">Protect the day with clean actions and low friction.</p>
        </div>

        <div className="plan-action-row">
          <button disabled={busy} onClick={onSetup}>
            Setup Sheets
          </button>
          <button disabled={busy} onClick={onSaveDaily}>
            Save Daily Log
          </button>
          <button disabled={busy} onClick={onAnalyzeOnly}>
            Analyze Day Only
          </button>
          <button disabled={busy} onClick={onWeeklyRollup}>
            Weekly Rollup
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              const perm = await ensureNotificationPermission();
              setAlertPermission(perm);
              setStatus(`Notification permission: ${perm}`);
            }}
          >
            Enable Alerts
          </button>
        </div>
      </div>

      {status && <div className="status-box info">{status}</div>}

      <div className="plan-grid">
        <section className="plan-left">
          <div className="plan-card">
            <h2 className="plan-card-title">Daily Log</h2>

            <div className="plan-split-grid">
              <label className="field-label">
                Date
                <input value={date} onChange={(e) => setDate(e.target.value)} type="date" />
              </label>

              <div className="mini-stat">
                <div className="mini-stat-label">Today Completion</div>
                <div className="mini-stat-value">{completionToday}%</div>
                <div className="mini-stat-note">{dailyMotivation}</div>
              </div>

              <label className="field-label">
                Plan Minutes
                <input type="number" value={planMin} onChange={(e) => setPlanMin(e.target.value)} />
              </label>

              <label className="field-label">
                Done Minutes
                <input type="number" value={doneMin} onChange={(e) => setDoneMin(e.target.value)} />
              </label>

              <label className="field-label">
                CSAT Minutes
                <input type="number" value={csatMin} onChange={(e) => setCsatMin(e.target.value)} />
              </label>
            </div>

            <label className="field-label" style={{ marginTop: 16 }}>
              Reflection (THIS is your study text)
              <textarea
                rows={4}
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="What you studied today..."
              />
            </label>

            {mappingResult?.mapping && (
              <div className="mini-stat" style={{ marginTop: 16 }}>
                <div className="mini-stat-label">Syllabus Mapping</div>
                <div className="mini-stat-note">
                  <b>Top Code:</b> {mappingResult.mapping.code || "—"}
                </div>
                <div className="mini-stat-note">
                  <b>Path:</b> {mappingResult.mapping.path || "—"}
                </div>
              </div>
            )}

            {advice && (
              <div className="mini-stat" style={{ marginTop: 16 }}>
                <div className="mini-stat-label" style={{ marginBottom: 8 }}>
                  Daily Push Targets
                </div>
                <div className="mini-stat-note" style={{ marginBottom: 8 }}>
                  <b>Coach Note:</b> {advice.coachNote || ""}
                </div>
                <ul style={{ marginTop: 0, paddingLeft: 18 }}>
                  {(advice.pushes || []).map((p, idx) => (
                    <li key={idx} style={{ marginBottom: 6 }}>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="plan-card">
            <h3 className="plan-card-title">Plan Photo → Parse (OCR)</h3>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPlanPhoto(e.target.files?.[0] || null)}
            />
            <div style={{ marginTop: 12 }}>
              <button disabled={busy} onClick={onParsePhoto}>
                Parse Plan Photo (Review + Approve + Save)
              </button>
            </div>

            {parsedPlan && (
              <div style={{ marginTop: 16 }}>
                <div className="mini-stat-label" style={{ marginBottom: 8 }}>
                  Parsed Output (debug)
                </div>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 12,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(123, 136, 138, 0.16)",
                    background: "#2D3038",
                    maxHeight: 260,
                    overflow: "auto",
                    color: "#F3F2EE",
                  }}
                >
                  {JSON.stringify(parsedPlan, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {todayBlocks.length > 0 && (
            <>
              <h2 ref={studyBlocksRef} className="block-section-title">
                Today’s Study Blocks
              </h2>

              <div className="blocks-grid">
                {todayBlocks.map((block) => (
                  <div
                    key={block.BlockId}
                    className={`block-card ${getDisplayStatus(block.Status) === BLOCK_STATUS.ACTIVE
                      ? "block-card-active"
                      : ""
                      }`}
                  >
                    <div className="block-top">
                      <div>
                        <div className="block-subject">
                          {block.PlannedSubject || "Unknown Subject"}
                        </div>
                        <div className="block-topic">{block.PlannedTopic || "No topic"}</div>
                      </div>

                      <div className="block-time">
                        <div>
                          {block.PlannedStart || "--:--"} → {block.PlannedEnd || "--:--"}
                        </div>
                        <div className="block-minutes">{block.PlannedMinutes || 0} min</div>
                      </div>
                    </div>

                    <div className="block-status-row">
                      <div>
                        <span
                          className="block-badge"
                          style={{ background: getStatusBadgeColor(block.Status) }}
                        >
                          {getDisplayStatus(block.Status)}
                        </span>
                      </div>

                      <div>
                        Mapping: <b>{block.SyllabusTop1Code || "—"}</b>
                      </div>
                    </div>

                    {(block.ActualStart ||
                      block.ActualEnd ||
                      Number(block.ActualMinutes || 0) > 0) && (
                        <div className="block-details">
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
                      <div className="block-path">{block.SyllabusTop1Path}</div>
                    )}

                    <div className="block-actions">
                      {getDisplayStatus(block.Status) === BLOCK_STATUS.PLANNED && (
                        <button
                          disabled={busy}
                          onClick={() => handleStartBlock(block.BlockId, { openFocus: true })}
                        >
                          {busy ? "Processing..." : "Start"}
                        </button>
                      )}

                      {getDisplayStatus(block.Status) === BLOCK_STATUS.ACTIVE && (
                        <>
                          <button disabled={busy} onClick={() => handlePauseBlock(block.BlockId)}>
                            {busy ? "Processing..." : "Pause"}
                          </button>
                          <button disabled={busy} onClick={() => requestStopBlock(block)}>
                            Stop
                          </button>
                          <span style={{ fontSize: 13, opacity: 0.9, alignSelf: "center" }}>
                            Active
                          </span>
                        </>
                      )}

                      {getDisplayStatus(block.Status) === BLOCK_STATUS.PAUSED && (
                        <>
                          <button disabled={busy} onClick={() => handleResumeBlock(block.BlockId)}>
                            {busy ? "Processing..." : "Resume"}
                          </button>
                          <button disabled={busy} onClick={() => requestStopBlock(block)}>
                            Stop
                          </button>
                          <span style={{ fontSize: 13, opacity: 0.9, alignSelf: "center" }}>
                            Paused ({block.PauseCount || 0})
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="plan-right">
          <SyllabusRadar radar={syllabusRadar} />

          <div className="plan-card">
            <h2 className="plan-card-title">Weekly Dashboard</h2>

            {!weekly ? (
              <div className="footer-note" style={{ fontSize: 14 }}>
                Click <b>Weekly Rollup</b> to generate the weekly row. (See it in Google Sheet.)
              </div>
            ) : (
              <div className="footer-note" style={{ fontSize: 14, color: "#F3F2EE" }}>
                {weekly.message}
              </div>
            )}
          </div>

          <div ref={nightReviewRef} className="plan-card">
            <h2 className="plan-card-title">Night Review</h2>

            <div style={{ display: "grid", gap: 12 }}>
              <label className="field-label">
                Planned targets completed?
                <select
                  value={review.planCompleted}
                  onChange={(e) => setReview({ ...review, planCompleted: e.target.value })}
                >
                  <option value="Yes">Yes</option>
                  <option value="Partial">Partial</option>
                  <option value="No">No</option>
                </select>
              </label>

              <label className="field-label">
                What went well today?
                <textarea
                  rows={2}
                  value={review.wentWell}
                  onChange={(e) => setReview({ ...review, wentWell: e.target.value })}
                />
              </label>

              <label className="field-label">
                What went wrong today?
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

              <label className="field-label">
                Optional detail (1–2 lines)
                <textarea
                  rows={2}
                  value={review.wentWrongText}
                  onChange={(e) => setReview({ ...review, wentWrongText: e.target.value })}
                />
              </label>

              <label className="field-label">
                Did you cover anything extra beyond plan?
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
                  <label className="field-label">
                    What extra did you do?
                    <textarea
                      rows={2}
                      value={review.extraText}
                      onChange={(e) => setReview({ ...review, extraText: e.target.value })}
                    />
                  </label>

                  <label className="field-label">
                    How many extra minutes?
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

          <div ref={loopDetectorRef} className="plan-card">
            <h2 className="plan-card-title">Loop Detector</h2>

            {!loops ? (
              <div className="footer-note" style={{ fontSize: 14 }}>
                Run Night Review to generate loops.
              </div>
            ) : (
              <>
                <div
                  className="footer-note"
                  style={{ marginBottom: 12, fontSize: 14, color: "#F3F2EE" }}
                >
                  Active loops: <b>{activeFlags.length}</b> | Window days:{" "}
                  <b>{loops.windowDays ?? "NA"}</b>
                </div>

                {String(loops.loopFlagsText || "").trim() && (
                  <div style={{ marginBottom: 10 }}>
                    <b>Loop Flags:</b> {loops.loopFlagsText}
                  </div>
                )}

                {String(loops.tomorrowCorrection || "").trim() && (
                  <div style={{ marginBottom: 12 }}>
                    <b>Tomorrow correction:</b> {loops.tomorrowCorrection}
                  </div>
                )}

                {activeFlags.length > 0 ? (
                  <ol style={{ marginTop: 0, paddingLeft: 18 }}>
                    {activeFlags.map((f, idx) => (
                      <li key={idx} style={{ marginBottom: 12 }}>
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
                  <div className="footer-note" style={{ fontSize: 14 }}>
                    No active loops detected ✅
                  </div>
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

          <div className="plan-card">
            <div className="footer-note">
              Backend: <b>{BACKEND_URL}</b> (health: <b>/health</b>)
            </div>
            <div className="footer-note">
              Sheets: Apps Script URL is behind backend proxy (<b>/api/sheets</b>)
            </div>
          </div>
        </section>
      </div>

      <BlockReviewModal
        open={!!activeReviewBlock}
        block={activeReviewBlock}
        reviewForm={reviewForm}
        setReviewForm={setReviewForm}
        onSubmit={handleSubmitReview}
        onCancel={async () => {
          setActiveReviewBlock(null);
          setPendingStopBlock(null);
          setStopConfirmOpen(false);
          await loadBlocksForDate(date);
        }}
      />

      <StopConfirmModal
        open={stopConfirmOpen && !!(pendingStopBlock || currentBlock)}
        block={pendingStopBlock || currentBlock}
        onConfirm={() => {
          const stopTarget = pendingStopBlock || currentBlock;
          if (stopTarget) {
            handleStopBlock(stopTarget);
          }
        }}
        onCancel={() => {
          setStopConfirmOpen(false);
          setPendingStopBlock(null);
        }}
      />
      <FocusModeModal
        open={spotlightOpen}
        block={currentBlock}
        busy={busy}
        onStart={() => currentBlock && handleStartBlock(currentBlock.BlockId, { openFocus: true })}
        onPause={() => currentBlock && handlePauseBlock(currentBlock.BlockId)}
        onResume={() => currentBlock && handleResumeBlock(currentBlock.BlockId)}
        onStop={() => currentBlock && requestStopBlock(currentBlock)}
        onClose={() => setSpotlightOpen(false)}
      />

      {ocrApprovalOpen && (
        <div className="focus-overlay">
          <div
            className="focus-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(980px, 96vw)", maxHeight: "88vh", overflow: "auto" }}
          >
            <div className="focus-kicker">OCR Review</div>
            <h2 className="focus-title">Approve Parsed Plan</h2>
            <div className="focus-subtitle">
              Review subject, topic, time, and minutes before saving blocks and syncing calendar.
            </div>

            <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
              {ocrDraftBlocks.map((block, index) => (
                <div
                  key={block.BlockId || `${block.PlannedStart}-${index}`}
                  className={`block-card ${getDisplayStatus(block.Status) === BLOCK_STATUS.ACTIVE
                    ? "block-card-active"
                    : ""
                    }`}
                >
                  <div className="plan-split-grid">
                    <label className="field-label">
                      Subject
                      <input
                        value={block.PlannedSubject || ""}
                        onChange={(e) =>
                          updateOcrDraftBlock(index, { PlannedSubject: e.target.value })
                        }
                      />
                    </label>

                    <label className="field-label">
                      Topic
                      <input
                        value={block.PlannedTopic || ""}
                        onChange={(e) =>
                          updateOcrDraftBlock(index, { PlannedTopic: e.target.value })
                        }
                      />
                    </label>

                    <label className="field-label">
                      Start
                      <input
                        value={block.PlannedStart || ""}
                        onChange={(e) =>
                          updateOcrDraftBlock(index, { PlannedStart: e.target.value })
                        }
                      />
                    </label>

                    <label className="field-label">
                      End
                      <input
                        value={block.PlannedEnd || ""}
                        onChange={(e) =>
                          updateOcrDraftBlock(index, { PlannedEnd: e.target.value })
                        }
                      />
                    </label>

                    <label className="field-label">
                      Minutes
                      <input
                        type="number"
                        value={block.PlannedMinutes || 0}
                        onChange={(e) =>
                          updateOcrDraftBlock(index, {
                            PlannedMinutes: Number(e.target.value || 0),
                          })
                        }
                      />
                    </label>
                  </div>

                  {(block.SyllabusTop1Code || block.SyllabusTop1Path) && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 12,
                        background: "rgba(123,136,138,0.10)",
                        border: "1px solid rgba(123,136,138,0.16)",
                        fontSize: 13,
                      }}
                    >
                      <div>
                        <b>Mapping:</b> {block.SyllabusTop1Code || "—"}
                      </div>
                      {block.SyllabusTop1Path && (
                        <div style={{ marginTop: 4, opacity: 0.9 }}>{block.SyllabusTop1Path}</div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                    <button className="focus-close-btn" onClick={() => removeOcrDraftBlock(index)}>
                      Remove Block
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="focus-actions" style={{ marginTop: 24 }}>
              <button disabled={busy} onClick={handleApproveOcrBlocks}>
                {busy ? "Processing..." : "Approve and Continue"}
              </button>

              <button
                disabled={busy}
                className="focus-close-btn"
                onClick={() => {
                  setOcrApprovalOpen(false);
                  setOcrDraftBlocks([]);
                  setOcrPreviewReminderBlocks([]);
                  setParsedPlan(null);
                  setReminderState({});
                  setStatus("OCR review closed. Nothing was saved or synced.");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )
      }
    </div >
  );
}