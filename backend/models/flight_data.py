"""Models — Flight data schema (for validation / type hints)"""
from dataclasses import dataclass


@dataclass
class TelemetrySnapshot:
    altitude_ft: float
    airspeed_kts: float
    heading_deg: int
    vertical_speed_fpm: float
    fuel_flow_kg_h: float
    n1_eng1_pct: float
    n1_eng2_pct: float
    oil_temp_c: float


@dataclass
class WeatherSnapshot:
    wind_speed_kts: float
    wind_gust_kts: float
    wind_dir_deg: int
    temperature_c: float
    humidity_pct: int
    pressure_hpa: float
    visibility_nm: float
    icing_risk_pct: float


@dataclass
class FlightCondition:
    condition: str  # NORMAL | TURBULENCE | WAKE | THUNDERSTORM | WIND_SHEAR | CRITICAL
