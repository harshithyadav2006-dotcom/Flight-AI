"""Routes — /api/forecast  (2-hour predictive weather strip)"""
import os, math, random, time, datetime
import requests
from flask import Blueprint, request, jsonify

forecast_bp = Blueprint("forecast", __name__)

OWM_KEY      = os.getenv("OWM_API_KEY", "")
OWM_FORECAST = "https://api.openweathermap.org/data/2.5/forecast"


# ── helpers ──────────────────────────────────────────────────────────────────

def _icing_risk(temp_c: float, humidity: float) -> float:
    """Simple icing probability 0-100 based on temp & humidity."""
    if temp_c > 2:
        return 0.0
    if temp_c > -10:
        base = (2 - temp_c) / 12 * 60          # 0→60% between +2 and -10
        return min(100, base * (humidity / 80))
    return min(100, 80 * (humidity / 80))


def _tornado_risk(wind_kts: float, conditions: list[str]) -> float:
    """Simple tornado probability 0-100."""
    t_conds = {"Thunderstorm", "Squall", "Tornado"}
    base = 5.0 if any(c in t_conds for c in conditions) else 0.0
    if wind_kts > 40:
        base += (wind_kts - 40) * 2
    return min(100, base)


def _rain_prob(conditions: list[str], humidity: float) -> float:
    rain_conds = {"Rain", "Drizzle", "Thunderstorm", "Snow"}
    if any(c in rain_conds for c in conditions):
        return min(100, 50 + humidity * 0.5)
    return max(0, humidity - 55) * 0.8


# ── simulated fallback ────────────────────────────────────────────────────────

def _simulate(city: str) -> list[dict]:
    """Deterministic 5-slot 30-min-interval fake forecast."""
    seed_base = int(abs(hash(city)) % 1000)
    now = datetime.datetime.utcnow()
    slots = []
    for i in range(5):
        r = random.Random(seed_base + i * 7 + int(time.time() // 1800))
        temp     = round(r.uniform(-5, 28), 1)
        wind_mps = r.uniform(2, 22)
        wind_kts = round(wind_mps * 1.94384, 1)
        humidity = round(r.uniform(40, 95))
        conds    = r.choice([[], [], [], ["Rain"], ["Thunderstorm"]])
        ice      = round(_icing_risk(temp, humidity), 1)
        tornado  = round(_tornado_risk(wind_kts, conds), 1)
        rain     = round(_rain_prob(conds, humidity), 1)
        slots.append({
            "time":          (now + datetime.timedelta(minutes=30 * i)).strftime("%H:%M"),
            "label":         f"T+{i * 30}min" if i > 0 else "NOW",
            "temp_c":        temp,
            "wind_kts":      wind_kts,
            "humidity_pct":  humidity,
            "rain_prob_pct": rain,
            "icing_risk_pct":   ice,
            "tornado_risk_pct": tornado,
            "conditions":    conds if conds else ["Clear"],
            "alert":         ice > 40 or tornado > 20 or rain > 75,
        })
    return slots


def _from_owm(city: str) -> list[dict] | None:
    if not OWM_KEY:
        return None
    try:
        r = requests.get(OWM_FORECAST, params={
            "q": city, "appid": OWM_KEY, "units": "metric", "cnt": 5
        }, timeout=5)
        r.raise_for_status()
        data = r.json()
    except Exception:
        return None

    slots = []
    now = datetime.datetime.utcnow()
    for i, entry in enumerate(data.get("list", [])[:5]):
        temp     = entry["main"]["temp"]
        wind_mps = entry["wind"]["speed"]
        wind_kts = round(wind_mps * 1.94384, 1)
        humidity = entry["main"]["humidity"]
        conds    = [w["main"] for w in entry.get("weather", [])]
        rain_raw = entry.get("rain", {}).get("3h", 0)
        ice      = round(_icing_risk(temp, humidity), 1)
        tornado  = round(_tornado_risk(wind_kts, conds), 1)
        rain     = min(100, round(rain_raw * 20 + _rain_prob(conds, humidity) * 0.4, 1))

        dt = datetime.datetime.utcfromtimestamp(entry["dt"])
        slots.append({
            "time":          dt.strftime("%H:%M"),
            "label":         f"T+{i * 30}min" if i > 0 else "NOW",
            "temp_c":        round(temp, 1),
            "wind_kts":      wind_kts,
            "humidity_pct":  humidity,
            "rain_prob_pct": rain,
            "icing_risk_pct":   ice,
            "tornado_risk_pct": tornado,
            "conditions":    conds or ["Clear"],
            "alert":         ice > 40 or tornado > 20 or rain > 75,
        })
    return slots


# ── endpoint ──────────────────────────────────────────────────────────────────

@forecast_bp.post("/")
def get_forecast():
    body = request.get_json(silent=True) or {}
    city = (body.get("departure") or body.get("city") or "").strip()
    if not city:
        return jsonify({"error": "city/departure required"}), 400

    slots = _from_owm(city) or _simulate(city)
    return jsonify({"city": city.upper(), "slots": slots, "simulated": not bool(OWM_KEY)})
