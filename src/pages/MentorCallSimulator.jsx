import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth, getAuthToken } from '../utils/auth';
import { BACKEND_URL } from '../config';

const CALL_STATES = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  READY: 'READY',
  LISTENING: 'LISTENING',
  USER_SPEAKING: 'USER_SPEAKING',
  PROCESSING_SPEECH: 'PROCESSING_SPEECH',
  TRANSCRIBING: 'TRANSCRIBING',
  MENTOR_THINKING: 'MENTOR_THINKING',
  MENTOR_GENERATING_VOICE: 'MENTOR_GENERATING_VOICE',
  MENTOR_SPEAKING: 'MENTOR_SPEAKING',
  INTERRUPTED: 'INTERRUPTED',
  ENDED: 'ENDED',
  ERROR: 'ERROR'
};

/**
 * Stateful audio resampler with continuous phase tracking and anti-aliasing integration.
 * Correctly resamples arbitrary hardware rates (48000Hz, 44100Hz, etc.) to 16000Hz mono Float32.
 */
class AudioResampler {
  constructor(inputSampleRate, targetSampleRate = 16000) {
    this.inputSampleRate = inputSampleRate;
    this.targetSampleRate = targetSampleRate;
    this.ratio = inputSampleRate / targetSampleRate;
    this.phase = 0;
    this.lastInputSample = 0;
  }

  reset() {
    this.phase = 0;
    this.lastInputSample = 0;
  }

  process(inputBuffer) {
    if (this.inputSampleRate === this.targetSampleRate || this.ratio === 1) {
      return inputBuffer;
    }

    const inputLen = inputBuffer.length;
    const ratio = this.ratio;
    let pos = this.phase;
    const maxOutLen = Math.ceil((inputLen - pos) / ratio) + 2;
    const output = new Float32Array(maxOutLen);
    let outIdx = 0;

    while (pos + ratio <= inputLen) {
      const start = pos;
      const end = pos + ratio;

      let sum = 0;
      let count = 0;

      const iStart = Math.floor(start);
      const iEnd = Math.floor(end);

      if (iStart === iEnd) {
        sum = (iStart >= 0 ? inputBuffer[iStart] : this.lastInputSample) * ratio;
        count = ratio;
      } else {
        const firstWeight = (iStart + 1) - start;
        sum += (iStart >= 0 ? inputBuffer[iStart] : this.lastInputSample) * firstWeight;
        count += firstWeight;

        for (let i = iStart + 1; i < iEnd; i++) {
          sum += inputBuffer[i];
          count += 1;
        }

        if (iEnd < inputLen) {
          const lastWeight = end - iEnd;
          sum += inputBuffer[iEnd] * lastWeight;
          count += lastWeight;
        }
      }

      output[outIdx++] = count > 0 ? (sum / count) : 0;
      pos += ratio;
    }

    this.phase = pos - inputLen;
    this.lastInputSample = inputBuffer[inputLen - 1] || 0;

    return output.subarray(0, outIdx);
  }
}

function MentorCallSimulator() {
  const navigate = useNavigate();

  const [mentorState, setMentorState] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [callState, setCallState] = useState(CALL_STATES.IDLE);
  const [monthlyUsage, setMonthlyUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorStage, setErrorStage] = useState(null);

  // Diagnostic Panel State
  const [micStatus, setMicStatus] = useState('DISCONNECTED'); // 'CONNECTED' | 'DISCONNECTED' | 'FAILED'
  const [micDeviceName, setMicDeviceName] = useState('DEFAULT / not detected');
  const [outputDeviceName, setOutputDeviceName] = useState('DEFAULT (System Speakers)');
  const [micRms, setMicRms] = useState(0.0);
  const [audioChunksSent, setAudioChunksSent] = useState(0);
  const [totalPcmSamplesSent, setTotalPcmSamplesSent] = useState(0);
  const [voiceWsStatus, setVoiceWsStatus] = useState('CLOSED'); // 'CONNECTED' | 'CLOSED' | 'CONNECTING'
  const [geminiStatus, setGeminiStatus] = useState('WAITING'); // 'CONNECTED' | 'FAILED' | 'WAITING'
  const [speechDetected, setSpeechDetected] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [deepseekStatus, setDeepseekStatus] = useState('IDLE'); // 'IDLE' | 'RUNNING' | 'DONE' | 'FAILED'
  const [deepseekReply, setDeepseekReply] = useState('');
  const [geminiOutputChunks, setGeminiOutputChunks] = useState(0);
  const [geminiOutputBytes, setGeminiOutputBytes] = useState(0);
  const [audioContextState, setAudioContextState] = useState('CLOSED'); // 'RUNNING' | 'SUSPENDED' | 'CLOSED'
  const [playbackQueueCount, setPlaybackQueueCount] = useState(0);
  const [browserPlaybackStatus, setBrowserPlaybackStatus] = useState('STOPPED'); // 'PLAYING' | 'STOPPED' | 'BLOCKED'
  const [speakerActivityLevel, setSpeakerActivityLevel] = useState(0); // 0-100 meter
  const [lastInterruptionReason, setLastInterruptionReason] = useState('None');

  // Session Duration & Cost Estimation
  const [sessionDurationSec, setSessionDurationSec] = useState(0);
  const sessionStartTimeRef = useRef(null);
  const sessionTimerRef = useRef(null);

  // Hard Standalone Test States
  const [micTestRunning, setMicTestRunning] = useState(false);
  const [micTestResult, setMicTestResult] = useState(null); // null | 'PASS' | 'FAIL'
  const [micTestTranscript, setMicTestTranscript] = useState('');
  
  const [speakerTestRunning, setSpeakerTestRunning] = useState(false);
  const [speakerTestResult, setSpeakerTestResult] = useState(null); // null | 'PASS' | 'FAIL'
  const [speakerTestChunks, setSpeakerTestChunks] = useState(0);
  const [speakerTestBytes, setSpeakerTestBytes] = useState(0);

  // Human Audio Verification State
  const [humanVerificationStatus, setHumanVerificationStatus] = useState('AWAITING HUMAN AUDIO CONFIRMATION');

  // Audio Pipeline References
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);
  const speakerAnalyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const processorNodeRef = useRef(null);
  const silenceGainNodeRef = useRef(null);
  const resamplerRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);
  const speakerMeterIntervalRef = useRef(null);
  const hangoverCounterRef = useRef(0);
  const voiceGenTimeoutRef = useRef(null);
  const speechFinalizeTimeoutRef = useRef(null);
  const userSpeechActiveRef = useRef(false);
  const lastVoiceActivityAtRef = useRef(0);
  const trailingSilenceFramesRef = useRef(0);
  const audioStreamOpenRef = useRef(false);
  const callStateRef = useRef(CALL_STATES.IDLE);
  const browserPlaybackStatusRef = useRef('STOPPED');
  const micStatusRef = useRef('DISCONNECTED');

  const updateCallState = useCallback((newState) => {
    callStateRef.current = newState;
    setCallState(newState);
  }, []);

  const startVoiceGenTimeout = useCallback(() => {
    if (voiceGenTimeoutRef.current) clearTimeout(voiceGenTimeoutRef.current);
    voiceGenTimeoutRef.current = setTimeout(() => {
      console.warn('[VoiceClient] 5s timeout: Gemini returned no audio');
      setErrorStage('Gemini returned no audio.');
      updateCallState(CALL_STATES.ERROR);
    }, 5000);
  }, [updateCallState]);

  const clearVoiceGenTimeout = useCallback(() => {
    if (voiceGenTimeoutRef.current) {
      clearTimeout(voiceGenTimeoutRef.current);
      voiceGenTimeoutRef.current = null;
    }
  }, []);

  const clearSpeechFinalizeTimeout = useCallback(() => {
    if (speechFinalizeTimeoutRef.current) {
      clearTimeout(speechFinalizeTimeoutRef.current);
      speechFinalizeTimeoutRef.current = null;
    }
  }, []);

  // Keep ref synchronized with state for real-time audio thread access
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    browserPlaybackStatusRef.current = browserPlaybackStatus;
  }, [browserPlaybackStatus]);

  useEffect(() => {
    micStatusRef.current = micStatus;
  }, [micStatus]);

  // Session timer management
  useEffect(() => {
    if (session && session.status !== 'completed') {
      sessionStartTimeRef.current = Date.now();
      sessionTimerRef.current = setInterval(() => {
        if (sessionStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
          setSessionDurationSec(elapsed);
        }
      }, 1000);
    } else {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    }
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [session]);

  // Helper to ensure AudioContext exists and is running
  const getOrCreateAudioContext = async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      // Create GainNode set to 1.0
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 1.0;
      gainNodeRef.current = gainNode;

      // Create AnalyserNode for live speaker meter
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      speakerAnalyserRef.current = analyser;

      gainNode.connect(analyser);
      analyser.connect(audioCtx.destination);
    }

    const audioCtx = audioContextRef.current;
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    setAudioContextState(audioCtx.state.toUpperCase());
    return audioCtx;
  };

  // Detect available audio output devices if supported
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        if (audioOutputs.length > 0 && audioOutputs[0].label) {
          setOutputDeviceName(audioOutputs[0].label);
        }
      }).catch(() => {});
    }
  }, []);

  // Speaker meter animation loop
  useEffect(() => {
    speakerMeterIntervalRef.current = setInterval(() => {
      if (speakerAnalyserRef.current && browserPlaybackStatus === 'PLAYING') {
        const dataArray = new Uint8Array(speakerAnalyserRef.current.frequencyBinCount);
        speakerAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setSpeakerActivityLevel(normalized);
      } else {
        setSpeakerActivityLevel(0);
      }
    }, 50);

    return () => {
      if (speakerMeterIntervalRef.current) clearInterval(speakerMeterIntervalRef.current);
    };
  }, [browserPlaybackStatus]);

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

  // On page mount: fetch state and usage ONLY. Do not connect WebSockets or mic.
  useEffect(() => {
    fetchStateAndUsage();
    return () => {
      cleanupVoicePipeline();
    };
  }, [fetchStateAndUsage]);

  const cleanupVoicePipeline = (reason = 'cleanup') => {
    clearVoiceGenTimeout();
    clearSpeechFinalizeTimeout();
    stopCurrentAudioPlayback(reason);
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (silenceGainNodeRef.current) {
      silenceGainNodeRef.current.disconnect();
      silenceGainNodeRef.current = null;
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
    if (resamplerRef.current) {
      resamplerRef.current.reset();
    }
    setVoiceWsStatus('CLOSED');
    setMicStatus('DISCONNECTED');
    setBrowserPlaybackStatus('STOPPED');
    setAudioContextState('CLOSED');
    setPlaybackQueueCount(0);
    setMicRms(0);
    setSpeechDetected(false);
    setTotalPcmSamplesSent(0);
  };

  const stopCurrentAudioPlayback = (reason = 'user_barge_in') => {
    if (activeSourcesRef.current.length > 0) {
      console.log(`[AudioPlayback] source.stop() called on ${activeSourcesRef.current.length} active nodes. Reason: ${reason}`);
      setLastInterruptionReason(reason);
    }
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch (_) {}
    }
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
    setBrowserPlaybackStatus('STOPPED');
    setPlaybackQueueCount(0);
  };

  const scheduleAudioPlayback = async (base64Data, mimeType = 'audio/pcm;rate=24000') => {
    if (!base64Data) return;

    try {
      const audioCtx = await getOrCreateAudioContext();

      // Convert base64 to byte array
      const binaryString = atob(base64Data);
      const byteLength = binaryString.length;
      setGeminiOutputChunks(prev => prev + 1);
      setGeminiOutputBytes(prev => prev + byteLength);

      let audioBuffer = null;

      if (mimeType?.includes('audio/pcm')) {
        const sampleRate = mimeType.includes('rate=16000') ? 16000 : 24000;
        const sampleCount = Math.floor(byteLength / 2);
        const float32Array = new Float32Array(sampleCount);

        // Robust little-endian 16-bit PCM decoding
        for (let i = 0; i < sampleCount; i++) {
          const low = binaryString.charCodeAt(i * 2);
          const high = binaryString.charCodeAt(i * 2 + 1);
          let int16 = (high << 8) | low;
          if (int16 >= 0x8000) int16 -= 0x10000;
          float32Array[i] = int16 / 32768.0;
        }

        audioBuffer = audioCtx.createBuffer(1, float32Array.length, sampleRate);
        audioBuffer.getChannelData(0).set(float32Array);
      } else {
        const bytes = new Uint8Array(byteLength);
        for (let i = 0; i < byteLength; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        audioBuffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0));
      }

      if (audioBuffer) {
        const sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;

        // Connect through GainNode (gain = 1.0) and Analyser to audioCtx.destination
        sourceNode.connect(gainNodeRef.current || audioCtx.destination);

        const currentTime = audioCtx.currentTime;
        const startTime = Math.max(currentTime, nextPlayTimeRef.current);
        sourceNode.start(startTime);
        nextPlayTimeRef.current = startTime + audioBuffer.duration;

        clearVoiceGenTimeout();
        updateCallState(CALL_STATES.MENTOR_SPEAKING);

        activeSourcesRef.current.push(sourceNode);
        setPlaybackQueueCount(activeSourcesRef.current.length);
        setBrowserPlaybackStatus('PLAYING');

        sourceNode.onended = () => {
          activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== sourceNode);
          setPlaybackQueueCount(activeSourcesRef.current.length);
          if (activeSourcesRef.current.length === 0 && audioCtx.currentTime >= nextPlayTimeRef.current - 0.05) {
            console.log('[TURN] mentor playback ended');
            console.log('[TURN] previous callState:', callStateRef.current);
            console.log('[TURN] browserPlaybackStatus:', browserPlaybackStatusRef.current);
            console.log('[TURN] setting state -> LISTENING');
            setBrowserPlaybackStatus('STOPPED');
            browserPlaybackStatusRef.current = 'STOPPED';
            updateCallState(CALL_STATES.LISTENING);
          }
        };
      }
    } catch (playErr) {
      console.warn('[VoiceClient] Audio playback error:', playErr);
      setBrowserPlaybackStatus('BLOCKED');
      setErrorStage('Audio playback blocked: ' + playErr.message);
      updateCallState(CALL_STATES.ERROR);
    }
  };

  const startMicrophoneCapture = async () => {
    try {
      const audioCtx = await getOrCreateAudioContext();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      micStreamRef.current = stream;
      setMicStatus('CONNECTED');
      
      const track = stream.getAudioTracks()[0];
      if (track && track.label) {
        setMicDeviceName(track.label);
      }
      console.log('[VoiceClient] Microphone stream acquired:', track?.label);

      // Initialize stateful resampler for hardware input sample rate -> 16000 Hz
      resamplerRef.current = new AudioResampler(audioCtx.sampleRate, 16000);
      console.log(`[VoiceClient] AudioResampler initialized: Input=${audioCtx.sampleRate}Hz -> Output=16000Hz (ratio: ${(audioCtx.sampleRate / 16000).toFixed(4)})`);

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      processorNodeRef.current = processor;

      // Silence GainNode to prevent microphone audio from feeding directly to speakers
      const silenceGain = audioCtx.createGain();
      silenceGain.gain.value = 0;
      silenceGainNodeRef.current = silenceGain;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate live RMS on raw microphone signal
        let sumSquares = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSquares += inputData[i] * inputData[i];
        }
        const currentRms = Math.sqrt(sumSquares / inputData.length);
        setMicRms(currentRms);

        const isSpeakingOrPlaying = 
          callStateRef.current === CALL_STATES.MENTOR_SPEAKING || 
          callStateRef.current === CALL_STATES.MENTOR_THINKING ||
          callStateRef.current === CALL_STATES.MENTOR_GENERATING_VOICE ||
          callStateRef.current === CALL_STATES.CONNECTING ||
          browserPlaybackStatusRef.current === 'PLAYING';

        const isVoiceActive = currentRms >= 0.012;

        if (isVoiceActive) {
          audioStreamOpenRef.current = true;
          userSpeechActiveRef.current = true;
          lastVoiceActivityAtRef.current = Date.now();
          trailingSilenceFramesRef.current = 20; // Send ~850ms of trailing silence after speech drops
          setSpeechDetected(true);

          if (callStateRef.current !== CALL_STATES.USER_SPEAKING && !isSpeakingOrPlaying) {
            updateCallState(CALL_STATES.USER_SPEAKING);
          }

          console.log(`[MIC-A] RMS threshold crossed: ${currentRms.toFixed(4)}`);
          console.log(`[MIC-B] callStateRef.current: ${callStateRef.current}`);
        } else if (userSpeechActiveRef.current) {
          if (trailingSilenceFramesRef.current > 0) {
            trailingSilenceFramesRef.current -= 1;
          } else {
            // Speech ended and trailing silence window completed
            userSpeechActiveRef.current = false;
            setSpeechDetected(false);

            // Send explicit audioStreamEnd signal to Gemini Live via WebSocket gateway once
            if (audioStreamOpenRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              console.log('[END-1] client VAD speech-end detected -> sending audio_stream_end');
              wsRef.current.send(JSON.stringify({ type: 'audio_stream_end' }));
              audioStreamOpenRef.current = false;
            }

            if (callStateRef.current === CALL_STATES.USER_SPEAKING || callStateRef.current === CALL_STATES.LISTENING) {
              console.log('[MIC] Trailing silence window completed. Setting state -> PROCESSING_SPEECH');
              updateCallState(CALL_STATES.PROCESSING_SPEECH);

              // Arm 3-second finalize timeout
              if (speechFinalizeTimeoutRef.current) clearTimeout(speechFinalizeTimeoutRef.current);
              speechFinalizeTimeoutRef.current = setTimeout(() => {
                if (callStateRef.current === CALL_STATES.PROCESSING_SPEECH || callStateRef.current === CALL_STATES.USER_SPEAKING) {
                  console.warn('[VoiceClient] 3s timeout: Speech audio reached Mentor, but Gemini did not finalize the transcript.');
                  setErrorStage('Speech audio reached Mentor, but Gemini did not finalize the transcript.');
                  updateCallState(CALL_STATES.ERROR);
                }
              }, 3000);
            }
          }
        }

        // Send audio while user is active OR while sending trailing silence
        const shouldSendAudio = !isSpeakingOrPlaying && (isVoiceActive || trailingSilenceFramesRef.current > 0);

        if (shouldSendAudio && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          // 1. Resample Float32 from hardware input sample rate to 16000 Hz
          const resampler = resamplerRef.current || new AudioResampler(audioCtx.sampleRate, 16000);
          const resampled16k = resampler.process(inputData);

          // 2. Convert 16kHz Float32 to signed PCM16 little-endian
          const pcm16 = new Int16Array(resampled16k.length);
          for (let i = 0; i < resampled16k.length; i++) {
            const s = Math.max(-1, Math.min(1, resampled16k[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          // 3. Compute output RMS for verification
          let outSumSq = 0;
          for (let i = 0; i < resampled16k.length; i++) {
            outSumSq += resampled16k[i] * resampled16k[i];
          }
          const outputRms = resampled16k.length > 0 ? Math.sqrt(outSumSq / resampled16k.length) : 0;

          console.log(`[MIC-C] In: ${inputData.length} samples (@${audioCtx.sampleRate}Hz, RMS=${currentRms.toFixed(4)}) -> Out: ${resampled16k.length} samples (@16000Hz, RMS=${outputRms.toFixed(4)}), PCM: ${pcm16.byteLength} B (isVoiceActive: ${isVoiceActive})`);
          wsRef.current.send(pcm16.buffer);
          console.log(`[MIC-D] PCM chunk sent through WebSocket`);
          setAudioChunksSent(prev => prev + 1);
          setTotalPcmSamplesSent(prev => prev + resampled16k.length);
        }
      };

      source.connect(processor);
      processor.connect(silenceGain);
      silenceGain.connect(audioCtx.destination);
    } catch (micErr) {
      console.error('[VoiceClient] Microphone capture error:', micErr);
      setMicStatus('FAILED');
      setErrorStage('Microphone unavailable: ' + micErr.message);
      setCallState(CALL_STATES.ERROR);
    }
  };

  // ==========================================
  // HARD TEST 1: TEST MICROPHONE
  // ==========================================
  const handleTestMicrophone = async () => {
    try {
      setMicTestRunning(true);
      setMicTestResult(null);
      setMicTestTranscript('');
      setErrorStage(null);

      await getOrCreateAudioContext();
      await startMicrophoneCapture();

      // Open WebSocket in test_mic mode
      const token = getAuthToken() || '';
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let host = window.location.host;
      if (BACKEND_URL && BACKEND_URL.startsWith('http')) {
        const urlObj = new URL(BACKEND_URL);
        host = urlObj.host;
      }

      const wsUrl = `${wsProto}//${host}/ws/mentor/voice?token=${encodeURIComponent(token)}&mode=test_mic`;
      console.log('[TestMic] Connecting to:', wsUrl);

      const testWs = new WebSocket(wsUrl);
      wsRef.current = testWs;
      setVoiceWsStatus('CONNECTING');

      testWs.onopen = () => {
        setVoiceWsStatus('CONNECTED');
        console.log('[TestMic] Connected');
      };

      testWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ready') {
            setGeminiStatus('CONNECTED');
          } else if (data.type === 'interim_transcript') {
            setPartialTranscript(data.text || '');
            setMicTestTranscript(data.text || '');
          } else if (data.type === 'final_transcript') {
            const heard = data.text || '';
            setFinalTranscript(heard);
            setMicTestTranscript(heard);
            setPartialTranscript('');
            if (heard.trim().length > 0) {
              setMicTestResult('PASS');
              // Automatically disconnect test after receiving transcript
              setTimeout(() => {
                handleStopMicrophoneTest();
              }, 1200);
            } else {
              setMicTestResult('FAIL');
            }
          }
        } catch (e) {
          console.error('[TestMic] Error parsing message:', e);
        }
      };

      testWs.onerror = (err) => {
        console.error('[TestMic] WS error:', err);
        setMicTestResult('FAIL');
      };

    } catch (err) {
      console.error('[TestMic] Failed to run mic test:', err);
      setMicTestResult('FAIL');
      setErrorStage('Mic test error: ' + err.message);
    }
  };

  const handleStopMicrophoneTest = () => {
    setMicTestRunning(false);
    if (!micTestResult && micTestTranscript.trim().length > 0) {
      setMicTestResult('PASS');
    }
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setVoiceWsStatus('CLOSED');
    setMicStatus('DISCONNECTED');
    setSpeechDetected(false);
  };

  // ==========================================
  // HARD TEST 2: TEST MENTOR SPEAKER
  // ==========================================
  const handleTestSpeaker = async () => {
    try {
      setSpeakerTestRunning(true);
      setSpeakerTestResult(null);
      setSpeakerTestChunks(0);
      setSpeakerTestBytes(0);
      setErrorStage(null);

      const audioCtx = await getOrCreateAudioContext();
      setAudioContextState(audioCtx.state.toUpperCase());

      const token = getAuthToken() || '';
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let host = window.location.host;
      if (BACKEND_URL && BACKEND_URL.startsWith('http')) {
        const urlObj = new URL(BACKEND_URL);
        host = urlObj.host;
      }

      const wsUrl = `${wsProto}//${host}/ws/mentor/voice?token=${encodeURIComponent(token)}&mode=test_speaker`;
      console.log('[TestSpeaker] Connecting to:', wsUrl);

      const testWs = new WebSocket(wsUrl);
      wsRef.current = testWs;
      setVoiceWsStatus('CONNECTING');

      const testSpeechText = "Hello Moulika. Mentor voice is working.";

      testWs.onopen = () => {
        setVoiceWsStatus('CONNECTED');
        console.log('[TestSpeaker] Connected, waiting for ready event...');
      };

      testWs.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ready') {
            setGeminiStatus('CONNECTED');
            testWs.send(JSON.stringify({
              type: 'speak',
              text: testSpeechText
            }));
          } else if (data.type === 'audio_chunk' || data.type === 'tts_audio') {
            const base64Data = data.audio || data.data;
            const chunkBytes = atob(base64Data).length;
            setSpeakerTestChunks(prev => prev + 1);
            setSpeakerTestBytes(prev => prev + chunkBytes);
            setSpeakerTestResult('PASS'); // Browser receives and schedules non-zero audio
            await scheduleAudioPlayback(base64Data, data.mimeType);
          } else if (data.type === 'turn_complete' || data.type === 'tts_end') {
            setSpeakerTestRunning(false);
            // Automatically close test WebSocket after delivery
            setTimeout(() => {
              if (testWs.readyState === WebSocket.OPEN) {
                testWs.close();
              }
              setVoiceWsStatus('CLOSED');
            }, 2500);
          }
        } catch (e) {
          console.error('[TestSpeaker] Error handling message:', e);
        }
      };

      testWs.onerror = (err) => {
        console.error('[TestSpeaker] WS error:', err);
        setSpeakerTestResult('FAIL');
        setSpeakerTestRunning(false);
      };

    } catch (err) {
      console.error('[TestSpeaker] Test speaker error:', err);
      setSpeakerTestResult('FAIL');
      setSpeakerTestRunning(false);
      setErrorStage('Speaker test error: ' + err.message);
    }
  };

  // ==========================================
  // REAL LIVE CALL PIPELINE
  // ==========================================
  const initVoiceWebSocket = (activeSessionId, openingGreeting = '') => {
    setVoiceWsStatus('CONNECTING');
    updateCallState(CALL_STATES.CONNECTING);

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
      updateCallState(CALL_STATES.READY);
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'state_change':
            if (data.state === 'MENTOR_THINKING') {
              setDeepseekStatus('RUNNING');
              clearVoiceGenTimeout();
              updateCallState(CALL_STATES.MENTOR_THINKING);
            } else if (data.state === 'MENTOR_GENERATING_VOICE') {
              setDeepseekStatus('DONE');
              startVoiceGenTimeout();
              updateCallState(CALL_STATES.MENTOR_GENERATING_VOICE);
            } else if (data.state === 'MENTOR_SPEAKING') {
              setDeepseekStatus('DONE');
              if (browserPlaybackStatusRef.current === 'PLAYING') {
                updateCallState(CALL_STATES.MENTOR_SPEAKING);
              }
            } else {
              updateCallState(data.state);
            }
            break;

          case 'ready':
            setGeminiStatus('CONNECTED');
            // Section E: Mentor must speak FIRST upon connection
            if (openingGreeting && openingGreeting.trim().length > 0) {
              console.log('[VoiceClient] Triggering opening mentor greeting first:', openingGreeting);
              startVoiceGenTimeout();
              updateCallState(CALL_STATES.MENTOR_GENERATING_VOICE);
              ws.send(JSON.stringify({ type: 'speak', text: openingGreeting }));
            } else {
              updateCallState(CALL_STATES.LISTENING);
            }
            break;

          case 'interim_transcript':
            setPartialTranscript(data.text || '');
            setSpeechDetected(true);
            updateCallState(CALL_STATES.USER_SPEAKING);
            break;

          case 'final_transcript':
            clearSpeechFinalizeTimeout();
            setPartialTranscript('');
            setFinalTranscript(data.text || '');
            setSpeechDetected(false);
            setDeepseekStatus('RUNNING');
            // Once final_transcript is received: USER_SPEAKING ends immediately -> MENTOR_THINKING
            updateCallState(CALL_STATES.MENTOR_THINKING);
            setMessages(prev => [...prev, { role: 'user', content: data.text }]);
            break;

          case 'mentor_reply':
            setDeepseekStatus('DONE');
            setDeepseekReply(data.reply || '');
            startVoiceGenTimeout();
            updateCallState(CALL_STATES.MENTOR_GENERATING_VOICE);
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
            clearVoiceGenTimeout();
            updateCallState(CALL_STATES.MENTOR_SPEAKING);
            scheduleAudioPlayback(data.audio || data.data, data.mimeType);
            break;

          case 'interrupted':
          case 'tts_interrupted':
            console.log('[VoiceClient] Barge-in interrupted — halting playback');
            stopCurrentAudioPlayback('user_barge_in');
            updateCallState(CALL_STATES.USER_SPEAKING);
            setSpeechDetected(true);
            break;

          case 'turn_complete':
          case 'tts_end':
            // If audio playback in Web Audio queue has finished, transition to LISTENING
            if (activeSourcesRef.current.length === 0 && browserPlaybackStatusRef.current === 'STOPPED') {
              console.log('[TURN] turn_complete received with empty audio queue -> setting LISTENING');
              updateCallState(CALL_STATES.LISTENING);
            }
            break;

          case 'error':
            console.error('[VoiceClient] Voice Error:', data.error);
            setErrorStage(data.error || 'Voice connection lost');
            updateCallState(CALL_STATES.ERROR);
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
      updateCallState(CALL_STATES.ERROR);
    };

    ws.onclose = () => {
      console.log('[VoiceClient] WebSocket closed');
      setVoiceWsStatus('CLOSED');
      if (callStateRef.current !== CALL_STATES.ENDED) {
        updateCallState(CALL_STATES.IDLE);
      }
    };
  };

  const startSession = async () => {
    try {
      setLoading(true);
      setErrorStage(null);

      // Pre-resume AudioContext on user gesture
      const audioCtx = await getOrCreateAudioContext();
      setAudioContextState(audioCtx.state.toUpperCase());

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

      const openingText = data.initialMessage?.content || "Good morning Moulika. How is your energy today?";
      setMessages([{ role: 'mentor', content: openingText, source: 'ai' }]);
      setDeepseekReply(openingText);

      // Connect Voice Gateway & Start Mic
      initVoiceWebSocket(newSession.id, openingText);
      await startMicrophoneCapture();

    } catch (err) {
      setErrorStage(err.message);
      updateCallState(CALL_STATES.ERROR);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || !session || session.status === 'completed') return;

    stopCurrentAudioPlayback('text_input_submitted');
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setFinalTranscript(text);
    setDeepseekStatus('RUNNING');
    updateCallState(CALL_STATES.MENTOR_THINKING);

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
      setDeepseekReply(data.mentorReply || '');
      const mentorMsg = {
        role: 'mentor',
        content: data.mentorReply,
        source: data.source
      };
      setMessages(prev => [...prev, mentorMsg]);
      setSession(prev => ({ ...prev, currentStage: data.session.current_stage, status: data.session.status }));

      // Request voice synthesis if WebSocket is active
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        startVoiceGenTimeout();
        updateCallState(CALL_STATES.MENTOR_GENERATING_VOICE);
        wsRef.current.send(JSON.stringify({ type: 'speak', text: data.mentorReply }));
      }

      fetchStateAndUsage();
    } catch (err) {
      console.error('[MentorCall] Send message error:', err);
      setDeepseekStatus('FAILED');
      setErrorStage('Mentor reasoning failed: ' + err.message);
      updateCallState(CALL_STATES.ERROR);
    }
  };

  const commitSession = async () => {
    try {
      const res = await fetchWithAuth(`/api/mentor/sessions/${session.id}/commit`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to commit session');
      setSession(prev => ({ ...prev, status: 'completed' }));
      cleanupVoicePipeline('session_committed');
    } catch (err) {
      console.error('[MentorCall] Commit error:', err);
      setErrorStage('Failed to save commitment: ' + err.message);
    }
  };

  const handleManualInterrupt = () => {
    stopCurrentAudioPlayback('manual_barge_in_button');
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_speaking' }));
    }
    updateCallState(CALL_STATES.USER_SPEAKING);
  };

  const handleInputSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const normalizedLevel = Math.min(100, Math.round(micRms * 800));

  // Compute live audio duration & session cost estimation
  const audioSecSent = Math.round((totalPcmSamplesSent / 16000) * 10) / 10;
  const audioSecReceived = Math.round(geminiOutputBytes / (24000 * 2) * 10) / 10;
  // Estimate cost: input audio ~₹0.003/sec, output audio ~₹0.012/sec, DeepSeek turn ~₹0.02
  const sessionEstimatedCostInr = Math.round((audioSecSent * 0.003 + audioSecReceived * 0.012 + (deepseekStatus === 'DONE' ? 0.02 : 0)) * 100) / 100;

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
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        
        {/* Top Header & Monthly Budget */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ color: '#0A64F5', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              MentorOS · Realtime Voice Self-Diagnosing Shell
            </div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: '#FFFFFF' }}>
              Moulika Voice Check-in
            </h1>
          </div>

          {monthlyUsage && (
            <div style={{ background: '#0D1117', border: '1px solid #202A36', borderRadius: 12, padding: '8px 14px', fontSize: 12 }}>
              <div style={{ color: '#95A1B3', marginBottom: 2 }}>Production AI Spend:</div>
              <div style={{ fontWeight: 800, color: '#16B364' }}>
                ₹{monthlyUsage.totalCostInr} / ₹{monthlyUsage.budgetInr}
                <span style={{ color: '#95A1B3', fontWeight: 500, marginLeft: 6 }}>
                  (Remaining: ₹{monthlyUsage.remainingInr})
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SECTION A: TWO EXPLICIT HARD TEST BUTTONS & CARDS BEFORE CALL */}
        {!session && (
          <div style={{ background: '#0B1017', border: '1px solid #1E293B', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
                🔬 Pre-Call Hardware & Audio Diagnostics
              </h3>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Zero cost until clicked · Auto-disconnects on completion</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
              
              {/* HARD TEST 1: MICROPHONE */}
              <div style={{ background: '#0F172A', border: micTestResult === 'PASS' ? '1px solid #22C55E' : '1px solid #334155', borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong style={{ fontSize: 14, color: '#38BDF8' }}>🎤 Test Microphone</strong>
                  {micTestResult && (
                    <span style={{
                      background: micTestResult === 'PASS' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                      color: micTestResult === 'PASS' ? '#22C55E' : '#EF4444',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800
                    }}>
                      {micTestResult}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: '#94A3B8', display: 'grid', gap: 4, marginBottom: 12 }}>
                  <div>Microphone: <strong style={{ color: micStatus === 'CONNECTED' ? '#22C55E' : '#64748B' }}>{micStatus}</strong></div>
                  <div>Input device: <strong style={{ color: '#F8FAFC' }}>{micDeviceName}</strong></div>
                  <div>Mic level: <strong style={{ color: micRms > 0.01 ? '#38BDF8' : '#64748B' }}>{micRms.toFixed(4)} RMS</strong></div>
                </div>

                {/* Live Mic Meter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 24, marginBottom: 12, background: '#090D14', padding: '0 8px', borderRadius: 6 }}>
                  {[...Array(20)].map((_, i) => {
                    const barHeight = Math.max(4, Math.min(20, Math.round(normalizedLevel * (i / 10 + 0.2))));
                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: `${barHeight}px`,
                          borderRadius: 2,
                          background: micRms > 0.01 ? '#38BDF8' : '#1E293B',
                          transition: 'height 0.05s ease'
                        }}
                      />
                    );
                  })}
                </div>

                {micTestRunning ? (
                  <div style={{ background: '#1E293B', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                    <div style={{ color: '#F59E0B', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      📢 Please say out loud:
                    </div>
                    <div style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 700, fontStyle: 'italic' }}>
                      "Testing MentorOS microphone."
                    </div>
                    {micTestTranscript && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#38BDF8' }}>
                        Gemini heard: <strong>"{micTestTranscript}"</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  micTestTranscript && (
                    <div style={{ background: '#131D2D', border: '1px solid #1E293B', borderRadius: 8, padding: 8, marginBottom: 10, fontSize: 12 }}>
                      Gemini heard: <strong style={{ color: '#38BDF8' }}>"{micTestTranscript}"</strong>
                    </div>
                  )
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  {!micTestRunning ? (
                    <button
                      onClick={handleTestMicrophone}
                      style={{
                        flex: 1,
                        background: '#0A64F5',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      🎤 Test Microphone
                    </button>
                  ) : (
                    <button
                      onClick={handleStopMicrophoneTest}
                      style={{
                        flex: 1,
                        background: '#EF4444',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ⏹ Finish Mic Test
                    </button>
                  )}
                </div>
              </div>

              {/* HARD TEST 2: SPEAKER */}
              <div style={{ background: '#0F172A', border: speakerTestResult === 'PASS' ? '1px solid #22C55E' : '1px solid #334155', borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong style={{ fontSize: 14, color: '#16B364' }}>🔊 Test Mentor Speaker</strong>
                  {speakerTestResult && (
                    <span style={{
                      background: speakerTestResult === 'PASS' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                      color: speakerTestResult === 'PASS' ? '#22C55E' : '#EF4444',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800
                    }}>
                      {speakerTestResult}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: '#94A3B8', display: 'grid', gap: 4, marginBottom: 12 }}>
                  <div>AudioContext: <strong style={{ color: audioContextState === 'RUNNING' ? '#22C55E' : '#F59E0B' }}>{audioContextState}</strong></div>
                  <div>Output device: <strong style={{ color: '#F8FAFC' }}>{outputDeviceName}</strong></div>
                  <div>Gemini chunks received: <strong style={{ color: '#F8FAFC' }}>{speakerTestChunks}</strong></div>
                  <div>Audio bytes received: <strong style={{ color: '#F8FAFC' }}>{speakerTestBytes} B</strong></div>
                  <div>Playback state: <strong style={{ color: browserPlaybackStatus === 'PLAYING' ? '#22C55E' : '#94A3B8' }}>{browserPlaybackStatus}</strong></div>
                </div>

                {/* Visible 0-100 Speaker Output Meter */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B', marginBottom: 3 }}>
                    <span>Speaker Output Activity Meter</span>
                    <strong style={{ color: speakerActivityLevel > 0 ? '#16B364' : '#64748B' }}>{speakerActivityLevel}%</strong>
                  </div>
                  <div style={{ background: '#090D14', height: 10, borderRadius: 5, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${speakerActivityLevel}%`,
                        height: '100%',
                        background: speakerActivityLevel > 50 ? '#16B364' : '#0A64F5',
                        transition: 'width 0.08s ease'
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={handleTestSpeaker}
                  disabled={speakerTestRunning}
                  style={{
                    width: '100%',
                    background: speakerTestRunning ? '#334155' : '#16B364',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: speakerTestRunning ? 'default' : 'pointer'
                  }}
                >
                  {speakerTestRunning ? '🔊 Playing Audio Test ("Hello Moulika...")...' : '🔊 Test Mentor Speaker'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* SECTION C: DIAGNOSTIC PANEL */}
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
              🛠️ Live Self-Diagnostic Panel
            </span>
            <div style={{ fontSize: 11, color: '#64748B', display: 'flex', gap: 12 }}>
              <span>Duration: <strong>{sessionDurationSec}s</strong></span>
              <span>Audio Sent: <strong>{audioSecSent}s</strong></span>
              <span>Est. Cost: <strong style={{ color: '#16B364' }}>₹{sessionEstimatedCostInr}</strong></span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px 14px' }}>
            <div>
              <span style={{ color: '#64748B' }}>Microphone: </span>
              <strong style={{ color: micStatus === 'CONNECTED' ? '#22C55E' : '#64748B' }}>{micStatus}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Mic RMS: </span>
              <strong style={{ color: micRms > 0.01 ? '#38BDF8' : '#94A3B8' }}>{micRms.toFixed(4)}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Audio chunks sent: </span>
              <strong style={{ color: '#F8FAFC' }}>{audioChunksSent}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Voice WebSocket: </span>
              <strong style={{ color: voiceWsStatus === 'CONNECTED' ? '#22C55E' : voiceWsStatus === 'CONNECTING' ? '#F59E0B' : '#64748B' }}>{voiceWsStatus}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Gemini Live: </span>
              <strong style={{ color: geminiStatus === 'CONNECTED' ? '#22C55E' : '#94A3B8' }}>{geminiStatus}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Speech detected: </span>
              <strong style={{ color: speechDetected ? '#22C55E' : '#64748B' }}>{speechDetected ? 'YES' : 'NO'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>DeepSeek: </span>
              <strong style={{ color: deepseekStatus === 'RUNNING' ? '#A855F7' : deepseekStatus === 'DONE' ? '#22C55E' : deepseekStatus === 'FAILED' ? '#EF4444' : '#64748B' }}>{deepseekStatus}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Gemini output chunks: </span>
              <strong style={{ color: '#F8FAFC' }}>{geminiOutputChunks}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Gemini output bytes: </span>
              <strong style={{ color: '#F8FAFC' }}>{geminiOutputBytes} B ({audioSecReceived}s)</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>AudioContext: </span>
              <strong style={{ color: audioContextState === 'RUNNING' ? '#22C55E' : '#64748B' }}>{audioContextState}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Playback queue: </span>
              <strong style={{ color: '#F8FAFC' }}>{playbackQueueCount}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Playback: </span>
              <strong style={{ color: browserPlaybackStatus === 'PLAYING' ? '#22C55E' : browserPlaybackStatus === 'BLOCKED' ? '#EF4444' : '#64748B' }}>{browserPlaybackStatus}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Interruption reason: </span>
              <strong style={{ color: '#94A3B8' }}>{lastInterruptionReason}</strong>
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
            {deepseekReply && (
              <div>
                <span style={{ color: '#64748B' }}>DeepSeek reply: </span>
                <span style={{ color: '#A855F7' }}>"{deepseekReply}"</span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION F: HUMAN VERIFICATION STATUS CARD */}
        <div style={{
          background: '#0D1117',
          border: humanVerificationStatus === 'CONFIRMED - AUDIO WORKING' ? '1px solid #16B364' : '1px solid #F59E0B',
          borderRadius: 14,
          padding: '12px 18px',
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>
              Physical Audio Verification
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: humanVerificationStatus === 'CONFIRMED - AUDIO WORKING' ? '#16B364' : '#F59E0B' }}>
              {humanVerificationStatus}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {humanVerificationStatus !== 'CONFIRMED - AUDIO WORKING' ? (
              <button
                onClick={() => setHumanVerificationStatus('CONFIRMED - AUDIO WORKING')}
                style={{
                  background: '#16B364',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 750,
                  cursor: 'pointer'
                }}
              >
                ✅ I Can Hear Mentor Voice Clearly
              </button>
            ) : (
              <button
                onClick={() => setHumanVerificationStatus('AWAITING HUMAN AUDIO CONFIRMATION')}
                style={{
                  background: '#1E293B',
                  color: '#94A3B8',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Reset Verification
              </button>
            )}
          </div>
        </div>

        {/* MAIN BODY: START CALL OR ACTIVE CALL INTERFACE */}
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
            
            {/* SECTION B: UNMISTAKABLE REAL CALL UI STATES */}
            <div style={{
              background: '#0D1117',
              border: callState === CALL_STATES.ERROR ? '1px solid #EF4444' :
                      callState === CALL_STATES.MENTOR_SPEAKING ? '1px solid #16B364' :
                      callState === CALL_STATES.USER_SPEAKING ? '1px solid #D99100' :
                      callState === CALL_STATES.TRANSCRIBING ? '1px solid #38BDF8' :
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
                    CONNECTING
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#FFFFFF' }}>
                    Connecting to Mentor...
                  </h2>
                  <p style={{ margin: 0, color: '#95A1B3', fontSize: 13 }}>
                    Establishing secure voice gateway and AI audio link
                  </p>
                </div>
              )}

              {/* 2. READY STATE */}
              {callState === CALL_STATES.READY && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
                    READY
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#FFFFFF' }}>
                    Mentor connected
                  </h2>
                  <p style={{ margin: 0, color: '#95A1B3', fontSize: 13 }}>
                    Audio channel initialized and ready for check-in
                  </p>
                </div>
              )}

              {/* 3. LISTENING STATE (Only shown if mic is connected & active) */}
              {callState === CALL_STATES.LISTENING && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(10, 100, 245, 0.15)', color: '#0A64F5', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#0A64F5', animation: 'pulse 1.5s infinite' }} />
                    LISTENING
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#FFFFFF' }}>
                    Listening to you...
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

              {/* 4. USER SPEAKING STATE */}
              {callState === CALL_STATES.USER_SPEAKING && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(217, 145, 0, 0.15)', color: '#D99100', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#D99100', animation: 'pulse 0.8s infinite' }} />
                    USER SPEAKING
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

              {/* 4.5 PROCESSING SPEECH STATE */}
              {callState === CALL_STATES.PROCESSING_SPEECH && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#38BDF8', animation: 'pulse 0.8s infinite' }} />
                    PROCESSING SPEECH
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#38BDF8' }}>
                    Finalizing your speech...
                  </h2>
                  <p style={{ margin: 0, color: '#95A1B3', fontSize: 13 }}>
                    Waiting for final utterance recognition from Gemini Live
                  </p>
                  {partialTranscript && (
                    <div style={{ marginTop: 12, fontSize: 14, color: '#F8FAFC', fontStyle: 'italic' }}>
                      "{partialTranscript}"
                    </div>
                  )}
                </div>
              )}

              {/* 5. TRANSCRIBING STATE */}
              {callState === CALL_STATES.TRANSCRIBING && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#38BDF8', animation: 'pulse 1s infinite' }} />
                    TRANSCRIBING
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#38BDF8' }}>
                    Understanding what you said...
                  </h2>
                  {finalTranscript && (
                    <div style={{ margin: '10px 0 0', fontSize: 15, color: '#F8FAFC', fontWeight: 600 }}>
                      "{finalTranscript}"
                    </div>
                  )}
                </div>
              )}

              {/* 6. MENTOR THINKING STATE */}
              {callState === CALL_STATES.MENTOR_THINKING && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', animation: 'pulse 1s infinite' }} />
                    MENTOR THINKING
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
                    DeepSeek Flash is evaluating readiness targets and UPSC preparation state
                  </p>
                </div>
              )}

              {/* 6.5 MENTOR GENERATING VOICE STATE */}
              {callState === CALL_STATES.MENTOR_GENERATING_VOICE && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', animation: 'pulse 0.8s infinite' }} />
                    MENTOR GENERATING VOICE
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#F59E0B' }}>
                    Generating mentor voice...
                  </h2>
                  <p style={{ margin: 0, color: '#95A1B3', fontSize: 13 }}>
                    Synthesizing audio stream from Gemini 3.8 Live
                  </p>
                </div>
              )}

              {/* 7. MENTOR SPEAKING STATE */}
              {callState === CALL_STATES.MENTOR_SPEAKING && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(22, 179, 100, 0.15)', color: '#16B364', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#16B364', animation: 'pulse 0.6s infinite' }} />
                    MENTOR SPEAKING
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#16B364' }}>
                    Mentor is speaking...
                  </h2>
                  <p style={{ margin: '0 0 14px', color: '#95A1B3', fontSize: 13 }}>
                    Gemini 3.8 Live spoken delivery in natural voice
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

              {/* 8. ERROR STATE */}
              {callState === CALL_STATES.ERROR && (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontSize: 13, fontWeight: 750, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
                    ERROR
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#EF4444' }}>
                    {errorStage || 'Speech audio reached Mentor, but Gemini did not finalize the transcript.'}
                  </h2>
                  <p style={{ margin: '0 0 16px', color: '#95A1B3', fontSize: 13 }}>
                    Speech audio reached Mentor, but Gemini did not finalize the transcript.
                  </p>
                  <button
                    onClick={() => {
                      cleanupVoicePipeline('reconnect');
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
