"""Routes — /api/telemetry"""
import random
from flask import Blueprint, jsonify

telemetry_bp = Blueprint("telemetry", __name__)


def _jitter(base, spread):
    return round(base + (random.random() - 0.5) * spread, 1)


@telemetry_bp.get("/")
def get_telemetry():
    """Return current simulated telemetry snapshot."""
    return jsonify({
        "altitude_ft":   _jitter(35000, 500),
        "airspeed_kts":  _jitter(480, 20),
        "heading_deg":   round(_jitter(225, 15)),
        "vertical_speed_fpm": _jitter(0, 200),
        "fuel_flow_kg_h":    _jitter(2800, 200),
        "n1_eng1_pct":   _jitter(82, 4),
        "n1_eng2_pct":   _jitter(83, 4),
        "oil_temp_c":    _jitter(88, 5),
    })
