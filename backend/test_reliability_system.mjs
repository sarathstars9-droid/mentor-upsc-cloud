import { pool, query } from "./db/index.js";
import { healthMonitor } from "./services/healthMonitor.js";
import * as telegramService from "./services/telegramService.js";
import { initNotificationScheduler, stopNotificationScheduler } from "./services/notificationScheduler.js";
import assert from "assert";

console.log("=== STARTING NOTIFICATION RELIABILITY & HEALTH MONITOR TEST SUITE ===");

// Save original methods
const originalPoolQuery = pool.query;
const originalFetch = globalThis.fetch;

async function runTests() {
  try {
    // -------------------------------------------------------------------------
    // PREPARATION: Synchronously initialize the retry table
    // -------------------------------------------------------------------------
    console.log("Initializing retry queue table...");
    await telegramService.initRetryTable();

    // -------------------------------------------------------------------------
    // TEST 1: Health Endpoint Response Structure Validation
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Validating health monitor status structure...");
    
    // Trigger a successful query to populate DB success timestamp
    await query("SELECT NOW()");
    
    const status = await healthMonitor.getHealthStatus();
    console.log("Health Status:", JSON.stringify(status, null, 2));
    
    assert.strictEqual(typeof status.database, "string", "database status should be a string");
    assert.strictEqual(typeof status.scheduler, "string", "scheduler status should be a string");
    assert.strictEqual(typeof status.telegram, "string", "telegram status should be a string");
    assert.ok(status.lastSuccessfulDbQueryTime instanceof Date, "lastSuccessfulDbQueryTime should be a Date object");
    assert.ok("recentFailureCount" in status, "recentFailureCount should be present");
    console.log("✅ Test 1 Passed: Response structure is correct.");

    // -------------------------------------------------------------------------
    // TEST 2: DB Timeout Simulation
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Simulating DB Timeout...");
    
    // Reset DB failures
    healthMonitor.consecutiveDbFailures = 0;
    
    // Mock pool.query to simulate connection timeout
    pool.query = async (text, params) => {
      throw new Error("Connection timeout");
    };

    // Execute queries to trigger consecutive failures
    for (let i = 0; i < 3; i++) {
      try {
        await query("SELECT 1");
      } catch (err) {
        // Expected timeout error
      }
    }

    const failedDbStatus = await healthMonitor.getHealthStatus();
    console.log(`consecutiveDbFailures: ${healthMonitor.consecutiveDbFailures}`);
    console.log(`Database health status: ${failedDbStatus.database}`);
    
    assert.strictEqual(healthMonitor.consecutiveDbFailures, 3, "consecutiveDbFailures should be 3");
    assert.strictEqual(failedDbStatus.database, "Failed", "Database status should be 'Failed'");
    
    // Restore DB connection
    pool.query = originalPoolQuery;
    
    // Execute a successful query
    await query("SELECT 1");
    const restoredDbStatus = await healthMonitor.getHealthStatus();
    console.log(`Database health status after success: ${restoredDbStatus.database}`);
    assert.strictEqual(restoredDbStatus.database, "Healthy", "Database status should restore to 'Healthy'");
    assert.strictEqual(healthMonitor.consecutiveDbFailures, 0, "consecutiveDbFailures should reset to 0");
    console.log("✅ Test 2 Passed: DB timeout registered and recovered correctly.");

    // -------------------------------------------------------------------------
    // TEST 3: Telegram Failure Simulation & Retry Queue
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Simulating Telegram API Failure...");
    
    // Clear retry queues
    telegramService.inMemoryRetryQueue.length = 0;
    try {
      await query("DELETE FROM public.telegram_retry_queue");
    } catch (e) {}

    // Mock fetch to simulate Telegram API down (500 Internal Server Error)
    globalThis.fetch = async (url, options) => {
      if (url.includes("api.telegram.org")) {
        return {
          ok: false,
          status: 500,
          text: async () => "Internal Server Error"
        };
      }
      return originalFetch(url, options);
    };

    // Try sending message
    const sendResult = await telegramService.sendTelegramMessage("99999", "Reliability Test Message", {
      userId: "moulika",
      notificationType: "TEST_ALERT",
      sourceType: "test",
      sourceId: "1"
    });
    
    assert.strictEqual(sendResult, false, "Telegram message send should fail");
    
    // Verify it is queued (in database or in-memory fallback)
    let isQueued = false;
    let queueLength = 0;
    
    // Check in-memory queue first
    queueLength = telegramService.inMemoryRetryQueue.length;
    if (queueLength > 0) {
      isQueued = true;
      console.log(`Message queued in-memory. Queue length: ${queueLength}`);
      assert.strictEqual(telegramService.inMemoryRetryQueue[0].chat_id, "99999");
      assert.strictEqual(telegramService.inMemoryRetryQueue[0].text, "Reliability Test Message");
      
      // Force next_retry_at to be in the past so processInMemoryQueue processes it
      telegramService.inMemoryRetryQueue[0].next_retry_at = new Date(Date.now() - 10000);
    } else {
      // Check database retry queue
      const dbQueue = await query("SELECT * FROM public.telegram_retry_queue");
      queueLength = dbQueue.rows.length;
      if (queueLength > 0) {
        isQueued = true;
        console.log(`Message queued in database. Queue length: ${queueLength}`);
        assert.strictEqual(dbQueue.rows[0].chat_id, "99999");
        assert.strictEqual(dbQueue.rows[0].text, "Reliability Test Message");
        
        // Force next_retry_at to be in the past in DB
        await query("UPDATE public.telegram_retry_queue SET next_retry_at = NOW() - INTERVAL '10 seconds'");
      }
    }
    
    assert.ok(isQueued, "Failed telegram message must be queued for retry");

    // Restore fetch to simulate Telegram coming back online
    globalThis.fetch = async (url, options) => {
      if (url.includes("api.telegram.org")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: {} })
        };
      }
      return originalFetch(url, options);
    };

    // Process retry queue (both db and in-memory)
    console.log("Processing retry queues...");
    await telegramService.processRetryQueue();
    await telegramService.processInMemoryQueue();

    // Verify it was successfully sent and removed from the queue
    let queueLengthAfter = telegramService.inMemoryRetryQueue.length;
    const dbQueueAfter = await query("SELECT * FROM public.telegram_retry_queue");
    queueLengthAfter += dbQueueAfter.rows.length;
    
    assert.strictEqual(queueLengthAfter, 0, "Queue must be empty after successful retry");
    console.log("✅ Test 3 Passed: Telegram failures are correctly queued, retried, and cleared.");

    // -------------------------------------------------------------------------
    // TEST 4: Scheduler Failure Detection
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Simulating Scheduler Tick Failure...");
    
    // Reset scheduler failures
    healthMonitor.consecutiveSchedulerFailures = 0;
    
    // Temporarily mock pool.query to throw error during scheduler ticks
    pool.query = async (text, params) => {
      throw new Error("Scheduler DB query failed");
    };
    
    // Trigger scheduler init check which will fail
    initNotificationScheduler('moulika');
    
    // Wait a brief moment for the tick to run and fail
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    stopNotificationScheduler();
    pool.query = originalPoolQuery;
    
    console.log(`consecutiveSchedulerFailures: ${healthMonitor.consecutiveSchedulerFailures}`);
    assert.ok(healthMonitor.consecutiveSchedulerFailures > 0, "consecutiveSchedulerFailures should be incremented");
    
    // Increment consecutiveSchedulerFailures to hit the threshold of 3
    healthMonitor.recordSchedulerFailure();
    healthMonitor.recordSchedulerFailure();

    const statusWithSchedulerFail = await healthMonitor.getHealthStatus();
    console.log(`Scheduler Health Status: ${statusWithSchedulerFail.scheduler}`);
    assert.strictEqual(statusWithSchedulerFail.scheduler, "Failed", "Scheduler status should be 'Failed'");
    
    // Recover scheduler
    healthMonitor.recordSchedulerSuccess();
    const statusRestored = await healthMonitor.getHealthStatus();
    assert.strictEqual(statusRestored.scheduler, "Healthy", "Scheduler status should recover to 'Healthy'");
    console.log("✅ Test 4 Passed: Scheduler failure registered and handled correctly.");

    // -------------------------------------------------------------------------
    // TEST 5: Heartbeat Alert Persistence & Expose in /api/system/health
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Simulating Heartbeat Alert Telegram Failure & DB/Memory Persistence...");

    // Mock Telegram as failing
    globalThis.fetch = async (url, options) => {
      if (url.includes("api.telegram.org")) {
        return {
          ok: false,
          status: 503,
          text: async () => "Service Unavailable"
        };
      }
      return originalFetch(url, options);
    };

    // Trigger heartbeat check directly with failures simulated
    healthMonitor.consecutiveDbFailures = 3; // Simulating DB down
    healthMonitor.lastUnsentTelegramAlert = null;
    
    await healthMonitor.runHeartbeatCheck();
    
    const finalHealth = await healthMonitor.getHealthStatus();
    console.log("Heartbeat failed alert cached in memory:", finalHealth.unsentHeartbeatAlert);
    
    assert.ok(finalHealth.unsentHeartbeatAlert, "Heartbeat alert must be cached when Telegram fails");
    assert.ok(finalHealth.unsentHeartbeatAlert.message.includes("[MentorOS CRITICAL SYSTEM ALERT]"), "Alert message structure is correct");
    
    // Reset health monitor stats for clean state
    healthMonitor.consecutiveDbFailures = 0;
    healthMonitor.consecutiveTelegramFailures = 0;
    healthMonitor.consecutiveSchedulerFailures = 0;
    healthMonitor.lastUnsentTelegramAlert = null;
    
    // Clean up created retry table rows
    try {
      await query("DROP TABLE IF EXISTS public.telegram_retry_queue");
    } catch (e) {}

    console.log("✅ Test 5 Passed: Failed heartbeat alerts are persisted and exposed.");

    console.log("\n=== ALL RELIABILITY & HEALTH MONITOR TESTS PASSED SUCCESSFULLY! ===");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST SUITE FAILED:");
    console.error(error);
    
    // Restore mocks
    pool.query = originalPoolQuery;
    globalThis.fetch = originalFetch;
    stopNotificationScheduler();
    
    // Clean up created retry table rows
    try {
      await query("DROP TABLE IF EXISTS public.telegram_retry_queue");
    } catch (e) {}

    process.exit(1);
  }
}

runTests();
