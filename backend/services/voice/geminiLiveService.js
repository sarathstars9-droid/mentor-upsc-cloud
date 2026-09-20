// backend/services/voice/geminiLiveService.js
// Gemini 3.8 / 2.0 Live Multimodal Voice Shell with Native Interruption & Transcription

import WebSocket from 'ws';
import { recordGeminiLiveUsage } from '../mentorUsageService.js';

const GEMINI_LIVE_HOST = 'generativelanguage.googleapis.com';
const GEMINI_LIVE_PATH = '/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

const DEFAULT_SYSTEM_INSTRUCTION = `You are the realtime voice interface for MentorOS.
Your job is natural listening, turn-taking and spoken delivery.
You are NOT the authoritative UPSC mentor reasoning engine.
For substantive mentor decisions, use the MentorOS mentor result supplied by the backend.
When a mentor result is supplied, communicate its meaning faithfully in a natural conversational way.
Do not add new study tasks, change priorities, invent evidence, diagnose the user, or contradict the MentorOS result.
Be warm, calm, firm and natural.
Moulika may speak Telugu, English or mixed Telugu-English. Understand code-switching naturally.
Avoid call-centre style speech, excessive enthusiasm, repetitive confirmations and long monologues.
Allow interruptions immediately.`;

export class GeminiLiveService {
  constructor({ userId, sessionId = null, onEvent, apiKey = null, model = null, voice = null }) {
    this.userId = userId;
    this.sessionId = sessionId;
    this.onEvent = onEvent;
    this.apiKey = apiKey || process.env.GEMINI_LIVE_API_KEY || process.env.GEMINI_API_KEY || process.env.MAINS_EVAL_AI_API_KEY;
    this.model = model || process.env.GEMINI_LIVE_MODEL || process.env.MENTOR_LIVE_MODEL || 'gemini-3.8-live';
    this.voiceName = voice || process.env.MENTOR_LIVE_VOICE || 'Kore';

    this.ws = null;
    this.isConnected = false;
    this.isSetupComplete = false;
    this.pendingAudioQueue = [];
    this.interimTranscript = '';

    // Cumulative debug counters
    this.forwardedChunks = 0;
    this.forwardedBytes = 0;
    this.lastForwardLogTime = 0;
  }

  connect() {
    if (!this.apiKey) {
      console.error('[GeminiLive] Missing GEMINI_LIVE_API_KEY or GEMINI_API_KEY');
      this.emit({ type: 'error', error: 'Missing Gemini Live API Key' });
      return;
    }

    const url = `wss://${GEMINI_LIVE_HOST}${GEMINI_LIVE_PATH}?key=${this.apiKey}`;
    const configuredModel = process.env.GEMINI_LIVE_MODEL || process.env.MENTOR_LIVE_MODEL || 'gemini-3.8-live';
    let outboundModel = this.model;
    if (!outboundModel.startsWith('models/')) {
      outboundModel = `models/${outboundModel}`;
    }

    console.log(`[GeminiLive] Session Init - configured GEMINI_LIVE_MODEL: "${configuredModel}", exact outbound model: "${outboundModel}", voice: "${this.voiceName}", provider: "gemini"`);

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('[GeminiLive] WebSocket connection established. Sending setup payload...');
      this.isConnected = true;
      this.sendSetup();
    });

    this.ws.on('message', (data) => {
      this.handleServerMessage(data);
    });

    this.ws.on('error', (err) => {
      console.error('[VOICE DEBUG] error (Gemini WebSocket):', err.message);
      this.emit({ type: 'error', error: `Gemini Live error: ${err.message}` });
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[GeminiLive] WebSocket closed: code=${code}, reason=${reason.toString()}`);
      this.isConnected = false;
      this.isSetupComplete = false;
      this.emit({ type: 'close', code, reason: reason.toString() });
    });
  }

  sendSetup() {
    let modelName = this.model;
    if (!modelName.startsWith('models/')) {
      modelName = `models/${modelName}`;
    }

    const setupPayload = {
      setup: {
        model: modelName,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.voiceName
              }
            }
          }
        },
        systemInstruction: {
          parts: [
            { text: DEFAULT_SYSTEM_INSTRUCTION }
          ]
        },
        contextWindowCompression: {
          slidingWindow: {}
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      }
    };

    this.ws.send(JSON.stringify(setupPayload));
  }

  handleServerMessage(rawData) {
    try {
      const msg = JSON.parse(rawData.toString());

      if (msg.setupComplete) {
        console.log('[VOICE DEBUG] Gemini session ready');
        this.isSetupComplete = true;
        this.emit({ type: 'ready' });

        // Flush any queued audio chunks
        while (this.pendingAudioQueue.length > 0) {
          const chunk = this.pendingAudioQueue.shift();
          this.sendAudioChunk(chunk);
        }
        return;
      }

      // Voice Activity signals
      if (msg.serverContent?.activityStart || msg.activityStart) {
        console.log('[VOICE DEBUG] activity start');
        this.emit({ type: 'activity_start' });
      }
      if (msg.serverContent?.activityEnd || msg.activityEnd) {
        console.log('[VOICE DEBUG] activity end');
        this.emit({ type: 'activity_end' });
      }

      // Interim Input Transcription (Live Speech Recognition preview)
      const interimObj = msg.serverContent?.interimInputTranscription || msg.interimInputTranscription;
      if (interimObj && interimObj.text !== undefined) {
        const text = interimObj.text || '';
        if (text) {
          this.interimTranscript = text;
          console.log(`[VOICE DEBUG] input transcription partial: "${text}"`);
          this.emit({ type: 'interim_transcript', text });
        }
      }

      // Finalized Input Transcription (Canonical Moulika Utterance)
      const finalObj = msg.serverContent?.inputTranscription || msg.inputTranscription;
      if (finalObj && finalObj.text !== undefined) {
        const text = (finalObj.text || this.interimTranscript || '').trim();
        this.interimTranscript = '';
        if (text) {
          console.log(`[VOICE DEBUG] input transcription final: "${text}"`);
          this.emit({ type: 'final_transcript', text });
        }
      }

      // Server Content (Audio streaming, Interruption, Turn Complete)
      if (msg.serverContent) {
        const sc = msg.serverContent;

        // Native Barge-in / Interruption
        if (sc.interrupted === true) {
          console.log('[GeminiLive] Native serverContent.interrupted triggered! Halting audio.');
          this.emit({ type: 'interrupted' });
        }

        // Audio model turn chunks (24kHz PCM)
        if (sc.modelTurn?.parts) {
          for (const part of sc.modelTurn.parts) {
            if (part.inlineData && part.inlineData.data) {
              this.emit({
                type: 'audio_chunk',
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000'
              });
            }
          }
        }

        // Turn complete
        if (sc.turnComplete === true) {
          console.log('[VOICE DEBUG] turn complete');
          this.emit({ type: 'turn_complete' });
        }
      }

      // Token Usage Metadata (Persist to mentor_ai_usage)
      if (msg.usageMetadata) {
        recordGeminiLiveUsage({
          userId: this.userId,
          sessionId: this.sessionId,
          model: this.model,
          usageMetadata: msg.usageMetadata,
          metadata: { provider: 'gemini_live' }
        }).catch(e => console.error('[GeminiLive] Usage record error:', e.message));
      }

      // GoAway lifecycle handling (session resumption)
      if (msg.goAway) {
        console.warn('[GeminiLive] Received GoAway from Gemini:', msg.goAway);
        this.emit({ type: 'go_away', details: msg.goAway });
      }

    } catch (err) {
      console.error('[GeminiLive] Error parsing server message:', err);
    }
  }

  sendAudioChunk(buffer) {
    if (!this.isConnected || !this.isSetupComplete) {
      if (this.pendingAudioQueue.length < 50) {
        this.pendingAudioQueue.push(buffer);
      }
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const base64Data = buffer.toString('base64');
      const payload = {
        realtimeInput: {
          audio: {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Data
          }
        }
      };
      this.ws.send(JSON.stringify(payload));

      this.forwardedChunks++;
      this.forwardedBytes += buffer.length;

      const now = Date.now();
      if (now - this.lastForwardLogTime >= 2000) {
        this.lastForwardLogTime = now;
        console.log(`[VOICE DEBUG] audio forwarded: chunks=${this.forwardedChunks}, bytes=${this.forwardedBytes}`);
      }
    }
  }

  /**
   * Supply the authoritative DeepSeek mentor response to Gemini Live for natural spoken delivery
   */
  speakMentorText(mentorReplyText) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[GeminiLive] Cannot speak text, WebSocket not ready.');
      return;
    }

    console.log(`[GeminiLive] Supplying authoritative mentor reply to speak: "${mentorReplyText}"`);

    const payload = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: `[AUTHORITATIVE_MENTOR_DECISION]:\n${mentorReplyText}\n\nSpoken Delivery Instruction: Speak this authoritative mentor advice to Moulika faithfully, warmly, and concisely in natural voice.`
              }
            ]
          }
        ],
        turnComplete: true
      }
    };

    this.ws.send(JSON.stringify(payload));
  }

  interrupt() {
    this.emit({ type: 'interrupted' });
  }

  close() {
    this.isConnected = false;
    this.isSetupComplete = false;
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
  }

  emit(event) {
    if (typeof this.onEvent === 'function') {
      this.onEvent(event);
    }
  }
}
