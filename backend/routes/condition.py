"""Routes — /api/condition"""
from flask import Blueprint, jsonify
from services.condition_engine import get_current_condition, set_condition

condition_bp = Blueprint("condition", __name__)


@condition_bp.get("/")
def get_condition():
    """Return the current flight condition."""
    return jsonify(get_current_condition())


@condition_bp.post("/<string:new_condition>")
def update_condition(new_condition):
    """Manually override the flight condition (for testing)."""
    result = set_condition(new_condition.upper())
    if result is None:
        return jsonify({"error": "Invalid condition"}), 400
    return jsonify(result)
