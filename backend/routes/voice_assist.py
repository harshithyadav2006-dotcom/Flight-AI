"""routes/voice_assist.py — Groq-powered pilot voice command handler"""
import os
import json
from flask import Blueprint, request, jsonify
from groq import Groq

voice_bp = Blueprint("voice_assist", __name__)

SYSTEM_PROMPT = """You are SkyPilot AI — an onboard aviation co-pilot assistant.
The pilot speaks to you verbally. You must:
1. Understand the pilot's intent from the transcript
2. Respond concisely (1-3 sentences, plain English, no markdown)
3. Identify any ACTION required

Current flight state will be provided with each request.

Output ONLY valid JSON (no markdown fences):
{
  "response": "Your spoken response to the pilot",
  "action": "NONE" | "REROUTE" | "SHOW_WEATHER" | "SHOW_STATUS" | "EMERGENCY" | "SHOW_RADAR",
  "urgency": "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": "3-5 word summary of what was asked"
}

Action rules:
- REROUTE: pilot asks about rerouting, deviating, avoiding something
- SHOW_WEATHER: pilot asks about weather, conditions, atmosphere
- SHOW_STATUS: pilot asks for status, readings, check systems
- EMERGENCY: pilot says mayday, emergency, critical issue, need help
- SHOW_RADAR: pilot asks about radar, proximity, obstacles
- NONE: general question, answered in text only
"""


def _get_groq_client():
    key = os.getenv("GROQ_API_KEY", "")
    if not key or key == "your_groq_api_key_here":
        raise ValueError("GROQ_API_KEY not configured")
    return Groq(api_key=key)


@voice_bp.route("/", methods=["POST"])
def voice_assist():
    data       = request.get_json(force=True, silent=True) or {}
    transcript = data.get("transcript", "").strip()
    state      = data.get("flight_state", {})

    if not transcript:
        return jsonify({"ok": False, "error": "Empty transcript"}), 400

    # Build context from live sensor state
    context = f"""
Current flight state:
- Turbulence: {state.get('turb_level', 'UNKNOWN')}
- Icing: {state.get('ice_level', 'UNKNOWN')}
- Sensor distance: {state.get('distance_cm', '?')} cm
- Shake: {state.get('shake_dps', '?')} °/s
- Tilt: {state.get('tilt_deg', '?')}°
- Pitch: {state.get('pitch_deg', '?')}°
- Roll: {state.get('roll_deg', '?')}°

Pilot said: "{transcript}"
"""

    try:
        client = _get_groq_client()
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system",  "content": SYSTEM_PROMPT},
                {"role": "user",    "content": context},
            ],
            temperature=0.3,
            max_tokens=250,
        )
        raw = resp.choices[0].message.content.strip()

        # Parse JSON (strip any accidental markdown)
        clean = raw.lstrip("```json").lstrip("```").rstrip("```").strip()
        result = json.loads(clean)
        return jsonify({"ok": True, "transcript": transcript, **result})

    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 503
    except json.JSONDecodeError:
        # Return raw text if JSON parse fails
        return jsonify({
            "ok":        True,
            "transcript": transcript,
            "response":   raw[:300],
            "action":     "NONE",
            "urgency":    "NONE",
            "summary":    "Voice response",
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
