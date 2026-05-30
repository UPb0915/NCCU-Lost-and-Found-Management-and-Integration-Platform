import os
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from werkzeug.utils import secure_filename

from db import fetch_all, fetch_one, get_connection
from services.match_service import find_matches_and_notify
from services.security_service import check_security_before_report, log_activity

report_bp = Blueprint("report_bp", __name__)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
CLOSED_STATUS = {"已處理", "已認領"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_photo(file):
    if not file or not file.filename:
        return None

    if not allowed_file(file.filename):
        return None

    filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    saved_name = f"{timestamp}_{filename}"

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)

    file_path = os.path.join(upload_folder, saved_name)
    file.save(file_path)

    return f"/uploads/{saved_name}"


def report_select_sql():
    return """
        SELECT
            r.report_id,
            r.type,
            r.status,
            r.event_date,
            r.created_at,
            r.updated_at,
            r.resolved_at,
            r.deleted_at,
            u.user_id,
            u.name AS submitter_name,
            u.phone_number AS submitter_phone,
            i.item_id,
            i.item_name,
            i.item_photo,
            i.note,
            c.category_id,
            c.category_name,
            l.location_id,
            l.location_name,
            l.building,
            l.floor,
            l.room,
            l.map_type,
            l.map_x,
            l.map_y,
            la.area_id,
            la.area_key,
            la.area_name,
            ld.detail_id,
            ld.detail_key,
            ld.detail_name,
            ld.floor_label,
            fr.storage_location,
            fr.trusted_user_id,
            fr.has_verification_question,
            vq.question_text,
            vq.reference_answer
        FROM report r
        JOIN user_account u ON r.user_id = u.user_id
        JOIN item i ON r.item_id = i.item_id
        JOIN category c ON i.category_id = c.category_id
        JOIN location l ON r.location_id = l.location_id
        LEFT JOIN location_area la ON r.area_id = la.area_id
        LEFT JOIN location_detail ld ON r.detail_id = ld.detail_id
        LEFT JOIN found_report fr ON r.report_id = fr.report_id
        LEFT JOIN verification_question vq ON fr.report_id = vq.found_report_id
        WHERE r.deleted_at IS NULL
    """


def get_or_create_location(cursor, location_name):
    clean_name = (location_name or "").strip() or "未填寫地點"

    cursor.execute(
        """
        SELECT location_id, location_name, building, map_x, map_y
        FROM location
        WHERE location_name = %s
        LIMIT 1
        """,
        (clean_name,),
    )
    location = cursor.fetchone()

    if location:
        return location

    building = "商學院" if ("商" in clean_name or "260" in clean_name) else "自訂地點"
    map_x = 52.0 if building == "商學院" else 50.0
    map_y = 18.0 if building == "商學院" else 50.0

    cursor.execute(
        """
        INSERT INTO location (location_name, building, map_type, map_x, map_y)
        VALUES (%s, %s, 'campus', %s, %s)
        """,
        (clean_name, building, map_x, map_y),
    )

    location_id = cursor.lastrowid

    return {
        "location_id": location_id,
        "location_name": clean_name,
        "building": building,
        "map_x": map_x,
        "map_y": map_y,
    }


@report_bp.route("/reports", methods=["GET"])
def get_reports():
    keyword = request.args.get("keyword", "").strip().lower()
    category_id = request.args.get("category_id")
    report_type = request.args.get("type")
    status = request.args.get("status")
    user_id = request.args.get("user_id")
    area_id = request.args.get("area_id")
    detail_id = request.args.get("detail_id")
    mine = request.args.get("mine") == "true"
    search_mode = request.args.get("search") == "true"

    sql = report_select_sql()
    params = []

    if mine and user_id:
        sql += " AND r.user_id = %s"
        params.append(user_id)

    if search_mode:
        sql += " AND r.status NOT IN ('已處理', '已認領')"

    if keyword:
        sql += """
            AND (
                i.item_name LIKE %s
                OR i.note LIKE %s
                OR l.location_name LIKE %s
                OR l.building LIKE %s
            )
        """
        like = f"%{keyword}%"
        params.extend([like, like, like, like])

    if category_id:
        sql += " AND c.category_id = %s"
        params.append(category_id)

    if report_type:
        sql += " AND r.type = %s"
        params.append(report_type)

    if status:
        sql += " AND r.status = %s"
        params.append(status)

    if area_id:
        sql += " AND r.area_id = %s"
        params.append(area_id)

    if detail_id:
        sql += " AND r.detail_id = %s"
        params.append(detail_id)

    sql += " ORDER BY r.created_at DESC"

    reports = fetch_all(sql, tuple(params))

    return jsonify({"success": True, "reports": reports})


@report_bp.route("/reports", methods=["POST"])
def create_report():
    report_type = request.form.get("type")
    item_name = (request.form.get("item_name") or "").strip()
    category_id = request.form.get("category_id")
    user_id = request.form.get("user_id")
    event_date = request.form.get("event_date")
    note = request.form.get("note", "")
    area_id = request.form.get("area_id")
    detail_id = request.form.get("detail_id")
    manual_location_text = (request.form.get("manual_location_text") or "").strip()
    location_name_text = (
        manual_location_text
        or request.form.get("location_name")
        or request.form.get("location_name_text")
        or ""
    ).strip()
    storage_location = request.form.get("storage_location", "")
    has_verification_question = request.form.get("has_verification_question") == "true"
    verification_question = (request.form.get("verification_question") or "").strip()
    verification_answer = (request.form.get("verification_answer") or "").strip()

    if not area_id:
        return jsonify({"success": False, "message": "請選擇大地點後再送出通報"}), 400

    area_id = int(area_id)
    detail_id = int(detail_id) if detail_id else None

    if report_type not in ["L", "F"]:
        return jsonify({"success": False, "message": "通報類型錯誤"}), 400

    if not item_name:
        return jsonify({"success": False, "message": "請輸入物品名稱"}), 400

    if not user_id:
        return jsonify({"success": False, "message": "請先登入"}), 400

    if area_id and detail_id:
        selected_detail = fetch_one(
            """
            SELECT
                detail_id,
                detail_key
            FROM location_detail
            WHERE detail_id = %s
            """,
            (detail_id,)
        )

        if selected_detail and selected_detail["detail_key"] == "all":
            default_detail = fetch_one(
                """
                SELECT detail_id
                FROM location_detail
                WHERE area_id = %s
                  AND is_default = 1
                LIMIT 1
                """,
                (area_id,)
            )

            if default_detail:
                detail_id = default_detail["detail_id"]

    security_content = f"{report_type} {item_name} {note} {location_name_text}"
    security_result = check_security_before_report(
        user_id=user_id,
        content=security_content,
    )
    if not security_result["allowed"]:
        return jsonify({"success": False, "message": security_result["message"]}), 403

    photo_url = save_photo(request.files.get("item_photo"))

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        location = get_or_create_location(cursor, location_name_text)

        cursor.execute(
            """
            INSERT INTO item (item_name, item_photo, note, category_id)
            VALUES (%s, %s, %s, %s)
            """,
            (item_name, photo_url, note, category_id),
        )
        item_id = cursor.lastrowid

        status = "待認領" if report_type == "F" else "待處理"

        cursor.execute(
            """
            INSERT INTO report
                (
                    user_id,
                    item_id,
                    location_id,
                    area_id,
                    detail_id,
                    type,
                    status,
                    event_date
                )
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                item_id,
                location["location_id"],
                area_id,
                detail_id,
                report_type,
                status,
                event_date,
            ),
        )
        report_id = cursor.lastrowid

        if report_type == "F":
            if has_verification_question and (not verification_question or not verification_answer):
                return jsonify({"success": False, "message": "請填寫特徵問題與參考答案"}), 400

            cursor.execute(
                """
                INSERT INTO found_report (report_id, storage_location, has_verification_question)
                VALUES (%s, %s, %s)
                """,
                (report_id, storage_location, has_verification_question),
            )

            if has_verification_question:
                cursor.execute(
                    """
                    INSERT INTO verification_question
                        (found_report_id, question_text, reference_answer)
                    VALUES
                        (%s, %s, %s)
                    """,
                    (report_id, verification_question, verification_answer),
                )
        else:
            cursor.execute(
                """
                INSERT INTO lost_report (report_id)
                VALUES (%s)
                """,
                (report_id,),
            )

        connection.commit()

        log_activity(
            user_id=user_id,
            activity_type="create_report",
            target_id=report_id,
            content=f"{item_name} {note} {location_name_text}",
        )
    except Exception as exc:
        connection.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500
    finally:
        cursor.close()
        connection.close()

    report = fetch_one(report_select_sql() + " AND r.report_id = %s", (report_id,))
    recommendations = find_matches_and_notify(report_id)

    return jsonify({
        "success": True,
        "message": "通報建立成功",
        "report": report,
        "recommendations": recommendations,
    })


@report_bp.route("/reports/<int:report_id>/status", methods=["PATCH"])
def update_report_status(report_id):
    data = request.get_json() or {}
    user_id = data.get("user_id")
    new_status = data.get("status")

    if not user_id or not new_status:
        return jsonify({"success": False, "message": "缺少更新狀態資料"}), 400

    report = fetch_one(
        """
        SELECT
            r.report_id,
            r.user_id,
            r.type,
            r.status,
            i.item_name
        FROM report r
        JOIN item i ON r.item_id = i.item_id
        WHERE r.report_id = %s
          AND r.deleted_at IS NULL
        """,
        (report_id,),
    )

    if not report:
        return jsonify({"success": False, "message": "找不到通報資料"}), 404

    if str(report["user_id"]) != str(user_id):
        return jsonify({"success": False, "message": "只有通報者本人可以更新此通報狀態"}), 403

    allowed = False

    if report["type"] == "L" and new_status == "已處理":
        allowed = True

    if report["type"] == "F" and new_status == "已認領":
        completed_claim = fetch_one(
            """
            SELECT claim_id
            FROM claim_request
            WHERE found_report_id = %s
              AND status = '已完成'
            LIMIT 1
            """,
            (report_id,),
        )

        if completed_claim:
            allowed = True
        else:
            return jsonify({
                "success": False,
                "message": "拾獲物必須透過認領流程完成後，才能標記為已認領。",
            }), 400

    if not allowed:
        return jsonify({"success": False, "message": "此狀態不允許手動更新"}), 400

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            UPDATE report
            SET status = %s,
                resolved_at = NOW()
            WHERE report_id = %s
            """,
            (new_status, report_id),
        )

        if report["type"] == "L" and new_status == "已處理":
            cursor.execute(
                """
                UPDATE claim_request
                SET status = '已取消',
                    cancel_reason = '遺失者已自行標記遺失物為已處理',
                    cancelled_at = NOW()
                WHERE lost_report_id = %s
                  AND status IN ('待審核', '已接受')
                """,
                (report_id,),
            )

            cursor.execute(
                """
                INSERT INTO notification
                    (user_id, report_id, type, content)
                SELECT
                    owner_user_id,
                    found_report_id,
                    'claim',
                    '對方已自行找回遺失物，相關認領申請已取消。'
                FROM claim_request
                WHERE lost_report_id = %s
                  AND status = '已取消'
                  AND cancel_reason = '遺失者已自行標記遺失物為已處理'
                """,
                (report_id,),
            )

        connection.commit()
    except Exception as exc:
        connection.rollback()
        return jsonify({"success": False, "message": f"更新狀態失敗：{str(exc)}"}), 500
    finally:
        cursor.close()
        connection.close()

    updated_report = fetch_one(
        report_select_sql() + " AND r.report_id = %s",
        (report_id,),
    )

    return jsonify({
        "success": True,
        "message": "狀態已更新",
        "report": updated_report,
    })


@report_bp.route("/reports/<int:report_id>", methods=["DELETE"])
def delete_report(report_id):
    data = request.get_json() or {}
    user_id = data.get("user_id")

    report = fetch_one(
        report_select_sql() + " AND r.report_id = %s",
        (report_id,),
    )

    if not report:
        return jsonify({"success": False, "message": "找不到通報"}), 404

    if str(report["user_id"]) != str(user_id):
        return jsonify({"success": False, "message": "只能刪除自己的通報"}), 403

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            UPDATE report
            SET status = '已刪除', deleted_at = NOW()
            WHERE report_id = %s
            """,
            (report_id,),
        )
        connection.commit()
    except Exception as exc:
        connection.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500
    finally:
        cursor.close()
        connection.close()

    return jsonify({"success": True, "message": "通報已刪除"})