from flask import Blueprint, jsonify

from db import fetch_all

meta_bp = Blueprint("meta_bp", __name__)


@meta_bp.route("/categories", methods=["GET"])
def get_categories():
    categories = fetch_all(
        """
        SELECT category_id, category_name, example
        FROM category
        ORDER BY category_id
        """
    )

    return jsonify({
        "success": True,
        "categories": categories,
    })


@meta_bp.route("/locations", methods=["GET"])
def get_locations():
    locations = fetch_all(
        """
        SELECT location_id, location_name, building, floor, room, map_type, map_x, map_y
        FROM location
        ORDER BY building, location_name
        """
    )

    return jsonify({
        "success": True,
        "locations": locations,
    })
