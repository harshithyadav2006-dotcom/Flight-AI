"""routes/openmeteo.py — Open-Meteo weather endpoint (free, no API key)"""
from flask import Blueprint, request, jsonify
from services.groq_service import get_open_meteo_weather

openmeteo_bp = Blueprint("openmeteo", __name__)

@openmeteo_bp.route("/", methods=["GET", "POST"])
def weather():
    if request.method == "POST":
        data = request.get_json(force=True, silent=True) or {}
        city = data.get("city", "")
    else:
        city = request.args.get("city", "")

    if not city:
        return jsonify({"ok": False, "error": "city code required"}), 400

    result = get_open_meteo_weather(city)
    if "error" in result:
        return jsonify({"ok": False, "error": result["error"]}), 500
    return jsonify({"ok": True, "weather": result})
