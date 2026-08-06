import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../utils/auth';

function MentorCallSimulator() {
  const navigate = useNavigate();

  const [mentorState, setMentorState] = useState(null);
  const [session, setSession] = useState(null);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    fetchState();
    initSpeechRecognition();
    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const fetchState = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/api/mentor/state/today');
      if (!res.ok) throw new Error('Failed to fetch Mentor State');
      const data = await res.json();
      setMentorState(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  };

  const startSession = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/api/mentor/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dayKey: mentorState?.dayKey || new Date().toISOString().split('T')[0] })
      });
      if (!res.ok) throw new Error('Failed to start session');
      const data = await res.json();
      setSession({
        id: data.session.id,
        currentStage: data.session.current_stage,
        status: data.session.status
      });
      setMessages([data.initialMessage]);
      speakText(data.initialMessage.content);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || !session || session.status === 'completed' || isProcessing) return;

    stopSpeaking();
    setIsProcessing(true);

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    try {
      const res = await fetchWithAuth(`/api/mentor/sessions/${session.id}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: text, stage: session.currentStage, requestId: crypto.randomUUID() })
      });
      if (!res.ok) throw new Error('Failed to send message');
      const data = await res.json();

      const mentorMsg = {
        role: 'mentor',
        content: data.mentorReply,
        source: data.source,
        fallbackReason: data.metadata?.fallbackReason
      };
      setMessages(prev => [...prev, mentorMsg]);
      setSession(prev => ({ ...prev, currentStage: data.session.current_stage, status: data.session.status }));

      speakText(data.mentorReply);
    } catch (err) {
      console.error(err);
      // Fallback UI or retry handled conceptually; backend already falls back deterministically.
    } finally {
      setIsProcessing(false);
    }
  };

  const commitSession = async () => {
    try {
      const res = await fetchWithAuth(`/api/mentor/sessions/${session.id}/commit`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to commit session');
      setSession(prev => ({ ...prev, status: 'completed' }));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      stopSpeaking();
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const speakText = (text) => {
    if (synthRef.current) {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 0.9;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      synthRef.current.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const handleInputSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  if (loading && !session) return <div className="p-8 text-center text-gray-500">Loading Mentor State...</div>;
  if (error && !session) return <div className="p-8 text-center text-red-600">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Morning Mentor Check-in</h1>
        <p className="text-gray-600 mb-6">Review your state and align on today's execution.</p>

        {!session ? (
          <div>
            <div className="bg-blue-50 text-blue-900 p-4 rounded mb-6">
              <h2 className="font-semibold mb-2">Mentor State Summary</h2>
              {mentorState && (
                <ul className="list-disc pl-5 space-y-1">
                  <li>Active/Paused Priority: {mentorState.mentorCommand?.title}</li>
                  <li>Planned blocks: {mentorState.today.plannedBlocks}</li>
                  <li>Execution standard: {mentorState.today.executionPercent}%</li>
                </ul>
              )}
            </div>
            <button
              onClick={startSession}
              className="w-full bg-blue-600 text-white font-medium py-3 rounded hover:bg-blue-700 transition"
            >
              Start Mentor Check-in
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-[60vh]">
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 mb-4 p-4 bg-gray-50 rounded border">
              {messages.map((m, idx) => (
                <div key={idx} className={`p-3 rounded-lg max-w-[80%] ${m.role === 'mentor' ? 'bg-white border text-gray-800 self-start' : 'bg-blue-600 text-white self-end ml-auto'}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 12 }}>
                    <strong className="block text-xs opacity-75">{m.role === 'mentor' ? 'Mentor' : 'You'}</strong>
                    {m.role === 'mentor' && m.source && (
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${m.source === 'ai' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-850'}`}>
                        {m.source === 'ai' ? 'AI' : 'Safety fallback'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                    {m.content}
                  </div>
                  {m.role === 'mentor' && m.source === 'deterministic' && m.fallbackReason && (
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6, marginTop: 2, fontStyle: 'italic' }}>
                      Diagnostic: fallback reason = {m.fallbackReason}
                    </div>
                  )}
                </div>
              ))}
              {isProcessing && (
                <div className="p-3 rounded-lg max-w-[80%] bg-white border text-gray-800 self-start">
                  <strong className="block text-xs opacity-75 mb-1">Mentor</strong>
                  <span className="animate-pulse">Mentor is thinking...</span>
                </div>
              )}
            </div>

            {session.status !== 'completed' ? (
              <form onSubmit={handleInputSubmit} className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type your response..."
                    className="flex-1 border border-gray-300 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
                    disabled={isListening || isProcessing}
                  />

                  {recognitionRef.current && (
                    <button
                      type="button"
                      onClick={toggleListening}
                      disabled={isProcessing}
                      className={`px-4 py-2 rounded font-medium transition ${isListening ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} disabled:opacity-50`}
                    >
                      {isListening ? 'Stop Listening' : 'Speak'}
                    </button>
                  )}

                  <button type="submit" disabled={isProcessing || !inputText.trim()} className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">Send</button>
                </div>

                <div className="flex justify-between items-center text-sm text-gray-500">
                  {isSpeaking && (
                    <button type="button" onClick={stopSpeaking} className="text-red-500 hover:underline">
                      Stop Speaking
                    </button>
                  )}
                  {['first_block_commitment', 'csat_commitment', 'confirmation'].includes(session.currentStage) && (
                    <button type="button" onClick={commitSession} className="text-blue-600 font-semibold hover:underline ml-auto">
                      Confirm Final Commitment
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <div className="text-center p-6 bg-green-50 text-green-800 rounded">
                <h3 className="font-bold mb-2">Check-in Complete</h3>
                <p className="mb-4">Your commitment has been recorded. Focus on your execution.</p>
                <button onClick={() => navigate('/plan')} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
                  Return to Plan
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
