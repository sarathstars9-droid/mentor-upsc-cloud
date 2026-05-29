import express from 'express';
import * as disciplineEventService from '../services/disciplineEventService.js';
import * as rescueModeService from '../services/rescueModeService.js';
import * as whatsappService from '../services/whatsappService.js';

const router = express.Router();

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// Meta standard webhook verification
router.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Meta webhook for receiving messages/button replies
router.post('/webhook/whatsapp', async (req, res) => {
  const body = req.body;

  if (body.object) {
    if (
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
      const from = body.entry[0].changes[0].value.messages[0].from;
      const msg = body.entry[0].changes[0].value.messages[0];

      let buttonPayload = null;
      let textBody = null;

      if (msg.type === 'interactive' && msg.interactive.type === 'button_reply') {
        buttonPayload = msg.interactive.button_reply.id;
      } else if (msg.type === 'text') {
        textBody = msg.text.body;
      }

      const userId = 'moulika'; // Typically map 'from' phone to user_id, hardcoded for now

      if (buttonPayload) {
        await handleButtonReply(userId, from, buttonPayload);
      } else if (textBody) {
        await handleTextReply(userId, from, textBody);
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

async function handleButtonReply(userId, from, payload) {
  const kolkataStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  switch (payload) {
    case 'I_AM_STUDYING':
      await disciplineEventService.createEvent(userId, 'DAY_NOT_STARTED_USER_STUDYING_WITHOUT_PLAN', 'medium', 'WHATSAPP');
      await disciplineEventService.createEvent(userId, 'DAY_UNTRACKED_STUDY_LOG_REQUESTED', 'medium', 'SYSTEM');
      
      await whatsappService.sendWhatsAppMessage(from, "Okay. Continue studying.\n\nBut today is untracked in MentorOS.\nAt end of day, I will ask what you studied so we can save it and track your preparation properly.");
      break;
    
    case 'UPLOAD_PLAN':
      await whatsappService.sendWhatsAppMessage(from, "Please open the MentorOS app and upload your plan now.");
      break;

    case 'START_RESCUE_MODE':
      await rescueModeService.startRescueMode(userId);
      await whatsappService.sendWhatsAppMessage(from, "Rescue Mode started. 3 focused blocks have been created for you. Let's finish the day strong.");
      break;

    case 'START_BLOCK_1':
      await whatsappService.sendWhatsAppMessage(from, "Great. Open the MentorOS app and click Start on your first block.");
      break;

    case 'OPEN_PLAN':
      await whatsappService.sendWhatsAppMessage(from, "Please open your plan in the app.");
      break;

    case 'CONTINUE_CURRENT_PLAN':
      await disciplineEventService.createEvent(userId, 'RESCUE_MODE_DECLINED', 'low', 'WHATSAPP');
      await whatsappService.sendWhatsAppMessage(from, "Understood. Keep pushing to complete your existing plan.");
      break;

    case 'NEED_RESET':
      await disciplineEventService.createEvent(userId, 'RESCUE_MODE_DECLINED', 'low', 'WHATSAPP');
      await whatsappService.sendWhatsAppMessage(from, "Take a small break, breathe, and resume when you are ready. The plan is waiting.");
      break;

    default:
      console.log('Unknown button payload:', payload);
  }
}

async function handleTextReply(userId, from, textBody) {
  const kolkataStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // If we asked for untracked study log at night:
  const openLogRequest = await disciplineEventService.getOpenEventByType(userId, 'DAY_UNTRACKED_STUDY_LOG_REQUESTED');
  if (openLogRequest) {
    await disciplineEventService.createUntrackedStudyLog(userId, dateKey, textBody, openLogRequest.id);
    await disciplineEventService.resolveEvent(openLogRequest.id, { parsed_reply: true });
    await whatsappService.sendWhatsAppMessage(from, "Thank you. Your study details have been saved.\n\nTomorrow, please upload the plan first.");
    return;
  }
}

export default router;
