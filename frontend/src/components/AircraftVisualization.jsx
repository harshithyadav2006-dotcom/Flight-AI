import styles from './AircraftVisualization.module.css';

export default function AircraftVisualization() {
  return (
    <div className={styles.wrapper} aria-label="SkyPilot AI aircraft monitoring visualization">
      {/* Outer orbit ring */}
      <div className={styles.orbitOuter} aria-hidden="true" />
      <div className={styles.orbitMid} aria-hidden="true" />
      <div className={styles.orbitInner} aria-hidden="true" />

      {/* Scan line */}
      <div className={styles.scanLine} aria-hidden="true" />

      {/* Central aircraft SVG */}
      <div className={styles.aircraft} aria-hidden="true">
        <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Glow filter */}
          <defs>
            <filter id="aircraftGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="160" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" />
              <stop offset="1" stopColor="#818CF8" />
            </linearGradient>
            <linearGradient id="wingGrad" x1="0" y1="0" x2="160" y2="160" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" stopOpacity="0.8" />
              <stop offset="1" stopColor="#0EA5E9" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Engine glow */}
          <ellipse cx="80" cy="108" rx="12" ry="6" fill="#38BDF8" fillOpacity="0.15" filter="url(#aircraftGlow)" />

          {/* Fuselage */}
          <path d="M80 20 L86 65 L86 105 Q80 112 74 105 L74 65 Z"
            fill="url(#bodyGrad)" opacity="0.95" filter="url(#aircraftGlow)" />

          {/* Main wings */}
          <path d="M80 55 L30 90 L38 95 L74 75 Z" fill="url(#wingGrad)" />
          <path d="M80 55 L130 90 L122 95 L86 75 Z" fill="url(#wingGrad)" />

          {/* Wing highlights */}
          <path d="M80 57 L35 89" stroke="#38BDF8" strokeWidth="0.8" strokeOpacity="0.6" />
          <path d="M80 57 L125 89" stroke="#38BDF8" strokeWidth="0.8" strokeOpacity="0.6" />

          {/* Tail fins */}
          <path d="M80 90 L60 110 L66 112 L80 97 Z" fill="#38BDF8" fillOpacity="0.5" />
          <path d="M80 90 L100 110 L94 112 L80 97 Z" fill="#38BDF8" fillOpacity="0.5" />

          {/* Cockpit window */}
          <ellipse cx="80" cy="32" rx="4" ry="7" fill="#E2EBF7" fillOpacity="0.9" />
          <ellipse cx="80" cy="32" rx="2.5" ry="5" fill="#38BDF8" fillOpacity="0.5" />

          {/* Engine exhaust */}
          <ellipse cx="80" cy="106" rx="5" ry="3" fill="#818CF8" fillOpacity="0.9" />
          <ellipse cx="80" cy="109" rx="3" ry="5" fill="#818CF8" fillOpacity="0.4" filter="url(#aircraftGlow)" />

          {/* Detail lines on wings */}
          <line x1="55" y1="80" x2="74" y2="73" stroke="#38BDF8" strokeWidth="0.5" strokeOpacity="0.4" />
          <line x1="105" y1="80" x2="86" y2="73" stroke="#38BDF8" strokeWidth="0.5" strokeOpacity="0.4" />
        </svg>
      </div>

      {/* HUD Data Points */}
      <div className={`${styles.dataPoint} ${styles.dataPointTL}`} aria-label="Altitude data">
        <span className={styles.dataLabel}>ALT</span>
        <span className={styles.dataValue}>35,000 ft</span>
        <span className={styles.dataStatus} data-ok>NOMINAL</span>
      </div>

      <div className={`${styles.dataPoint} ${styles.dataPointTR}`} aria-label="Speed data">
        <span className={styles.dataLabel}>SPD</span>
        <span className={styles.dataValue}>485 kts</span>
        <span className={styles.dataStatus} data-ok>NOMINAL</span>
      </div>

      <div className={`${styles.dataPoint} ${styles.dataPointBL}`} aria-label="AI safety score">
        <span className={styles.dataLabel}>AI SAFETY</span>
        <span className={styles.dataValue}>98.4%</span>
        <div className={styles.miniBar}>
          <div className={styles.miniBarFill} style={{ width: '98%' }} />
        </div>
      </div>

      <div className={`${styles.dataPoint} ${styles.dataPointBR}`} aria-label="Pilot status">
        <span className={styles.dataLabel}>PILOT</span>
        <span className={styles.dataValue}>Active</span>
        <span className={styles.dataStatus} data-ok>ALERT</span>
      </div>

      {/* Crosshair center */}
      <div className={styles.crosshair} aria-hidden="true">
        <div className={styles.crosshairH} />
        <div className={styles.crosshairV} />
        <div className={styles.crosshairCenter} />
      </div>

      {/* Rotating radar arc */}
      <svg className={styles.radarSvg} viewBox="0 0 300 300" aria-hidden="true">
        <circle cx="150" cy="150" r="100" stroke="rgba(56,189,248,0.08)" strokeWidth="1" fill="none" />
        <circle cx="150" cy="150" r="65" stroke="rgba(56,189,248,0.06)" strokeWidth="1" fill="none" />
        <path d="M150 150 L150 50" stroke="url(#radarGrad)" strokeWidth="1.5" />
        <defs>
          <linearGradient id="radarGrad" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
            <stop stopColor="#38BDF8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Blip */}
        <circle cx="188" cy="98" r="3" fill="#34D399" opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.2;0.9" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="115" cy="175" r="2" fill="#FBBF24" opacity="0.7">
          <animate attributeName="opacity" values="0.7;0.1;0.7" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
