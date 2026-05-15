import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import styles from './LiveFlightPage.module.css';
import RadarDisplay from '../components/RadarDisplay';
import CriticalVoiceAlert from '../components/CriticalVoiceAlert';

const BACKEND = 'http://localhost:5000';

const COND_CFG = {
  NORMAL:      { color: '#22c55e', label: 'NORMAL',       flash: false },
  TURBULENCE:  { color: '#f59e0b', label: 'TURBULENCE',   flash: false },
  THUNDERSTORM:{ color: '#60c8ff', label: 'ICING WARN',   flash: false },
  WAKE:        { color: '#f97316', label: 'WAKE TURB.',   flash: false },
  WIND_SHEAR:  { color: '#ef4444', label: 'WIND SHEAR',   flash: false },
  CRITICAL:    { color: '#ef4444', label: 'CRITICAL',      flash: true  },
};

// Jitter config mirroring Arduino LED logic
const SHAKE_CFG = {
  NONE:     { trans: 0,  rot: 0   },
  MILD:     { trans: 3,  rot: 0.6 },
  MODERATE: { trans: 8,  rot: 1.8 },
  SEVERE:   { trans: 18, rot: 4.5 },
};

const TURB_COLOR = {
  NONE:     '#22c55e',
  MILD:     '#f59e0b',
  MODERATE: '#f97316',
  SEVERE:   '#ef4444',
};

const ICE_COLOR = {
  NONE:     '#22c55e',
  WARNING:  '#60c8ff',
  CRITICAL: '#ef4444',
};

const lerp = (a, b, t) => a + (b - a) * t;
const rand  = (amp) => (Math.random() - 0.5) * 2 * amp;

// ─── null-safe number display ────────────────────────────────────────
const fmt = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));

export default function LiveFlightPage() {
  const planeRef  = useRef(null);
  const sensorRef = useRef({ accel_z: 0, gyro_x: 0, gyro_y: 0 });
  const smoothRef = useRef({ rX: 0, rZ: 0, rY: 0 });
  const frameRef  = useRef(null);
  const turbRef   = useRef('NONE'); // RAF reads this without stale closure

  const [condition, setCondition] = useState('NORMAL');
  const [connected, setConnected] = useState(false);

  // ── Real IoT values from hw_update ───────────────────────────────────
  const [hw, setHw] = useState({
    // Turbulence / MPU6050
    turb_level:  'NONE',
    shake_dps:   null,   // raw gyro magnitude (deg/s)
    tilt_deg:    null,   // complementary filter tilt angle (deg)
    pitch_deg:   null,   // alias: tilt → pitch
    roll_deg:    null,   // alias: shake_scaled → roll
    // Icing / HC-SR04
    ice_level:   'NONE',
    distance_cm: null,   // raw ultrasonic distance (cm)
    icing_pct:   null,   // 0–100%
    // Radar servos
    radar_x:     90,
    radar_y:     90,
  });

  /* ── Animation loop: IMU + turbulence jitter ── */
  useEffect(() => {
    const sm = smoothRef.current;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const s = sensorRef.current;

      const targetPitch = (s.accel_z || 0) * 5;
      const targetRoll  = (s.gyro_x  || 0) * 1.2;
      const targetYaw   = (s.gyro_y  || 0) * 0.8;
      sm.rX = lerp(sm.rX, targetPitch, 0.06);
      sm.rZ = lerp(sm.rZ, targetRoll,  0.06);
      sm.rY = lerp(sm.rY, targetYaw,   0.06);

      const cfg = SHAKE_CFG[turbRef.current] || SHAKE_CFG.NONE;
      const jX  = rand(cfg.trans);
      const jY  = rand(cfg.trans * 0.6);
      const jRZ = rand(cfg.rot);
      const jRX = rand(cfg.rot * 0.5);

      if (planeRef.current) {
        planeRef.current.style.transform =
          `perspective(1200px)` +
          ` translate(${jX}px, ${jY}px)` +
          ` rotateX(${sm.rX + jRX}deg)` +
          ` rotateZ(${sm.rZ + jRZ}deg)` +
          ` rotateY(${sm.rY}deg)`;
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  /* ── Socket.IO ── */
  useEffect(() => {
    const socket = io(BACKEND, { transports: ['polling'] });

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('condition_update', ({ condition: c }) => setCondition(c));

    // Update RAF sensor ref
    socket.on('sensor_update', (d) => { sensorRef.current = d; });

    // hw_update: merge into existing state — never wipe fields not in this payload
    socket.on('hw_update', (d) => {
      setHw(prev => ({ ...prev, ...d }));
      turbRef.current = d.turb_level || turbRef.current;
    });

    // Also accept individual events as fallback
    socket.on('turb_update', ({ level, shake_dps, tilt_deg }) => {
      turbRef.current = level;
      setHw(prev => ({ ...prev, turb_level: level, shake_dps, tilt_deg }));
    });
    socket.on('ice_update', ({ level, distance_cm, icing_pct }) => {
      setHw(prev => ({ ...prev, ice_level: level, distance_cm, icing_pct }));
    });
    socket.on('radar_update', ({ radar_x, radar_y, distance_cm, icing_pct, ice_level }) => {
      setHw(prev => ({ ...prev, radar_x, radar_y, distance_cm, icing_pct, ice_level }));
    });

    return () => socket.disconnect();
  }, []);

  const cfg = COND_CFG[condition] || COND_CFG.NORMAL;
  const turbLevel = hw.turb_level || 'NONE';
  const iceLevel  = hw.ice_level  || 'NONE';

  // Derived axis display from real pitch/roll
  const pitchDisplay = hw.pitch_deg != null ? fmt(hw.pitch_deg, 1) : '0.0';
  const rollDisplay  = hw.roll_deg  != null ? fmt(hw.roll_deg,  1) : '0.0';
  const yawDisplay   = hw.yaw_deg   != null ? fmt(hw.yaw_deg,   1) : '0.0';

  // Icing bar gradient
  const icingPct = hw.icing_pct ?? 0;
  const icingColor = icingPct > 60
    ? 'linear-gradient(90deg,#3b82f6,#60c8ff)'
    : icingPct > 30
      ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
      : 'linear-gradient(90deg,#22c55e,#34d399)';

  return (
    <div className={styles.page}>

      {/* ── SEVERE: red pulsing screen overlay ── */}
      {turbLevel === 'SEVERE' && <div className={styles.severeOverlay} />}

      {/* ── Plane ── */}
      <div className={styles.planeStage}>
        <div ref={planeRef} className={styles.planeWrapper}>
          <img src="/plane_cutout.png" alt="Boeing 787"
            className={styles.planeImg} draggable={false} />
        </div>
      </div>

      {/* ── Connection dot ── */}
      <div className={`${styles.connDot} ${connected ? styles.connOn : styles.connOff}`}
        title={connected ? 'Live' : 'Disconnected'} />

      {/* ── Condition badge ── */}
      <div className={styles.condWrap}>
        <div className={`${styles.condBadge} ${cfg.flash ? styles.condFlash : ''}`}
          style={{ '--cc': cfg.color }}>
          <span className={styles.condDot}
            style={{ background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }} />
          {cfg.label}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          LEFT HUD — MPU6050 real values
          ══════════════════════════════════════════════════ */}
      <div className={styles.hudLeft}>
        <div className={styles.hudPanel}>

          <div className={styles.hudTitle}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            MPU6050 · LIVE
          </div>

          <div className={styles.sensorGrid}>

            {/* Turbulence Level */}
            <div className={styles.sensorRow}>
              <span className={styles.sensorLabel}>TURB</span>
              <span className={styles.sensorVal}
                style={{ color: TURB_COLOR[turbLevel], fontSize: '0.72rem', fontWeight: 900 }}>
                {turbLevel}
              </span>
            </div>

            {/* Shake magnitude — raw gyro value from Arduino */}
            <div className={styles.sensorRow}>
              <span className={styles.sensorLabel}>SHAKE</span>
              <span className={styles.sensorVal} style={{ color: TURB_COLOR[turbLevel] }}>
                {fmt(hw.shake_dps, 1)}
                <span className={styles.sensorUnit}> °/s</span>
              </span>
            </div>

            {/* Tilt angle — complementary filter output */}
            <div className={styles.sensorRow}>
              <span className={styles.sensorLabel}>TILT</span>
              <span className={styles.sensorVal} style={{ color: '#c084fc' }}>
                {fmt(hw.tilt_deg, 1)}
                <span className={styles.sensorUnit}> °</span>
              </span>
            </div>

            <div className={styles.divider} />

            {/* Derived axis aliases */}
            <div className={styles.sensorRow}>
              <span className={styles.sensorLabel}>PITCH</span>
              <span className={styles.sensorVal} style={{ color: '#60c8ff' }}>
                {pitchDisplay}<span className={styles.sensorUnit}>°</span>
              </span>
            </div>
            <div className={styles.sensorRow}>
              <span className={styles.sensorLabel}>ROLL</span>
              <span className={styles.sensorVal} style={{ color: '#c084fc' }}>
                {rollDisplay}<span className={styles.sensorUnit}>°</span>
              </span>
            </div>
            <div className={styles.sensorRow}>
              <span className={styles.sensorLabel}>YAW</span>
              <span className={styles.sensorVal} style={{ color: '#34d399' }}>
                {yawDisplay}<span className={styles.sensorUnit}>°</span>
              </span>
            </div>

          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          RIGHT HUD — HC-SR04 + Radar servo
          ══════════════════════════════════════════════════ */}
      <div className={styles.hudRight}>

        {/* Icing / Ultrasonic panel */}
        <div className={styles.hudPanel}>
          <div className={styles.hudTitle}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            HC-SR04 · ICING
          </div>
          <div className={styles.sensorGrid}>

            <div className={styles.sensorRow}>
              <span className={styles.sensorLabel}>STATUS</span>
              <span className={styles.sensorVal}
                style={{ color: ICE_COLOR[iceLevel], fontSize: '0.68rem', fontWeight: 900 }}>
                {iceLevel}
              </span>
            </div>

            <div className={styles.sensorRow}>
              <span className={styles.sensorLabel}>DIST</span>
              <span className={styles.sensorVal} style={{ color: '#60c8ff' }}>
                {hw.distance_cm != null ? fmt(hw.distance_cm, 1) : '—'}
                <span className={styles.sensorUnit}> cm</span>
              </span>
            </div>

            <div className={styles.sensorRow}>
              <span className={styles.sensorLabel}>ICING</span>
              <span className={styles.sensorVal}
                style={{ color: icingPct > 60 ? '#60c8ff' : '#22c55e' }}>
                {fmt(icingPct, 0)}<span className={styles.sensorUnit}>%</span>
              </span>
            </div>

            {/* Icing progress bar */}
            <div style={{ marginTop: '0.4rem' }}>
              <div style={{
                width: '100%', height: '5px',
                background: 'rgba(30,100,180,0.1)',
                borderRadius: '3px', overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  width: `${icingPct}%`, height: '100%',
                  background: icingColor,
                  borderRadius: '3px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ fontSize: '0.58rem', color: 'rgba(180,210,240,0.4)',
                marginTop: '0.2rem', fontFamily: 'Inter, sans-serif' }}>
                ▲ 60% threshold
              </div>
            </div>

          </div>
        </div>

        {/* Radar canvas panel */}
        <div className={styles.hudPanel} style={{ padding: '0.75rem 0.75rem 0.5rem' }}>
          <div className={styles.hudTitle} style={{ paddingLeft: '0.25rem' }}>Radar Sweep</div>
          <RadarDisplay width={220} height={130} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.25rem 0', fontSize: '0.62rem', color: 'rgba(180,210,240,0.55)', fontFamily: 'Inter, sans-serif' }}>
            <span>X: {hw.radar_x ?? 90}°</span>
            <span>Y: {hw.radar_y ?? 90}°</span>
            <span style={{ color: connected ? '#22c55e' : '#ef4444' }}>
              {connected ? '● COM8' : '● OFFLINE'}
            </span>
          </div>
        </div>

      </div>

      {/* ── Bottom axis meters ── */}
      <div className={styles.axisBar}>
        {[
          { id: 'pitch', label: 'PITCH', val: pitchDisplay, color: '#60c8ff' },
          { id: 'roll',  label: 'ROLL',  val: rollDisplay,  color: '#c084fc' },
          { id: 'yaw',   label: 'YAW',   val: yawDisplay,   color: '#34d399' },
          { id: 'shake', label: 'SHAKE', val: fmt(hw.shake_dps, 1), color: TURB_COLOR[turbLevel], unit: '°/s' },
          { id: 'dist',  label: 'DIST',  val: fmt(hw.distance_cm, 0), color: ICE_COLOR[iceLevel], unit: 'cm' },
        ].map(r => (
          <div key={r.id} className={styles.axisItem}>
            <span className={styles.axisLabel}>{r.label}</span>
            <div className={styles.axisMeter}>
              <div className={styles.axisCenter} />
              <div className={styles.axisFill} style={{
                left:  '50%',
                width: `${Math.min(Math.abs(parseFloat(r.val) || 0), 50)}%`,
                background: r.color,
              }} />
            </div>
            <span className={styles.axisVal}>{r.val}{r.unit ?? '°'}</span>
          </div>
        ))}
      </div>

      {/* ── Critical auto voice alert — fires when sensor thresholds breach ── */}
      <CriticalVoiceAlert condition={condition} hw={hw} />

    </div>
  );
}
