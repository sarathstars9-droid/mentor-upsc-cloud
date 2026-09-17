import WebSocket from 'ws';

export class SarvamRealtimeService {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.SARVAM_API_KEY;
    this.model = options.model || process.env.MENTOR_STT_MODEL || 'saaras:v4-realtime';
    this.languageCode = options.languageCode || 'auto';
    this.mode = options.mode || 'codemix';
    this.onEvent = options.onEvent || (() => {});
    this.ws = null;
    this.isConnected = false;
  }

  connect() {
    if (!this.apiKey) {
      console.error('[SarvamSTT] Missing SARVAM_API_KEY in environment');
      this.onEvent({ type: 'error', error: 'Missing SARVAM_API_KEY configuration' });
      return;
    }

    const targetModel = (this.model === 'saaras:v4-realtime' || this.model === 'saaras:v4') ? 'saaras:v4' : 'saaras:v3-realtime';
    const url = `wss://api.sarvam.ai/speech-to-text-realtime/ws?model=${encodeURIComponent(targetModel)}&language_code=${this.languageCode}&mode=${this.mode}`;

    console.log(`[SarvamSTT] Connecting to Sarvam Realtime STT: ${url}`);

    try {
      this.ws = new WebSocket(url, {
        headers: {
          'api-subscription-key': this.apiKey
        }
      });

      this.ws.on('open', () => {
        console.log('[SarvamSTT] Connected to Sarvam STT WebSocket');
        this.isConnected = true;
        this.onEvent({ type: 'ready', model: this.model });

        // Send initial session config if required by Sarvam protocol
        try {
          this.ws.send(JSON.stringify({
            event: 'session.begin',
            request_id: `req_${Date.now()}`
          }));
        } catch (e) {
          // Some Sarvam versions start session automatically on connection
        }
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleSarvamMessage(msg);
        } catch (e) {
          console.warn('[SarvamSTT] Failed to parse message from Sarvam:', data.toString());
        }
      });

      this.ws.on('error', (err) => {
        console.error('[SarvamSTT] WebSocket error:', err.message);
        this.onEvent({ type: 'error', error: err.message });
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[SarvamSTT] Connection closed. Code: ${code}, Reason: ${reason}`);
        this.isConnected = false;
        this.onEvent({ type: 'close', code, reason: reason.toString() });
      });
    } catch (err) {
      console.error('[SarvamSTT] Exception during connect:', err);
      this.onEvent({ type: 'error', error: err.message });
    }
  }

  sendAudioChunk(buffer) {
    if (!this.ws || !this.isConnected) return;

    try {
      const base64Audio = Buffer.from(buffer).toString('base64');
      const payload = JSON.stringify({
        event: 'audio_input',
        audio: base64Audio
      });
      this.ws.send(payload);
    } catch (err) {
      console.error('[SarvamSTT] Error sending audio chunk:', err);
    }
  }

  handleSarvamMessage(msg) {
    const event = msg.event || msg.type;
    const text = msg.transcript || msg.text || msg.data?.transcript || msg.data?.text || '';

    if (event === 'speech_start' || event === 'speech.start') {
      this.onEvent({ type: 'speech_start' });
    } else if (event === 'speech_end' || event === 'speech.end') {
      this.onEvent({ type: 'speech_end' });
    } else if (event === 'transcript' || event === 'transcript.partial' || event === 'transcript.final' || text) {
      const isFinal = Boolean(msg.is_final || event === 'transcript.final' || msg.type === 'transcript.final');
      if (isFinal) {
        this.onEvent({ type: 'final_transcript', text, language: msg.language_code || 'en' });
      } else {
        this.onEvent({ type: 'partial_transcript', text, language: msg.language_code || 'en' });
      }
    } else if (event === 'error') {
      this.onEvent({ type: 'error', error: msg.message || msg.error || 'Sarvam API Error' });
    }
  }

  close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
      this.isConnected = false;
    }
  }
}
