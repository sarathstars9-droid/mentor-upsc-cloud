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

    console.log(`[SPK-2] Gemini session created - outbound model: "${outboundModel}", voice: "${this.voiceName}"`);

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

    console.log(`[SPK-3] AUDIO modality configured: responseModalities=['AUDIO'], voiceName='${this.voiceName}'`);

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
      const msgKeys = Object.keys(msg);
      const sc = msg.serverContent;
      const scKeys = sc ? Object.keys(sc) : [];

      console.log('[SPK-7] Gemini event received:', {
        keys: msgKeys,
        serverContentKeys: scKeys,
        modelTurnExists: Boolean(sc?.modelTurn),
        partsCount: sc?.modelTurn?.parts?.length || 0,
        generationComplete: Boolean(sc?.generationComplete),
        turnComplete: Boolean(sc?.turnComplete),
        interrupted: Boolean(sc?.interrupted),
        hasError: Boolean(msg.error)
      });

      if (msg.setupComplete) {
        console.log('[GeminiLive] Setup complete. Ready for speech/audio.');
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
        console.log('[MIC-G] Gemini activityStart / speech start received');
        this.emit({ type: 'activity_start' });
      }
      if (msg.serverContent?.activityEnd || msg.activityEnd) {
        console.log('[MIC-I] Gemini activityEnd / speech end received');
        this.emit({ type: 'activity_end' });
      }

      // Interim Input Transcription (Live Speech Recognition preview)
      const interimObj = msg.serverContent?.interimInputTranscription || msg.interimInputTranscription;
      if (interimObj && interimObj.text !== undefined) {
        const text = interimObj.text || '';
        if (text) {
          this.interimTranscript = text;
          console.log(`[MIC-H] Gemini partial input transcription received: "${text}"`);
          this.emit({ type: 'interim_transcript', text });
        }
      }

      // Finalized Input Transcription (Canonical User Utterance)
      const finalObj = msg.serverContent?.inputTranscription || msg.inputTranscription;
      if (finalObj && finalObj.text !== undefined) {
        const text = (finalObj.text || this.interimTranscript || '').trim();
        this.interimTranscript = '';
        if (text) {
          console.log(`[MIC-J] Gemini FINAL input transcription received: "${text}"`);
          this.emit({ type: 'final_transcript', text });
        }
      }

      // Server Content (Audio streaming, Interruption, Turn Complete)
      if (msg.serverContent) {
        // Fallback userTurn check if inputTranscription was missing
        if (sc.userTurn?.parts) {
          for (const part of sc.userTurn.parts) {
            if (part.text) {
              console.log(`[GeminiLive] UserTurn text fallback: "${part.text}"`);
              this.emit({ type: 'final_transcript', text: part.text });
            }
          }
        }

        // Native Barge-in / Interruption
        if (sc.interrupted === true) {
          console.log('[GeminiLive] Native serverContent.interrupted triggered! Halting audio.');
          this.isMentorSpeaking = false;
          this.emit({ type: 'interrupted' });
        }

        // Audio model turn chunks (24kHz PCM)
        if (sc.modelTurn?.parts) {
          const partsCount = sc.modelTurn.parts.length;
          for (let pIdx = 0; pIdx < partsCount; pIdx++) {
            const part = sc.modelTurn.parts[pIdx];
            if (part.inlineData && part.inlineData.data) {
              const mimeType = part.inlineData.mimeType || 'audio/pcm;rate=24000';
              const byteLen = part.inlineData.data.length;
              console.log(`[GeminiLive] modelTurn part[${pIdx}]: mimeType=${mimeType}, base64Bytes=${byteLen}`);
              this.emit({
                type: 'audio_chunk',
                data: part.inlineData.data,
                mimeType
              });
            }
            if (part.text) {
              console.log(`[GeminiLive] modelTurn text part[${pIdx}]: "${part.text}"`);
            }
          }
        }

        // Turn complete
        if (sc.turnComplete === true) {
          console.log('[GeminiLive] Turn complete received from Gemini Live.');
          this.isMentorSpeaking = false;
          this.emit({ type: 'turn_complete' });
        }
      }

      // Token Usage Metadata (Persist to mentor_ai_usage)
      if (msg.usageMetadata) {
        console.log(`[GeminiLive] Usage metadata received: prompt=${msg.usageMetadata.promptTokenCount}, response=${msg.usageMetadata.responseTokenCount}`);
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

    // Suppress mic streaming while Mentor is actively speaking to prevent self-interruption
    if (this.isMentorSpeaking) {
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const base64Data = buffer.toString('base64');
      const payload = {
        realtimeInput: {
          audio: {
            data: base64Data,
            mimeType: 'audio/pcm;rate=16000'
          }
        }
      };
      this.ws.send(JSON.stringify(payload));

      this.forwardedChunks++;
      this.forwardedBytes += buffer.length;

      if (this.forwardedChunks === 1 || this.forwardedChunks % 10 === 0) {
        console.log(`[MIC-F] geminiLiveService sent realtimeInput audio (chunk #${this.forwardedChunks}, bytes=${buffer.length}, totalForwarded=${this.forwardedBytes})`);
      }
    }
  }

  sendAudioStreamEnd() {
    if (!this.isConnected || !this.isSetupComplete) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[END-2] audioStreamEnd sent to Gemini Live');
      const payload = {
        realtimeInput: {
          audioStreamEnd: true
        }
      };
      this.ws.send(JSON.stringify(payload));
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

    console.log(`[SPK-4] speakMentorText entered: text="${mentorReplyText}"`);
    this.isMentorSpeaking = true;

    const payload = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: mentorReplyText
              }
            ]
          }
        ],
        turnComplete: true
      }
    };

    console.log(`[SPK-5] text submitted to clientContent payload: ${JSON.stringify(payload)}`);
    this.ws.send(JSON.stringify(payload));
    console.log('[SPK-6] turn submitted/completed (turnComplete: true)');
  }

  interrupt() {
    this.isMentorSpeaking = false;
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
