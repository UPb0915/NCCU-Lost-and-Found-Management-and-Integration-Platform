from flask import Blueprint, jsonify

from db import fetch_all


location_bp = Blueprint("location_bp", __name__)


@location_bp.route("/location-areas", methods=["GET"])
def get_location_areas():
    areas = fetch_all(
        """
        SELECT
            area_id,
            area_key,
            area_name,
            map_type
        FROM location_area
        ORDER BY area_id ASC
        """
    )

    return jsonify({
        "success": True,
        "areas": areas,
    })


@location_bp.route("/location-areas/<int:area_id>/details", methods=["GET"])
def get_location_details(area_id):
    details = fetch_all(
        """
        SELECT
            detail_id,
            area_id,
            detail_key,
            detail_name,
            floor_label,
            is_default
        FROM location_detail
        WHERE area_id = %s
        ORDER BY
            CASE
                WHEN detail_key = 'all' THEN 0
                WHEN is_default = 1 THEN 1
                ELSE 2
            END,
            floor_label ASC,
            detail_name ASC
        """,
        (area_id,),
    )

    return jsonify({
        "success": True,
        "details": details,
    })
