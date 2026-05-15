"""
routes/voice_alert.py
Auto-triggered critical situation voice alert for pilots.
Called by the frontend when sensor thresholds breach CRITICAL / SEVERE levels.
Returns a short, urgent AI-generated spoken briefing.
"""
import os
import json
from flask import Blueprint, request, jsonify
from groq import Groq

voice_alert_bp = Blueprint("voice_alert", __name__)

# ── Groq system prompt tuned for terse emergency briefings ─────────
ALERT_PROMPT = """You are SkyPilot ALERT — an emergency aviation AI co-pilot.
A critical flight condition has been automatically detected by onboard sensors.

You MUST output ONLY valid JSON — no markdown, no extra text:
{
  "spoken_alert": "Urgent spoken message to the pilot (2-3 sentences, clear & calm, use ATC-style phrasing, state the hazard and immediate action)",
  "severity": "WARNING" | "CRITICAL" | "MAYDAY",
  "immediate_action": "Single most urgent thing the pilot must do right now",
  "secondary_action": "Second priority action",
  "condition_summary": "5-word sensor status summary"
}

Rules:
- Keep spoken_alert short, clear, and actionable — it will be read aloud.
- Do NOT use markdown, bullet points, or numbered lists in spoken_alert.
- Use calm but urgent ATC-style phrasing: "Attention flight deck", "Immediate action required", "Initiating emergency protocol".
- Base your response strictly on the sensor data provided.
"""


def _get_groq_client():
    key = os.getenv("GROQ_API_KEY", "")
    if not key or key == "your_groq_api_key_here":
        raise ValueError("GROQ_API_KEY not configured")
    return Groq(api_key=key)


@voice_alert_bp.route("/", methods=["POST"])
def generate_alert():
    data    = request.get_json(force=True, silent=True) or {}
    hw      = data.get("hw", {})
    trigger = data.get("trigger", "UNKNOWN")  # e.g. "SEVERE_TURBULENCE", "CRITICAL_ICING"

    # Build a sensor context string
    turb_level   = hw.get("turb_level",  "UNKNOWN")
    ice_level    = hw.get("ice_level",   "UNKNOWN")
    shake_dps    = hw.get("shake_dps",   "?")
    tilt_deg     = hw.get("tilt_deg",    "?")
    pitch_deg    = hw.get("pitch_deg",   "?")
    roll_deg     = hw.get("roll_deg",    "?")
    distance_cm  = hw.get("distance_cm", "?")
    icing_pct    = hw.get("icing_pct",   "?")

    context = f"""ALERT TRIGGER: {trigger}

Live sensor readings:
- Turbulence level: {turb_level}
- Gyroscope shake: {shake_dps} °/s
- Tilt angle: {tilt_deg}°
- Pitch: {pitch_deg}° | Roll: {roll_deg}°
- Icing status: {ice_level}
- Ultrasonic icing probe distance: {distance_cm} cm
- Icing accumulation: {icing_pct}%

The above values have breached CRITICAL safety thresholds. Generate an emergency pilot briefing."""

    try:
        client = _get_groq_client()
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": ALERT_PROMPT},
                {"role": "user",   "content": context},
            ],
            temperature=0.2,
            max_tokens=200,
        )
        raw = resp.choices[0].message.content.strip()

        # Strip accidental markdown fences
        clean = raw.lstrip("```json").lstrip("```").rstrip("```").strip()
        result = json.loads(clean)
        return jsonify({"ok": True, "trigger": trigger, **result})

    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 503
    except json.JSONDecodeError:
        # Fallback: still usable text
        return jsonify({
            "ok":              True,
            "trigger":         trigger,
            "spoken_alert":    raw[:300] if raw else "Critical condition detected. Immediate action required.",
            "severity":        "CRITICAL",
            "immediate_action": "Assess flight instruments and declare emergency if needed.",
            "secondary_action": "Contact ATC immediately.",
            "condition_summary": f"{trigger} alert active",
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
