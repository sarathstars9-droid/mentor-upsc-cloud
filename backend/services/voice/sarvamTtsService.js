import WebSocket from 'ws';

export class SarvamTtsService {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.SARVAM_API_KEY;
    this.model = options.model || process.env.MENTOR_TTS_MODEL || 'bulbul:v3';
    this.languageCode = options.languageCode || process.env.MENTOR_TTS_LANGUAGE || 'te-IN';
    this.speaker = options.speaker || process.env.MENTOR_TTS_SPEAKER || 'priya';
    this.pace = options.pace || 1.0;
  }

  synthesizeStream({ text, onAudioChunk, onComplete, onError }) {
    let cancelled = false;
    let ws = null;
    let fallbackTimeout = null;

    const cancel = () => {
      cancelled = true;
      if (ws) {
        try { ws.close(); } catch (e) {}
        ws = null;
      }
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
      }
    };

    if (!this.apiKey) {
      if (onError) onError(new Error('Missing SARVAM_API_KEY configuration'));
      return { cancel };
    }

    const wsUrl = `wss://api.sarvam.ai/text-to-speech/ws?model=${encodeURIComponent(this.model)}&send_completion_event=true`;

    try {
      ws = new WebSocket(wsUrl, {
        headers: {
          'api-subscription-key': this.apiKey
        }
      });

      ws.on('open', () => {
        if (cancelled) {
          try { ws.close(); } catch (e) {}
          return;
        }

        const payload = {
          inputs: [text],
          target_language_code: this.languageCode,
          speaker: this.speaker,
          pace: this.pace,
          speech_sample_rate: 24000,
          enable_preprocessing: true,
          model: this.model
        };
        ws.send(JSON.stringify(payload));
      });

      ws.on('message', (data) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'error' || (msg.data && msg.data.code)) {
            console.warn('[SarvamTTS] WebSocket returned error, triggering REST fallback:', msg.data?.message || msg);
            ws.close();
            this.runRestFallback({ text, onAudioChunk, onComplete, onError, isCancelled: () => cancelled });
            return;
          }

          if (msg.audio || msg.data?.audio) {
            const audioData = msg.audio || msg.data.audio;
            if (onAudioChunk) onAudioChunk(audioData);
          }

          if (msg.event === 'completion' || msg.event === 'done' || msg.type === 'completion') {
            if (onComplete) onComplete();
          }
        } catch (e) {
          if (onAudioChunk) onAudioChunk(data.toString('base64'));
        }
      });

      ws.on('error', (err) => {
        if (cancelled) return;
        console.warn('[SarvamTTS] WebSocket error, triggering REST fallback:', err.message);
        this.runRestFallback({ text, onAudioChunk, onComplete, onError, isCancelled: () => cancelled });
      });

      ws.on('close', (code, reason) => {
        // Closed normally
      });

    } catch (err) {
      if (!cancelled) {
        this.runRestFallback({ text, onAudioChunk, onComplete, onError, isCancelled: () => cancelled });
      }
    }

    return { cancel };
  }

  async runRestFallback({ text, onAudioChunk, onComplete, onError, isCancelled }) {
    if (isCancelled()) return;

    try {
      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': this.apiKey
        },
        body: JSON.stringify({
          inputs: [text],
          target_language_code: this.languageCode,
          speaker: this.speaker,
          pace: this.pace,
          model: this.model
        })
      });

      if (isCancelled()) return;

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Sarvam TTS API failed with status ${response.status}`);
      }

      const data = await response.json();
      if (isCancelled()) return;

      if (data.audios && data.audios.length > 0) {
        const base64Audio = data.audios[0];
        // Stream chunking: slice base64 into small frames for progressive streaming
        const chunkSize = 8192;
        for (let i = 0; i < base64Audio.length; i += chunkSize) {
          if (isCancelled()) break;
          const chunk = base64Audio.slice(i, i + chunkSize);
          if (onAudioChunk) onAudioChunk(chunk);
          // Micro delay to simulate streaming audio delivery
          await new Promise(r => setTimeout(r, 20));
        }
      }

      if (!isCancelled() && onComplete) {
        onComplete();
      }
    } catch (err) {
      if (!isCancelled() && onError) {
        onError(err);
      }
    }
  }
}
