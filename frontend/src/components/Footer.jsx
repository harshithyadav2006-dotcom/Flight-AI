import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.container}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <div className={styles.logoRow}>
              <div className={styles.logoIcon} aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="13" stroke="url(#footerGrad)" strokeWidth="1.5" />
                  <path d="M14 6L8 16h3.5v6l6.5-10H14.5V6z" fill="url(#footerGrad)" />
                  <defs>
                    <linearGradient id="footerGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#38BDF8" />
                      <stop offset="1" stopColor="#818CF8" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className={styles.logoText}>SkyPilot <span className={styles.logoAI}>AI</span></span>
            </div>
            <p className={styles.brandDesc}>
              Intelligent flight safety systems for the modern aviation era.
              Powered by next-generation AI and real-time sensor fusion.
            </p>
            <div className={styles.socials} aria-label="Social links">
              {['Twitter', 'LinkedIn', 'GitHub'].map((s) => (
                <a key={s} href="#" className={styles.socialLink} aria-label={s}>{s[0]}</a>
              ))}
            </div>
          </div>

          <div className={styles.links}>
            {[
              { heading: 'Product', items: ['Dashboard', 'Live Flight', 'Analysis', 'API Docs'] },
              { heading: 'Company', items: ['About', 'Careers', 'Press', 'Blog'] },
              { heading: 'Legal', items: ['Privacy Policy', 'Terms of Service', 'Security', 'Compliance'] },
            ].map((col) => (
              <div key={col.heading} className={styles.linkCol}>
                <h3 className={styles.linkHeading}>{col.heading}</h3>
                <ul role="list">
                  {col.items.map((item) => (
                    <li key={item}>
                      <a href="#" className={styles.linkItem}>{item}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.bottom}>
          <span className={styles.copyright}>© 2026 SkyPilot AI. All rights reserved.</span>
          <span className={styles.version}>v2.4.1 • System Nominal</span>
        </div>
      </div>
    </footer>
  );
}
