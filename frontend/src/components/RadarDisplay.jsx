/**
 * RadarDisplay.jsx
 * Canvas half-circle radar linked to Arduino servo sweep.
 * Receives radar_update events via socket: { radar_x, radar_y, distance_cm }
 *
 * Mapping:
 *   ServoX 0° → left edge (270° canvas)
 *   ServoX 90° → top (straight ahead)
 *   ServoX 180° → right edge
 *   distance_cm → radius (max 200cm = full range ring)
 */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND   = 'http://localhost:5000';
const MAX_DIST  = 200;   // HC-SR04 max practical range in cm
const MAX_BLIPS = 80;    // rolling history buffer

// Convert servo angle (0-180) to canvas radians (π → 0, left to right)
const servoToRad = (deg) => ((180 - deg) / 180) * Math.PI;

export default function RadarDisplay({ width = 260, height = 160 }) {
  const canvasRef  = useRef(null);
  const blipsRef   = useRef([]);   // { angle, dist, ts }
  const sweepRef   = useRef({ angle: 90, dist: 999 });
  const rafRef     = useRef(null);

  // Draw loop
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;
    const cx  = W / 2;
    const cy  = H - 8;       // origin at bottom-center
    const R   = H - 16;      // max radius

    // ── Background ──────────────────────────────────────────────
    ctx.fillStyle = '#020e0a';
    ctx.fillRect(0, 0, W, H);

    // ── Range rings ─────────────────────────────────────────────
    [0.25, 0.5, 0.75, 1.0].forEach((frac, i) => {
      ctx.beginPath();
      ctx.arc(cx, cy, R * frac, Math.PI, 0, false);
      ctx.strokeStyle = `rgba(0,200,80,${i === 3 ? 0.45 : 0.18})`;
      ctx.lineWidth = i === 3 ? 1 : 0.5;
      ctx.setLineDash([]);
      ctx.stroke();

      // Range labels
      if (frac < 1) {
        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = 'rgba(0,200,80,0.4)';
        ctx.fillText(`${(MAX_DIST * frac).toFixed(0)}cm`, cx + 4, cy - R * frac + 2);
      }
    });

    // ── Angle grid lines every 30° ───────────────────────────────
    [0, 30, 60, 90, 120, 150, 180].forEach(deg => {
      const rad = servoToRad(deg);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(rad) * R, cy - Math.sin(rad) * R);
      ctx.strokeStyle = 'rgba(0,200,80,0.12)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    // ── Angle labels ─────────────────────────────────────────────
    [[0, '0°'], [30, '30'], [60, '60'], [90, '90°'], [120, '120'], [150, '150'], [180, '180°']].forEach(
      ([deg, label]) => {
        const rad = servoToRad(deg);
        const lx  = cx + Math.cos(rad) * (R + 10);
        const ly  = cy - Math.sin(rad) * (R + 10);
        ctx.font = '7px Inter, sans-serif';
        ctx.fillStyle = 'rgba(0,200,80,0.35)';
        ctx.textAlign = 'center';
        ctx.fillText(label, lx, ly + 3);
      }
    );
    ctx.textAlign = 'left';

    // ── Historical blips (fading) ─────────────────────────────────
    const now = Date.now();
    blipsRef.current.forEach(({ angle, dist, ts }) => {
      if (dist >= MAX_DIST) return;
      const age  = (now - ts) / 4000;  // fade over 4s
      if (age > 1) return;
      const r    = (dist / MAX_DIST) * R;
      const rad  = servoToRad(angle);
      const px   = cx + Math.cos(rad) * r;
      const py   = cy - Math.sin(rad) * r;
      const alpha = 1 - age;

      // Outer glow
      const grd = ctx.createRadialGradient(px, py, 0, px, py, 8);
      grd.addColorStop(0, `rgba(0,255,100,${alpha * 0.5})`);
      grd.addColorStop(1, 'rgba(0,255,100,0)');
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,255,100,${alpha})`;
      ctx.fill();
    });

    // ── Sweep line (current angle) ────────────────────────────────
    const { angle: sa, dist: sd } = sweepRef.current;
    const sweepRad = servoToRad(sa);

    // Glowing sector behind sweep
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, sweepRad - 0.18, sweepRad + 0.02, false);
    ctx.closePath();
    const sectorGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    sectorGrd.addColorStop(0, 'rgba(0,255,80,0.25)');
    sectorGrd.addColorStop(1, 'rgba(0,255,80,0)');
    ctx.fillStyle = sectorGrd;
    ctx.fill();

    // Sweep line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepRad) * R, cy - Math.sin(sweepRad) * R);
    ctx.strokeStyle = '#00ff64';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00ff64';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Live blip at current sweep position ────────────────────────
    if (sd < MAX_DIST) {
      const r  = (sd / MAX_DIST) * R;
      const px = cx + Math.cos(sweepRad) * r;
      const py = cy - Math.sin(sweepRad) * r;

      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff64';
      ctx.shadowColor = '#00ff64';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Distance readout next to blip
      ctx.font = '8px Roboto Mono, monospace';
      ctx.fillStyle = 'rgba(0,255,100,0.9)';
      ctx.fillText(`${sd.toFixed(0)}cm`, px + 6, py - 4);
    }

    // ── Origin dot ───────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff64';
    ctx.fill();

    // ── Baseline ─────────────────────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.strokeStyle = 'rgba(0,200,80,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    rafRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    // Socket.IO listener
    const socket = io(BACKEND, { transports: ['polling'] });

    socket.on('radar_update', ({ radar_x, distance_cm }) => {
      sweepRef.current = { angle: radar_x ?? 90, dist: distance_cm ?? 999 };

      // Push to history
      blipsRef.current.push({ angle: radar_x ?? 90, dist: distance_cm ?? 999, ts: Date.now() });
      if (blipsRef.current.length > MAX_BLIPS) blipsRef.current.shift();
    });

    // Also accept hw_update as fallback
    socket.on('hw_update', ({ radar_x, distance_cm }) => {
      if (radar_x != null) sweepRef.current = { angle: radar_x, dist: distance_cm ?? 999 };
    });

    // Start draw loop
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      socket.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: '100%',
        height: 'auto',
        display: 'block',
        borderRadius: '8px',
        background: '#020e0a',
      }}
    />
  );
}
