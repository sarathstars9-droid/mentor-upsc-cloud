import { startBlock, pauseBlock, resumeBlock } from "./services/blockLifecycleService.js";
import { processTodayBlocks } from "./services/notificationScheduler.js";
import { handleCallbackQuery } from "./services/botCommandService.js";
import { query } from "./db/index.js";

async function runTests() {
  console.log("=== RUNNING TELEGRAM FRICTION ALERT SYNC TESTS ===");
  
  const testUserId = "test_friction_user_1";
  
  // Clean up
  await query("DELETE FROM study_blocks WHERE user_id = $1", [testUserId]);
  
  // Mock global fetch to capture Telegram messages
  const originalFetch = global.fetch;
  let sentMessages = [];
  global.fetch = async (url, options) => {
    if (url && url.includes('api.telegram.org')) {
      if (url.includes('sendMessage')) {
        const body = JSON.parse(options.body);
        sentMessages.push(body);
      }
      return { ok: true, json: async () => ({ ok: true, result: {} }), text: async () => "{}" };
    }
    return originalFetch(url, options);
  };
  
  // Set required env variables for test path to execute
  process.env.TELEGRAM_CHAT_ID = "12345678";
  process.env.TELEGRAM_BOT_TOKEN = "mock_token";
  
  // 1. Create and start a test block
  const todayKey = new Date().toISOString().split('T')[0];
  const block = await startBlock(testUserId, "B1", todayKey, {
    title: "Friction Test Block",
    subject: "Polity",
    plannedMinutes: 60,
    plannedStart: "08:00",
    isTestData: true
  });
  
  console.log("Created test block ID:", block.id);
  
  // 2. Pause the block with friction triggers (3 pauses, 30m total pause)
  await query(
    `UPDATE study_blocks 
     SET status = 'paused',
         paused_at = NOW() - INTERVAL '31 minutes',
         pauses_count = 3,
         total_pause_seconds = 1800
     WHERE id = $1`,
    [block.id]
  );
  
  // Verify block starts paused
  let dbBlock = (await query("SELECT * FROM study_blocks WHERE id = $1", [block.id])).rows[0];
  console.log("Initial state - status:", dbBlock.status, "friction_alert_sent:", dbBlock.friction_alert_sent);
  
  // 3. Trigger friction alert by running processTodayBlocks
  sentMessages = [];
  await processTodayBlocks(testUserId, new Date());
  
  // Assert alert sent
  dbBlock = (await query("SELECT * FROM study_blocks WHERE id = $1", [block.id])).rows[0];
  console.log("After alert check - status:", dbBlock.status, "friction_alert_sent:", dbBlock.friction_alert_sent, "telegram_action_pending:", dbBlock.telegram_action_pending);
  console.log("Sent Telegram message counts:", sentMessages.length);
  
  if (!dbBlock.friction_alert_sent || !dbBlock.telegram_action_pending || sentMessages.length !== 1) {
    global.fetch = originalFetch;
    throw new Error("Test Failed: Friction alert was not sent/flagged correctly.");
  }
  
  const callbackData = sentMessages[0].reply_markup.inline_keyboard[0][0].callback_data;
  console.log("Friction callback data sent:", callbackData);
  if (!callbackData.includes(block.id)) {
    global.fetch = originalFetch;
    throw new Error("Test Failed: Inline keyboard callback data did not include block ID.");
  }
  
  // 4. Try running processTodayBlocks again. Verify no duplicate message is sent.
  sentMessages = [];
  await processTodayBlocks(testUserId, new Date());
  console.log("Run scheduler again - Sent message count:", sentMessages.length);
  if (sentMessages.length > 0) {
    global.fetch = originalFetch;
    throw new Error("Test Failed: Duplicate Telegram message was sent.");
  }
  
  // 5. Resume block from dashboard
  await resumeBlock(testUserId, "B1", todayKey);
  
  // Assert fields are cleared
  dbBlock = (await query("SELECT * FROM study_blocks WHERE id = $1", [block.id])).rows[0];
  console.log("After resume - status:", dbBlock.status, "friction_state:", dbBlock.friction_state, "friction_alert_sent:", dbBlock.friction_alert_sent, "telegram_action_pending:", dbBlock.telegram_action_pending);
  
  if (dbBlock.status !== 'active' || dbBlock.friction_state !== null || dbBlock.friction_alert_sent || dbBlock.telegram_action_pending) {
    global.fetch = originalFetch;
    throw new Error("Test Failed: Friction columns were not cleared on resume.");
  }
  
  // 6. Run alert checker again. Verify no new Telegram message is sent because status is ACTIVE.
  sentMessages = [];
  await processTodayBlocks(testUserId, new Date());
  console.log("Run alert checker after resume - Sent message count:", sentMessages.length);
  if (sentMessages.length > 0) {
    global.fetch = originalFetch;
    throw new Error("Test Failed: Alert sent for active block.");
  }
  
  // 7. Click old Telegram button (simulate handleCallbackQuery for the resumed block)
  sentMessages = [];
  await handleCallbackQuery(testUserId, "12345678", { data: `CONTINUE_BLOCK_25:${block.id}` });
  
  console.log("Callback click reply message count:", sentMessages.length);
  console.log("Callback click reply text:", sentMessages[0]?.text);
  
  if (sentMessages.length !== 1 || !sentMessages[0].text.includes("This block is already active. No action needed.")) {
    global.fetch = originalFetch;
    throw new Error("Test Failed: Did not return active notification on old callback click.");
  }
  
  // Verify block remains active
  dbBlock = (await query("SELECT * FROM study_blocks WHERE id = $1", [block.id])).rows[0];
  console.log("Final block status after callback click:", dbBlock.status);
  if (dbBlock.status !== 'active') {
    global.fetch = originalFetch;
    throw new Error("Test Failed: Callback click altered block state.");
  }

  // Restore fetch
  global.fetch = originalFetch;
  
  // Cleanup test user
  await query("DELETE FROM study_blocks WHERE user_id = $1", [testUserId]);
  
  console.log("🎉 TELEGRAM FRICTION ALERT SYNC TESTS PASSED!");
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
