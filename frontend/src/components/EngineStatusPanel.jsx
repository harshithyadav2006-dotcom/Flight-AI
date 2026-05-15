import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import styles from './EngineStatusPanel.module.css';

const BACKEND_URL = 'http://localhost:5000';

/* ── Status config ── */
const STATUS_CONFIG = {
  'NORMAL':             { label: 'NORMAL',            color: '#22c55e', glow: 'rgba(34,197,94,0.35)' },
  'WARNING':            { label: 'WARNING',            color: '#f59e0b', glow: 'rgba(245,158,11,0.35)' },
  'AUTO DE-ICE ACTIVE': { label: 'AUTO DE-ICE ACTIVE', color: '#60c8ff', glow: 'rgba(96,200,255,0.4)'  },
};

/* ── Vertical RPM bar ── */
function RpmBar({ pct, color, glow }) {
  return (
    <div className={styles.rpmBarTrack}>
      <div
        className={styles.rpmBarFill}
        style={{
          height: `${Math.min(pct, 100)}%`,
          background: color,
          boxShadow: `0 0 12px ${glow}`,
        }}
      />
      {/* tick marks */}
      {[75, 50, 25].map(t => (
        <div key={t} className={styles.rpmTick} style={{ bottom: `${t}%` }} />
      ))}
    </div>
  );
}

/* ── Single engine indicator ── */
function EngineIndicator({ label, n1Pct, rpm, status, prevStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['NORMAL'];
  const changed = status !== prevStatus;

  return (
    <div className={`${styles.engine} ${changed ? styles.engineFlash : ''}`}>
      <div className={styles.engineLabel}>{label}</div>

      {/* RPM vertical bar */}
      <div className={styles.rpmSection}>
        <RpmBar pct={n1Pct} color={cfg.color} glow={cfg.glow} />
        <div className={styles.rpmValues}>
          <span className={styles.n1Val} style={{ color: cfg.color }}>
            {n1Pct.toFixed(1)}<span className={styles.n1Unit}>%</span>
          </span>
          <span className={styles.rpmVal}>{rpm.toLocaleString()} <span className={styles.rpmUnit}>RPM</span></span>
        </div>
      </div>

      {/* Status badge */}
      <div
        className={`${styles.statusBadge} ${changed ? styles.badgePulse : ''}`}
        style={{
          '--status-color': cfg.color,
          '--status-glow':  cfg.glow,
          borderColor: cfg.color,
          color: cfg.color,
        }}
      >
        <span className={styles.statusDot} style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.glow}` }} />
        {cfg.label}
      </div>
    </div>
  );
}

/* ══════════════════════════════════
   ENGINE STATUS PANEL
   ══════════════════════════════════ */
export default function EngineStatusPanel() {
  const [data, setData] = useState({
    n1_eng1_pct: 82,  n1_eng2_pct: 83,
    rpm_eng1: 15170,  rpm_eng2: 15355,
    eng1_status: 'NORMAL', eng2_status: 'NORMAL',
    icing_risk_pct: 18,
  });
  const prevStatus = useRef({ eng1: 'NORMAL', eng2: 'NORMAL' });
  const [flash, setFlash] = useState({ eng1: false, eng2: false });

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['polling'] });

    socket.on('connect', () => console.log('[Engine Panel] WS connected'));
    socket.on('telemetry_update', (d) => {
      setData(prev => {
        const e1Changed = d.eng1_status !== prev.eng1_status;
        const e2Changed = d.eng2_status !== prev.eng2_status;
        if (e1Changed || e2Changed) {
          setFlash({ eng1: e1Changed, eng2: e2Changed });
          setTimeout(() => setFlash({ eng1: false, eng2: false }), 800);
        }
        prevStatus.current = { eng1: d.eng1_status, eng2: d.eng2_status };
        return d;
      });
    });

    return () => socket.disconnect();
  }, []);

  const icingActive = (data.icing_risk_pct || 0) > 45;

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          ENGINE STATUS
        </div>
        {icingActive && (
          <div className={styles.icingAlert}>
            <span className={styles.icingDot} />
            ICING DETECTED · {data.icing_risk_pct?.toFixed(0)}%
          </div>
        )}
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Engine indicators */}
      <div className={styles.enginesRow}>
        <EngineIndicator
          label="ENG 1"
          n1Pct={data.n1_eng1_pct || 82}
          rpm={data.rpm_eng1 || 15170}
          status={data.eng1_status || 'NORMAL'}
          prevStatus={prevStatus.current.eng1}
        />
        <div className={styles.separator} />
        <EngineIndicator
          label="ENG 2"
          n1Pct={data.n1_eng2_pct || 83}
          rpm={data.rpm_eng2 || 15355}
          status={data.eng2_status || 'NORMAL'}
          prevStatus={prevStatus.current.eng2}
        />
      </div>

      {/* Icing risk bar */}
      <div className={styles.icingSection}>
        <div className={styles.icingLabel}>
          <span>ICING RISK</span>
          <span style={{ color: icingActive ? '#60c8ff' : '#22c55e' }}>
            {data.icing_risk_pct?.toFixed(0)}%
          </span>
        </div>
        <div className={styles.icingTrack}>
          <div
            className={styles.icingFill}
            style={{
              width: `${data.icing_risk_pct || 0}%`,
              background: icingActive
                ? 'linear-gradient(90deg, #3b82f6, #60c8ff)'
                : 'linear-gradient(90deg, #22c55e, #34d399)',
            }}
          />
          <div className={styles.icingThreshold} />
        </div>
        <span className={styles.icingNote}>▲ 45% threshold</span>
      </div>
    </div>
  );
}
