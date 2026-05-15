"""
Service -- Serial Bridge (v2)
Parses ALL Arduino serial lines using regex, extracts real numeric values,
and emits them to Socket.IO under clean aliases.

Arduino → Alias mapping:
  [TURB] ...Shake:X.Xdps Tilt:X.Xdeg  →  shake_dps, tilt_deg, turb_level
  [ICE]  ...Dist:X.Xcm                 →  distance_cm, ice_level, icing_pct
  [RADAR] ServoX:N ServoY:N | Dist:X.X →  radar_x, radar_y, distance_cm
  WEB_DATA:pitch,roll,yaw,dist         →  pitch_deg, roll_deg, yaw_deg (if Arduino has it)
"""
import re
import serial
import threading
import time
import os

# ─────────────────────────────────────────────────────────────────────
# Regex patterns — match the exact format the Arduino prints
# ─────────────────────────────────────────────────────────────────────

# [TURB] *** SEVERE *** Shake:12.5dps Tilt:45.3deg — SMS SENDING
# [TURB] MODERATE Shake:8.5dps Tilt:2.1deg
# [TURB] Mild Shake:3.2dps Tilt:1.5deg
RE_TURB = re.compile(
    r'\[TURB\].*?Shake:([\d.]+)dps\s+Tilt:([\d.]+)deg',
    re.IGNORECASE
)
RE_TURB_CALM = re.compile(r'\[TURB\].*Smooth', re.IGNORECASE)

# [ICE] *** CRITICAL *** Dist:28.3cm
# [ICE] WARNING Dist:45.7cm
RE_ICE = re.compile(r'\[ICE\].*Dist:([\d.]+)cm', re.IGNORECASE)

# [RADAR] ServoX:90 ServoY:120 | Dist:35.5cm
RE_RADAR = re.compile(
    r'\[RADAR\]\s+ServoX:(\d+)\s+ServoY:(\d+)\s+\|\s+Dist:([\d.]+)cm',
    re.IGNORECASE
)

# WEB_DATA:pitch,roll,yaw,dist  (optional, if Arduino has the line)
RE_WEB = re.compile(r'WEB_DATA:([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)')


def _turb_level_from_line(line: str) -> str:
    up = line.upper()
    if "SEVERE"   in up: return "SEVERE"
    if "MODERATE" in up: return "MODERATE"
    if "MILD"     in up: return "MILD"
    return "NONE"

def _turb_to_condition(level: str) -> str:
    return {
        "SEVERE":   "CRITICAL",
        "MODERATE": "TURBULENCE",
        "MILD":     "TURBULENCE",
        "NONE":     "NORMAL",
    }.get(level, "NORMAL")

def _icing_pct(distance_cm: float) -> float:
    """Convert HC-SR04 distance to an icing risk percentage.
       0 cm → 100%   (sensor totally blocked = max icing)
      50 cm → 0%     (clear = no icing)
    """
    return round(max(0.0, min(100.0, (1.0 - distance_cm / 50.0) * 100.0)), 1)


def start_serial_bridge(socketio):
    """Starts a background thread to read from the Serial port."""

    COM_PORT  = os.getenv("SERIAL_PORT", "COM3")
    BAUD_RATE = int(os.getenv("SERIAL_BAUD", 9600))

    # Shared state — last known values so every event has full context
    state = {
        "turb_level":   "NONE",
        "shake_dps":    0.0,
        "tilt_deg":     0.0,
        "ice_level":    "NONE",
        "distance_cm":  999.0,
        "icing_pct":    0.0,
        "radar_x":      90,
        "radar_y":      90,
        # derived sensor aliases for the plane animation
        "pitch_deg":    0.0,   # tilt_deg used as pitch
        "roll_deg":     0.0,   # shake_dps scaled to roll
        "yaw_deg":      0.0,
    }

    def emit_hw_update():
        """Emit a comprehensive hardware snapshot to all connected clients."""
        socketio.emit("hw_update", {
            # ── Turbulence / IMU ──────────────────
            "turb_level":  state["turb_level"],
            "shake_dps":   state["shake_dps"],   # raw gyro magnitude (deg/s)
            "tilt_deg":    state["tilt_deg"],     # complementary filter angle (deg)
            # ── Derived sensor aliases ────────────
            "pitch_deg":   state["pitch_deg"],    # = tilt_deg  (alias for plane pitch)
            "roll_deg":    state["roll_deg"],     # = shake * scale (alias for roll)
            "yaw_deg":     state["yaw_deg"],
            # ── Icing / Ultrasonic ────────────────
            "ice_level":   state["ice_level"],
            "distance_cm": state["distance_cm"],  # raw HC-SR04 distance
            "icing_pct":   state["icing_pct"],    # 0–100% derived from distance
            # ── Radar sweep ───────────────────────
            "radar_x":     state["radar_x"],      # servo X angle (0–180°)
            "radar_y":     state["radar_y"],      # servo Y angle (45–135°)
        })

    def serial_loop():
        print(f"[SERIAL] Attempting to connect to {COM_PORT}...")
        ser = None

        while True:
            try:
                if ser is None:
                    ser = serial.Serial(COM_PORT, BAUD_RATE, timeout=1)
                    print(f"[SERIAL] Connected to {COM_PORT} @ {BAUD_RATE} baud")

                raw = ser.readline()
                try:
                    line = raw.decode("utf-8").strip()
                except UnicodeDecodeError:
                    continue

                if not line:
                    continue

                # ── [TURB] with numeric values ────────────────────────────
                m = RE_TURB.search(line)
                if m:
                    shake = float(m.group(1))
                    tilt  = float(m.group(2))
                    level = _turb_level_from_line(line)

                    state["turb_level"] = level
                    state["shake_dps"]  = shake
                    state["tilt_deg"]   = tilt
                    # Map to plane axes:
                    #   tilt_deg  → pitch (nose up/down)
                    #   shake_dps → roll  (wing tilt, scaled)
                    state["pitch_deg"]  = round(tilt, 2)
                    state["roll_deg"]   = round(shake * 0.4, 2)   # scale so it looks natural
                    state["yaw_deg"]    = 0.0

                    # Update plane sensor ref (accel_z = pitch/5, gyro_x = roll/1.2)
                    socketio.emit("sensor_update", {
                        "accel_z": round(tilt  / 5.0,  3),
                        "gyro_x":  round(shake * 0.4 / 1.2, 3),
                        "gyro_y":  0.0,
                        "gyro_z":  0.0,
                    })
                    socketio.emit("turb_update", {
                        "level":     level,
                        "shake_dps": shake,
                        "tilt_deg":  tilt,
                    })
                    socketio.emit("condition_update", {
                        "condition": _turb_to_condition(level)
                    })
                    emit_hw_update()
                    print(f"[HW] TURB={level} Shake={shake}dps Tilt={tilt}deg")
                    continue

                # ── [TURB] Smooth flight — keep last numeric values, only update level ──
                if RE_TURB_CALM.search(line):
                    state["turb_level"] = "NONE"
                    # NOTE: shake_dps / tilt_deg / pitch_deg / roll_deg are
                    # intentionally NOT reset — we hold the last real reading.
                    socketio.emit("turb_update", {
                        "level":     "NONE",
                        "shake_dps": state["shake_dps"],   # last real value
                        "tilt_deg":  state["tilt_deg"],    # last real value
                    })
                    socketio.emit("condition_update", {"condition": "NORMAL"})
                    emit_hw_update()
                    continue


                # ── [ICE] with distance ───────────────────────────────────
                m = RE_ICE.search(line)
                if m:
                    dist = float(m.group(1))
                    up   = line.upper()
                    ice  = "CRITICAL" if "CRITICAL" in up else "WARNING"

                    state["ice_level"]   = ice
                    state["distance_cm"] = dist
                    state["icing_pct"]   = _icing_pct(dist)

                    socketio.emit("ice_update", {
                        "level":       ice,
                        "distance_cm": dist,
                        "icing_pct":   state["icing_pct"],
                    })
                    socketio.emit("condition_update", {
                        "condition": "CRITICAL" if ice == "CRITICAL" else "THUNDERSTORM"
                    })
                    # Update telemetry icing bar
                    socketio.emit("telemetry_update", {
                        "icing_risk_pct": state["icing_pct"],
                        "altitude_ft":    35000,
                        "airspeed_kts":   480,
                        "heading_deg":    225,
                    })
                    emit_hw_update()
                    print(f"[HW] ICE={ice} Dist={dist}cm Icing={state['icing_pct']}%")
                    continue

                # ── [RADAR] with all three values ─────────────────────────
                m = RE_RADAR.search(line)
                if m:
                    sx   = int(m.group(1))
                    sy   = int(m.group(2))
                    dist = float(m.group(3))

                    state["radar_x"]     = sx
                    state["radar_y"]     = sy
                    state["distance_cm"] = dist
                    state["icing_pct"]   = _icing_pct(dist)
                    # Ice level from distance alone
                    if dist <= 30:
                        state["ice_level"] = "CRITICAL"
                    elif dist <= 50:
                        state["ice_level"] = "WARNING"
                    else:
                        state["ice_level"] = "NONE"

                    socketio.emit("radar_update", {
                        "radar_x":     sx,
                        "radar_y":     sy,
                        "distance_cm": dist,
                        "icing_pct":   state["icing_pct"],
                        "ice_level":   state["ice_level"],
                    })
                    socketio.emit("telemetry_update", {
                        "icing_risk_pct": state["icing_pct"],
                        "altitude_ft":    35000,
                        "airspeed_kts":   480,
                        "heading_deg":    225,
                    })
                    emit_hw_update()
                    # [RADAR] prints every 20ms — only log when ice changes
                    continue

                # ── WEB_DATA:pitch,roll,yaw,dist (optional) ───────────────
                m = RE_WEB.search(line)
                if m:
                    pitch = float(m.group(1))
                    roll  = float(m.group(2))
                    yaw   = float(m.group(3))
                    dist  = float(m.group(4))

                    state["pitch_deg"]   = pitch
                    state["roll_deg"]    = roll
                    state["yaw_deg"]     = yaw
                    state["distance_cm"] = dist
                    state["icing_pct"]   = _icing_pct(dist)

                    socketio.emit("sensor_update", {
                        "accel_z": round(pitch / 5.0, 3),
                        "gyro_x":  round(roll  / 1.2, 3),
                        "gyro_y":  round(yaw   / 0.8, 3),
                        "gyro_z":  0.0,
                    })
                    emit_hw_update()

            except serial.SerialException:
                if ser:
                    ser.close()
                ser = None
                print(f"[SERIAL] Lost {COM_PORT} — retrying in 5s...")
                time.sleep(5)
            except Exception as e:
                print(f"[SERIAL] Error: {e}")
                time.sleep(1)

    def heartbeat_loop():
        """Re-emit current state every 200ms so the frontend always
        shows the most recent values — not just on Arduino state changes."""
        while True:
            time.sleep(0.2)
            emit_hw_update()

    threading.Thread(target=serial_loop,    daemon=True).start()
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    print(f"[SERIAL] Bridge thread started -> {COM_PORT} @ {BAUD_RATE} baud")
