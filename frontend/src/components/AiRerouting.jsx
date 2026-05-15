/**
 * AiRerouting.jsx
 * AI rerouting panel — Groq LLM + interactive Leaflet map.
 * Falls back to rule-based logic if API key not configured.
 */
import { useState, useEffect, useRef } from 'react';
import styles from './AiRerouting.module.css';
import RouteMap from './RouteMap';

const BACKEND = 'http://localhost:5000';

// ── Rule-based fallback ────────────────────────────────────────────
function ruleBasedReroute(turbLevel, iceLevel, distanceCm) {
  if (iceLevel === 'CRITICAL' || turbLevel === 'SEVERE') {
    return {
      active:      true,
      severity:    'critical',
      badge:       'IMMEDIATE REROUTE',
      reason:      iceLevel === 'CRITICAL'
        ? `Critical icing — sensor distance ${distanceCm != null ? distanceCm.toFixed(0) : '?'} cm`
        : 'Severe turbulence — gyro limit exceeded',
      heading:     '+28°',
      altitude:    turbLevel === 'SEVERE' ? 'Descend to FL300' : 'Climb to FL410',
      speed:       '-20 kts (turbulence penetration)',
      deviation:   48,
      accentColor: '#ef4444',
    };
  }
  if (iceLevel === 'WARNING' || turbLevel === 'MODERATE') {
    return {
      active:      true,
      severity:    'warning',
      badge:       'RECOMMENDED REROUTE',
      reason:      iceLevel === 'WARNING'
        ? `Icing warning — sensor distance ${distanceCm != null ? distanceCm.toFixed(0) : '?'} cm`
        : 'Moderate turbulence — caution advised',
      heading:     '+14°',
      altitude:    'Climb to FL400',
      speed:       'Maintain current speed',
      deviation:   28,
      accentColor: '#f59e0b',
    };
  }
  return { active: false, accentColor: '#22c55e', deviation: 0 };
}

// ── Main component ─────────────────────────────────────────────────
export default function AiRerouting({
  turbLevel   = 'NONE',
  iceLevel    = 'NONE',
  distanceCm  = null,
  shakeDps    = 0,
  tiltDeg     = 0,
  departure   = 'BLR',
  destination = 'DEL',
}) {
  const [aiRoute, setAiRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const debounceRef = useRef(null);

  // Call Groq API on condition change (debounced 2s)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setAiError(false);
      try {
        const res = await fetch(`${BACKEND}/api/reroute/`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            turb_level:  turbLevel,
            ice_level:   iceLevel,
            distance_cm: distanceCm ?? 999,
            shake_dps:   shakeDps,
            tilt_deg:    tiltDeg,
          }),
        });
        const data = await res.json();
        if (data.ok) setAiRoute(data.recommendation);
        else         setAiError(true);
      } catch {
        setAiError(true);
      } finally {
        setLoading(false);
      }
    }, 2000);
    return () => clearTimeout(debounceRef.current);
  }, [turbLevel, iceLevel, distanceCm]);

  // Map Groq response → display object (or rule-based fallback)
  const fallback = ruleBasedReroute(turbLevel, iceLevel, distanceCm);
  const route = aiRoute
    ? {
        active:      aiRoute.action !== 'NORMAL',
        severity:    aiRoute.urgency === 'HIGH' ? 'critical' : aiRoute.urgency === 'MEDIUM' ? 'warning' : 'safe',
        badge:       aiRoute.action,
        reason:      aiRoute.reason,
        heading:     aiRoute.heading_change,
        altitude:    aiRoute.altitude_change,
        speed:       aiRoute.speed_adjustment,
        deviation:   aiRoute.urgency === 'HIGH' ? 48 : aiRoute.urgency === 'MEDIUM' ? 28 : 0,
        accentColor: aiRoute.urgency === 'HIGH' ? '#ef4444' : aiRoute.urgency === 'MEDIUM' ? '#f59e0b' : '#22c55e',
        pilotNote:   aiRoute.pilot_note,
      }
    : fallback;

  return (
    <div className={`${styles.card} ${route.active ? styles[route.severity] : styles.safe}`}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={styles.titleIcon}>
            <path d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"
              stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <span className={styles.titleText}>AI Flight Rerouting</span>
          <span className={styles.liveChip}>
            {loading ? '⟳ THINKING...' : aiError ? '⚠ FALLBACK' : '● GROQ AI'}
          </span>
        </div>

        {route.active ? (
          <div className={styles.badge}
            style={{ color: route.accentColor, borderColor: route.accentColor, background: `${route.accentColor}14` }}>
            {route.severity === 'critical' ? '⚠ ' : '⚡ '}{route.badge}
          </div>
        ) : (
          <div className={styles.safeBadge}>✓ {aiRoute ? aiRoute.action : 'On Course'}</div>
        )}
      </div>

      {/* ── Pilot note (Groq only) ─────────────────────────────── */}
      {aiRoute?.pilot_note && (
        <div className={styles.pilotNote}>
          <span className={styles.pilotNoteIcon}>🎙</span>
          <span>{aiRoute.pilot_note}</span>
        </div>
      )}

      {/* ── Status line ───────────────────────────────────────── */}
      <p className={styles.reason}>
        {route.active
          ? route.reason
          : `All parameters nominal · Turbulence: ${turbLevel} · Icing: ${iceLevel}`}
      </p>

      {/* ── Leaflet map ───────────────────────────────────────── */}
      <div className={styles.mapBox}>
        <RouteMap
          departure={departure}
          destination={destination}
          isRerouting={route.active}
          hazardColor={route.accentColor}
          deviation={route.deviation || 0}
          height={260}
        />
        {/* Map overlay labels */}
        <div className={styles.mapOverlay}>
          <span className={styles.mapLabel}>{departure}</span>
          <span className={styles.mapArrow}>✈ ─────────────── ▶</span>
          <span className={styles.mapLabel}>{destination}</span>
        </div>
      </div>

      {/* ── Recommendations (when active) ─────────────────────── */}
      {route.active && (
        <div className={styles.recs}>
          <div className={styles.recItem}>
            <span className={styles.recIcon}>🧭</span>
            <span className={styles.recLabel}>Heading</span>
            <span className={styles.recVal} style={{ color: route.accentColor }}>{route.heading}</span>
          </div>
          <div className={styles.recItem}>
            <span className={styles.recIcon}>📈</span>
            <span className={styles.recLabel}>Altitude</span>
            <span className={styles.recVal} style={{ color: route.accentColor }}>{route.altitude}</span>
          </div>
          <div className={styles.recItem}>
            <span className={styles.recIcon}>💨</span>
            <span className={styles.recLabel}>Speed</span>
            <span className={styles.recVal} style={{ color: route.accentColor }}>{route.speed}</span>
          </div>
        </div>
      )}

      {/* ── Live sensor chips ──────────────────────────────────── */}
      <div className={styles.sensors}>
        <div className={styles.sensorChip}>
          <span className={styles.chipLabel}>Turbulence</span>
          <span className={styles.chipVal}
            style={{ color: turbLevel === 'NONE' ? '#22c55e' : turbLevel === 'MODERATE' ? '#f59e0b' : '#ef4444' }}>
            {turbLevel}
          </span>
        </div>
        <div className={styles.sensorChip}>
          <span className={styles.chipLabel}>Icing</span>
          <span className={styles.chipVal}
            style={{ color: iceLevel === 'NONE' ? '#22c55e' : iceLevel === 'WARNING' ? '#f59e0b' : '#ef4444' }}>
            {iceLevel}
          </span>
        </div>
        <div className={styles.sensorChip}>
          <span className={styles.chipLabel}>Sensor dist.</span>
          <span className={styles.chipVal} style={{ color: '#60c8ff' }}>
            {distanceCm != null ? `${distanceCm.toFixed(0)} cm` : '— cm'}
          </span>
        </div>
      </div>

    </div>
  );
}
