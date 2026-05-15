import { useState } from 'react';
import styles from './AnalysisPage.module.css';

const BACKEND = 'http://localhost:5000';

const AIRPORTS = [
  { code: 'BLR', name: 'Bengaluru' },
  { code: 'DEL', name: 'Delhi' },
  { code: 'BOM', name: 'Mumbai' },
  { code: 'MAA', name: 'Chennai' },
  { code: 'HYD', name: 'Hyderabad' },
  { code: 'CCU', name: 'Kolkata' },
  { code: 'LHR', name: 'London' },
  { code: 'JFK', name: 'New York' },
  { code: 'DXB', name: 'Dubai' },
  { code: 'SIN', name: 'Singapore' },
];

export default function AnalysisPage() {
  const [departure,    setDeparture]    = useState('');
  const [destination,  setDestination]  = useState('');
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState(null);
  const [forecast,     setForecast]     = useState(null);
  const [error,        setError]        = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!departure.trim() || !destination.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const [prefRes, fcRes] = await Promise.all([
        fetch(`${BACKEND}/api/preflight/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ departure: departure.trim(), destination: destination.trim() }),
        }),
        fetch(`${BACKEND}/api/forecast/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ departure: departure.trim() }),
        }),
      ]);
      if (!prefRes.ok) throw new Error('Backend error');
      const data = await prefRes.json();
      setResult(data);
      if (fcRes.ok) setForecast(await fcRes.json());
    } catch {
      setError('Could not reach backend. Is the Flask server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* ── Page header ── */}
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className={styles.title}>Flight Analysis</h1>
            <p className={styles.subtitle}>Pre-flight risk assessment & route analytics</p>
          </div>
        </div>

        {/* ══════════════════════════════════
            PRE-FLIGHT GO/CAUTION/NO-GO PANEL
            ══════════════════════════════════ */}
        <div className={styles.preflightCard}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Pre-Flight Risk Assessment</h2>
              <p className={styles.cardDesc}>
                Enter departure and destination airport codes (IATA or city name).
                We analyse live weather conditions and issue a GO / CAUTION / NO-GO verdict.
              </p>
            </div>
          </div>

          {/* ── Input form ── */}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputRow}>
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="dep">DEPARTURE</label>
                <div className={styles.inputWrap}>
                  <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <input
                    id="dep"
                    type="text"
                    placeholder="e.g. BLR or Bengaluru"
                    value={departure}
                    onChange={e => setDeparture(e.target.value)}
                    className={styles.input}
                    maxLength={40}
                    autoComplete="off"
                  />
                </div>
                <div className={styles.chips}>
                  {AIRPORTS.slice(0, 5).map(a => (
                    <button key={a.code} type="button" className={styles.chip}
                      onClick={() => setDeparture(a.code)}>{a.code}</button>
                  ))}
                </div>
              </div>

              <div className={styles.swapBtn} onClick={() => {
                const t = departure; setDeparture(destination); setDestination(t);
              }} title="Swap airports">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="dest">DESTINATION</label>
                <div className={styles.inputWrap}>
                  <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <input
                    id="dest"
                    type="text"
                    placeholder="e.g. DEL or Delhi"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    className={styles.input}
                    maxLength={40}
                    autoComplete="off"
                  />
                </div>
                <div className={styles.chips}>
                  {AIRPORTS.slice(5, 10).map(a => (
                    <button key={a.code} type="button" className={styles.chip}
                      onClick={() => setDestination(a.code)}>{a.code}</button>
                  ))}
                </div>
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading || !departure || !destination}>
              {loading
                ? <><span className={styles.spinner} /> Analysing Route…</>
                : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg> Run Pre-Flight Check</>
              }
            </button>
          </form>

          {/* ── Error ── */}
          {error && (
            <div className={styles.errorBox}>{error}</div>
          )}

          {result && (
            <div className={styles.resultWrap}>

              {/* ── MFD-style clearance panel ── */}
              <div className={styles.mfdPanel} style={{ '--vc': result.color }}>

                {/* top bar */}
                <div className={styles.mfdBar}>
                  <span className={styles.mfdBarLabel}>ASSESSMENT DETAIL</span>
                  <div className={styles.mfdDots}>
                    <span className={styles.mfdDot} style={{ background: result.verdict === 'GO' ? '#16a34a' : '#374151' }} />
                    <span className={styles.mfdDot} style={{ background: result.verdict === 'CAUTION' ? '#d97706' : '#374151' }} />
                    <span className={styles.mfdDot} style={{ background: result.verdict === 'NO-GO' ? '#dc2626' : '#374151' }} />
                  </div>
                </div>

                {/* route strip */}
                <div className={styles.mfdRoute}>
                  <div className={styles.mfdApt}>
                    <span className={styles.mfdAptLabel}>DEP</span>
                    <span className={styles.mfdAptCode}>{result.departure}</span>
                  </div>
                  <div className={styles.mfdRouteLine}>
                    <div className={styles.mfdLine} />
                    <svg width="24" height="14" viewBox="0 0 24 14" fill="none">
                      <path d="M2 7h18M15 2l5 5-5 5" stroke="var(--vc)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div className={styles.mfdLine} />
                  </div>
                  <div className={styles.mfdApt}>
                    <span className={styles.mfdAptLabel}>ARR</span>
                    <span className={styles.mfdAptCode}>{result.destination}</span>
                  </div>
                </div>

                {/* verdict */}
                <div className={styles.mfdVerdict}>
                  <div className={styles.mfdStatusBar} style={{ background: result.color }} />
                  <span className={styles.mfdVerdictText} style={{ color: result.color }}>
                    {result.verdict}
                  </span>
                </div>

                {/* reason */}
                <div className={styles.mfdReason}>
                  <span className={styles.mfdReasonLabel}>AI SUGGESTION</span>
                  <p className={styles.mfdReasonText}>{result.reason}</p>
                </div>

                {/* footer meta */}
                <div className={styles.mfdFooter}>
                  <span>SRC: {result.simulated ? 'SIMULATED' : 'OWM-LIVE'}</span>
                  <span>SYS: SKYPILOT-AI v1.0</span>
                  <span>{new Date().toUTCString().replace('GMT', 'Z')}</span>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ══════════════════════════════════
            2-HOUR FORECAST STRIP
            ══════════════════════════════════ */}
        {forecast && (() => {
          const now = forecast.slots[0];
          return (
            <div className={styles.forecastCard}>
              <div className={styles.forecastHeader}>
                <div className={styles.forecastTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Current Weather
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
                  <span className={styles.forecastCity}>{forecast.city}</span>
                  <span className={styles.condBadge}>{now.conditions[0]}</span>
                  {now.alert && (
                    <div className={styles.alertMarker}>
                      {now.icing_risk_pct > 40   && <span className={styles.alertTag} style={{background:'#3b82f6'}}>ICE</span>}
                      {now.tornado_risk_pct > 20 && <span className={styles.alertTag} style={{background:'#ef4444'}}>TNDO</span>}
                      {now.rain_prob_pct > 75     && <span className={styles.alertTag} style={{background:'#8b5cf6'}}>RAIN</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Proper bar chart ── */}
              <div className={styles.barChart}>

                {/* Y-axis labels */}
                <div className={styles.yAxis}>
                  {[100, 75, 50, 25, 0].map(v => (
                    <span key={v} className={styles.yLabel}>{v}%</span>
                  ))}
                </div>

                {/* chart area */}
                <div className={styles.chartArea}>
                  {/* grid lines */}
                  {[0, 25, 50, 75, 100].map(v => (
                    <div key={v} className={styles.gridLine} style={{ bottom: `${v}%` }} />
                  ))}

                  {/* bars */}
                  {[
                    { label: 'TEMP',     display: `${now.temp_c}°C`,        pct: Math.min(100, Math.max(0, (now.temp_c + 10) / 40 * 100)) },
                    { label: 'WIND',     display: `${now.wind_kts}kts`,     pct: Math.min(100, now.wind_kts / 60 * 100) },
                    { label: 'HUMIDITY', display: `${now.humidity_pct}%`,   pct: now.humidity_pct },
                    { label: 'RAIN',     display: `${now.rain_prob_pct}%`,  pct: now.rain_prob_pct },
                    { label: 'ICING',    display: `${now.icing_risk_pct}%`, pct: now.icing_risk_pct },
                  ].map(m => (
                    <div key={m.label} className={styles.barGroup}>
                      <span className={styles.barTopLabel}>{m.display}</span>
                      <div className={styles.bar} style={{ height: `${Math.max(m.pct, 2)}%` }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* X-axis labels */}
              <div className={styles.xAxis}>
                <div className={styles.xAxisOffset} />
                {['TEMP', 'WIND', 'HUMIDITY', 'RAIN', 'ICING'].map(l => (
                  <span key={l} className={styles.xLabel}>{l}</span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Placeholder for future panels ── */}
        <div className={styles.comingSoon}>
          <p>More analysis modules coming soon</p>
          <span>Route efficiency · Fuel prediction · Historical incidents</span>
        </div>

      </div>
    </div>
  );
}
