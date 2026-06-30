import { query } from '../db/index.js';
import * as botCommandService from './botCommandService.js';

// ── Module-level singleton guards ────────────────────────────────────────────
// These are process-lifetime flags. Even if startTelegramPolling() is called
// multiple times (e.g., from a buggy boot sequence), only ONE polling loop runs.
let pollingLoopStarted = false;  // set to true permanently once the loop starts
let isPolling = false;           // set to false by stopTelegramPolling() to end the loop

let lastUpdateId = 0;
export let inMemoryRetryQueue = [];

// ── Markdown → Telegram HTML ─────────────────────────────────────────────────
export function convertMarkdownToHtml(md) {
  if (!md) return "";
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*([^\*]+)\*/g, "<b>$1</b>")
    .replace(/_([^_]+)_/g, "<i>$1</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

// ── Send message ─────────────────────────────────────────────────────────────
export async function sendTelegramMessageDirect(chatId, text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn(`[TelegramService] Cannot send message: TELEGRAM_BOT_TOKEN is missing. Chat ID: ${chatId}`);
    return false;
  }
  
  try {
    const { healthMonitor } = await import('./healthMonitor.js');
    healthMonitor.recordTelegramAttempt();

    const htmlText = convertMarkdownToHtml(text);
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    // Omit custom non-Telegram options before sending body
    const { skipEventLogging, userId, notificationType, sourceType, sourceId, skipQueue, ...telegramOptions } = options;

    const bodyPayload = {
      chat_id: chatId,
      text: htmlText,
      parse_mode: 'HTML',
      ...telegramOptions
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[TelegramService] Bot reply failed to ${chatId}. Status: ${res.status}. Response: ${errText}`);
      healthMonitor.recordTelegramFailure();
      return false;
    }
    
    console.log(`[TelegramService] Bot reply sent to ${chatId}`);
    healthMonitor.recordTelegramSuccess();
    return true;
  } catch (err) {
    console.error(`[TelegramService ERROR] Failed to send message to ${chatId}:`, err);
    try {
      const { healthMonitor } = await import('./healthMonitor.js');
      healthMonitor.recordTelegramFailure();
    } catch (e) {}
    return false;
  }
}

export async function sendTelegramMessage(chatId, text, options = {}) {
  const success = await sendTelegramMessageDirect(chatId, text, options);
  
  if (!success && !options.skipQueue) {
    try {
      const nextRetryAt = new Date(Date.now() + 1 * 60 * 1000);
      await query(
        `INSERT INTO public.telegram_retry_queue (chat_id, text, options, retry_count, next_retry_at)
         VALUES ($1, $2, $3, 0, $4)`,
        [chatId, text, JSON.stringify(options), nextRetryAt]
      );
      console.log(`[TelegramService] Queued failed Telegram message to ${chatId} in database.`);
    } catch (err) {
      console.warn(`[TelegramService] Failed to queue message in DB, using in-memory fallback. Error: ${err.message}`);
      inMemoryRetryQueue.push({
        chat_id: chatId,
        text: text,
        options: options,
        retry_count: 0,
        next_retry_at: new Date(Date.now() + 1 * 60 * 1000),
        created_at: new Date()
      });
    }
  }
  return success;
}

export async function sendMessage(chatId, text, options = {}) {
  return sendTelegramMessage(chatId, text, options);
}

// ── Register env chat ID ─────────────────────────────────────────────────────
export async function registerEnvChatId() {
  const envChatId = process.env.TELEGRAM_CHAT_ID;
  if (envChatId) {
    try {
      await query(
        `INSERT INTO public.notification_channels (user_id, channel_type, destination_id, is_enabled)
         VALUES ('moulika', 'TELEGRAM', $1, TRUE)
         ON CONFLICT (user_id, channel_type, destination_id) DO NOTHING`,
        [String(envChatId)]
      );
      console.log(`[TelegramService] Registered destination_id: ${envChatId} from env.`);
    } catch (err) {
      console.error("[TelegramService env registration failed]", err.message);
    }
  }
}

// ── Delete webhook ───────────────────────────────────────────────────────────
async function deleteWebhook(token) {
  try {
    const url = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[TelegramService] deleteWebhook failed: HTTP ${res.status}`);
    } else {
      console.log(`[TelegramService] Webhook deleted (drop_pending_updates=false).`);
    }
  } catch (err) {
    console.error(`[TelegramService] deleteWebhook error:`, err.message);
  }
}

// ── Main polling entry point (singleton) ─────────────────────────────────────
export async function startTelegramPolling() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const pollingEnabled = process.env.ENABLE_TELEGRAM_POLLING;

  // Diagnostics on every call
  console.log("[TelegramService] startTelegramPolling() called.");
  console.log(`[TelegramService] ENABLE_TELEGRAM_POLLING=${pollingEnabled}`);
  console.log(`[TelegramService] pollingLoopStarted=${pollingLoopStarted}`);
  console.log(`[TelegramService] TELEGRAM_BOT_TOKEN present=${!!token}`);

  if (pollingEnabled !== "true") {
    console.log("[TelegramService] Polling disabled (ENABLE_TELEGRAM_POLLING != 'true').");
    return;
  }

  if (!token) {
    console.warn("[TelegramService] Polling disabled (missing TELEGRAM_BOT_TOKEN).");
    return;
  }

  // ── Singleton guard ──────────────────────────────────────────────────────
  if (pollingLoopStarted || isPolling) {
    console.log("[TelegramService] Polling already active. Skipping duplicate start.");
    return;
  }

  pollingLoopStarted = true;
  isPolling = true;

  // Step 1: Clear any leftover webhook (prevents 409 from prior webhook config)
  await deleteWebhook(token);

  console.log("[TelegramService] Starting single long polling loop.");

  // Step 2: Sequential polling loop (no setInterval, no fire-and-forget)
  await runPollingLoop(token);
}

export function stopTelegramPolling() {
  isPolling = false;
  console.log("[TelegramService] Long polling stopped.");
}

// ── Sequential polling loop ───────────────────────────────────────────────────
// This is the core long-polling loop. It is purely sequential:
// each getUpdates call finishes BEFORE the next one starts.
// 409 conflict is handled with a 30s back-off and a single log line.
async function runPollingLoop(token) {
  let consecutive409 = 0;

  while (isPolling) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&limit=10&timeout=25`;
      const res = await fetch(url);

      // ── 409 Conflict: another poller is active ───────────────────────────
      // This can happen during Railway deploy transitions when old + new container
      // both run briefly. Back off 30s and retry (do NOT spam logs every second).
      if (res.status === 409) {
        consecutive409++;
        if (consecutive409 === 1) {
          console.warn("[TelegramService] 409 conflict. Another poller is active. Retrying in 30s.");
        }
        // Wait 30 seconds before retrying — silently after first log
        await sleep(30000);
        continue;
      }

      // Reset 409 counter on any other response
      consecutive409 = 0;

      if (res.status === 401) {
        console.error("[TelegramService] 401 Unauthorized. Stopping polling. Check TELEGRAM_BOT_TOKEN.");
        isPolling = false;
        return;
      }

      if (!res.ok) {
        console.error(`[TelegramService] getUpdates failed: HTTP ${res.status}. Retrying in 5s.`);
        await sleep(5000);
        continue;
      }

      const data = await res.json();
      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          await handleIncomingUpdate(update);
        }
      }
      // On empty result (long-poll timeout expired with no messages), loop immediately

    } catch (err) {
      console.error("[TelegramService polling error]", {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        causeCode: err?.cause?.code,
        causeMessage: err?.cause?.message
      });
      await sleep(5000);
    }
  }

  console.log("[TelegramService] Polling loop exited.");
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Handle incoming update ────────────────────────────────────────────────────
async function handleIncomingUpdate(update) {
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = String(cb.message?.chat?.id);
    console.log(`[TelegramService] Incoming Callback: "${cb.data}" from chat_id: ${chatId}`);
    try {
      await botCommandService.handleCallbackQuery('moulika', chatId, cb);
      await answerTelegramCallback(cb.id);
    } catch (err) {
      console.error("[TelegramService handleCallbackQuery failed]", err);
    }
    return;
  }

  const message = update.message;
  if (!message || !message.text || !message.chat || !message.chat.id) return;
  
  const chatId = String(message.chat.id);
  const text = message.text.trim();
  
  console.log(`[TelegramService] Incoming: "${text}" from chat_id: ${chatId}`);
  
  try {
    // Dynamic Registration: Ensure the channel is active for moulika
    await query(
      `INSERT INTO public.notification_channels (user_id, channel_type, destination_id, is_enabled)
       VALUES ('moulika', 'TELEGRAM', $1, TRUE)
       ON CONFLICT (user_id, channel_type, destination_id) 
       DO UPDATE SET is_enabled = TRUE`,
      [chatId]
    );

    // Delegate processing to botCommandService (handles all commands including 'hi')
    await botCommandService.handleCommand('moulika', chatId, text);
  } catch (err) {
    console.error("[TelegramService handleIncomingUpdate failed]", err);
  }
}

export async function answerTelegramCallback(callbackQueryId, text = '') {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text
      })
    });
  } catch (err) {
    console.error("[TelegramService] Failed to answer callback query:", err);
  }
}

// ── Send document ────────────────────────────────────────────────────────────
export async function sendTelegramDocument(chatId, filePath, caption = '') {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn(`[TelegramService] Cannot send document: TELEGRAM_BOT_TOKEN is missing. Chat ID: ${chatId}`);
    return false;
  }
  
  try {
    try {
      const { healthMonitor } = await import('./healthMonitor.js');
      healthMonitor.recordTelegramAttempt();
    } catch (e) {}
    const { readFileSync } = await import('fs');
    const { Blob } = await import('buffer');
    const { basename } = await import('path');
    
    const fileBuffer = readFileSync(filePath);
    const fileBlob = new Blob([fileBuffer]);
    const fileName = basename(filePath);
    
    const formData = new FormData();
    formData.append('document', fileBlob, fileName);
    formData.append('chat_id', chatId);
    if (caption) {
      formData.append('caption', caption);
    }
    
    const url = `https://api.telegram.org/bot${token}/sendDocument`;
    
    const res = await fetch(url, {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[TelegramService] Bot document send failed to ${chatId}. Status: ${res.status}. Response: ${errText}`);
      try {
        const { healthMonitor } = await import('./healthMonitor.js');
        healthMonitor.recordTelegramFailure();
      } catch (e) {}
      return false;
    }
    
    console.log(`[TelegramService] Bot document sent to ${chatId}`);
    try {
      const { healthMonitor } = await import('./healthMonitor.js');
      healthMonitor.recordTelegramSuccess();
    } catch (e) {}
    return true;
  } catch (err) {
    console.error(`[TelegramService ERROR] Failed to send document to ${chatId}:`, err);
    try {
      const { healthMonitor } = await import('./healthMonitor.js');
      healthMonitor.recordTelegramFailure();
    } catch (e) {}
    return false;
  }
}

// ── Telegram Retry Queue Helpers ──────────────────────────────────────────────
export function getNextRetryInterval(retryCount) {
  if (retryCount === 0) return 1; // 1 min
  if (retryCount === 1) return 5; // 5 min
  if (retryCount === 2) return 15; // 15 min
  if (retryCount === 3) return 60; // 1 hour
  return null; // permanently failed
}

export async function initRetryTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS public.telegram_retry_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id TEXT NOT NULL,
        text TEXT NOT NULL,
        options JSONB DEFAULT '{}'::jsonb,
        retry_count INT DEFAULT 0,
        next_retry_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("[TelegramService] Telegram retry queue table checked/created.");
  } catch (err) {
    console.warn("[TelegramService] Could not verify/create telegram_retry_queue (DB might be down):", err.message);
  }
}

let retryInterval = null;

export function startRetryScheduler() {
  if (retryInterval) return;
  
  retryInterval = setInterval(async () => {
    try {
      await processRetryQueue();
      await processInMemoryQueue();
    } catch (err) {
      console.error("[TelegramService Retry Queue Tick Error]", err);
    }
  }, 30 * 1000); // Check every 30 seconds
  
  console.log("[TelegramService] Telegram retry scheduler started.");
}

export async function processRetryQueue() {
  try {
    const now = new Date();
    // Fetch messages due for retry
    const res = await query(
      `SELECT id, chat_id, text, options, retry_count 
       FROM public.telegram_retry_queue 
       WHERE next_retry_at <= $1 
       ORDER BY created_at ASC`,
      [now]
    );

    for (const row of res.rows) {
      const { id, chat_id, text, options, retry_count } = row;
      console.log(`[TelegramService] Retrying message to ${chat_id} (Attempt ${retry_count + 1})...`);
      
      const success = await sendTelegramMessageDirect(chat_id, text, { ...options, skipQueue: true });
      if (success) {
        console.log(`[TelegramService] Retry successful for message to ${chat_id} on attempt ${retry_count + 1}.`);
        await query(`DELETE FROM public.telegram_retry_queue WHERE id = $1`, [id]);
        
        // Update notification_events status to 'sent'
        try {
          await query(
            `UPDATE public.notification_events 
             SET status = 'sent', error_message = NULL, sent_at = NOW() 
             WHERE user_id = $1 AND notification_type = $2 AND source_type = $3 AND source_id = $4`,
            [options.userId || 'moulika', options.notificationType || 'SYSTEM', options.sourceType || 'system', options.sourceId || 'system']
          );
        } catch (e) {}
      } else {
        const nextRetryMins = getNextRetryInterval(retry_count + 1);
        if (nextRetryMins !== null) {
          const nextRetryAt = new Date(Date.now() + nextRetryMins * 60 * 1000);
          console.warn(`[TelegramService] Retry failed for message to ${chat_id}. Next retry in ${nextRetryMins} mins (at ${nextRetryAt.toISOString()}).`);
          await query(
            `UPDATE public.telegram_retry_queue 
             SET retry_count = retry_count + 1, next_retry_at = $2 
             WHERE id = $1`,
            [id, nextRetryAt]
          );
        } else {
          console.error(`[TelegramService] Retry failed permanently for message to ${chat_id} after ${retry_count + 1} attempts.`);
          await query(`DELETE FROM public.telegram_retry_queue WHERE id = $1`, [id]);
          
          try {
            await query(
              `UPDATE public.notification_events 
               SET status = 'failed', error_message = 'Failed after maximum retry attempts', sent_at = NOW() 
               WHERE user_id = $1 AND notification_type = $2 AND source_type = $3 AND source_id = $4`,
              [options.userId || 'moulika', options.notificationType || 'SYSTEM', options.sourceType || 'system', options.sourceId || 'system']
            );
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    // DB down warning
    console.warn("[TelegramService] Error fetching retry queue (DB might be offline):", err.message);
  }
}

export async function processInMemoryQueue() {
  if (inMemoryRetryQueue.length === 0) return;

  const now = Date.now();
  const activeRetries = inMemoryRetryQueue.filter(item => item.next_retry_at.getTime() <= now);
  
  inMemoryRetryQueue = inMemoryRetryQueue.filter(item => item.next_retry_at.getTime() > now);

  for (const item of activeRetries) {
    console.log(`[TelegramService] In-memory retrying message to ${item.chat_id} (Attempt ${item.retry_count + 1})...`);
    const success = await sendTelegramMessageDirect(item.chat_id, item.text, { ...item.options, skipQueue: true });
    if (success) {
      console.log(`[TelegramService] In-memory retry successful to ${item.chat_id}.`);
    } else {
      const nextMins = getNextRetryInterval(item.retry_count + 1);
      if (nextMins !== null) {
        item.retry_count++;
        item.next_retry_at = new Date(Date.now() + nextMins * 60 * 1000);
        inMemoryRetryQueue.push(item);
        console.warn(`[TelegramService] In-memory retry failed to ${item.chat_id}. Scheduled in ${nextMins} mins.`);
      } else {
        console.error(`[TelegramService] In-memory retry failed permanently to ${item.chat_id}.`);
      }
    }
  }
}

// Start queue and scheduler boot initialization
setTimeout(() => {
  initRetryTable().then(() => {
    startRetryScheduler();
  }).catch(err => {
    console.error("[TelegramService Retry Boot Error]", err);
  });
}, 1000);
