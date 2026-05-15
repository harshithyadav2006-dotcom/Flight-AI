import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import styles from './DashboardPage.module.css';
import EngineStatusPanel from '../components/EngineStatusPanel';
import AiRerouting from '../components/AiRerouting';
import VoiceAssistant from '../components/VoiceAssistant';
import CriticalVoiceAlert from '../components/CriticalVoiceAlert';

const BACKEND = 'http://localhost:5000';


function useLive(base, range, ms = 2000) {
  const [v, setV] = useState(base);
  useEffect(() => {
    const id = setInterval(() => setV(+(base + (Math.random() - 0.5) * range).toFixed(1)), ms);
    return () => clearInterval(id);
  }, [base, range, ms]);
  return v;
}

function useInt(base, range, ms = 2500) {
  const [v, setV] = useState(base);
  useEffect(() => {
    const id = setInterval(() => setV(Math.round(base + (Math.random() - 0.5) * range)), ms);
    return () => clearInterval(id);
  }, [base, range, ms]);
  return v;
}

function Sparkline({ values, color }) {
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const w = 90, h = 22;
  const pts = values.map((v, i) =>
    `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`
  ).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={w} cy={h - ((values[values.length - 1] - min) / range) * h}
        r="2" fill={color} />
    </svg>
  );
}

function useHistory(value, len = 10) {
  const [hist, setHist] = useState(Array(len).fill(value));
  useEffect(() => { setHist(h => [...h.slice(1), value]); }, [value]);
  return hist;
}

function Compass({ deg }) {
  return (
    <svg width="60" height="60" viewBox="0 0 72 72" aria-label={`Wind ${deg}°`}>
      <circle cx="36" cy="36" r="32" stroke="rgba(255,255,255,0.18)" strokeWidth="1" fill="none"/>
      <circle cx="36" cy="36" r="22" stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none"/>
      {['N','E','S','W'].map((d, i) => {
        const r = (i * 90 - 90) * Math.PI / 180;
        return <text key={d} x={36 + 26 * Math.cos(r)} y={36 + 26 * Math.sin(r)}
          textAnchor="middle" dominantBaseline="middle"
          fill={d === 'N' ? '#60c8ff' : 'rgba(255,255,255,0.45)'} fontSize="7" fontWeight="700">{d}</text>;
      })}
      <g transform={`rotate(${deg}, 36, 36)`}>
        <polygon points="36,10 38.5,34 36,28 33.5,34" fill="#60c8ff" opacity="0.95"/>
        <polygon points="36,62 38.5,38 36,44 33.5,38" fill="rgba(255,255,255,0.2)"/>
      </g>
      <circle cx="36" cy="36" r="2.5" fill="#60c8ff"/>
    </svg>
  );
}

function GaugeBar({ value, max, color }) {
  return (
    <div className={styles.gaugeBar}>
      <div className={styles.gaugeFill} style={{ width: `${Math.min((value/max)*100,100)}%`, background: color }} />
    </div>
  );
}

const bearingLabel = d => {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(d / 22.5) % 16];
};

/* ══════════════════════════════
   DASHBOARD PAGE
   ══════════════════════════════ */
export default function DashboardPage() {
  const altitude  = useLive(35000, 500, 3000);
  const speed     = useLive(480, 20, 2000);
  const heading   = useInt(225, 15, 4000);
  const vspeed    = useLive(0, 200, 2500);
  const fuelFlow  = useLive(2800, 200, 2000);
  const windSpeed = useLive(24, 10, 2000);
  const windGust  = useLive(38, 12, 2500);
  const windDir   = useInt(225, 40, 4000);
  const temp      = useLive(8, 3, 2500);
  const humidity  = useInt(72, 8, 3500);
  const pressure  = useLive(1013, 4, 4000);
  const visibility= useLive(9.2, 2, 3000);
  const n1Eng1    = useLive(82, 4, 1800);
  const n1Eng2    = useLive(83, 4, 1800);
  const oilTemp   = useLive(88, 5, 3000);

  const altHist   = useHistory(altitude);
  const speedHist = useHistory(speed);
  const windHist  = useHistory(windSpeed);

  // ── Live hardware state from Arduino ──
  const [turbLevel,  setTurbLevel]  = useState('NONE');
  const [iceLevel,   setIceLevel]   = useState('NONE');
  const [distanceCm, setDistanceCm] = useState(null);
  const [icingPct,   setIcingPct]   = useState(null);
  const [shakeDps,   setShakeDps]   = useState(null);
  const [pitchDeg,   setPitchDeg]   = useState(null);
  const [rollDeg,    setRollDeg]    = useState(null);
  const [tiltDeg,    setTiltDeg]    = useState(null);
  const [condition,  setCondition]  = useState('NORMAL');

  useEffect(() => {
    const socket = io(BACKEND, { transports: ['polling'] });
    socket.on('hw_update', (d) => {
      if (d.turb_level   != null) setTurbLevel(d.turb_level);
      if (d.ice_level    != null) setIceLevel(d.ice_level);
      if (d.distance_cm  != null) setDistanceCm(d.distance_cm);
      if (d.icing_pct    != null) setIcingPct(d.icing_pct);
      if (d.shake_dps    != null) setShakeDps(d.shake_dps);
      if (d.pitch_deg    != null) setPitchDeg(d.pitch_deg);
      if (d.roll_deg     != null) setRollDeg(d.roll_deg);
      if (d.tilt_deg     != null) setTiltDeg(d.tilt_deg);
    });
    socket.on('condition_update', ({ condition: c }) => setCondition(c));
    return () => socket.disconnect();
  }, []);

  return (
    <div className={styles.page}>

      {/* ── Main ── */}
      <main className={styles.main}>

        {/* Stat cards */}
        <section className={styles.statsRow} aria-label="Flight telemetry">
          {[
            { id:'alt',  label:'Altitude',    val:`${altitude.toLocaleString()}`, unit:'ft',   color:'#60c8ff', hist:altHist },
            { id:'spd',  label:'Airspeed',    val:speed.toFixed(0),               unit:'kts',  color:'#c084fc', hist:speedHist },
            { id:'hdg',  label:'Heading',     val:`${heading}°`,                  unit:'',     color:'#34d399', hist:null },
            { id:'vs',   label:'Vert. Speed', val:vspeed.toFixed(0),              unit:'fpm',  color: vspeed > 0 ? '#22c55e' : '#f87171', hist:null },
            { id:'fuel', label:'Fuel Flow',   val:fuelFlow.toFixed(0),            unit:'kg/h', color:'#fbbf24', hist:null },
          ].map(s => (
            <div key={s.id} id={`stat-${s.id}`} className={styles.statCard}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statVal} style={{ color: s.color }}>
                {s.val}<span className={styles.statUnit}> {s.unit}</span>
              </span>
              {s.hist && <div className={styles.statSpark}><Sparkline values={s.hist} color={s.color}/></div>}
            </div>
          ))}
        </section>

        {/* AI Rerouting — full width, wired to live hardware */}
        <div style={{ marginBottom: '1.25rem' }}>
          <AiRerouting
            turbLevel={turbLevel}
            iceLevel={iceLevel}
            distanceCm={distanceCm}
            departure="BLR"
            destination="DEL"
          />
        </div>

        {/* Panels */}
        <div className={styles.panelsGrid}>

          {/* Wind */}
          <div id="panel-wind" className={styles.panel}>
            <h3 className={styles.panelTitle}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M17.7 7.7A2.5 2.5 0 1112 10H2M9.6 4.4A2 2 0 1111 8H2M12.6 19.4A2 2 0 1014 16H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Wind
            </h3>
            <div className={styles.windLayout}>
              <div className={styles.windNumbers}>
                <div className={styles.bigVal} style={{ color:'#60c8ff' }}>
                  {windSpeed.toFixed(0)}<span className={styles.unit}> kts</span>
                </div>
                <div className={styles.windMeta}>
                  <span>Gust <strong>{windGust.toFixed(0)} kts</strong></span>
                  <span>{bearingLabel(windDir)}</span>
                </div>
                <Sparkline values={windHist} color="#60c8ff"/>
              </div>
              <Compass deg={windDir}/>
            </div>
          </div>

          {/* Atmosphere */}
          <div id="panel-atmo" className={styles.panel}>
            <h3 className={styles.panelTitle}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Atmosphere
            </h3>
            <div className={styles.atmoGrid}>
              <div className={styles.atmoItem}>
                <span className={styles.atmoLabel}>Temp</span>
                <span className={styles.atmoVal} style={{color:'#fb923c'}}>{temp>0?'+':''}{temp.toFixed(1)}°C</span>
              </div>
              <div className={styles.atmoItem}>
                <span className={styles.atmoLabel}>Humidity</span>
                <span className={styles.atmoVal} style={{color:'#a78bfa'}}>{humidity}%</span>
              </div>
              <div className={styles.atmoItem}>
                <span className={styles.atmoLabel}>Pressure</span>
                <span className={styles.atmoVal} style={{color:'#34d399'}}>{pressure.toFixed(0)} hPa</span>
              </div>
              <div className={styles.atmoItem}>
                <span className={styles.atmoLabel}>Visibility</span>
                <span className={styles.atmoVal} style={{color:'#60c8ff'}}>{visibility.toFixed(1)} nm</span>
              </div>
            </div>
          </div>

          {/* Engines */}
          <div id="panel-engine" className={styles.panel}>
            <h3 className={styles.panelTitle}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Engines
            </h3>
            <div className={styles.engineList}>
              {[
                { id:'eng1', label:'ENG 1 N1', val:n1Eng1, color:'#60c8ff' },
                { id:'eng2', label:'ENG 2 N1', val:n1Eng2, color:'#818cf8' },
                { id:'oil',  label:'Oil Temp', val:oilTemp, color:'#fbbf24', max:120 },
              ].map(e => (
                <div key={e.id} id={`gauge-${e.id}`} className={styles.engineRow}>
                  <span className={styles.engineLabel}>{e.label}</span>
                  <GaugeBar value={e.val} max={e.max||100} color={e.color}/>
                  <span className={styles.engineVal} style={{color:e.color}}>
                    {e.val.toFixed(0)}{e.max?'°C':'%'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Engine Status Panel */}
        <EngineStatusPanel />

      </main>

      {/* Voice assistant — global floating button */}
      <VoiceAssistant
        flightState={{
          turb_level:  turbLevel,
          ice_level:   iceLevel,
          distance_cm: distanceCm,
        }}
      />

      {/* Critical auto voice alert — fires when danger thresholds breach */}
      <CriticalVoiceAlert
        condition={condition}
        hw={{
          turb_level:  turbLevel,
          ice_level:   iceLevel,
          distance_cm: distanceCm,
          icing_pct:   icingPct,
          shake_dps:   shakeDps,
          pitch_deg:   pitchDeg,
          roll_deg:    rollDeg,
          tilt_deg:    tiltDeg,
        }}
      />

    </div>
  );
}
