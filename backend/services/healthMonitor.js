import {
  query,
  activeDbHost,
  activeDbPort,
  activeDbSsl,
  activeDbSource
} from '../db/index.js';
import * as telegramService from './telegramService.js';

class HealthMonitor {
  constructor() {
    this.lastSchedulerRunTime = null;
    this.lastTelegramSendAttempt = null;
    this.lastTelegramSendSuccess = null;
    this.lastDatabaseSuccess = null;

    this.consecutiveDbFailures = 0;
    this.consecutiveTelegramFailures = 0;
    this.consecutiveSchedulerFailures = 0;

    // Cache of last critical alert message (if Telegram send fails)
    this.lastUnsentTelegramAlert = null;
    
    this.heartbeatInterval = null;
  }

  // Record Database success
  recordDbSuccess() {
    this.lastDatabaseSuccess = new Date();
    this.consecutiveDbFailures = 0;
  }

  // Record Database failure
  recordDbFailure() {
    this.consecutiveDbFailures++;
  }

  // Record Scheduler run success
  recordSchedulerSuccess() {
    this.lastSchedulerRunTime = new Date();
    this.consecutiveSchedulerFailures = 0;
  }

  // Record Scheduler run failure
  recordSchedulerFailure() {
    this.consecutiveSchedulerFailures++;
  }

  // Record Telegram attempt
  recordTelegramAttempt() {
    this.lastTelegramSendAttempt = new Date();
  }

  // Record Telegram success
  recordTelegramSuccess() {
    this.lastTelegramSendSuccess = new Date();
    this.consecutiveTelegramFailures = 0;
  }

  // Record Telegram failure
  recordTelegramFailure() {
    this.consecutiveTelegramFailures++;
  }

  // Get total recent failure count across all components
  getRecentFailureCount() {
    return this.consecutiveDbFailures + this.consecutiveTelegramFailures + this.consecutiveSchedulerFailures;
  }

  // Get health status
  async getHealthStatus() {
    const dbStatus = this.consecutiveDbFailures < 3 ? 'Healthy' : 'Failed';
    
    // For scheduler, we also check if it's been more than 15 minutes since last success
    const now = new Date();
    const schedulerElapsedMins = this.lastSchedulerRunTime 
      ? (now - this.lastSchedulerRunTime) / 60000 
      : null;
    
    const schedulerStatus = (this.consecutiveSchedulerFailures < 3 && (schedulerElapsedMins === null || schedulerElapsedMins <= 15)) 
      ? 'Healthy' 
      : 'Failed';

    const telegramStatus = this.consecutiveTelegramFailures < 3 ? 'Healthy' : 'Failed';

    // We can also fetch the last sent notification timestamp from DB (if DB is healthy) as a fallback/verification
    let lastNotificationTime = null;
    if (dbStatus === 'Healthy') {
      try {
        const res = await query(
          `SELECT sent_at FROM public.notification_events 
           WHERE status = 'sent' 
           ORDER BY sent_at DESC LIMIT 1`
        );
        if (res.rows.length > 0) {
          lastNotificationTime = res.rows[0].sent_at;
        }
      } catch (err) {
        console.error("[HealthMonitor] Failed to fetch last notification sent_at from DB:", err.message);
      }
    }
    
    // Fallback to lastTelegramSendSuccess in-memory
    if (!lastNotificationTime) {
      lastNotificationTime = this.lastTelegramSendSuccess;
    }

    // Expose unsent heartbeat alerts if present
    let unsentHeartbeatAlert = this.lastUnsentTelegramAlert;
    // Check if there's any failed heartbeat alert in DB
    if (dbStatus === 'Healthy' && !unsentHeartbeatAlert) {
      try {
        const res = await query(
          `SELECT error_message, sent_at FROM public.notification_events 
           WHERE notification_type = 'HEARTBEAT_ALERT' AND status = 'failed' 
           ORDER BY sent_at DESC LIMIT 1`
        );
        if (res.rows.length > 0) {
          unsentHeartbeatAlert = {
            message: res.rows[0].error_message,
            timestamp: res.rows[0].sent_at
          };
        }
      } catch (err) {
        // Ignore
      }
    }

    return {
      database: dbStatus,
      scheduler: schedulerStatus,
      telegram: telegramStatus,
      lastSuccessfulDbQueryTime: this.lastDatabaseSuccess,
      lastSuccessfulSchedulerRun: this.lastSchedulerRunTime,
      lastSuccessfulTelegramSend: this.lastTelegramSendSuccess,
      lastSuccessfulNotification: lastNotificationTime,
      recentFailureCount: this.getRecentFailureCount(),
      unsentHeartbeatAlert,
      activeDbHost,
      activeDbPort,
      activeDbSsl,
      activeDbSource
    };
  }

  // Public projection of getHealthStatus().
  // Returns only coarse, non-sensitive values safe for external callers.
  // No second health algorithm — always derived from the internal result.
  async toPublicSummary() {
    const full = await this.getHealthStatus();
    const overallStatus =
      full.database === 'Healthy' &&
      full.scheduler === 'Healthy' &&
      full.telegram  === 'Healthy'
        ? 'healthy'
        : 'degraded';
    return {
      status:    overallStatus,
      database:  full.database,
      scheduler: full.scheduler,
      telegram:  full.telegram,
    };
  }

  // Start heartbeat alert checks hourly
  startHeartbeatAlerts() {
    if (this.heartbeatInterval) return;

    console.log("[HealthMonitor] Initializing hourly heartbeat check...");

    this.heartbeatInterval = setInterval(async () => {
      await this.runHeartbeatCheck();
    }, 60 * 60 * 1000); // 1 hour
  }

  // Perform heartbeat check
  async runHeartbeatCheck() {
    console.log("[HealthMonitor] Running heartbeat check...");
    const now = new Date();
    
    // Check for failures
    const schedulerElapsedMins = this.lastSchedulerRunTime 
      ? (now - this.lastSchedulerRunTime) / 60000 
      : 999; // Assume down if null
    
    const isDbDown = this.consecutiveDbFailures >= 3;
    const isSchedulerDown = schedulerElapsedMins > 15 || this.consecutiveSchedulerFailures >= 3;
    const isTelegramDown = this.consecutiveTelegramFailures >= 3;

    if (isDbDown || isSchedulerDown || isTelegramDown) {
      const alertMsg = `🚨 [MentorOS CRITICAL SYSTEM ALERT]\n` +
        `Time: ${now.toISOString()}\n` +
        `DB Status: ${isDbDown ? 'FAILED' : 'HEALTHY'} (consecutive failures: ${this.consecutiveDbFailures})\n` +
        `Scheduler Status: ${isSchedulerDown ? 'FAILED' : 'HEALTHY'} (last run: ${this.lastSchedulerRunTime ? this.lastSchedulerRunTime.toISOString() : 'never'})\n` +
        `Telegram Status: ${isTelegramDown ? 'FAILED' : 'HEALTHY'} (consecutive failures: ${this.consecutiveTelegramFailures})`;
      
      console.warn("[HealthMonitor] System issues detected:", alertMsg);

      // Attempt to send telegram alert to admin (chat ID from env)
      const adminChatId = process.env.TELEGRAM_CHAT_ID;
      let telegramSuccess = false;
      if (adminChatId) {
        // Directly send telegram message. Note: this might fail if Telegram is down
        telegramSuccess = await telegramService.sendTelegramMessage(adminChatId, alertMsg, { skipEventLogging: true });
      }

      if (telegramSuccess) {
        console.log("[HealthMonitor] Heartbeat alert sent successfully via Telegram to admin.");
        this.recordTelegramSuccess();
        this.lastUnsentTelegramAlert = null;
      } else {
        console.error("[HealthMonitor] Heartbeat alert could NOT be sent via Telegram.");
        this.recordTelegramFailure();
        
        // Persist alert in memory
        this.lastUnsentTelegramAlert = {
          message: alertMsg,
          timestamp: now
        };

        // Persist in DB if DB is healthy
        if (!isDbDown) {
          try {
            const hourKey = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}-${now.getHours()}`;
            await query(
              `INSERT INTO public.notification_events 
                 (user_id, notification_type, source_type, source_id, channel_type, status, error_message, payload_json, sent_at)
               VALUES ($1, $2, $3, $4, $5, 'failed', $6, $7, NOW())
               ON CONFLICT (user_id, notification_type, source_type, source_id, channel_type) 
               DO UPDATE SET 
                 status = 'failed',
                 error_message = EXCLUDED.error_message,
                 sent_at = NOW()`,
              ['moulika', 'HEARTBEAT_ALERT', 'system_health', hourKey, 'TELEGRAM', alertMsg, JSON.stringify({ is_heartbeat: true })]
            );
            console.log("[HealthMonitor] Saved failed heartbeat alert to DB.");
          } catch (err) {
            console.error("[HealthMonitor] Failed to write failed heartbeat alert to database:", err.message);
          }
        }
      }
    } else {
      console.log("[HealthMonitor] Heartbeat check: system is fully healthy.");
    }
  }
}

export const healthMonitor = new HealthMonitor();
