import styles from './Features.module.css';

const FEATURES = [
  {
    id: 'hazard-detection',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2L2 19h20L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 9v5M12 16.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Real-Time Hazard Detection',
    description: 'AI continuously monitors turbulence, weather fronts, airspace conflicts, and terrain threats — alerting pilots in under 300ms.',
    color: '#1a7cc1',
    tag: 'Core Feature',
  },
  {
    id: 'autonomous-rerouting',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Autonomous Rerouting',
    description: 'When hazards are detected, SkyPilot calculates optimal alternative flight paths and presents them instantly with fuel-efficiency analysis.',
    color: '#2e6bb0',
    tag: 'AI-Powered',
  },
  {
    id: 'pilot-monitoring',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="18" cy="6" r="3" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1" />
        <path d="M17 6l1 1 2-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
    title: 'Pilot Behavior Monitoring',
    description: 'Biometric and behavioral analysis detects pilot fatigue, stress levels, and cognitive impairment to prevent human-error incidents.',
    color: '#17a589',
    tag: 'Safety',
  },
  {
    id: 'black-box',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 10h2M7 14h10M13 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Blockchain Black Box',
    description: 'Tamper-proof, real-time flight logging secured with blockchain cryptography — accessible to authorized personnel post-incident.',
    color: '#c07a12',
    tag: 'Security',
  },
  {
    id: 'live-telemetry',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <polyline points="4,14 8,8 12,12 16,6 20,10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 18h16" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
      </svg>
    ),
    title: 'Live Telemetry Streams',
    description: 'Ground control and airlines get continuous, real-time sensor streams — altitude, speed, heading, engine vitals, and AI scores.',
    color: '#7c3cbf',
    tag: 'Monitoring',
  },
  {
    id: 'emergency-protocol',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Emergency Protocols',
    description: 'Automated emergency response workflows including ATC communication drafts, nearest airport routing, and crew alert notifications.',
    color: '#c0392b',
    tag: 'Emergency',
  },
];

export default function Features() {
  return (
    <section className={styles.section} id="features" aria-labelledby="features-heading">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden="true" />
            Our Capabilities
          </div>
          <h2 id="features-heading" className={styles.heading}>
            Built for Every Phase of Flight
          </h2>
          <p className={styles.subheading}>
            From pre-flight checks to post-landing analysis, SkyPilot AI provides
            an end-to-end intelligent safety layer across the entire aviation stack.
          </p>
        </div>

        <div className={styles.grid}>
          {FEATURES.map((feature) => (
            <article
              key={feature.id}
              id={`feature-${feature.id}`}
              className={styles.card}
              style={{ '--card-tint': `${feature.color}0a` }}
            >
              <div className={styles.cardTop}>
                <div className={styles.iconWrap} style={{ color: feature.color, background: `${feature.color}12`, borderColor: `${feature.color}20` }}>
                  {feature.icon}
                </div>
                <span className={styles.tag} style={{ color: feature.color, borderColor: `${feature.color}30`, background: `${feature.color}0d` }}>
                  {feature.tag}
                </span>
              </div>
              <h3 className={styles.cardTitle}>{feature.title}</h3>
              <p className={styles.cardDesc}>{feature.description}</p>
              <div className={styles.cardFooter}>
                <div className={styles.cardLine} style={{ background: `linear-gradient(90deg, ${feature.color}, ${feature.color}00)` }} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
