import { useState, useEffect } from 'react';
import styles from './WeatherDashboard.module.css';

/* ── Simulated live data hooks ── */
function useLive(base, range, interval = 2000) {
  const [v, setV] = useState(base);
  useEffect(() => {
    const id = setInterval(() => setV(+(base + (Math.random() - 0.5) * range).toFixed(1)), interval);
    return () => clearInterval(id);
  }, [base, range, interval]);
  return v;
}

function useInt(base, range, interval = 3000) {
  const [v, setV] = useState(base);
  useEffect(() => {
    const id = setInterval(() => setV(Math.round(base + (Math.random() - 0.5) * range)), interval);
    return () => clearInterval(id);
  }, [base, range, interval]);
  return v;
}

/* ── Route weather snapshots ── */
const ROUTE_WEATHER = [
  { id: 'rwx-1', location: 'JFK → 35,000 ft', condition: 'Clear Skies',    icon: '☀', severity: 'ok'   },
  { id: 'rwx-2', location: 'Mid-Atlantic',      condition: 'Moderate Turb.',icon: '⚡', severity: 'warn' },
  { id: 'rwx-3', location: 'LHR Approach',      condition: 'Light Rain',    icon: '🌧', severity: 'info' },
  { id: 'rwx-4', location: 'DXB → 33,000 ft',  condition: 'Sandstorm Risk',icon: '🌪', severity: 'danger'},
];

/* ── Wind direction compass ── */
function Compass({ deg }) {
  return (
    <div className={styles.compass} aria-label={`Wind direction ${deg}°`}>
      <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r="36" stroke="rgba(56,189,248,0.15)" strokeWidth="1" fill="none" />
        <circle cx="40" cy="40" r="28" stroke="rgba(56,189,248,0.08)" strokeWidth="1" fill="none" />
        {['N','E','S','W'].map((d, i) => {
          const angle = i * 90 - 90;
          const rad = (angle * Math.PI) / 180;
          const x = 40 + 32 * Math.cos(rad);
          const y = 40 + 32 * Math.sin(rad);
          return <text key={d} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fill={d === 'N' ? '#38BDF8' : 'rgba(148,163,184,0.6)'} fontSize="9" fontWeight="700">{d}</text>;
        })}
        {/* Needle */}
        <g transform={`rotate(${deg}, 40, 40)`}>
          <polygon points="40,10 43,40 40,34 37,40" fill="#38BDF8" opacity="0.9" />
          <polygon points="40,70 43,40 40,46 37,40" fill="rgba(148,163,184,0.3)" />
        </g>
        <circle cx="40" cy="40" r="3" fill="#38BDF8" />
      </svg>
      <span className={styles.compassDeg}>{deg}°</span>
    </div>
  );
}

/* ── Mini sparkline ── */
function Sparkline({ values, color }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 120, h = 32, pts = values.length;
  const coords = values.map((v, i) => {
    const x = (i / (pts - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className={styles.sparkline}>
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={(w)} cy={h - ((values[values.length-1] - min) / range) * h} r="2.5" fill={color} />
    </svg>
  );
}

/* ── History buffer hook ── */
function useHistory(value, len = 12) {
  const [hist, setHist] = useState(Array(len).fill(value));
  useEffect(() => {
    setHist(h => [...h.slice(1), value]);
  }, [value]);
  return hist;
}

export default function WeatherDashboard() {
  /* Live values */
  const temp       = useLive(8, 3, 2500);
  const feelsLike  = useLive(4, 2, 3000);
  const humidity   = useInt(72, 8, 3500);
  const windSpeed  = useLive(24, 10, 2000);
  const windGust   = useLive(38, 12, 2500);
  const windDir    = useInt(225, 40, 4000);
  const pressure   = useLive(1013, 4, 4000);
  const visibility = useLive(9.2, 2, 3000);
  const dewPoint   = useLive(3, 2, 4000);
  const rainRate   = useLive(1.8, 1.5, 2000);
  const rainAccum  = useLive(12.4, 0.5, 5000);
  const cloudCover = useInt(65, 15, 4000);
  const uvIndex    = useInt(2, 1, 6000);
  const icing      = useLive(18, 8, 3000); // icing altitude %

  /* Sparkline histories */
  const tempHist     = useHistory(temp);
  const windHist     = useHistory(windSpeed);
  const humidHist    = useHistory(humidity);
  const pressureHist = useHistory(pressure);

  /* Wind bearing label */
  const bearingLabel = (d) => {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(d / 22.5) % 16];
  };

  /* Safety level */
  const safetyLevel = windSpeed < 30 && visibility > 5 ? 'OPTIMAL' : windSpeed < 45 ? 'ADVISORY' : 'DANGER';
  const safetyColor = safetyLevel === 'OPTIMAL' ? '#34D399' : safetyLevel === 'ADVISORY' ? '#FBBF24' : '#F87171';

  return (
    <section className={styles.section} id="weather-dashboard" aria-labelledby="weather-heading">
      <div className={styles.container}>

        {/* Section Header */}
        <div className={styles.header}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden="true" />
            Live Weather Intel
          </div>
          <h2 id="weather-heading" className={styles.heading}>
            Atmospheric <span className={styles.accent}>Flight Conditions</span>
          </h2>
          <p className={styles.subheading}>
            Real-time meteorological data fused with AI hazard assessment across all active flight corridors.
          </p>
        </div>

        {/* Safety Banner */}
        <div className={styles.safetyBanner} style={{ borderColor: safetyColor, background: `${safetyColor}0D` }} id="wx-safety-banner">
          <span className={styles.safetyDot} style={{ background: safetyColor, boxShadow: `0 0 10px ${safetyColor}` }} aria-hidden="true" />
          <span className={styles.safetyLabel} style={{ color: safetyColor }}>FLIGHT CONDITIONS: {safetyLevel}</span>
          <span className={styles.safetyDesc}>
            Wind {windSpeed} kts · Visibility {visibility} nm · Pressure {pressure.toFixed(0)} hPa
          </span>
          <span className={styles.safetyTime}>Updated {new Date().toLocaleTimeString()}</span>
        </div>

        {/* Main Grid */}
        <div className={styles.mainGrid}>

          {/* ── Temperature Card ── */}
          <div className={styles.card} id="wx-temp-card">
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon} style={{ color: '#F97316', background: 'rgba(249,115,22,0.1)', borderColor: 'rgba(249,115,22,0.2)' }}>
                🌡
              </div>
              <span className={styles.cardTitle}>Temperature</span>
            </div>
            <div className={styles.bigValue} style={{ color: '#F97316' }}>
              {temp > 0 ? '+' : ''}{temp}°C
            </div>
            <div className={styles.subRow}>
              <span className={styles.subItem}>Feels Like <strong>{feelsLike > 0 ? '+' : ''}{feelsLike}°C</strong></span>
              <span className={styles.subItem}>Dew Point <strong>{dewPoint}°C</strong></span>
            </div>
            <div className={styles.sparkRow}>
              <Sparkline values={tempHist} color="#F97316" />
              <span className={styles.sparkLabel}>24h trend</span>
            </div>
          </div>

          {/* ── Wind Card ── */}
          <div className={styles.card} id="wx-wind-card">
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon} style={{ color: '#38BDF8', background: 'rgba(56,189,248,0.1)', borderColor: 'rgba(56,189,248,0.2)' }}>
                💨
              </div>
              <span className={styles.cardTitle}>Wind</span>
            </div>
            <div className={styles.windLayout}>
              <div className={styles.windNumbers}>
                <div className={styles.bigValue} style={{ color: '#38BDF8' }}>{windSpeed}<span className={styles.unit}> kts</span></div>
                <div className={styles.subRow}>
                  <span className={styles.subItem}>Gust <strong>{windGust} kts</strong></span>
                  <span className={styles.subItem}>Dir <strong>{bearingLabel(windDir)}</strong></span>
                </div>
                <div className={styles.sparkRow}>
                  <Sparkline values={windHist} color="#38BDF8" />
                  <span className={styles.sparkLabel}>trend</span>
                </div>
              </div>
              <Compass deg={windDir} />
            </div>
          </div>

          {/* ── Humidity Card ── */}
          <div className={styles.card} id="wx-humidity-card">
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon} style={{ color: '#818CF8', background: 'rgba(129,140,248,0.1)', borderColor: 'rgba(129,140,248,0.2)' }}>
                💧
              </div>
              <span className={styles.cardTitle}>Humidity</span>
            </div>
            <div className={styles.bigValue} style={{ color: '#818CF8' }}>{humidity}<span className={styles.unit}>%</span></div>
            <div className={styles.gaugeWrap}>
              <div className={styles.gauge} role="progressbar" aria-valuenow={humidity} aria-valuemin={0} aria-valuemax={100} aria-label="Humidity gauge">
                <div className={styles.gaugeFill} style={{ width: `${humidity}%`, background: 'linear-gradient(90deg, #4F46E5, #818CF8)' }} />
                <div className={styles.gaugeMarker} style={{ left: `${humidity}%` }} />
              </div>
              <div className={styles.gaugeLabels}>
                <span>Dry</span><span>Comfortable</span><span>Humid</span>
              </div>
            </div>
            <div className={styles.subRow}>
              <span className={styles.subItem}>Status <strong style={{ color: humidity > 85 ? '#F87171' : humidity > 60 ? '#FBBF24' : '#34D399' }}>
                {humidity > 85 ? 'Very High' : humidity > 60 ? 'Moderate' : 'Low'}
              </strong></span>
              <span className={styles.subItem}>Dewpt <strong>{dewPoint}°C</strong></span>
            </div>
            <Sparkline values={humidHist} color="#818CF8" />
          </div>

          {/* ── Rain Card ── */}
          <div className={styles.card} id="wx-rain-card">
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon} style={{ color: '#60A5FA', background: 'rgba(96,165,250,0.1)', borderColor: 'rgba(96,165,250,0.2)' }}>
                🌧
              </div>
              <span className={styles.cardTitle}>Precipitation</span>
            </div>
            <div className={styles.bigValue} style={{ color: '#60A5FA' }}>
              {rainRate.toFixed(1)}<span className={styles.unit}> mm/h</span>
            </div>
            {/* Rain columns visualizer */}
            <div className={styles.rainViz} aria-hidden="true">
              {Array.from({ length: 14 }, (_, i) => {
                const h = 20 + Math.random() * 60;
                return <div key={i} className={styles.rainBar} style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />;
              })}
            </div>
            <div className={styles.subRow}>
              <span className={styles.subItem}>Accum <strong>{rainAccum.toFixed(1)} mm</strong></span>
              <span className={styles.subItem}>Cloud <strong>{cloudCover}%</strong></span>
              <span className={styles.subItem}>UV <strong>{uvIndex}</strong></span>
            </div>
          </div>

          {/* ── Pressure Card ── */}
          <div className={styles.card} id="wx-pressure-card">
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon} style={{ color: '#34D399', background: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.2)' }}>
                📊
              </div>
              <span className={styles.cardTitle}>Pressure</span>
            </div>
            <div className={styles.bigValue} style={{ color: '#34D399' }}>
              {pressure.toFixed(0)}<span className={styles.unit}> hPa</span>
            </div>
            <div className={styles.subRow}>
              <span className={styles.subItem}>Trend <strong style={{ color: pressure > 1013 ? '#34D399' : '#F87171' }}>
                {pressure > 1013 ? '▲ Rising' : '▼ Falling'}
              </strong></span>
              <span className={styles.subItem}>Visibility <strong>{visibility.toFixed(1)} nm</strong></span>
            </div>
            <Sparkline values={pressureHist} color="#34D399" />
          </div>

          {/* ── Icing / Turbulence Card ── */}
          <div className={styles.card} id="wx-icing-card">
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon} style={{ color: '#FBBF24', background: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.2)' }}>
                ⚡
              </div>
              <span className={styles.cardTitle}>Hazards</span>
            </div>
            <div className={styles.hazardList}>
              <div className={styles.hazardItem} id="haz-icing">
                <span className={styles.hazardName}>Icing Risk</span>
                <div className={styles.hazardBar}>
                  <div className={styles.hazardFill} style={{ width: `${icing}%`, background: icing > 60 ? '#F87171' : icing > 30 ? '#FBBF24' : '#34D399' }} />
                </div>
                <span className={styles.hazardVal} style={{ color: icing > 60 ? '#F87171' : icing > 30 ? '#FBBF24' : '#34D399' }}>{icing.toFixed(0)}%</span>
              </div>
              <div className={styles.hazardItem} id="haz-turb">
                <span className={styles.hazardName}>Turbulence</span>
                <div className={styles.hazardBar}>
                  <div className={styles.hazardFill} style={{ width: `${Math.min(windSpeed * 1.5, 100)}%`, background: windSpeed > 40 ? '#F87171' : windSpeed > 25 ? '#FBBF24' : '#34D399' }} />
                </div>
                <span className={styles.hazardVal}>{windSpeed > 40 ? 'SEVERE' : windSpeed > 25 ? 'MOD' : 'LIGHT'}</span>
              </div>
              <div className={styles.hazardItem} id="haz-vis">
                <span className={styles.hazardName}>Low Visibility</span>
                <div className={styles.hazardBar}>
                  <div className={styles.hazardFill} style={{ width: `${Math.max(0, 100 - visibility * 8)}%`, background: visibility < 3 ? '#F87171' : visibility < 6 ? '#FBBF24' : '#34D399' }} />
                </div>
                <span className={styles.hazardVal}>{visibility.toFixed(1)} nm</span>
              </div>
              <div className={styles.hazardItem} id="haz-wind-shear">
                <span className={styles.hazardName}>Wind Shear</span>
                <div className={styles.hazardBar}>
                  <div className={styles.hazardFill} style={{ width: `${Math.min((windGust - windSpeed) * 4, 100)}%`, background: windGust - windSpeed > 15 ? '#F87171' : '#FBBF24' }} />
                </div>
                <span className={styles.hazardVal}>{(windGust - windSpeed).toFixed(0)} kts</span>
              </div>
            </div>
          </div>

        </div>

        {/* Route Weather Table */}
        <div className={styles.routeSection} id="wx-route-section">
          <h3 className={styles.routeTitle}>Route Weather Snapshot</h3>
          <div className={styles.routeGrid}>
            {ROUTE_WEATHER.map((r) => (
              <div key={r.id} id={r.id} className={`${styles.routeCard} ${styles[`route-${r.severity}`]}`}>
                <span className={styles.routeIcon} aria-hidden="true">{r.icon}</span>
                <div className={styles.routeInfo}>
                  <span className={styles.routeLocation}>{r.location}</span>
                  <span className={styles.routeCondition}>{r.condition}</span>
                </div>
                <span className={`${styles.routeBadge} ${styles[`badge-${r.severity}`]}`}>
                  {r.severity === 'ok' ? 'CLEAR' : r.severity === 'warn' ? 'CAUTION' : r.severity === 'info' ? 'INFO' : 'WARNING'}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
