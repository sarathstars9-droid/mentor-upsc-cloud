// backend/services/voice/mentorVoiceGateway.js
// MentorOS Multi-Provider Realtime Voice Gateway
// Supports Gemini 3.8 / 2.0 Live (Default) & Sarvam AI (A/B Testable)

import { WebSocketServer } from 'ws';
import { randomUUID as uuidv4 } from 'node:crypto';
import { verifyToken } from '../../utils/tokenUtils.js';
import { GeminiLiveService } from './geminiLiveService.js';
import { SarvamRealtimeService } from './sarvamRealtimeService.js';
import { SarvamTtsService } from './sarvamTtsService.js';
import { processMentorTurn } from '../mentorTurnService.js';

const DEFAULT_USER = (process.env.DEFAULT_USER_ID || 'moulika').toLowerCase().trim();

export function setupMentorVoiceGateway(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/ws/mentor/voice') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (clientWs, req) => {
    console.log('[MentorVoiceGateway] New browser WebSocket connection');

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token') || '';
    let sessionId = url.searchParams.get('sessionId') || null;
    const isProd = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;

    let userId = null;
    if (token) {
      const payload = verifyToken(token);
      if (payload) userId = payload.sub;
    }

    if (isProd && !userId) {
      console.warn('[MentorVoiceGateway] Unauthorized connection attempt in production.');
      clientWs.send(JSON.stringify({ type: 'error', error: 'Unauthorized token' }));
      clientWs.close(4001, 'Unauthorized');
      return;
    }

    if (!userId) {
      userId = url.searchParams.get('userId') || DEFAULT_USER;
    }

    const provider = (process.env.MENTOR_VOICE_PROVIDER || 'gemini').toLowerCase();
    console.log(`[MentorVoiceGateway] Connecting user "${userId}" using provider: ${provider}`);

    const broadcastState = (state) => {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify({ type: 'state_change', state }));
      }
    };

    broadcastState('CONNECTING');

    let voiceService = null;
    let sarvamTtsService = null;
    let activeTtsSession = null;
    let isProcessingTurn = false;

    let backendChunks = 0;
    let backendBytes = 0;
    let lastBackendAudioLogTime = 0;
    let geminiAudioChunksCount = 0;
    let lastGeminiAudioLogTime = 0;

    if (provider === 'sarvam') {
      // ──────────────────────────────────────────
      // Sarvam AI Saaras / Bulbul Integration Path
      // ──────────────────────────────────────────
      sarvamTtsService = new SarvamTtsService();

      voiceService = new SarvamRealtimeService({
        onEvent: async (event) => {
          if (clientWs.readyState !== clientWs.OPEN) return;

          // Forward standard Sarvam events to client
          clientWs.send(JSON.stringify(event));

          if (event.type === 'speech_start') {
            broadcastState('USER_SPEAKING');
            if (activeTtsSession) {
              console.log('[MentorVoiceGateway] Barge-in triggered by Saaras speech_start! Cancelling TTS.');
              activeTtsSession.cancel();
              activeTtsSession = null;
              clientWs.send(JSON.stringify({ type: 'tts_interrupted' }));
            }
          } else if (event.type === 'transcript') {
            const transcriptText = (event.transcript || '').trim();
            if (event.is_final && transcriptText && sessionId && !isProcessingTurn) {
              isProcessingTurn = true;
              broadcastState('MENTOR_THINKING');

              const turnRequestId = uuidv4();
              try {
                const turnResult = await processMentorTurn({
                  userId,
                  sessionId,
                  userMessage: transcriptText,
                  requestId: turnRequestId
                });

                broadcastState('MENTOR_SPEAKING');
                clientWs.send(JSON.stringify({
                  type: 'mentor_reply',
                  reply: turnResult.mentorReply,
                  stage: turnResult.session?.current_stage
                }));

                // Synthesize TTS
                if (clientWs.readyState === clientWs.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'tts_start' }));
                }

                activeTtsSession = sarvamTtsService.synthesizeStream({
                  text: turnResult.mentorReply,
                  onAudioChunk: (audioBase64) => {
                    if (clientWs.readyState === clientWs.OPEN) {
                      clientWs.send(JSON.stringify({ type: 'tts_audio', audio: audioBase64 }));
                    }
                  },
                  onComplete: () => {
                    activeTtsSession = null;
                    broadcastState('LISTENING');
                    if (clientWs.readyState === clientWs.OPEN) {
                      clientWs.send(JSON.stringify({ type: 'tts_end' }));
                    }
                  },
                  onError: (err) => {
                    activeTtsSession = null;
                    broadcastState('LISTENING');
                    console.error('[MentorVoiceGateway] Sarvam TTS error:', err.message);
                  }
                });
              } catch (turnErr) {
                console.error('[MentorVoiceGateway] Turn processing error:', turnErr.message);
                broadcastState('LISTENING');
              } finally {
                isProcessingTurn = false;
              }
            }
          }
        }
      });

      voiceService.connect();
      broadcastState('LISTENING');

    } else {
      // ──────────────────────────────────────────
      // Gemini 3.8 / 2.0 Live Voice Shell Path
      // ──────────────────────────────────────────
      voiceService = new GeminiLiveService({
        userId,
        sessionId,
        onEvent: async (event) => {
          if (clientWs.readyState !== clientWs.OPEN) return;

          switch (event.type) {
            case 'ready':
              broadcastState('LISTENING');
              clientWs.send(JSON.stringify({ type: 'ready', provider: 'gemini' }));
              break;

            case 'interim_transcript':
              broadcastState('USER_SPEAKING');
              clientWs.send(JSON.stringify({
                type: 'interim_transcript',
                text: event.text
              }));
              break;

            case 'final_transcript': {
              const userText = (event.text || '').trim();
              console.log(`[VOICE DEBUG] FINAL USER TURN: ${userText}`);
              clientWs.send(JSON.stringify({
                type: 'final_transcript',
                text: userText
              }));

              if (userText && sessionId && !isProcessingTurn) {
                isProcessingTurn = true;
                broadcastState('MENTOR_THINKING');

                const turnRequestId = uuidv4();
                try {
                  console.log('[VOICE DEBUG] sending to canonical Mentor turn');
                  console.log('[VOICE DEBUG] DeepSeek called');
                  const tStart = Date.now();

                  const turnResult = await processMentorTurn({
                    userId,
                    sessionId,
                    userMessage: userText,
                    requestId: turnRequestId
                  });

                  const latency = Date.now() - tStart;
                  console.log(`[VOICE DEBUG] DeepSeek reply received (${latency}ms): "${turnResult.mentorReply}"`);

                  broadcastState('MENTOR_SPEAKING');
                  clientWs.send(JSON.stringify({
                    type: 'mentor_reply',
                    reply: turnResult.mentorReply,
                    source: turnResult.source,
                    stage: turnResult.session?.current_stage
                  }));

                  // Send the authoritative DeepSeek mentor reply to Gemini Live to speak naturally
                  console.log('[VOICE DEBUG] Mentor reply sent for speech');
                  voiceService.speakMentorText(turnResult.mentorReply);

                } catch (turnErr) {
                  console.error('[MentorVoiceGateway] Turn processing error:', turnErr.message);
                  broadcastState('LISTENING');
                  clientWs.send(JSON.stringify({
                    type: 'error',
                    error: `Turn error: ${turnErr.message}`
                  }));
                } finally {
                  isProcessingTurn = false;
                }
              }
              break;
            }

            case 'audio_chunk':
              geminiAudioChunksCount++;
              if (Date.now() - lastGeminiAudioLogTime >= 2000 || geminiAudioChunksCount === 1) {
                lastGeminiAudioLogTime = Date.now();
                console.log(`[VOICE DEBUG] Gemini audio chunk received (total=${geminiAudioChunksCount})`);
              }
              broadcastState('MENTOR_SPEAKING');
              clientWs.send(JSON.stringify({
                type: 'audio_chunk',
                audio: event.data,
                mimeType: event.mimeType || 'audio/pcm;rate=24000'
              }));
              break;

            case 'interrupted':
              console.log('[MentorVoiceGateway] Interruption received — halting playback');
              broadcastState('INTERRUPTED');
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
              setTimeout(() => broadcastState('USER_SPEAKING'), 100);
              break;

            case 'turn_complete':
              broadcastState('LISTENING');
              clientWs.send(JSON.stringify({ type: 'turn_complete' }));
              break;

            case 'error':
              console.error('[VOICE DEBUG] error (Voice Gateway):', event.error);
              broadcastState('ERROR');
              clientWs.send(JSON.stringify({ type: 'error', error: event.error }));
              break;

            case 'close':
              broadcastState('ENDED');
              break;
          }
        }
      });

      voiceService.connect();
    }

    // ──────────────────────────────────────────
    // Handle Browser Inbound WebSocket Messages
    // ──────────────────────────────────────────
    clientWs.on('message', (message, isBinary) => {
      let buf = null;
      if (isBinary || message instanceof Buffer || message instanceof ArrayBuffer) {
        buf = Buffer.isBuffer(message) ? message : Buffer.from(message);
      } else {
        try {
          const data = JSON.parse(message.toString());

          if (data.type === 'audio' && data.data) {
            buf = Buffer.from(data.data, 'base64');
          } else if (data.type === 'set_session' && data.sessionId) {
            sessionId = data.sessionId;
            if (voiceService && voiceService.sessionId !== undefined) {
              voiceService.sessionId = sessionId;
            }
            console.log(`[MentorVoiceGateway] Active session set to: ${sessionId}`);
          } else if (data.type === 'speak' && data.text) {
            if (provider === 'sarvam') {
              if (activeTtsSession) {
                activeTtsSession.cancel();
                activeTtsSession = null;
              }
              if (clientWs.readyState === clientWs.OPEN) {
                clientWs.send(JSON.stringify({ type: 'tts_start' }));
              }
              activeTtsSession = sarvamTtsService.synthesizeStream({
                text: data.text,
                onAudioChunk: (audioBase64) => {
                  if (clientWs.readyState === clientWs.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'tts_audio', audio: audioBase64 }));
                  }
                },
                onComplete: () => {
                  activeTtsSession = null;
                  if (clientWs.readyState === clientWs.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'tts_end' }));
                  }
                },
                onError: (err) => {
                  activeTtsSession = null;
                  console.error('[MentorVoiceGateway] TTS Synthesis Error:', err.message);
                }
              });
            } else if (voiceService) {
              voiceService.speakMentorText(data.text);
            }
          } else if (data.type === 'interrupt_tts' || data.type === 'stop_speaking' || data.type === 'interrupt') {
            if (provider === 'sarvam' && activeTtsSession) {
              activeTtsSession.cancel();
              activeTtsSession = null;
              clientWs.send(JSON.stringify({ type: 'tts_interrupted' }));
            } else if (voiceService) {
              voiceService.interrupt();
            }
            broadcastState('LISTENING');
          }
        } catch (e) {
          console.error('[MentorVoiceGateway] Error handling client message:', e);
        }
      }

      if (buf && voiceService) {
        backendChunks++;
        backendBytes += buf.length;
        const now = Date.now();
        if (now - lastBackendAudioLogTime >= 2000) {
          lastBackendAudioLogTime = now;
          console.log(`[VOICE DEBUG] backend audio received: chunks=${backendChunks}, bytes=${backendBytes}`);
        }
        voiceService.sendAudioChunk(buf);
      }
    });

    clientWs.on('close', () => {
      console.log(`[MentorVoiceGateway] Browser connection closed for user: ${userId}`);
      if (activeTtsSession) {
        activeTtsSession.cancel();
        activeTtsSession = null;
      }
      if (voiceService) {
        voiceService.close();
      }
    });

    clientWs.on('error', (err) => {
      console.error('[MentorVoiceGateway] Client WebSocket error:', err.message);
      if (activeTtsSession) {
        activeTtsSession.cancel();
        activeTtsSession = null;
      }
      if (voiceService) {
        voiceService.close();
      }
    });
  });

  console.log('[MentorVoiceGateway] WebSocket gateway initialized for /ws/mentor/voice');
  return wss;
}
