/**
 * RouteMap.jsx
 * Interactive Leaflet map showing:
 *  - Original flight route (dashed gray)
 *  - AI rerouted path (solid green, curved around hazard)
 *  - Hazard zone (colored circle)
 *  - Aircraft marker (current position)
 *
 * Uses free OpenStreetMap tiles — no API key required.
 */
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet's broken default marker icons in Vite/webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Airport coordinates [lat, lon] ────────────────────────────────
const AIRPORTS = {
  BLR: [12.97, 77.59], DEL: [28.61, 77.20], BOM: [19.08, 72.88],
  MAA: [13.08, 80.27], HYD: [17.38, 78.49], CCU: [22.57, 88.36],
  LHR: [51.47, -0.45], JFK: [40.64, -73.78], DXB: [25.25, 55.36],
  SIN: [1.35, 103.99], CDG: [49.01, 2.55],   FRA: [50.03, 8.57],
  NRT: [35.77, 140.39], LAX: [33.94, -118.41], ORD: [41.97, -87.91],
};

// Midpoint between two [lat,lon] points
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

// Perpendicular offset point for the detour waypoint
function perpendicularOffset([lat1, lon1], [lat2, lon2], distance) {
  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;
  const len  = Math.sqrt(dlat * dlat + dlon * dlon) || 1;
  // rotate 90°: (-dlon, dlat)
  return [
    (lat1 + lat2) / 2 - (dlon / len) * distance,
    (lon1 + lon2) / 2 + (dlat / len) * distance,
  ];
}

// Custom aircraft SVG icon
const aircraftIcon = L.divIcon({
  className: '',
  html: `<div style="
    font-size:24px;
    transform:rotate(0deg);
    filter:drop-shadow(0 0 4px rgba(96,200,255,0.8));
    line-height:1;
  ">✈</div>`,
  iconAnchor: [12, 12],
  iconSize:   [24, 24],
});

export default function RouteMap({
  departure   = 'BLR',
  destination = 'DEL',
  isRerouting = false,
  hazardColor = '#ef4444',
  deviation   = 48,          // visual scale factor (controls detour size)
  height      = 260,
}) {
  const mapRef       = useRef(null);
  const instanceRef  = useRef(null);
  const layerRef     = useRef(null);

  // Resolve coordinates (fall back to BLR→DEL)
  const depCoords  = AIRPORTS[departure.toUpperCase()]  || AIRPORTS.BLR;
  const destCoords = AIRPORTS[destination.toUpperCase()] || AIRPORTS.DEL;
  const mid        = midpoint(depCoords, destCoords);

  // ── Initialise Leaflet once ────────────────────────────────────
  useEffect(() => {
    if (instanceRef.current) return;   // already mounted

    const map = L.map(mapRef.current, {
      zoomControl:        true,
      attributionControl: false,
      scrollWheelZoom:    true,
      dragging:           true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

    instanceRef.current = map;
  }, []);

  // ── Redraw route layers whenever props change ─────────────────
  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    // Clear previous route layers
    if (layerRef.current) {
      layerRef.current.forEach(l => map.removeLayer(l));
    }
    const layers = [];

    // ── Compute reroute waypoint ──
    // Scale deviation from SVG units to degrees (roughly 1 unit ≈ 0.08°)
    const detourScale = (deviation / 48) * 3.2;
    const detourPt    = perpendicularOffset(depCoords, destCoords, detourScale);
    const hazardPt    = midpoint(depCoords, destCoords);

    // Hazard zone circle
    const hazardRadius = 80000 * (deviation / 48); // meters
    const hazardCircle = L.circle(hazardPt, {
      radius:      hazardRadius,
      color:       hazardColor,
      fillColor:   hazardColor,
      fillOpacity: 0.1,
      weight:      isRerouting ? 2 : 0,
      dashArray:   '6 4',
      opacity:     isRerouting ? 0.7 : 0,
    }).addTo(map);
    layers.push(hazardCircle);

    if (isRerouting) {
      // Hazard label
      const hazardMarker = L.marker(hazardPt, {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            background:${hazardColor}cc;
            color:#fff;
            font:600 9px Inter,sans-serif;
            padding:2px 6px;
            border-radius:4px;
            white-space:nowrap;
            border:1px solid ${hazardColor};
          ">⚠ HAZARD ZONE</div>`,
          iconAnchor: [40, 10],
        }),
      }).addTo(map);
      layers.push(hazardMarker);
    }

    // Original route — gray dashed
    const origLine = L.polyline([depCoords, destCoords], {
      color:     'rgba(255,255,255,0.25)',
      weight:    2,
      dashArray: '8 6',
    }).addTo(map);
    layers.push(origLine);

    // Rerouted path — green solid via detour waypoint
    const rerouteLine = L.polyline(
      isRerouting
        ? [depCoords, detourPt, destCoords]
        : [depCoords, destCoords],
      {
        color:  '#22c55e',
        weight: isRerouting ? 3 : 2.5,
        opacity: isRerouting ? 0.9 : 0.6,
      }
    ).addTo(map);
    layers.push(rerouteLine);

    // Aircraft marker (at midpoint)
    const acMarker = L.marker(mid, { icon: aircraftIcon }).addTo(map);
    layers.push(acMarker);

    // Departure marker
    const depMarker = L.marker(depCoords, {
      icon: L.divIcon({
        className: '',
        html: `<div style="
          background:rgba(10,25,55,0.9);
          color:#60c8ff;
          font:600 9px Inter,sans-serif;
          padding:2px 6px;border-radius:4px;
          border:1px solid rgba(96,200,255,0.5);
          white-space:nowrap;
        ">${departure.toUpperCase()}</div>`,
        iconAnchor: [14, 0],
      }),
    }).addTo(map);
    layers.push(depMarker);

    // Destination marker
    const destMarker = L.marker(destCoords, {
      icon: L.divIcon({
        className: '',
        html: `<div style="
          background:rgba(10,25,55,0.9);
          color:#22c55e;
          font:600 9px Inter,sans-serif;
          padding:2px 6px;border-radius:4px;
          border:1px solid rgba(34,197,94,0.5);
          white-space:nowrap;
        ">${destination.toUpperCase()} ●</div>`,
        iconAnchor: [14, 0],
      }),
    }).addTo(map);
    layers.push(destMarker);

    layerRef.current = layers;

    // Fit bounds to show full route
    const bounds = L.latLngBounds([depCoords, destCoords]);
    if (isRerouting) bounds.extend(detourPt);
    map.fitBounds(bounds, { padding: [30, 30] });

  }, [isRerouting, hazardColor, deviation, departure, destination]);

  return (
    <div
      ref={mapRef}
      style={{
        width:        '100%',
        height:       `${height}px`,
        borderRadius: '10px',
        overflow:     'hidden',
        zIndex:       1,
      }}
    />
  );
}
