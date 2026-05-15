import { useState, useEffect } from 'react';
import styles from './Navbar.module.css';

const NAV_ITEMS = [
  { label: 'Home',       page: 'home' },
  { label: 'Dashboard',  page: 'dashboard' },
  { label: 'Live Flight',page: 'live-flight' },
  { label: 'Analysis',   page: 'analysis' },
];

export default function Navbar({ activePage = 'home', onNavigate }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // On the dashboard page always show the solid navbar
  const isDashboard = activePage === 'dashboard';
  const showSolid = scrolled || isDashboard;

  return (
    <nav
      className={`${styles.navbar} ${showSolid ? styles.scrolled : styles.atTop}`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className={styles.inner}>
        <button
          className={`${styles.logo} ${showSolid ? styles.logoDark : ''}`}
          onClick={() => onNavigate?.('home')}
          aria-label="SkyPilot AI Home"
        >
          SkyPilot AI
        </button>

        <ul className={styles.navList} role="list">
          {NAV_ITEMS.map(({ label, page }) => (
            <li key={page}>
              <button
                id={`nav-${page}`}
                className={`${styles.navItem} ${showSolid ? styles.navItemDark : ''} ${activePage === page ? styles.navItemActive : ''}`}
                onClick={() => onNavigate?.(page)}
                aria-current={activePage === page ? 'page' : undefined}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>

        <button
          id="nav-user-btn"
          className={`${styles.userBtn} ${showSolid ? styles.userBtnDark : ''}`}
          aria-label="User account"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
