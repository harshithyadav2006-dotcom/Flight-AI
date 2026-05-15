"""routes/reroute.py — AI rerouting endpoint powered by Groq"""
from flask import Blueprint, request, jsonify
from services.groq_service import get_ai_reroute

reroute_bp = Blueprint("reroute", __name__)

@reroute_bp.route("/", methods=["POST"])
def reroute():
    data = request.get_json(force=True, silent=True) or {}
    try:
        result = get_ai_reroute(
            turb_level  = data.get("turb_level",  "NONE"),
            ice_level   = data.get("ice_level",   "NONE"),
            distance_cm = float(data.get("distance_cm", 999)),
            shake_dps   = float(data.get("shake_dps",   0)),
            tilt_deg    = float(data.get("tilt_deg",    0)),
        )
        return jsonify({"ok": True, "recommendation": result})
    except ValueError as e:
        # Groq key not set
        return jsonify({"ok": False, "error": str(e)}), 503
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
