import { WebSocketServer } from 'ws';
import { verifyToken } from '../../utils/tokenUtils.js';
import { SarvamRealtimeService } from './sarvamRealtimeService.js';
import { SarvamTtsService } from './sarvamTtsService.js';

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

    clientWs.send(JSON.stringify({ type: 'connecting', message: 'Connecting to Sarvam Realtime STT' }));

    const sarvamService = new SarvamRealtimeService({
      onEvent: (event) => {
        if (clientWs.readyState === clientWs.OPEN) {
          clientWs.send(JSON.stringify(event));

          // Barge-in: If user starts speaking during active TTS, interrupt TTS immediately
          if (event.type === 'speech_start' && activeTtsSession) {
            console.log('[MentorVoiceGateway] Barge-in triggered by Saaras speech_start! Cancelling TTS.');
            activeTtsSession.cancel();
            activeTtsSession = null;
            clientWs.send(JSON.stringify({ type: 'tts_interrupted' }));
          }
        }
      }
    });

    const ttsService = new SarvamTtsService();
    let activeTtsSession = null;

    sarvamService.connect();

    clientWs.on('message', (message, isBinary) => {
      if (isBinary || message instanceof Buffer || message instanceof ArrayBuffer) {
        sarvamService.sendAudioChunk(message);
      } else {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'audio' && data.data) {
            const buf = Buffer.from(data.data, 'base64');
            sarvamService.sendAudioChunk(buf);
          } else if (data.type === 'speak' && data.text) {
            // Cancel any prior active TTS stream
            if (activeTtsSession) {
              activeTtsSession.cancel();
              activeTtsSession = null;
            }

            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ type: 'tts_start' }));
            }

            activeTtsSession = ttsService.synthesizeStream({
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
                if (clientWs.readyState === clientWs.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'error', error: `TTS Error: ${err.message}` }));
                }
              }
            });
          } else if (data.type === 'interrupt_tts' || data.type === 'stop_speaking') {
            if (activeTtsSession) {
              console.log('[MentorVoiceGateway] Client requested TTS interruption');
              activeTtsSession.cancel();
              activeTtsSession = null;
              if (clientWs.readyState === clientWs.OPEN) {
                clientWs.send(JSON.stringify({ type: 'tts_interrupted' }));
              }
            }
          }
        } catch (e) {}
      }
    });

    clientWs.on('close', () => {
      console.log(`[MentorVoiceGateway] Browser connection closed for user: ${userId}`);
      if (activeTtsSession) {
        activeTtsSession.cancel();
        activeTtsSession = null;
      }
      sarvamService.close();
    });

    clientWs.on('error', (err) => {
      console.error('[MentorVoiceGateway] Client WebSocket error:', err);
      if (activeTtsSession) {
        activeTtsSession.cancel();
        activeTtsSession = null;
      }
      sarvamService.close();
    });
  });

  console.log('[MentorVoiceGateway] WebSocket gateway initialized for /ws/mentor/voice');
  return wss;
}
