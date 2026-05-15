/**
 * CriticalVoiceAlert.jsx
 *
 * Watches live sensor data and automatically speaks AI-generated
 * voice alerts to the pilot when critical thresholds are detected.
 *
 * Triggers on:
 *  - turbulence SEVERE
 *  - icing CRITICAL
 *  - combined MODERATE turb + WARNING icing
 *  - flight condition "CRITICAL"
 *
 * Cooldown: 30 s between repeated alerts for the same trigger.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './CriticalVoiceAlert.module.css';

const BACKEND = 'http://localhost:5000';
const COOLDOWN_MS = 30_000; // 30 s between alerts for same trigger type

// ── TTS engine ─────────────────────────────────────────────────────
function speak(text, rate = 0.9) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate   = rate;
  utter.pitch  = 0.9;
  utter.volume = 1.0;
  // Prefer a clear, authoritative English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find(v => v.lang.startsWith('en') && v.name.includes('Google US')) ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang.startsWith('en'));
  if (preferred) utter.voice = preferred;
  window.speechSynthesis.speak(utter);
}

// ── Threshold detector ─────────────────────────────────────────────
function detectTrigger(hw, condition) {
  const turb = hw.turb_level || 'NONE';
  const ice  = hw.ice_level  || 'NONE';

  if (condition === 'CRITICAL')               return 'FLIGHT_CONDITION_CRITICAL';
  if (turb === 'SEVERE')                      return 'SEVERE_TURBULENCE';
  if (ice  === 'CRITICAL')                    return 'CRITICAL_ICING';
  if (turb === 'MODERATE' && ice === 'WARNING') return 'COMBINED_TURB_ICING';
  if ((hw.shake_dps ?? 0) > 45)               return 'HIGH_SHAKE_DETECTED';
  if ((hw.icing_pct ?? 0) > 75)               return 'ICING_THRESHOLD_EXCEEDED';
  return null;
}

const SEVERITY_META = {
  WARNING:  { color: '#f59e0b', icon: '⚠️', label: 'WARNING' },
  CRITICAL: { color: '#ef4444', icon: '🚨', label: 'CRITICAL' },
  MAYDAY:   { color: '#dc2626', icon: '🆘', label: 'MAYDAY'  },
};

// ══════════════════════════════════════════════════════════════════
export default function CriticalVoiceAlert({ hw = {}, condition = 'NORMAL' }) {
  const [alert,    setAlert]    = useState(null);   // current active alert data
  const [visible,  setVisible]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [muted,    setMuted]    = useState(false);
  const [history,  setHistory]  = useState([]);

  // Track cooldowns per trigger type
  const cooldownMap  = useRef({});
  const lastTrigger  = useRef(null);

  // ── Load voices lazily (Chrome needs an interaction first) ─────
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () =>
        window.speechSynthesis.getVoices();
    }
  }, []);

  // ── Fetch AI alert from backend ────────────────────────────────
  const fetchAlert = useCallback(async (trigger) => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/voice-alert/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hw, trigger }),
      });
      const data = await res.json();

      if (data.ok) {
        const entry = {
          ...data,
          ts: new Date().toLocaleTimeString(),
          trigger,
        };
        setAlert(entry);
        setVisible(true);
        setHistory(h => [entry, ...h].slice(0, 8)); // keep last 8

        if (!muted) {
          speak(data.spoken_alert);
        }
      }
    } catch (err) {
      console.error('[CriticalVoiceAlert] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [hw, muted]);

  // ── Watch hw + condition for threshold breaches ────────────────
  useEffect(() => {
    const trigger = detectTrigger(hw, condition);
    if (!trigger) return;

    const now = Date.now();
    const lastFired = cooldownMap.current[trigger] || 0;
    if (now - lastFired < COOLDOWN_MS) return; // still in cooldown

    cooldownMap.current[trigger] = now;
    lastTrigger.current = trigger;
    fetchAlert(trigger);
  }, [hw.turb_level, hw.ice_level, hw.shake_dps, hw.icing_pct, condition]);

  // ── Dismiss after 20 s automatically ──────────────────────────
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setVisible(false), 20_000);
    return () => clearTimeout(id);
  }, [visible, alert]);

  const dismiss = () => {
    setVisible(false);
    window.speechSynthesis?.cancel();
  };

  const replayAlert = () => {
    if (alert?.spoken_alert && !muted) speak(alert.spoken_alert);
  };

  const meta = SEVERITY_META[alert?.severity] || SEVERITY_META.WARNING;

  return (
    <>
      {/* ── Active critical alert banner ──────────────────────── */}
      {visible && alert && (
        <div
          className={`${styles.alertBanner} ${styles[`sev_${alert.severity}`]}`}
          role="alert"
          aria-live="assertive"
        >
          {/* Pulsing severity bar */}
          <div className={styles.severityBar} style={{ background: meta.color }} />

          <div className={styles.alertInner}>
            {/* Header */}
            <div className={styles.alertHeader}>
              <span className={styles.alertIcon}>{meta.icon}</span>
              <div className={styles.alertTitles}>
                <span className={styles.alertLabel}
                  style={{ color: meta.color }}>
                  {meta.label} — PILOT ATTENTION
                </span>
                <span className={styles.alertTrigger}>{alert.trigger?.replace(/_/g, ' ')}</span>
              </div>
              <div className={styles.alertHeaderActions}>
                {loading && <span className={styles.spinner} />}
                <button className={styles.iconBtn} onClick={replayAlert} title="Replay voice">
                  🔊
                </button>
                <button className={styles.iconBtn} onClick={dismiss} title="Dismiss">✕</button>
              </div>
            </div>

            {/* Spoken alert text */}
            <p className={styles.spokenText}>{alert.spoken_alert}</p>

            {/* Action cards */}
            <div className={styles.actionCards}>
              <div className={styles.actionCard} style={{ borderColor: `${meta.color}60` }}>
                <span className={styles.actionCardLabel}>IMMEDIATE ACTION</span>
                <span className={styles.actionCardText}>{alert.immediate_action}</span>
              </div>
              <div className={styles.actionCard} style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                <span className={styles.actionCardLabel}>SECONDARY ACTION</span>
                <span className={styles.actionCardText}>{alert.secondary_action}</span>
              </div>
            </div>

            {/* Footer */}
            <div className={styles.alertFooter}>
              <span className={styles.alertTime}>🕐 {alert.ts}</span>
              <span className={styles.condSummary}>{alert.condition_summary}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Mute toggle + history indicator (always visible) ──── */}
      <div className={styles.controlBar}>
        {/* Loading pulse */}
        {loading && (
          <div className={styles.loadingChip}>
            <span className={styles.loadDot} />
            Generating AI Alert…
          </div>
        )}

        {/* Alert history count badge */}
        {history.length > 0 && !visible && (
          <button
            className={styles.historyBtn}
            onClick={() => { setAlert(history[0]); setVisible(true); }}
            title="Show last alert"
          >
            🚨 {history.length} alert{history.length > 1 ? 's' : ''}
          </button>
        )}

        {/* Mute toggle */}
        <button
          className={`${styles.muteBtn} ${muted ? styles.muteBtnActive : ''}`}
          onClick={() => setMuted(m => !m)}
          title={muted ? 'Unmute voice alerts' : 'Mute voice alerts'}
        >
          {muted ? '🔇 Alerts muted' : '🔔 Voice alerts ON'}
        </button>
      </div>
    </>
  );
}
