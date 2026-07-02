import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTBOX_DIR = path.join(__dirname, '..', 'data', 'outbox', 'plan-actions');

// Ensure directory exists
if (!fs.existsSync(OUTBOX_DIR)) {
  fs.mkdirSync(OUTBOX_DIR, { recursive: true });
}

export async function enqueueAction(actionType, payload) {
  const id = `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const filePath = path.join(OUTBOX_DIR, `${id}.json`);
  const data = {
    id,
    actionType,
    payload,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[OUTBOX] Enqueued action ${actionType} as ${id}`);
}

export async function flushOutbox() {
  if (!fs.existsSync(OUTBOX_DIR)) return;
  const files = fs.readdirSync(OUTBOX_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) return;

  const { isDbCircuitOpen } = await import('../db/index.js');
  if (isDbCircuitOpen()) {
    console.log(`[OUTBOX] Circuit open, skipping flush. ${files.length} items queued.`);
    return;
  }

  // Import blockLifecycleService dynamically to avoid circular dependencies
  const blockService = await import('./blockLifecycleService.js');

  for (const file of files) {
    if (isDbCircuitOpen()) {
       console.log(`[OUTBOX] Circuit opened during flush, stopping.`);
       break;
    }
    const filePath = path.join(OUTBOX_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      console.log(`[OUTBOX] Processing action ${data.actionType} (${data.id})...`);
      
      const p = data.payload;
      
      // Map actionType to blockLifecycleService function
      if (data.actionType === 'startBlock') {
        await blockService.startBlock(p.userId, p.blockId, p.dayKey, p.metadata);
      } else if (data.actionType === 'pauseBlock') {
        await blockService.pauseBlock(p.userId, p.blockId, p.dayKey);
      } else if (data.actionType === 'resumeBlock') {
        await blockService.resumeBlock(p.userId, p.blockId, p.dayKey);
      } else if (data.actionType === 'completeBlock') {
        await blockService.completeBlock(p.userId, p.blockId, p.dayKey, p.metadata);
      } else if (data.actionType === 'stopBlock') {
        await blockService.stopBlock(p.userId, p.blockId, p.dayKey, p.metadata);
      } else {
        console.warn(`[OUTBOX] Unknown actionType: ${data.actionType}`);
      }

      fs.unlinkSync(filePath);
      console.log(`[OUTBOX] Processed and removed ${data.id}`);
    } catch (err) {
      console.error(`[OUTBOX] Failed to process ${file}:`, err.message);
      // Wait a little before moving to the next item in case it's a DB error
      if (err.code === 'CIRCUIT_OPEN' || err.message.includes('timeout')) {
        break; // Stop flushing if the DB is struggling
      }
    }
  }
}
