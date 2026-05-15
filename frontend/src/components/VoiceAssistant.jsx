/**
 * VoiceAssistant.jsx
 * Pilot voice assistant — push-to-talk using Web Speech API + Groq AI.
 *
 * Features:
 *  - Press mic button (or hold Space) to speak
 *  - Live transcript shown while listening
 *  - Groq AI responds with aviation context
 *  - Triggers actions: REROUTE, SHOW_WEATHER, SHOW_STATUS, EMERGENCY
 *  - Browser TTS reads the AI response aloud
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './VoiceAssistant.module.css';

const BACKEND = 'http://localhost:5000';

// ── Browser speech synthesis (TTS) ────────────────────────────────
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate   = 0.95;
  utter.pitch  = 1.0;
  utter.volume = 1.0;
  // Prefer a clear English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))
  ) || voices.find(v => v.lang.startsWith('en'));
  if (preferred) utter.voice = preferred;
  window.speechSynthesis.speak(utter);
}

// ── Action icons ───────────────────────────────────────────────────
const ACTION_META = {
  REROUTE:      { icon: '🛣️',  label: 'Rerouting...',    color: '#f59e0b' },
  SHOW_WEATHER: { icon: '🌤️',  label: 'Weather data',   color: '#60c8ff' },
  SHOW_STATUS:  { icon: '📊',  label: 'Systems check',  color: '#a78bfa' },
  EMERGENCY:    { icon: '🚨',  label: 'EMERGENCY',      color: '#ef4444' },
  SHOW_RADAR:   { icon: '📡',  label: 'Radar view',     color: '#34d399' },
  NONE:         { icon: '💬',  label: 'Response',       color: '#94a3b8' },
};

const URGENCY_COLOR = {
  NONE:     '#22c55e',
  LOW:      '#34d399',
  MEDIUM:   '#f59e0b',
  HIGH:     '#f97316',
  CRITICAL: '#ef4444',
};

// ── Suggested quick commands ───────────────────────────────────────
const QUICK_CMDS = [
  'Flight status',
  'Any icing risk?',
  'Request reroute',
  'Weather conditions',
  'Check radar',
  'Mayday assistance',
];

export default function VoiceAssistant({ flightState = {} }) {
  const [isOpen,       setIsOpen]       = useState(false);
  const [isListening,  setIsListening]  = useState(false);
  const [transcript,   setTranscript]   = useState('');
  const [processing,   setProcessing]   = useState(false);
  const [aiResponse,   setAiResponse]   = useState(null);  // { response, action, urgency, summary }
  const [history,      setHistory]      = useState([]);    // [{role, text, action, urgency}]
  const [error,        setError]        = useState('');
  const [ttsEnabled,   setTtsEnabled]   = useState(true);

  const recognitionRef = useRef(null);
  const historyEndRef  = useRef(null);

  // ── Scroll history to bottom ────────────────────────────────────
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // ── Space bar push-to-talk ──────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && isOpen && !isListening && !processing) {
        e.preventDefault();
        startListening();
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space' && isListening) {
        stopListening();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, [isOpen, isListening, processing]);

  // ── Init speech recognition ────────────────────────────────────
  const buildRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const rec = new SR();
    rec.lang           = 'en-US';
    rec.continuous     = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += text;
        else interim += text;
      }
      setTranscript(final || interim);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onerror = (e) => {
      setIsListening(false);
      setError(`Mic error: ${e.error}`);
    };

    return rec;
  }, []);

  // ── Start listening ────────────────────────────────────────────
  const startListening = useCallback(() => {
    setError('');
    setTranscript('');
    setAiResponse(null);

    const rec = buildRecognition();
    if (!rec) {
      setError('Speech recognition not supported. Try Chrome or Edge.');
      return;
    }
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [buildRecognition]);

  // ── Stop and send ──────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // ── Send transcript to Groq when listening ends ────────────────
  useEffect(() => {
    if (!isListening && transcript.trim().length > 2) {
      sendToGroq(transcript.trim());
    }
  }, [isListening]);

  const sendToGroq = async (text) => {
    setProcessing(true);
    setError('');

    // Add pilot message to history
    setHistory(h => [...h, { role: 'pilot', text, ts: new Date().toLocaleTimeString() }]);

    try {
      const res = await fetch(`${BACKEND}/api/voice-assist/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, flight_state: flightState }),
      });
      const data = await res.json();

      if (data.ok) {
        const aiMsg = {
          role:    'ai',
          text:    data.response,
          action:  data.action  || 'NONE',
          urgency: data.urgency || 'NONE',
          summary: data.summary || '',
          ts:      new Date().toLocaleTimeString(),
        };
        setAiResponse(aiMsg);
        setHistory(h => [...h, aiMsg]);
        if (ttsEnabled) speak(data.response);
      } else {
        setError(data.error || 'AI unavailable');
      }
    } catch {
      setError('Cannot reach backend. Is Flask running?');
    } finally {
      setProcessing(false);
      setTranscript('');
    }
  };

  const handleQuickCmd = (cmd) => {
    setTranscript(cmd);
    sendToGroq(cmd);
  };

  const isSpeechSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  return (
    <>
      {/* ── Floating mic button ──────────────────────────────── */}
      <button
        className={`${styles.fab} ${isListening ? styles.fabListening : ''} ${isOpen ? styles.fabOpen : ''}`}
        onClick={() => {
          if (!isOpen) { setIsOpen(true); return; }
          if (isListening) stopListening();
          else startListening();
        }}
        title={isOpen ? (isListening ? 'Stop (Space)' : 'Speak (Space)') : 'Open Voice Assistant'}
        aria-label="Pilot voice assistant"
      >
        {isListening ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="4" width="3" height="16" rx="1.5" fill="currentColor"/>
            <rect x="11" y="2" width="3" height="20" rx="1.5" fill="currentColor" opacity="0.7"/>
            <rect x="16" y="6" width="3" height="12" rx="1.5" fill="currentColor" opacity="0.5"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/>
            <path d="M5 10a7 7 0 0014 0" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" fill="none"/>
            <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="9"  y1="22" x2="15" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )}
      </button>

      {/* ── Voice assistant panel ────────────────────────────── */}
      {isOpen && (
        <div className={styles.panel}>

          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={`${styles.statusDot} ${isListening ? styles.dotListening : processing ? styles.dotProcessing : styles.dotIdle}`} />
              <span className={styles.headerTitle}>SkyPilot Voice</span>
              <span className={styles.headerSub}>
                {isListening ? 'Listening...' : processing ? 'Processing...' : 'Ready'}
              </span>
            </div>
            <div className={styles.headerActions}>
              <button
                className={`${styles.iconBtn} ${ttsEnabled ? styles.iconBtnActive : ''}`}
                onClick={() => setTtsEnabled(t => !t)}
                title={ttsEnabled ? 'Mute voice' : 'Enable voice'}
              >
                {ttsEnabled ? '🔊' : '🔇'}
              </button>
              <button className={styles.iconBtn} onClick={() => setIsOpen(false)} title="Close">✕</button>
            </div>
          </div>

          {/* Conversation history */}
          <div className={styles.history}>
            {history.length === 0 && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🎙️</div>
                <p>Press the mic button or hold <kbd>Space</kbd> to speak.</p>
                <p className={styles.emptyHint}>I can help with rerouting, weather, system status, and more.</p>
              </div>
            )}
            {history.map((msg, i) => (
              <div key={i} className={`${styles.msg} ${msg.role === 'pilot' ? styles.msgPilot : styles.msgAi}`}>
                {msg.role === 'ai' && (
                  <div className={styles.msgMeta}>
                    <span className={styles.actionChip}
                      style={{ color: ACTION_META[msg.action]?.color, borderColor: `${ACTION_META[msg.action]?.color}44` }}>
                      {ACTION_META[msg.action]?.icon} {ACTION_META[msg.action]?.label}
                    </span>
                    {msg.urgency !== 'NONE' && (
                      <span className={styles.urgencyChip}
                        style={{ color: URGENCY_COLOR[msg.urgency], borderColor: `${URGENCY_COLOR[msg.urgency]}44` }}>
                        {msg.urgency}
                      </span>
                    )}
                    <span className={styles.msgTime}>{msg.ts}</span>
                  </div>
                )}
                <div className={styles.msgBubble}>
                  {msg.role === 'pilot' && <span className={styles.pilotLabel}>You  </span>}
                  {msg.text}
                </div>
                {msg.role === 'pilot' && <span className={styles.msgTime}>{msg.ts}</span>}
              </div>
            ))}

            {/* Live transcript while listening */}
            {isListening && transcript && (
              <div className={`${styles.msg} ${styles.msgPilot}`}>
                <div className={`${styles.msgBubble} ${styles.liveTranscript}`}>
                  <span className={styles.pilotLabel}>You  </span>
                  {transcript}
                  <span className={styles.cursor}>|</span>
                </div>
              </div>
            )}

            {processing && (
              <div className={`${styles.msg} ${styles.msgAi}`}>
                <div className={`${styles.msgBubble} ${styles.thinkingBubble}`}>
                  <span className={styles.dot1}>●</span>
                  <span className={styles.dot2}>●</span>
                  <span className={styles.dot3}>●</span>
                </div>
              </div>
            )}

            <div ref={historyEndRef} />
          </div>

          {/* Error */}
          {error && <div className={styles.error}>{error}</div>}

          {/* Quick commands */}
          {!isListening && !processing && (
            <div className={styles.quickCmds}>
              {QUICK_CMDS.map(cmd => (
                <button key={cmd} className={styles.quickBtn} onClick={() => handleQuickCmd(cmd)}>
                  {cmd}
                </button>
              ))}
            </div>
          )}

          {/* Main mic button */}
          <div className={styles.footer}>
            {!isSpeechSupported ? (
              <p className={styles.noSupport}>Speech not supported — use Chrome or Edge</p>
            ) : (
              <button
                className={`${styles.micBtn} ${isListening ? styles.micBtnActive : ''}`}
                onMouseDown={startListening}
                onMouseUp={stopListening}
                onTouchStart={startListening}
                onTouchEnd={stopListening}
                disabled={processing}
              >
                {isListening ? (
                  <>
                    <span className={styles.micRing} />
                    <span className={styles.micRing2} />
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/>
                      <path d="M5 10a7 7 0 0014 0" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" fill="none"/>
                      <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Release to send
                  </>
                ) : (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/>
                      <path d="M5 10a7 7 0 0014 0" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" fill="none"/>
                      <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Hold to speak  ·  or press Space
                  </>
                )}
              </button>
            )}
            {history.length > 0 && (
              <button className={styles.clearBtn} onClick={() => { setHistory([]); setAiResponse(null); }}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
