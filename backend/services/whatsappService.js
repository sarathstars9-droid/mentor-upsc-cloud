import dotenv from 'dotenv';
dotenv.config();

// Graceful fallback for local dev or unconfigured instances
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

/**
 * Sends a standard text message over WhatsApp
 * @param {string} to - Recipient phone number (e.g., '919876543210')
 * @param {string} text - The message text
 */
export async function sendWhatsAppMessage(to, text) {
  if (!WHATSAPP_ENABLED || !to || to === '91YOURNUMBER' || !PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    let reason = 'provider_not_configured';
    if (!to || to === '91YOURNUMBER') reason = 'placeholder_number';
    else if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) reason = 'provider_credentials_missing';
    
    const maskedTo = to ? `***${to.slice(-4)}` : 'null';
    console.log(`[WhatsApp Fallback Disabled] reason=${reason} destination=${maskedTo}`);
    return false;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[WhatsAppService] Failed to send message:', err);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[WhatsAppService ERROR]', error);
    return false;
  }
}

/**
 * Sends a text message with interactive buttons over WhatsApp
 * @param {string} to - Recipient phone number
 * @param {string} text - The body text
 * @param {Array<{id: string, title: string}>} buttons - Array of button objects (max 3)
 */
export async function sendWhatsAppButtons(to, text, buttons) {
  if (!WHATSAPP_ENABLED || !to || to === '91YOURNUMBER' || !PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    let reason = 'provider_not_configured';
    if (!to || to === '91YOURNUMBER') reason = 'placeholder_number';
    else if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) reason = 'provider_credentials_missing';
    
    const maskedTo = to ? `***${to.slice(-4)}` : 'null';
    console.log(`[WhatsApp Fallback Disabled] reason=${reason} destination=${maskedTo}`);
    return false;
  }

  try {
    const formattedButtons = buttons.slice(0, 3).map(b => ({
      type: 'reply',
      reply: {
        id: b.id,
        title: b.title.substring(0, 20) // WhatsApp title limit is 20 chars
      }
    }));

    const response = await fetch(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: text },
          action: {
            buttons: formattedButtons
          }
        }
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[WhatsAppService] Failed to send buttons:', err);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[WhatsAppService ERROR]', error);
    return false;
  }
}
