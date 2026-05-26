import { query } from '../db/index.js';
import * as botCommandService from './botCommandService.js';

let pollingActive = false;
let lastUpdateId = 0;

// Escapes special HTML characters and converts Markdown tags (*bold*, _italic_, `code`) 
// to Telegram-safe HTML format to avoid Markdown parsing crashes.
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

// Delivery adapter function: sends a message to Telegram
export async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn(`[TelegramService] Cannot send message: TELEGRAM_BOT_TOKEN is missing. Chat ID: ${chatId}`);
    return false;
  }
  
  try {
    const htmlText = convertMarkdownToHtml(text);
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: 'HTML'
      })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[TelegramService] Failed to send message to ${chatId}. Status: ${res.status}. Response: ${errText}`);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`[TelegramService ERROR] Failed to send message to ${chatId}:`, err);
    return false;
  }
}

// Automatically registers TELEGRAM_CHAT_ID from .env if present
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

// Starts the long-polling loop to listen for user commands
export function startTelegramPolling() {
  if (process.env.ENABLE_TELEGRAM_POLLING !== "true") {
    console.log("[TelegramService] Polling is disabled via ENABLE_TELEGRAM_POLLING. Skipping startup.");
    return;
  }
  
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[TelegramService] TELEGRAM_BOT_TOKEN not configured. Long polling disabled.");
    return;
  }
  if (pollingActive) return;
  pollingActive = true;
  
  console.log("[TelegramService] Starting long polling for updates...");
  pollUpdates();
}

export function stopTelegramPolling() {
  pollingActive = false;
  console.log("[TelegramService] Long polling stopped.");
}

async function pollUpdates() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !pollingActive) return;
  
  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&limit=10&timeout=20`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 401) {
        console.error("[TelegramService] 401 Unauthorized. Stopping polling. Check TELEGRAM_BOT_TOKEN.");
        pollingActive = false;
        return;
      }
      throw new Error(`HTTP status ${res.status}`);
    }
    
    const data = await res.json();
    if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
      for (const update of data.result) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);
        await handleIncomingUpdate(update);
      }
    }
  } catch (err) {
    console.error("[TelegramService polling error]", err.message);
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  if (pollingActive) {
    // Continue loop asynchronously
    setTimeout(pollUpdates, 50);
  }
}

// Handles incoming updates: registers users and dispatches commands to botCommandService
async function handleIncomingUpdate(update) {
  const message = update.message;
  if (!message || !message.text || !message.chat || !message.chat.id) return;
  
  const chatId = String(message.chat.id);
  const text = message.text.trim();
  
  console.log(`[TelegramService] Incoming message from chat ${chatId}: "${text}"`);
  
  try {
    // Dynamic Registration: Ensure the channel is active for moulika
    await query(
      `INSERT INTO public.notification_channels (user_id, channel_type, destination_id, is_enabled)
       VALUES ('moulika', 'TELEGRAM', $1, TRUE)
       ON CONFLICT (user_id, channel_type, destination_id) 
       DO UPDATE SET is_enabled = TRUE`,
      [chatId]
    );

    // Delegate processing to botCommandService
    await botCommandService.handleCommand('moulika', chatId, text);
  } catch (err) {
    console.error("[TelegramService handleIncomingUpdate failed]", err);
  }
}
