"""
Service -- Background simulator
Pushes live telemetry + engine status + hw_update to all connected clients.
hw_update simulates MPU6050 + HC-SR04 + radar servo when Arduino is offline.
"""
import math
import random
import threading
import time
from services.condition_engine import VALID_CONDITIONS, _state

# ── Shared phase clock ────────────────────────────────────────────
_t = 0.0          # global time counter (seconds)

_icing_high  = False
_icing_timer = 0

# Servo sweep state
_servo_x     = 0.0   # 0 → 180 → 0 sweeping
_servo_dir   = 1     # +1 or -1


def _maybe_toggle_icing():
    global _icing_high, _icing_timer
    _icing_timer += 1
    if _icing_timer >= 10:
        _icing_high = not _icing_high
        _icing_timer = 0


def _jitter(base, spread, decimals=1):
    return round(base + (random.random() - 0.5) * spread, decimals)


# ── Telemetry packet (2 s) ────────────────────────────────────────
def _build_telemetry():
    global _icing_high
    _maybe_toggle_icing()

    wind_speed  = _jitter(24, 10)
    icing_risk  = _jitter(65, 15) if _icing_high else _jitter(18, 8)
    n1_eng1     = _jitter(82, 4)
    n1_eng2     = _jitter(83, 4)
    rpm_eng1    = round(n1_eng1 * 185)
    rpm_eng2    = round(n1_eng2 * 185)

    def eng_status(n1):
        if icing_risk > 45:  return "AUTO DE-ICE ACTIVE"
        if n1 < 75 or n1 > 95: return "WARNING"
        return "NORMAL"

    return {
        "altitude_ft":         _jitter(35000, 500),
        "airspeed_kts":        _jitter(480, 20),
        "heading_deg":         round(_jitter(225, 15)),
        "vertical_speed_fpm":  _jitter(0, 200),
        "fuel_flow_kg_h":      _jitter(2800, 200),
        "n1_eng1_pct":         n1_eng1,
        "n1_eng2_pct":         n1_eng2,
        "rpm_eng1":            rpm_eng1,
        "rpm_eng2":            rpm_eng2,
        "oil_temp_c":          _jitter(88, 5),
        "eng1_status":         eng_status(n1_eng1),
        "eng2_status":         eng_status(n1_eng2),
        "wind_speed_kts":      wind_speed,
        "wind_gust_kts":       round(wind_speed + _jitter(14, 6), 1),
        "wind_dir_deg":        round(_jitter(225, 40)),
        "temperature_c":       _jitter(8, 3),
        "humidity_pct":        round(_jitter(72, 8)),
        "pressure_hpa":        _jitter(1013, 4),
        "visibility_nm":       _jitter(9.2, 2),
        "icing_risk_pct":      icing_risk,
    }


# ── Sensor update (legacy, 5 Hz) ─────────────────────────────────
def _build_sensor_data():
    cond = _state.get("condition", "NORMAL")
    if cond == "NORMAL":
        return {"condition": "NORMAL", "accel_z": 0.0,
                "gyro_x": 0.0, "gyro_y": 0.0, "gyro_z": 0.0}
    base = {
        "TURBULENCE":   dict(az=0.6,  gx=3.0,  gy=1.0,  spread_a=0.8,  spread_g=6.0),
        "THUNDERSTORM": dict(az=1.5,  gx=8.0,  gy=4.0,  spread_a=2.0,  spread_g=15.0),
        "WAKE":         dict(az=0.3,  gx=5.0,  gy=0.2,  spread_a=0.4,  spread_g=4.0),
        "WIND_SHEAR":   dict(az=2.0,  gx=1.0,  gy=0.5,  spread_a=0.5,  spread_g=3.0),
        "CRITICAL":     dict(az=2.5,  gx=10.0, gy=6.0,  spread_a=2.5,  spread_g=18.0),
    }.get(cond, dict(az=0.0, gx=0.0, gy=0.0, spread_a=0.0, spread_g=0.0))
    return {
        "condition": cond,
        "accel_z":   round(_jitter(base["az"],  base["spread_a"], 3), 3),
        "gyro_x":    round(_jitter(base["gx"],  base["spread_g"], 3), 3),
        "gyro_y":    round(_jitter(base["gy"],  base["spread_g"] * 0.6, 3), 3),
        "gyro_z":    round(_jitter(0, base["spread_g"] * 0.3, 3), 3),
    }


# ══════════════════════════════════════════════════════════════════
# hw_update — simulates what the Arduino serial bridge emits
# Cycles through realistic flight scenarios every ~30 seconds
# ══════════════════════════════════════════════════════════════════

# Scenario definitions: (name, duration_s, turb_level, ice_level,
#                        shake_base, tilt_base, dist_base)
_SCENARIOS = [
    ("Smooth flight",   25, "NONE",     "NONE",     1.5,  2.0, 180.0),
    ("Mild turbulence", 15, "MODERATE", "NONE",    18.0,  9.0, 145.0),
    ("Icing warning",   20, "NONE",     "WARNING",  3.0,  4.0,  62.0),
    ("Smooth flight",   20, "NONE",     "NONE",     1.2,  1.5, 175.0),
    ("Heavy turbulence",12, "SEVERE",   "NONE",    55.0, 22.0, 130.0),
    ("Critical icing",  18, "MODERATE", "CRITICAL", 12.0, 7.0,  22.0),
    ("Smooth flight",   30, "NONE",     "NONE",     0.8,  1.0, 185.0),
]

_scene_idx      = 0
_scene_elapsed  = 0.0
_HW_INTERVAL    = 0.2   # 5 Hz heartbeat


def _build_hw_update():
    """
    Produce a realistic hw_update payload based on the current scenario.
    Adds smooth sinusoidal variation + noise on top of base values.
    """
    global _t, _servo_x, _servo_dir, _scene_idx, _scene_elapsed

    _t             += _HW_INTERVAL
    _scene_elapsed += _HW_INTERVAL

    # ── Advance scenario ──────────────────────────────────────────
    scene = _SCENARIOS[_scene_idx]
    if _scene_elapsed >= scene[1]:
        _scene_idx     = (_scene_idx + 1) % len(_SCENARIOS)
        _scene_elapsed = 0.0
        scene          = _SCENARIOS[_scene_idx]

    name, _, turb_level, ice_level, shake_base, tilt_base, dist_base = scene

    # ── MPU6050 simulation ────────────────────────────────────────
    # Shake: sinusoidal + random noise, scaled by scenario
    shake_sin   = abs(math.sin(_t * 1.7)) * shake_base * 0.6
    shake_noise = random.gauss(0, shake_base * 0.3)
    shake_dps   = max(0.0, round(shake_base * 0.4 + shake_sin + shake_noise, 2))

    # Tilt: slow sinusoidal drift
    tilt_deg    = round(tilt_base * math.sin(_t * 0.4) + random.gauss(0, tilt_base * 0.15), 2)

    # Pitch / Roll / Yaw: smooth realistic values
    pitch_deg   = round(2.5 * math.sin(_t * 0.3) + random.gauss(0, 0.4 + shake_base * 0.05), 2)
    roll_deg    = round(1.8 * math.cos(_t * 0.25) + random.gauss(0, 0.3 + shake_base * 0.04), 2)
    yaw_deg     = round(0.6 * math.sin(_t * 0.1)  + random.gauss(0, 0.15), 2)

    # Accel XYZ (g)
    accel_x     = round(random.gauss(0,   0.02 + shake_base * 0.004), 3)
    accel_y     = round(random.gauss(0,   0.02 + shake_base * 0.004), 3)
    accel_z     = round(random.gauss(1.0, 0.03 + shake_base * 0.008), 3)

    # ── HC-SR04 icing probe ───────────────────────────────────────
    # Distance oscillates around base with noise; lower = more icing
    dist_osc    = dist_base + 12 * math.sin(_t * 0.5)
    dist_noise  = random.gauss(0, dist_base * 0.04)
    distance_cm = round(max(8.0, min(220.0, dist_osc + dist_noise)), 1)

    # Icing percentage: inverse of distance normalised 0-100%
    icing_pct   = round(max(0.0, min(100.0, (1 - distance_cm / 220.0) * 100)), 1)

    # ── Radar servo sweep ─────────────────────────────────────────
    _servo_x += _servo_dir * 3.0   # 3° per tick = full sweep ~3s
    if _servo_x >= 180:
        _servo_x = 180; _servo_dir = -1
    elif _servo_x <= 0:
        _servo_x = 0;   _servo_dir = 1

    servo_y    = 90 + round(10 * math.sin(_t * 0.3))   # gentle up/down bob
    radar_dist = round(max(10.0, distance_cm + random.gauss(0, 8)), 1)

    # ── Composite state ──────────────────────────────────────────
    return {
        # Condition labels
        "condition":    name,
        "turb_level":   turb_level,
        "ice_level":    ice_level,
        # MPU6050
        "shake_dps":    shake_dps,
        "tilt_deg":     tilt_deg,
        "pitch_deg":    pitch_deg,
        "roll_deg":     roll_deg,
        "yaw_deg":      yaw_deg,
        "accel_x":      accel_x,
        "accel_y":      accel_y,
        "accel_z":      accel_z,
        # HC-SR04
        "distance_cm":  distance_cm,
        "icing_pct":    icing_pct,
        # Radar servo
        "radar_x":      round(_servo_x),
        "radar_y":      servo_y,
        "radar_dist":   radar_dist,
    }


# ── Start all loops ───────────────────────────────────────────────
def start_simulator(socketio):
    """Launch daemon threads: telemetry (2s), sensor (5Hz), hw_update (5Hz)."""

    def telemetry_loop():
        while True:
            time.sleep(2)
            socketio.emit("telemetry_update", _build_telemetry())

    def sensor_loop():
        while True:
            time.sleep(0.2)
            socketio.emit("sensor_update", _build_sensor_data())

    def hw_loop():
        """Emit hw_update at 5 Hz — mirrors what serial_bridge does when hardware is live."""
        while True:
            time.sleep(_HW_INTERVAL)
            payload = _build_hw_update()
            socketio.emit("hw_update",    payload)
            socketio.emit("radar_update", {
                "radar_x":     payload["radar_x"],
                "radar_y":     payload["radar_y"],
                "distance_cm": payload["radar_dist"],
            })

    threading.Thread(target=telemetry_loop, daemon=True).start()
    threading.Thread(target=sensor_loop,    daemon=True).start()
    threading.Thread(target=hw_loop,        daemon=True).start()
    print("[OK] Simulator started - telemetry 2s | sensor 5Hz | hw_update 5Hz")
