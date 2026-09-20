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
  const [monthlyUsage, setMonthlyUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorStage, setErrorStage] = useState(null); // specific error stage string

  // Debug & Dev Status Panel State
  const [micStatus, setMicStatus] = useState('FAILED'); // 'CONNECTED' | 'FAILED'
  const [micRms, setMicRms] = useState(0.0);
  const [voiceWsStatus, setVoiceWsStatus] = useState('CLOSED'); // 'CONNECTED' | 'CLOSED' | 'CONNECTING'
  const [geminiStatus, setGeminiStatus] = useState('WAITING'); // 'CONNECTED' | 'FAILED' | 'WAITING'
  const [speechDetected, setSpeechDetected] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [deepseekStatus, setDeepseekStatus] = useState('IDLE'); // 'IDLE' | 'RUNNING' | 'DONE' | 'FAILED'
  const [geminiAudioStatus, setGeminiAudioStatus] = useState('WAITING'); // 'WAITING' | 'RECEIVING'
  const [browserPlaybackStatus, setBrowserPlaybackStatus] = useState('IDLE'); // 'PLAYING' | 'BLOCKED' | 'IDLE'

  // Audio Pipeline References
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const micStreamRef = useRef(null);
  const processorNodeRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);

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
      setErrorStage(`Initialization failed: ${err.message}`);
      setCallState(CALL_STATES.ERROR);
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
    setVoiceWsStatus('CLOSED');
    setMicStatus('FAILED');
    setBrowserPlaybackStatus('IDLE');
  };

  const stopCurrentAudioPlayback = () => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch (_) {}
    }
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
    setBrowserPlaybackStatus('IDLE');
  };

  const initVoiceWebSocket = (activeSessionId) => {
    setVoiceWsStatus('CONNECTING');
    setCallState(CALL_STATES.CONNECTING);

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
      setVoiceWsStatus('CONNECTED');
      setCallState(CALL_STATES.CONNECTING);
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'state_change':
            if (data.state === 'MENTOR_THINKING') {
              setDeepseekStatus('RUNNING');
            } else if (data.state === 'MENTOR_SPEAKING') {
              setDeepseekStatus('DONE');
            }
            setCallState(data.state);
            break;

          case 'ready':
            setGeminiStatus('CONNECTED');
            setCallState(CALL_STATES.LISTENING);
            break;

          case 'interim_transcript':
            setPartialTranscript(data.text || '');
            setSpeechDetected(true);
            setCallState(CALL_STATES.USER_SPEAKING);
            break;

          case 'final_transcript':
            setPartialTranscript('');
            setFinalTranscript(data.text || '');
            setSpeechDetected(false);
            setDeepseekStatus('RUNNING');
            setCallState(CALL_STATES.MENTOR_THINKING);
            setMessages(prev => [...prev, { role: 'user', content: data.text }]);
            break;

          case 'mentor_reply':
            setDeepseekStatus('DONE');
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
            setGeminiAudioStatus('RECEIVING');
            setCallState(CALL_STATES.MENTOR_SPEAKING);
            scheduleAudioPlayback(data.audio || data.data, data.mimeType);
            break;

          case 'interrupted':
          case 'tts_interrupted':
            console.log('[VoiceClient] Barge-in interrupted — halting playback');
            stopCurrentAudioPlayback();
            setCallState(CALL_STATES.USER_SPEAKING);
            setSpeechDetected(true);
            break;

          case 'turn_complete':
          case 'tts_end':
            setGeminiAudioStatus('WAITING');
            setCallState(CALL_STATES.LISTENING);
            break;

          case 'error':
            console.error('[VoiceClient] Voice Error:', data.error);
            setErrorStage(data.error || 'Voice connection lost');
            setCallState(CALL_STATES.ERROR);
            break;
        }
      } catch (err) {
        console.error('[VoiceClient] Error parsing message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[VoiceClient] WebSocket Error:', err);
      setVoiceWsStatus('CLOSED');
      setErrorStage('Voice connection lost');
      setCallState(CALL_STATES.ERROR);
    };

    ws.onclose = () => {
      console.log('[VoiceClient] WebSocket closed');
      setVoiceWsStatus('CLOSED');
      if (callState !== CALL_STATES.ENDED) {
        setCallState(CALL_STATES.IDLE);
      }
    };
  };

  const startMicrophoneCapture = async () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      }

      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

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
      setMicStatus('CONNECTED');
      console.log('[VoiceClient] Microphone stream acquired');

      const source = audioCtx.createMediaStreamSource(stream);
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
        setMicRms(currentRms);

        const hasVoice = currentRms > 0.015;
        if (hasVoice && !speechDetected) {
          setSpeechDetected(true);
        } else if (!hasVoice && speechDetected && !partialTranscript) {
          setSpeechDetected(false);
        }

        // Convert Float32 to PCM16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(pcm16.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (micErr) {
      console.error('[VoiceClient] Microphone capture error:', micErr);
      setMicStatus('FAILED');
      setErrorStage('Microphone unavailable: ' + micErr.message);
      setCallState(CALL_STATES.ERROR);
    }
  };

  const scheduleAudioPlayback = async (base64Data, mimeType = 'audio/pcm;rate=24000') => {
    if (!base64Data) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContextClass();
      }

      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // Convert base64 to byte array
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      let audioBuffer = null;

      if (mimeType?.includes('audio/pcm')) {
        const sampleRate = mimeType.includes('rate=16000') ? 16000 : 24000;
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
        }
        audioBuffer = audioCtx.createBuffer(1, float32Array.length, sampleRate);
        audioBuffer.getChannelData(0).set(float32Array);
      } else {
        audioBuffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0));
      }

      if (audioBuffer) {
        const sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(audioCtx.destination);

        const currentTime = audioCtx.currentTime;
        const startTime = Math.max(currentTime, nextPlayTimeRef.current);
        sourceNode.start(startTime);
        nextPlayTimeRef.current = startTime + audioBuffer.duration;

        activeSourcesRef.current.push(sourceNode);
        setBrowserPlaybackStatus('PLAYING');

        sourceNode.onended = () => {
          activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== sourceNode);
          if (activeSourcesRef.current.length === 0 && audioCtx.currentTime >= nextPlayTimeRef.current - 0.05) {
            setBrowserPlaybackStatus('IDLE');
          }
        };
      }
    } catch (playErr) {
      console.warn('[VoiceClient] Audio playback error:', playErr);
      setBrowserPlaybackStatus('BLOCKED');
      setErrorStage('Audio playback blocked: ' + playErr.message);
      setCallState(CALL_STATES.ERROR);
    }
  };

  const startSession = async () => {
    try {
      setLoading(true);
      setErrorStage(null);

      // Pre-resume AudioContext on user gesture
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const res = await fetchWithAuth('/api/mentor/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayKey: mentorState?.dayKey || new Date().toISOString().split('T')[0] })
      });

      if (!res.ok) throw new Error('Failed to start mentor session');
      const data = await res.json();
      const newSession = {
        id: data.session.id,
        currentStage: data.session.current_stage,
        status: data.session.status
      };
      setSession(newSession);
      setMessages([data.initialMessage]);

      // Connect Voice Gateway & Start Mic
      initVoiceWebSocket(newSession.id);
      await startMicrophoneCapture();

    } catch (err) {
      setErrorStage(err.message);
      setCallState(CALL_STATES.ERROR);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSpeaker = async () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContextClass();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const testText = "Hello Moulika. Mentor voice is working.";
      console.log('[VoiceClient] Testing speaker with text:', testText);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        setDeepseekStatus('DONE');
        setGeminiAudioStatus('WAITING');
        wsRef.current.send(JSON.stringify({
          type: 'speak',
          text: testText
        }));
      } else {
        setErrorStage('Voice connection lost (WebSocket not open)');
        setCallState(CALL_STATES.ERROR);
      }
    } catch (err) {
      console.error('[VoiceClient] Test speaker error:', err);
      setErrorStage('Audio playback blocked: ' + err.message);
      setCallState(CALL_STATES.ERROR);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || !session || session.status === 'completed') return;

    stopCurrentAudioPlayback();
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setFinalTranscript(text);
    setDeepseekStatus('RUNNING');
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
      if (!res.ok) throw new Error('Mentor reasoning failed');
      const data = await res.json();

      setDeepseekStatus('DONE');
      const mentorMsg = {
        role: 'mentor',
        content: data.mentorReply,
        source: data.source
      };
      setMessages(prev => [...prev, mentorMsg]);
      setSession(prev => ({ ...prev, currentStage: data.session.current_stage, status: data.session.status }));

      // Request voice synthesis if WebSocket is active
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        setGeminiAudioStatus('WAITING');
        wsRef.current.send(JSON.stringify({ type: 'speak', text: data.mentorReply }));
      }

      fetchStateAndUsage();
    } catch (err) {
      console.error('[MentorCall] Send message error:', err);
      setDeepseekStatus('FAILED');
      setErrorStage('Mentor reasoning failed: ' + err.message);
      setCallState(CALL_STATES.ERROR);
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
      setErrorStage('Failed to save commitment: ' + err.message);
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

  // Helper calculation for live volume visualizer bar heights
  const normalizedLevel = Math.min(100, Math.round(micRms * 800));

  if (loading && !session) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#05070A', color: '#95A1B3' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🎙️</div>
          <div style={{ fontWeight: 700 }}>Connecting to MentorOS Voice Engine…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#05070A', color: '#F8FAFC', padding: '20px 16px 40px', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        
        {/* Top Header & Monthly Budget */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ color: '#0A64F5', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              MentorOS · Realtime Voice V2
            </div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: '#FFFFFF' }}>
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

        {/* Development Status Panel (Temporary for debugging & manual verification) */}
        <div style={{
          background: '#0B1017',
          border: '1px solid #1E293B',
          borderRadius: 14,
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: 12,
          fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid #1E293B', paddingBottom: 6 }}>
            <span style={{ fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              🛠️ Live Development Status Panel
            </span>
            <button
              onClick={handleTestSpeaker}
              style={{
                background: '#1E293B',
                color: '#38BDF8',
                border: '1px solid #38BDF8',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🔊 Test Mentor Speaker
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px 16px' }}>
            <div>
              <span style={{ color: '#64748B' }}>Mic: </span>
              <strong style={{ color: micStatus === 'CONNECTED' ? '#22C55E' : '#EF4444' }}>{micStatus}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Mic RMS: </span>
              <strong style={{ color: micRms > 0.01 ? '#38BDF8' : '#94A3B8' }}>{micRms.toFixed(4)}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Voice WS: </span>
              <strong style={{ color: voiceWsStatus === 'CONNECTED' ? '#22C55E' : voiceWsStatus === 'CONNECTING' ? '#F59E0B' : '#EF4444' }}>{voiceWsStatus}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Gemini: </span>
              <strong style={{ color: geminiStatus === 'CONNECTED' ? '#22C55E' : '#94A3B8' }}>{geminiStatus}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Speech detected: </span>
              <strong style={{ color: speechDetected ? '#22C55E' : '#64748B' }}>{speechDetected ? 'YES' : 'NO'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>DeepSeek: </span>
              <strong style={{ color: deepseekStatus === 'RUNNING' ? '#A855F7' : deepseekStatus === 'DONE' ? '#22C55E' : '#64748B' }}>{deepseekStatus}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Gemini audio: </span>
              <strong style={{ color: geminiAudioStatus === 'RECEIVING' ? '#38BDF8' : '#64748B' }}>{geminiAudioStatus}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Browser playback: </span>
              <strong style={{ color: browserPlaybackStatus === 'PLAYING' ? '#22C55E' : browserPlaybackStatus === 'BLOCKED' ? '#EF4444' : '#64748B' }}>{browserPlaybackStatus}</strong>
            </div>
          </div>

          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #1E293B', display: 'grid', gap: 4 }}>
            <div>
              <span style={{ color: '#64748B' }}>Partial transcript: </span>
              <span style={{ color: '#F8FAFC' }}>{partialTranscript ? `"${partialTranscript}"` : '(none)'}</span>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Final transcript: </span>
              <span style={{ color: '#38BDF8' }}>{finalTranscript ? `"${finalTranscript}"` : '(none)'}</span>
            </div>
          </div>
        </div>

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
            
            {/* UNMISTAKABLE VOICE STATE CARD */}
            <div style={{
              background: '#0D1117',
              border: callState === CALL_STATES.ERROR ? '1px solid #EF4444' :
                      callState === CALL_STATES.MENTOR_SPEAKING ? '1px solid #16B364' :
                      callState === CALL_STATES.USER_SPEAKING ? '1px solid #D99100' :
                      callState === CALL_STATES.MENTOR_THINKING ? '1px solid #8B5CF6' : '1px solid #202A36',
              borderRadius: 18,
              padding: 24,
              textAlign: 'center',
              boxShadow: callState === CALL_STATES.MENTOR_SPEAKING ? '0 0 25px rgba(22, 179, 100, 0.15)' :
                         callState === CALL_STATES.USER_SPEAKING ? '0 0 25px rgba(217, 145, 0, 0.15)' : 'none',
              transition: 'all .25s ease'
            }}>

              {/* 1. CONNECTING STATE */}
              {callState === CALL_STATES.CONNECTING && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(10, 100, 245, 0.15)', color: '#0A64F5', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#0A64F5', animation: 'pulse 1.5s infinite' }} />
                    Connecting
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#FFFFFF' }}>
                    Connecting to Mentor...
                  </h2>
                  <p style={{ margin: 0, color: '#95A1B3', fontSize: 13 }}>
                    Establishing secure voice gateway and AI audio link
                  </p>
                </div>
              )}

              {/* 2. LISTENING STATE */}
              {callState === CALL_STATES.LISTENING && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(10, 100, 245, 0.15)', color: '#0A64F5', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#0A64F5', animation: 'pulse 1.5s infinite' }} />
                    Ready
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#FFFFFF' }}>
                    Listening...
                  </h2>
                  <p style={{ margin: '0 0 16px', color: '#95A1B3', fontSize: 13 }}>
                    Speak naturally in Telugu, English or mixed code-switching
                  </p>

                  {/* LIVE MICROPHONE LEVEL METER / WAVEFORM */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, height: 40, margin: '0 auto', maxWidth: 280 }}>
                    {[...Array(16)].map((_, i) => {
                      const factor = Math.sin((i / 15) * Math.PI);
                      const barHeight = Math.max(6, Math.min(36, Math.round(normalizedLevel * factor * 1.5 + (micRms > 0.005 ? 6 : 0))));
                      return (
                        <div
                          key={i}
                          style={{
                            width: 6,
                            height: `${barHeight}px`,
                            borderRadius: 3,
                            background: micRms > 0.01 ? '#38BDF8' : '#334155',
                            transition: 'height 0.05s ease, background 0.1s ease'
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. USER SPEAKING STATE */}
              {callState === CALL_STATES.USER_SPEAKING && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(217, 145, 0, 0.15)', color: '#D99100', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#D99100', animation: 'pulse 0.8s infinite' }} />
                    Audio Detected
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#D99100' }}>
                    I can hear you...
                  </h2>
                  
                  {/* LIVE / INTERIM TRANSCRIPT */}
                  <div style={{
                    marginTop: 14,
                    padding: '14px 18px',
                    background: '#121923',
                    border: '1px solid #334155',
                    borderRadius: 14,
                    color: '#F8FAFC',
                    fontSize: 16,
                    fontWeight: 600,
                    fontStyle: 'italic',
                    minHeight: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {partialTranscript ? `"${partialTranscript}"` : 'Transcribing speech…'}
                  </div>

                  {/* Active Mic Level Meter */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, height: 28, marginTop: 14 }}>
                    {[...Array(16)].map((_, i) => {
                      const factor = Math.sin((i / 15) * Math.PI);
                      const barHeight = Math.max(6, Math.min(28, Math.round(normalizedLevel * factor * 1.5 + 8)));
                      return (
                        <div
                          key={i}
                          style={{
                            width: 6,
                            height: `${barHeight}px`,
                            borderRadius: 3,
                            background: '#D99100',
                            transition: 'height 0.05s ease'
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. MENTOR THINKING STATE */}
              {callState === CALL_STATES.MENTOR_THINKING && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', animation: 'pulse 1s infinite' }} />
                    DeepSeek Flash
                  </div>
                  
                  {finalTranscript && (
                    <div style={{ margin: '0 0 12px', fontSize: 15, color: '#94A3B8', fontWeight: 500 }}>
                      You said: <strong style={{ color: '#F8FAFC' }}>"{finalTranscript}"</strong>
                    </div>
                  )}

                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#8B5CF6' }}>
                    Mentor is thinking...
                  </h2>
                  <p style={{ margin: 0, color: '#95A1B3', fontSize: 13 }}>
                    Evaluating readiness targets and UPSC preparation state
                  </p>
                </div>
              )}

              {/* 5. MENTOR SPEAKING STATE */}
              {callState === CALL_STATES.MENTOR_SPEAKING && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(22, 179, 100, 0.15)', color: '#16B364', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#16B364', animation: 'pulse 0.6s infinite' }} />
                    Gemini 3.8 Live
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#16B364' }}>
                    Mentor is speaking...
                  </h2>
                  <p style={{ margin: '0 0 14px', color: '#95A1B3', fontSize: 13 }}>
                    Audible spoken delivery in natural code-switching voice
                  </p>

                  {/* Animated Soundwave / Speaker Visualizer */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, height: 36, marginBottom: 16 }}>
                    {[16, 28, 36, 24, 32, 18, 30, 36, 22, 34, 18].map((h, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: 6,
                          height: `${h}px`,
                          borderRadius: 3,
                          background: '#16B364',
                          animation: `soundwave 1s ease-in-out infinite alternate ${idx * 0.08}s`
                        }}
                      />
                    ))}
                  </div>

                  <div>
                    <button
                      onClick={handleManualInterrupt}
                      style={{
                        background: 'rgba(239,77,86,.15)',
                        border: '1px solid rgba(239,77,86,.4)',
                        color: '#EF4D56',
                        borderRadius: 10,
                        padding: '8px 18px',
                        fontSize: 13,
                        fontWeight: 750,
                        cursor: 'pointer'
                      }}
                    >
                      ⏹ Stop Speaking (Barge-in)
                    </button>
                  </div>
                </div>
              )}

              {/* 6. ERROR STATE */}
              {callState === CALL_STATES.ERROR && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
                    Stage Error
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#EF4444' }}>
                    {errorStage || 'Voice Error'}
                  </h2>
                  <p style={{ margin: '0 0 16px', color: '#95A1B3', fontSize: 13 }}>
                    Please grant microphone permission, check audio output, or reconnect.
                  </p>
                  <button
                    onClick={() => {
                      cleanupVoicePipeline();
                      startSession();
                    }}
                    style={{
                      background: '#EF4444',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 10,
                      padding: '10px 20px',
                      fontSize: 13,
                      fontWeight: 750,
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Reconnect Voice Engine
                  </button>
                </div>
              )}

              {/* Idle fallback */}
              {callState === CALL_STATES.IDLE && (
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, color: '#94A3B8' }}>
                    Voice session ready
                  </h2>
                </div>
              )}

            </div>

            {/* Conversation History / Transcript */}
            <div style={{ background: '#0D1117', border: '1px solid #202A36', borderRadius: 18, padding: 18, maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    placeholder="Speak naturally into microphone, or type your answer here…"
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.9); }
        }
        @keyframes soundwave {
          0% { height: 12px; }
          100% { height: 36px; }
        }
      `}</style>
    </div>
  );
}

export default MentorCallSimulator;
