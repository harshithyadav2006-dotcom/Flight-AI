import styles from './Hero.module.css';

export default function Hero() {
  return (
    <section className={styles.hero} id="hero" aria-label="SkyPilot AI hero">
      <div className={styles.bgImage} aria-hidden="true" />
      <div className={styles.topVignette} aria-hidden="true" />
    </section>
  );
}
