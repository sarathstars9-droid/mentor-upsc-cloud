import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth, getAuthToken } from '../utils/auth';
import { BACKEND_URL } from '../config';

const CALL_STATES = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  LISTENING: 'LISTENING',
  USER_SPEAKING: 'USER_SPEAKING',
  MENTOR_THINKING: 'MENTOR_THINKING',
  MENTOR_SPEAKING: 'MENTOR_SPEAKING',
  INTERRUPTED: 'INTERRUPTED',
  ENDED: 'ENDED',
  ERROR: 'ERROR'
};

function MentorCallSimulator() {
  const navigate = useNavigate();

  const [mentorState, setMentorState] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [callState, setCallState] = useState(CALL_STATES.IDLE);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [monthlyUsage, setMonthlyUsage] = useState(null);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Audio Pipeline References
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const micStreamRef = useRef(null);
  const processorNodeRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingAudioRef = useRef(false);
  const currentSourceNodeRef = useRef(null);

  const fetchStateAndUsage = useCallback(async () => {
    try {
      setLoading(true);
      const [stateRes, usageRes] = await Promise.all([
        fetchWithAuth('/api/mentor/state/today'),
        fetchWithAuth('/api/mentor/usage/month')
      ]);

      if (stateRes.ok) {
        const stateData = await stateRes.json();
        setMentorState(stateData);
      }
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setMonthlyUsage(usageData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStateAndUsage();
    return () => {
      cleanupVoicePipeline();
    };
  }, [fetchStateAndUsage]);

  const cleanupVoicePipeline = () => {
    stopCurrentAudioPlayback();
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setVoiceConnected(false);
  };

  const stopCurrentAudioPlayback = () => {
    if (currentSourceNodeRef.current) {
      try {
        currentSourceNodeRef.current.stop();
      } catch (_) {}
      currentSourceNodeRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
  };

  const initVoiceWebSocket = (activeSessionId) => {
    const token = getAuthToken() || '';
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let host = window.location.host;
    if (BACKEND_URL && BACKEND_URL.startsWith('http')) {
      const urlObj = new URL(BACKEND_URL);
      host = urlObj.host;
    }

    const wsUrl = `${wsProto}//${host}/ws/mentor/voice?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(activeSessionId)}`;
    console.log('[VoiceClient] Connecting to:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[VoiceClient] WebSocket connected');
      console.log('[VOICE DEBUG] websocket connected');
      setVoiceConnected(true);
      setCallState(CALL_STATES.CONNECTING);
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'state_change':
            setCallState(data.state);
            break;

          case 'ready':
            setCallState(CALL_STATES.LISTENING);
            break;

          case 'interim_transcript':
            setInterimTranscript(data.text);
            setCallState(CALL_STATES.USER_SPEAKING);
            break;

          case 'final_transcript':
            setInterimTranscript('');
            setMessages(prev => [...prev, { role: 'user', content: data.text }]);
            setCallState(CALL_STATES.MENTOR_THINKING);
            break;

          case 'mentor_reply':
            setMessages(prev => [...prev, {
              role: 'mentor',
              content: data.reply,
              source: data.source || 'ai'
            }]);
            if (data.stage) {
              setSession(prev => prev ? ({ ...prev, currentStage: data.stage }) : null);
            }
            fetchStateAndUsage();
            break;

          case 'audio_chunk':
          case 'tts_audio':
            console.log('[VOICE DEBUG] audio received');
            playIncomingAudioChunk(data.audio || data.data, data.mimeType);
            break;

          case 'interrupted':
          case 'tts_interrupted':
            console.log('[VoiceClient] Barge-in interrupted — clearing audio queue');
            stopCurrentAudioPlayback();
            setCallState(CALL_STATES.USER_SPEAKING);
            break;

          case 'turn_complete':
          case 'tts_end':
            setCallState(CALL_STATES.LISTENING);
            break;

          case 'error':
            console.error('[VoiceClient] Voice Error:', data.error);
            setError(data.error);
            break;
        }
      } catch (err) {
        console.error('[VoiceClient] Error parsing message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[VoiceClient] WebSocket Error:', err);
      setCallState(CALL_STATES.ERROR);
    };

    ws.onclose = () => {
      console.log('[VoiceClient] WebSocket closed');
      setVoiceConnected(false);
      setCallState(CALL_STATES.IDLE);
    };
  };

  const chunksSentRef = useRef(0);
  const bytesSentRef = useRef(0);
  const lastMicLogTimeRef = useRef(0);
  const rmsSumRef = useRef(0);
  const rmsCountRef = useRef(0);

  const startMicrophoneCapture = async () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      micStreamRef.current = stream;
      console.log('[VOICE DEBUG] mic acquired');

      const source = audioCtx.createMediaStreamSource(stream);
      // Create ScriptProcessorNode with buffer size 1024 (~64ms @ 16kHz)
      const processor = audioCtx.createScriptProcessor(1024, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Calculate RMS
        let sumSquares = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSquares += inputData[i] * inputData[i];
        }
        const currentRms = Math.sqrt(sumSquares / inputData.length);
        rmsSumRef.current += currentRms;
        rmsCountRef.current++;

        // Convert Float32 to PCM16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          // Send raw binary buffer
          wsRef.current.send(pcm16.buffer);
          chunksSentRef.current++;
          bytesSentRef.current += pcm16.buffer.byteLength;

          const now = Date.now();
          if (now - lastMicLogTimeRef.current >= 2000) {
            lastMicLogTimeRef.current = now;
            const avgRms = rmsCountRef.current > 0 ? (rmsSumRef.current / rmsCountRef.current) : currentRms;
            console.log(`[VOICE DEBUG] audio chunks sent: ${chunksSentRef.current}, bytes sent: ${bytesSentRef.current}, RMS level: ${avgRms.toFixed(4)}`);
            rmsSumRef.current = 0;
            rmsCountRef.current = 0;
          }
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      console.log('[VoiceClient] Microphone stream connected at 16kHz');
    } catch (micErr) {
      console.error('[VoiceClient] Microphone access denied or error:', micErr);
      setError('Microphone access is required for voice calling: ' + micErr.message);
    }
  };

  const playIncomingAudioChunk = (base64Data, mimeType = 'audio/pcm;rate=24000') => {
    if (!base64Data) return;
    audioQueueRef.current.push({ data: base64Data, mimeType });
    if (!isPlayingAudioRef.current) {
      processNextAudioChunk();
    }
  };

  const processNextAudioChunk = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false;
      return;
    }

    isPlayingAudioRef.current = true;
    const item = audioQueueRef.current.shift();

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContextClass();
      }

      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // Convert base64 to array buffer
      const binaryString = atob(item.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      let audioBuffer = null;

      if (item.mimeType?.includes('audio/pcm')) {
        // Raw PCM16 at 24kHz or 16kHz
        const sampleRate = item.mimeType.includes('rate=24000') ? 24000 : 16000;
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
        }
        audioBuffer = audioCtx.createBuffer(1, float32Array.length, sampleRate);
        audioBuffer.getChannelData(0).set(float32Array);
      } else {
        // Decodable audio (WAV, MP3)
        audioBuffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0));
      }

      if (audioBuffer) {
        const sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(audioCtx.destination);
        currentSourceNodeRef.current = sourceNode;

        sourceNode.onended = () => {
          currentSourceNodeRef.current = null;
          processNextAudioChunk();
        };

        console.log('[VOICE DEBUG] playback started');
        sourceNode.start(0);
      } else {
        processNextAudioChunk();
      }
    } catch (playErr) {
      console.warn('[VoiceClient] Audio playback decode error:', playErr);
      processNextAudioChunk();
    }
  };

  const startSession = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/api/mentor/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayKey: mentorState?.dayKey || new Date().toISOString().split('T')[0] })
      });
      if (!res.ok) throw new Error('Failed to start session');
      const data = await res.json();
      const newSession = {
        id: data.session.id,
        currentStage: data.session.current_stage,
        status: data.session.status
      };
      setSession(newSession);
      setMessages([data.initialMessage]);

      // Connect Voice Gateway & Microphone
      initVoiceWebSocket(newSession.id);
      await startMicrophoneCapture();

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || !session || session.status === 'completed') return;

    stopCurrentAudioPlayback();
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setCallState(CALL_STATES.MENTOR_THINKING);

    try {
      const res = await fetchWithAuth(`/api/mentor/sessions/${session.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          stage: session.currentStage,
          requestId: crypto.randomUUID()
        })
      });
      if (!res.ok) throw new Error('Failed to send message');
      const data = await res.json();

      const mentorMsg = {
        role: 'mentor',
        content: data.mentorReply,
        source: data.source
      };
      setMessages(prev => [...prev, mentorMsg]);
      setSession(prev => ({ ...prev, currentStage: data.session.current_stage, status: data.session.status }));

      // Request voice synthesis if WebSocket is active
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'speak', text: data.mentorReply }));
      }

      fetchStateAndUsage();
    } catch (err) {
      console.error('[MentorCall] Send message error:', err);
    } finally {
      setCallState(CALL_STATES.LISTENING);
    }
  };

  const commitSession = async () => {
    try {
      const res = await fetchWithAuth(`/api/mentor/sessions/${session.id}/commit`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to commit session');
      setSession(prev => ({ ...prev, status: 'completed' }));
      cleanupVoicePipeline();
    } catch (err) {
      console.error('[MentorCall] Commit error:', err);
    }
  };

  const handleManualInterrupt = () => {
    stopCurrentAudioPlayback();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_speaking' }));
    }
    setCallState(CALL_STATES.USER_SPEAKING);
  };

  const handleInputSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  if (loading && !session) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#05070A', color: '#95A1B3' }}>
        Loading MentorOS Voice Session…
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#05070A', color: '#F8FAFC', padding: '24px 16px', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        
        {/* Top Header & Monthly Budget Card */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ color: '#0A64F5', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              MentorOS · Realtime Voice V2
            </div>
            <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800 }}>
              Moulika Voice Check-in
            </h1>
          </div>

          {monthlyUsage && (
            <div style={{ background: '#0D1117', border: '1px solid #202A36', borderRadius: 12, padding: '8px 14px', fontSize: 12 }}>
              <div style={{ color: '#95A1B3', marginBottom: 2 }}>Monthly AI Spend:</div>
              <div style={{ fontWeight: 800, color: '#16B364' }}>
                ₹{monthlyUsage.totalCostInr} / ₹{monthlyUsage.budgetInr}
                <span style={{ color: '#95A1B3', fontWeight: 500, marginLeft: 6 }}>
                  (Remaining: ₹{monthlyUsage.remainingInr})
                </span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ background: 'rgba(239,77,86,.15)', border: '1px solid rgba(239,77,86,.4)', color: '#EF4D56', padding: '12px 16px', borderRadius: 12, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {!session ? (
          <div style={{ background: '#0D1117', border: '1px solid #202A36', borderRadius: 18, padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px', color: '#F8FAFC' }}>
              Today's Execution Target
            </h2>
            {mentorState && (
              <div style={{ background: '#121923', border: '1px solid #202A36', borderRadius: 14, padding: 16, marginBottom: 20 }}>
                <div style={{ color: '#D99100', fontWeight: 750, fontSize: 14 }}>
                  ⚡ {mentorState.mentorCommand?.title || 'Execution Priority'}
                </div>
                <div style={{ color: '#D5DCE6', fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
                  {mentorState.mentorCommand?.instruction}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: '#95A1B3' }}>
                  <span>Planned: <strong>{mentorState.today?.plannedBlocks || 0} blocks</strong></span>
                  <span>Standard: <strong>{mentorState.today?.executionPercent || 0}%</strong></span>
                </div>
              </div>
            )}

            <button
              onClick={startSession}
              style={{
                width: '100%',
                background: '#0A64F5',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 14,
                padding: '16px 20px',
                fontSize: 16,
                fontWeight: 750,
                cursor: 'pointer',
                transition: '.2s ease'
              }}
            >
              🎙️ Start Live Voice Check-in (Gemini 3.8 Live + DeepSeek Brain)
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            
            {/* Live Call State Machine Indicator */}
            <div style={{ background: '#0D1117', border: '1px solid #202A36', borderRadius: 18, padding: 20, textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderRadius: 999, background: '#121923', border: '1px solid #202A36', marginBottom: 12 }}>
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: callState === CALL_STATES.MENTOR_SPEAKING ? '#16B364' :
                              callState === CALL_STATES.USER_SPEAKING ? '#D99100' :
                              callState === CALL_STATES.MENTOR_THINKING ? '#8B5CF6' : '#0A64F5'
                }} />
                <span style={{ fontSize: 13, fontWeight: 750 }}>
                  {callState === CALL_STATES.LISTENING && 'Listening to Moulika…'}
                  {callState === CALL_STATES.USER_SPEAKING && 'Moulika speaking…'}
                  {callState === CALL_STATES.MENTOR_THINKING && 'Mentor reasoning (DeepSeek Flash)…'}
                  {callState === CALL_STATES.MENTOR_SPEAKING && 'Mentor speaking (Gemini Live)…'}
                  {callState === CALL_STATES.INTERRUPTED && 'Interrupted — listening…'}
                  {callState === CALL_STATES.CONNECTING && 'Connecting voice gateway…'}
                  {callState === CALL_STATES.IDLE && 'Call ready'}
                </span>
              </div>

              {interimTranscript ? (
                <div style={{ color: '#D99100', fontSize: 14, fontStyle: 'italic', minHeight: 20 }}>
                  "{interimTranscript}"
                </div>
              ) : (
                <div style={{ color: '#95A1B3', fontSize: 12 }}>
                  Speaks Telugu, English or mixed code-switching naturally with instant interruption
                </div>
              )}

              {callState === CALL_STATES.MENTOR_SPEAKING && (
                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={handleManualInterrupt}
                    style={{
                      background: 'rgba(239,77,86,.15)',
                      border: '1px solid rgba(239,77,86,.4)',
                      color: '#EF4D56',
                      borderRadius: 10,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 750,
                      cursor: 'pointer'
                    }}
                  >
                    ⏹ Stop Speaking (Barge-in)
                  </button>
                </div>
              )}
            </div>

            {/* Conversation History / Transcript */}
            <div style={{ background: '#0D1117', border: '1px solid #202A36', borderRadius: 18, padding: 18, maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: m.role === 'mentor' ? 'flex-start' : 'flex-end',
                    background: m.role === 'mentor' ? '#121923' : '#0A64F5',
                    border: m.role === 'mentor' ? '1px solid #202A36' : 'none',
                    color: '#F8FAFC',
                    borderRadius: 14,
                    padding: '12px 16px',
                    maxWidth: '82%',
                    fontSize: 14,
                    lineHeight: 1.5
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
                    <strong>{m.role === 'mentor' ? 'Mentor' : 'Moulika'}</strong>
                    {m.role === 'mentor' && m.source && (
                      <span style={{ fontSize: 10, color: m.source === 'ai' ? '#0A64F5' : '#D99100' }}>
                        {m.source === 'ai' ? 'DeepSeek Flash' : 'Deterministic'}
                      </span>
                    )}
                  </div>
                  <div>{m.content}</div>
                </div>
              ))}
            </div>

            {/* Typed Fallback Input & Commitment Actions */}
            {session.status !== 'completed' ? (
              <div style={{ background: '#0D1117', border: '1px solid #202A36', borderRadius: 18, padding: 16 }}>
                <form onSubmit={handleInputSubmit} style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Speak naturally, or type your answer here…"
                    style={{
                      flex: 1,
                      background: '#121923',
                      border: '1px solid #202A36',
                      borderRadius: 12,
                      color: '#F8FAFC',
                      padding: '12px 14px',
                      fontSize: 13,
                      outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    style={{
                      background: '#0A64F5',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 12,
                      padding: '0 20px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      opacity: inputText.trim() ? 1 : 0.5
                    }}
                  >
                    Send
                  </button>
                </form>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <span style={{ color: '#95A1B3', fontSize: 12 }}>
                    Stage: <strong style={{ color: '#F8FAFC' }}>{session.currentStage}</strong>
                  </span>

                  {['first_block_commitment', 'csat_commitment', 'confirmation', 'close'].includes(session.currentStage) && (
                    <button
                      onClick={commitSession}
                      style={{
                        background: '#16B364',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 10,
                        padding: '8px 16px',
                        fontSize: 12,
                        fontWeight: 750,
                        cursor: 'pointer'
                      }}
                    >
                      Confirm Final Commitment & Complete
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(22,179,100,.15)', border: '1px solid rgba(22,179,100,.4)', borderRadius: 18, padding: 20, textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 6px', color: '#16B364' }}>Check-in Complete</h3>
                <p style={{ margin: '0 0 14px', color: '#D5DCE6', fontSize: 13 }}>
                  Your execution commitment has been saved. Begin your first study block.
                </p>
                <button
                  onClick={() => navigate('/plan')}
                  style={{
                    background: '#16B364',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 22px',
                    fontWeight: 750,
                    cursor: 'pointer'
                  }}
                >
                  Return to Plan Page
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

export default MentorCallSimulator;
