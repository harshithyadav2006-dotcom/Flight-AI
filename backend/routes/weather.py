"""Routes — /api/weather"""
import random
from flask import Blueprint, jsonify

weather_bp = Blueprint("weather", __name__)


def _j(base, spread, decimals=1):
    return round(base + (random.random() - 0.5) * spread, decimals)


@weather_bp.get("/")
def get_weather():
    """Return current atmospheric / weather conditions."""
    wind_speed = _j(24, 10)
    wind_gust  = wind_speed + _j(14, 6)
    return jsonify({
        "wind_speed_kts":    wind_speed,
        "wind_gust_kts":     round(wind_gust, 1),
        "wind_dir_deg":      round(_j(225, 40)),
        "temperature_c":     _j(8, 3),
        "humidity_pct":      round(_j(72, 8)),
        "pressure_hpa":      _j(1013, 4),
        "visibility_nm":     _j(9.2, 2),
        "icing_risk_pct":    _j(18, 8),
    })
