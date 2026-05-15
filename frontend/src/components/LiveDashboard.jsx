import styles from './LiveDashboard.module.css';
import { useState, useEffect } from 'react';

function useLiveValue(base, range, interval = 1500) {
  const [val, setVal] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      setVal(+(base + (Math.random() - 0.5) * range).toFixed(1));
    }, interval);
    return () => clearInterval(id);
  }, [base, range, interval]);
  return val;
}

const FLIGHTS = [
  { id: 'SK-2041', from: 'JFK', to: 'LHR', status: 'En Route',   statusType: 'ok',      progress: 62 },
  { id: 'SK-1187', from: 'DXB', to: 'SIN', status: 'Rerouting',  statusType: 'warning', progress: 38 },
  { id: 'SK-0809', from: 'LAX', to: 'NRT', status: 'En Route',   statusType: 'ok',      progress: 81 },
  { id: 'SK-3302', from: 'CDG', to: 'ORD', status: 'Monitoring', statusType: 'info',    progress: 15 },
];

export default function LiveDashboard() {
  const alt   = useLiveValue(35020, 200);
  const speed = useLiveValue(484, 12);
  const safetyScore = useLiveValue(98.4, 0.8, 2000);
  const pilotScore  = useLiveValue(94.1, 2.0, 2500);

  return (
    <section className={styles.section} id="dashboard" aria-labelledby="dashboard-heading">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.badge}>Live Preview</div>
          <h2 id="dashboard-heading" className={styles.heading}>
            The Command Center,{' '}
            <span className={styles.headingAccent}>Always On</span>
          </h2>
          <p className={styles.subheading}>
            A real-time overview of fleet status, AI scores, and active flight paths — everything in one glance.
          </p>
        </div>

        <div className={styles.dashboardFrame}>
          {/* Top Bar */}
          <div className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <span className={styles.liveDot} aria-hidden="true" />
              <span className={styles.liveLabel}>LIVE</span>
              <span className={styles.topBarTitle}>SkyPilot AI Command Center</span>
            </div>
            <div className={styles.topBarRight}>
              <span className={styles.time}>{new Date().toUTCString().slice(17, 25)} UTC</span>
              <span className={styles.topBarBadge}>4 Flights Active</span>
            </div>
          </div>

          <div className={styles.dashGrid}>
            {/* Left – Flight List */}
            <div className={styles.panel} aria-label="Active flights panel">
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Active Flights</span>
                <span className={styles.panelCount}>{FLIGHTS.length}</span>
              </div>
              <ul className={styles.flightList} role="list">
                {FLIGHTS.map((f) => (
                  <li key={f.id} className={styles.flightItem} id={`flight-${f.id}`}>
                    <div className={styles.flightTop}>
                      <span className={styles.flightId}>{f.id}</span>
                      <span className={`${styles.flightStatus} ${styles[`status-${f.statusType}`]}`}>{f.status}</span>
                    </div>
                    <div className={styles.flightRoute}>
                      <span className={styles.airport}>{f.from}</span>
                      <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
                        <path d="M0 5h18M14 1l4 4-4 4" stroke="#4E6380" strokeWidth="1" strokeLinecap="round" />
                      </svg>
                      <span className={styles.airport}>{f.to}</span>
                    </div>
                    <div className={styles.progressBar} role="progressbar" aria-valuenow={f.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Flight ${f.id} progress`}>
                      <div className={styles.progressFill} style={{ width: `${f.progress}%` }} />
                      <span className={styles.progressLabel}>{f.progress}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Center – Metrics */}
            <div className={styles.metricsCol}>
              <div className={styles.metricCard} id="metric-altitude">
                <span className={styles.metricLabel}>Altitude (SK-2041)</span>
                <span className={styles.metricValue}>{alt.toLocaleString()} <span className={styles.metricUnit}>ft</span></span>
                <div className={styles.metricBar}>
                  <div className={styles.metricBarFill} style={{ width: `${(alt / 40000) * 100}%`, background: 'var(--grad-primary)' }} />
                </div>
              </div>
              <div className={styles.metricCard} id="metric-speed">
                <span className={styles.metricLabel}>Airspeed (SK-2041)</span>
                <span className={styles.metricValue}>{speed} <span className={styles.metricUnit}>kts</span></span>
                <div className={styles.metricBar}>
                  <div className={styles.metricBarFill} style={{ width: `${(speed / 600) * 100}%`, background: 'linear-gradient(90deg, #818CF8, #38BDF8)' }} />
                </div>
              </div>
              <div className={styles.metricCard} id="metric-ai-safety">
                <span className={styles.metricLabel}>AI Safety Score</span>
                <span className={styles.metricValue} style={{ color: '#34D399' }}>{safetyScore}%</span>
                <div className={styles.metricBar}>
                  <div className={styles.metricBarFill} style={{ width: `${safetyScore}%`, background: 'linear-gradient(90deg, #059669, #34D399)' }} />
                </div>
              </div>
              <div className={styles.metricCard} id="metric-pilot">
                <span className={styles.metricLabel}>Pilot Alertness Score</span>
                <span className={styles.metricValue} style={{ color: '#FBBF24' }}>{pilotScore}%</span>
                <div className={styles.metricBar}>
                  <div className={styles.metricBarFill} style={{ width: `${pilotScore}%`, background: 'linear-gradient(90deg, #D97706, #FBBF24)' }} />
                </div>
              </div>
            </div>

            {/* Right – Alerts */}
            <div className={styles.panel} aria-label="System alerts panel">
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>System Alerts</span>
                <span className={styles.alertDot} aria-hidden="true" />
              </div>
              <ul className={styles.alertList} role="list">
                <li className={`${styles.alertItem} ${styles.alertWarning}`} id="alert-1">
                  <div className={styles.alertIcon}>⚠</div>
                  <div className={styles.alertContent}>
                    <span className={styles.alertTitle}>Turbulence Ahead — SK-1187</span>
                    <span className={styles.alertTime}>2 min ago • Reroute initiated</span>
                  </div>
                </li>
                <li className={`${styles.alertItem} ${styles.alertInfo}`} id="alert-2">
                  <div className={styles.alertIcon}>ℹ</div>
                  <div className={styles.alertContent}>
                    <span className={styles.alertTitle}>Weather Update — SK-0809</span>
                    <span className={styles.alertTime}>5 min ago • Route clear</span>
                  </div>
                </li>
                <li className={`${styles.alertItem} ${styles.alertOk}`} id="alert-3">
                  <div className={styles.alertIcon}>✓</div>
                  <div className={styles.alertContent}>
                    <span className={styles.alertTitle}>Pilot Check — SK-2041</span>
                    <span className={styles.alertTime}>8 min ago • All vitals normal</span>
                  </div>
                </li>
                <li className={`${styles.alertItem} ${styles.alertDanger}`} id="alert-4">
                  <div className={styles.alertIcon}>!</div>
                  <div className={styles.alertContent}>
                    <span className={styles.alertTitle}>Airspace Advisory — SK-3302</span>
                    <span className={styles.alertTime}>11 min ago • Altitude adjustment</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
