"""Routes — /api/preflight  (pre-flight GO/CAUTION/NO-GO assessment)"""
import os
import requests
from flask import Blueprint, request, jsonify

preflight_bp = Blueprint("preflight", __name__)

OWM_KEY = os.getenv("OWM_API_KEY", "")
OWM_URL = "https://api.openweathermap.org/data/2.5/weather"


def _fetch_weather(city: str) -> dict | None:
    """Fetch current weather from OpenWeatherMap for a city/airport name."""
    if not OWM_KEY:
        return None
    try:
        r = requests.get(OWM_URL, params={"q": city, "appid": OWM_KEY, "units": "metric"}, timeout=5)
        r.raise_for_status()
        return r.json()
    except Exception:
        return None


def _assess(dep_data: dict | None, dest_data: dict | None, dep: str, dest: str) -> dict:
    """
    Derive GO / CAUTION / NO-GO from weather data.
    Falls back to a simulated deterministic assessment when no API key is set.
    """
    # ── Simulated fallback (no API key) ──────────────────────────────────────
    if dep_data is None or dest_data is None:
        import hashlib, time
        seed = int(hashlib.md5(f"{dep}{dest}{int(time.time()//300)}".encode()).hexdigest(), 16) % 100
        if seed < 55:
            return {
                "verdict": "GO",
                "color": "#16a34a",
                "icon": "✅",
                "reason": f"Route {dep.upper()}→{dest.upper()}: Clear skies expected. Winds calm, visibility excellent. No adverse weather along the corridor.",
                "simulated": True,
            }
        elif seed < 80:
            return {
                "verdict": "CAUTION",
                "color": "#d97706",
                "icon": "⚠️",
                "reason": f"Route {dep.upper()}→{dest.upper()}: Moderate turbulence forecast at cruise altitude. Monitor SIGMET and consider alternate routing.",
                "simulated": True,
            }
        else:
            return {
                "verdict": "NO-GO",
                "color": "#dc2626",
                "icon": "🚫",
                "reason": f"Route {dep.upper()}→{dest.upper()}: Severe storm system detected. Wind shear and icing risk exceed operational limits. Flight not recommended.",
                "simulated": True,
            }

    # ── Real OWM data assessment ──────────────────────────────────────────────
    reasons = []
    score = 0  # 0=GO, 1=CAUTION, 2=NO-GO

    for label, data in [("Departure", dep_data), ("Destination", dest_data)]:
        wind_mps = data.get("wind", {}).get("speed", 0)
        wind_kts = wind_mps * 1.94384
        visibility_m = data.get("visibility", 10000)
        conditions = [w.get("main", "") for w in data.get("weather", [])]
        temp_c = data.get("main", {}).get("temp", 20)

        if wind_kts > 35:
            score = max(score, 2)
            reasons.append(f"{label}: winds {wind_kts:.0f}kts (exceeds limit)")
        elif wind_kts > 20:
            score = max(score, 1)
            reasons.append(f"{label}: winds {wind_kts:.0f}kts (strong)")

        if visibility_m < 1500:
            score = max(score, 2)
            reasons.append(f"{label}: visibility {visibility_m}m (below minimums)")
        elif visibility_m < 5000:
            score = max(score, 1)
            reasons.append(f"{label}: reduced visibility {visibility_m}m")

        if any(c in ("Thunderstorm", "Snow", "Tornado") for c in conditions):
            score = max(score, 2)
            reasons.append(f"{label}: {', '.join(conditions)}")
        elif any(c in ("Rain", "Drizzle", "Squall") for c in conditions):
            score = max(score, 1)
            reasons.append(f"{label}: {', '.join(conditions)}")

        if temp_c < -20:
            score = max(score, 1)
            reasons.append(f"{label}: extreme cold {temp_c:.0f}°C (icing risk)")

    if not reasons:
        reasons.append(f"Route {dep.upper()}→{dest.upper()}: All parameters within normal limits.")

    verdicts = [
        {"verdict": "GO",      "color": "#16a34a", "icon": "✅"},
        {"verdict": "CAUTION", "color": "#d97706", "icon": "⚠️"},
        {"verdict": "NO-GO",   "color": "#dc2626", "icon": "🚫"},
    ]
    result = verdicts[score]
    result["reason"] = " | ".join(reasons)
    result["simulated"] = False
    return result


@preflight_bp.post("/")
def preflight_assessment():
    body = request.get_json(silent=True) or {}
    dep  = body.get("departure", "").strip()
    dest = body.get("destination", "").strip()

    if not dep or not dest:
        return jsonify({"error": "departure and destination required"}), 400

    dep_data  = _fetch_weather(dep)
    dest_data = _fetch_weather(dest)
    result = _assess(dep_data, dest_data, dep, dest)

    return jsonify({
        "departure":   dep.upper(),
        "destination": dest.upper(),
        **result,
    })
