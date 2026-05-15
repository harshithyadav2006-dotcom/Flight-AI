"""
services/groq_service.py
Groq LLM integration for SkyPilot AI.

Provides:
  - get_ai_reroute()   — real-time rerouting from sensor data
  - get_ai_analysis()  — flight route analysis from departure/destination
  - get_weather_brief() — plain-language weather brief from Open-Meteo data
"""
import os
import json
import requests
from groq import Groq

# ── Client ────────────────────────────────────────────────────────
def _client():
    key = os.getenv("GROQ_API_KEY", "")
    if not key or key == "your_groq_api_key_here":
        raise ValueError("GROQ_API_KEY not set in .env")
    return Groq(api_key=key)


def _chat(prompt: str, max_tokens: int = 400, temperature: float = 0.3) -> str:
    """Run a single-turn chat completion."""
    resp = _client().chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content.strip()


# ══════════════════════════════════════════════════════════════════
# 1. AI REROUTING — from live Arduino sensor data
# ══════════════════════════════════════════════════════════════════
def get_ai_reroute(turb_level: str, ice_level: str,
                   distance_cm: float, shake_dps: float, tilt_deg: float) -> dict:
    """
    Given live IoT sensor data, return an AI-generated rerouting recommendation.
    Returns a dict that the frontend can render directly.
    """
    prompt = f"""You are an AI aviation safety co-pilot integrated into a real aircraft monitoring system.
Real-time sensor readings from the aircraft right now:
  - Turbulence level: {turb_level}
  - Gyroscope shake: {shake_dps:.1f} °/s
  - Tilt angle: {tilt_deg:.1f}°
  - Icing status: {ice_level}
  - Proximity sensor (icing probe) distance: {distance_cm:.0f} cm (lower = more icing)

Analyze these readings and output ONLY a valid JSON object (no markdown, no extra text):
{{
  "action": "IMMEDIATE REROUTE" | "RECOMMENDED REROUTE" | "MONITOR" | "NORMAL",
  "urgency": "HIGH" | "MEDIUM" | "LOW" | "NONE",
  "heading_change": "+X° starboard / -X° port / Maintain heading",
  "altitude_change": "Climb to FLXXX / Descend to FLXXX / Maintain FLXXX",
  "speed_adjustment": "specific knot instruction or Maintain",
  "reason": "one clear sentence explaining why",
  "pilot_note": "one short actionable message for the pilot"
}}"""

    raw = _chat(prompt, max_tokens=350, temperature=0.2)

    # Parse JSON — handle cases where model wraps in backticks
    try:
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        return json.loads(clean)
    except json.JSONDecodeError:
        # Fallback: return raw text in a structured wrapper
        return {
            "action": "MONITOR",
            "urgency": "LOW",
            "heading_change": "Maintain heading",
            "altitude_change": "Maintain altitude",
            "speed_adjustment": "Maintain speed",
            "reason": raw[:200],
            "pilot_note": "Check AI response format.",
        }


# ══════════════════════════════════════════════════════════════════
# 2. AI FLIGHT ANALYSIS — from departure/destination + weather
# ══════════════════════════════════════════════════════════════════
def get_ai_analysis(departure: str, destination: str, weather_data: dict = None) -> dict:
    """
    Generate a preflight safety analysis and route briefing using Groq.
    """
    weather_summary = ""
    if weather_data:
        w = weather_data
        weather_summary = f"""
Current weather at departure ({departure}):
  - Wind: {w.get('wind_speed', '?')} km/h from {w.get('wind_direction', '?')}°
  - Temperature: {w.get('temperature', '?')}°C
  - Pressure: {w.get('pressure', '?')} hPa
  - Cloud cover: {w.get('cloud_cover', '?')}%
  - Visibility code: {w.get('weather_code', '?')}
  - Precipitation: {w.get('precipitation', '?')} mm"""

    prompt = f"""You are SkyPilot AI, an aviation safety analysis system.
Analyze a flight from {departure} to {destination}.{weather_summary}

Provide a structured preflight safety briefing. Output ONLY valid JSON:
{{
  "risk_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "go_nogo": "GO" | "GO WITH CAUTION" | "NO-GO",
  "route_summary": "2-sentence route description",
  "hazards": ["hazard 1", "hazard 2", "hazard 3"],
  "recommendations": ["rec 1", "rec 2", "rec 3"],
  "estimated_duration": "X hours Y minutes",
  "alternate_airports": ["ICAO1 - Name", "ICAO2 - Name"],
  "weather_brief": "2-sentence plain-language weather summary",
  "fuel_margin_note": "specific note about fuel planning"
}}"""

    raw = _chat(prompt, max_tokens=600, temperature=0.3)

    try:
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        return json.loads(clean)
    except json.JSONDecodeError:
        return {
            "risk_level": "MEDIUM",
            "go_nogo": "GO WITH CAUTION",
            "route_summary": raw[:300],
            "hazards": [],
            "recommendations": [],
            "estimated_duration": "Unknown",
            "alternate_airports": [],
            "weather_brief": "Weather data unavailable.",
            "fuel_margin_note": "Standard fuel reserves apply.",
        }


# ══════════════════════════════════════════════════════════════════
# 3. OPEN-METEO WEATHER — free, no API key
# ══════════════════════════════════════════════════════════════════

# City → approximate lat/lon lookup
CITY_COORDS = {
    "BLR": (12.97, 77.59), "DEL": (28.61, 77.20), "BOM": (19.08, 72.88),
    "MAA": (13.08, 80.27), "HYD": (17.38, 78.49), "CCU": (22.57, 88.36),
    "LHR": (51.47, -0.45), "JFK": (40.64, -73.78), "DXB": (25.25, 55.36),
    "SIN": (1.35, 103.99), "CDG": (49.01, 2.55),  "FRA": (50.03, 8.57),
    "NRT": (35.77, 140.39), "LAX": (33.94, -118.41), "ORD": (41.97, -87.91),
}

def get_open_meteo_weather(city_code: str) -> dict:
    """
    Fetch current weather from Open-Meteo (completely free, no API key).
    Returns a flat dict ready for the frontend.
    """
    coords = CITY_COORDS.get(city_code.upper())
    if not coords:
        return {"error": f"Unknown city code: {city_code}"}

    lat, lon = coords
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m,wind_speed_10m,"
        f"wind_direction_10m,surface_pressure,cloud_cover,precipitation,"
        f"weather_code,visibility"
        f"&wind_speed_unit=kmh&timezone=auto"
    )
    try:
        resp = requests.get(url, timeout=8)
        resp.raise_for_status()
        data = resp.json()
        c = data.get("current", {})
        return {
            "city":            city_code.upper(),
            "temperature":     c.get("temperature_2m"),
            "humidity":        c.get("relative_humidity_2m"),
            "wind_speed":      c.get("wind_speed_10m"),
            "wind_direction":  c.get("wind_direction_10m"),
            "pressure":        c.get("surface_pressure"),
            "cloud_cover":     c.get("cloud_cover"),
            "precipitation":   c.get("precipitation"),
            "weather_code":    c.get("weather_code"),
            "visibility":      c.get("visibility"),
        }
    except Exception as e:
        return {"error": str(e)}
