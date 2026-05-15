"""
SkyPilot AI -- Flask + Socket.IO Backend
Entry point
"""
import os

from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS
from dotenv import load_dotenv

from routes.telemetry  import telemetry_bp
from routes.weather    import weather_bp
from routes.condition  import condition_bp
from routes.preflight  import preflight_bp
from routes.forecast   import forecast_bp
from routes.reroute      import reroute_bp
from routes.openmeteo    import openmeteo_bp
from routes.voice_assist import voice_bp
from routes.voice_alert  import voice_alert_bp
from services.simulator import start_simulator
from services.serial_bridge import start_serial_bridge

# -- Load env --
load_dotenv()

# -- App setup --
app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "skypilot-dev")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

CORS(app, resources={r"/*": {"origins": "*"}})

# Use threading mode + polling transport — stable on Windows/Python3.13
# WebSocket upgrade causes an assertion error with Werkzeug dev server,
# so we keep polling which is reliable and latency is fine for this app.
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    allow_upgrades=False,       # stay on long-polling, no WS upgrade
    logger=False,
    engineio_logger=False,
)

# -- Register REST blueprints --
app.register_blueprint(telemetry_bp,  url_prefix="/api/telemetry")
app.register_blueprint(weather_bp,    url_prefix="/api/weather")
app.register_blueprint(condition_bp,  url_prefix="/api/condition")
app.register_blueprint(preflight_bp,  url_prefix="/api/preflight")
app.register_blueprint(forecast_bp,   url_prefix="/api/forecast")
app.register_blueprint(reroute_bp,    url_prefix="/api/reroute")
app.register_blueprint(openmeteo_bp,  url_prefix="/api/openmeteo")
app.register_blueprint(voice_bp,       url_prefix="/api/voice-assist")
app.register_blueprint(voice_alert_bp, url_prefix="/api/voice-alert")

# -- Socket.IO events --
@socketio.on("connect")
def on_connect():
    print("[WS] Client connected")

@socketio.on("disconnect")
def on_disconnect():
    print("[WS] Client disconnected")

# -- Start services --
start_simulator(socketio)
start_serial_bridge(socketio)

# -- Run --
if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5000))
    print(f"[OK] SkyPilot backend running on http://localhost:{port}")
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)
