"""Service — Flight condition engine"""

VALID_CONDITIONS = ["NORMAL", "TURBULENCE", "WAKE", "THUNDERSTORM", "WIND_SHEAR", "CRITICAL"]

_state = {"condition": "NORMAL"}


def get_current_condition():
    return {"condition": _state["condition"]}


def set_condition(name: str):
    if name not in VALID_CONDITIONS:
        return None
    _state["condition"] = name
    return get_current_condition()
