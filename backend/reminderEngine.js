// backend/reminderEngine.js (ESM)

const schedules = new Map(); // dayKey -> { userId, dayKey, blocks }
const deliveredEvents = new Set(); // prevents duplicate reminders

const MESSAGE_PACK = {
  uploadPraise: [
    "Excellent Moulika. Today's schedule is uploaded.",
    "Good job Moulika. The day is now under execution tracking."
  ],
  blockStart: ({ subject }) => [
    `Moulika, your ${subject} block should begin now.`,
    `Start your ${subject} block now and protect the day.`
  ],
  plus3: ({ subject }) => [
    `${subject} block has not started yet.`,
    `Moulika, begin your ${subject} block now.`
  ],
  plus15: ({ subject }) => [
    `Discipline check. Your ${subject} block is delayed.`,
    `Start ${subject} immediately, Moulika.`
  ],
  plus20: ({ subject }) => [
    `Critical delay. Do not lose the day. Start ${subject} now.`,
    `Moulika, this block is still pending. Start now.`
  ],
  completionPraise: ({ label }) => [
    `${label} successfully completed, Moulika.`,
    `Excellent Moulika. ${label} completed with discipline.`
  ]
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ordinal(n) {
  const map = {
    1: "First",
    2: "Second",
    3: "Third",
    4: "Fourth",
    5: "Fifth",
    6: "Sixth",
    7: "Seventh",
    8: "Eighth"
  };
  return map[n] || `${n}th`;
}

function buildEventKey(dayKey, blockId, stage) {
  return `${dayKey}:${blockId}:${stage}`;
}

function parseMs(value) {
  return new Date(value).getTime();
}

function sendCoachMessage({ channel = "log", text, meta = {} }) {
  // For now: log only
  // Later: connect to Alexa / push / WhatsApp / web socket
  console.log("[COACH]", JSON.stringify({ channel, text, meta }));
}

export function registerDaySchedule({ userId = "moulika", dayKey, blocks }) {
  const normalizedBlocks = (blocks || []).map((b, index) => ({
    dayKey,
    blockId: b.blockId || `B${index + 1}`,
    label: b.label || `${ordinal(index + 1)} block`,
    subject: b.subject || "Study",
    topic: b.topic || "",
    startTime: b.startTime,
    endTime: b.endTime,
    plannedMinutes: Number(b.plannedMinutes || b.minutes || 0),
    status: "pending", // pending | started | completed | skipped
    startedAt: null,
    completedAt: null
  }));

  schedules.set(dayKey, {
    userId,
    dayKey,
    blocks: normalizedBlocks
  });

  sendCoachMessage({
    text: pick(MESSAGE_PACK.uploadPraise),
    meta: { type: "upload_praise", dayKey }
  });

  return normalizedBlocks;
}

export function startBlock({ dayKey, blockId, source = "app" }) {
  const day = schedules.get(dayKey);
  if (!day) return { ok: false, error: "Schedule not found" };

  const block = day.blocks.find((b) => b.blockId === blockId);
  if (!block) return { ok: false, error: "Block not found" };

  if (block.status === "completed") {
    return { ok: false, error: "Block already completed" };
  }

  block.status = "started";
  block.startedAt = new Date().toISOString();

  sendCoachMessage({
    text: `Good. ${block.label} started. Protect this momentum.`,
    meta: { type: "block_started", dayKey, blockId, source }
  });

  return { ok: true, block };
}

export function completeBlock({ dayKey, blockId, source = "app" }) {
  const day = schedules.get(dayKey);
  if (!day) return { ok: false, error: "Schedule not found" };

  const block = day.blocks.find((b) => b.blockId === blockId);
  if (!block) return { ok: false, error: "Block not found" };

  block.status = "completed";
  block.completedAt = new Date().toISOString();

  sendCoachMessage({
    text: pick(MESSAGE_PACK.completionPraise({ label: block.label })),
    meta: { type: "block_completed", dayKey, blockId, source }
  });

  return { ok: true, block };
}

export function getDay(dayKey) {
  return schedules.get(dayKey) || null;
}

export function tickReminderEngine(now = Date.now()) {
  for (const [, day] of schedules) {
    for (const block of day.blocks) {
      if (block.status === "started" || block.status === "completed") continue;
      if (!block.startTime) continue;

      const startMs = parseMs(block.startTime);
      if (!Number.isFinite(startMs)) continue;

      const checkpoints = [
        {
          stage: "start",
          at: startMs,
          text: pick(MESSAGE_PACK.blockStart({ subject: block.subject }))
        },
        {
          stage: "plus3",
          at: startMs + 3 * 60 * 1000,
          text: pick(MESSAGE_PACK.plus3({ subject: block.subject }))
        },
        {
          stage: "plus15",
          at: startMs + 15 * 60 * 1000,
          text: pick(MESSAGE_PACK.plus15({ subject: block.subject }))
        },
        {
          stage: "plus20",
          at: startMs + 20 * 60 * 1000,
          text: pick(MESSAGE_PACK.plus20({ subject: block.subject }))
        }
      ];

      for (const cp of checkpoints) {
        const key = buildEventKey(day.dayKey, block.blockId, cp.stage);

        if (now >= cp.at && !deliveredEvents.has(key) && block.status === "pending") {
          deliveredEvents.add(key);

          sendCoachMessage({
            text: cp.text,
            meta: {
              type: "discipline_reminder",
              stage: cp.stage,
              dayKey: day.dayKey,
              blockId: block.blockId
            }
          });
        }
      }
    }
  }
}