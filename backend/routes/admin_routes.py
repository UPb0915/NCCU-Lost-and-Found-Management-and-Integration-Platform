import csv
import io

from flask import Blueprint, Response, jsonify, request

from db import execute, fetch_all, fetch_one, get_connection
from auth_utils import require_admin_auth

admin_bp = Blueprint("admin_bp", __name__)


def build_admin_date_filter(table_alias="r"):
    year = request.args.get("year")
    month = request.args.get("month")

    where = f"WHERE {table_alias}.deleted_at IS NULL"
    params = []

    if year:
      where += f" AND YEAR({table_alias}.created_at) = %s"
      params.append(int(year))

    if month:
      where += f" AND MONTH({table_alias}.created_at) = %s"
      params.append(int(month))

    return where, params


def build_admin_date_filter_without_deleted(table_alias="r"):
    year = request.args.get("year")
    month = request.args.get("month")

    where = "WHERE 1 = 1"
    params = []

    if year:
      where += f" AND YEAR({table_alias}.created_at) = %s"
      params.append(int(year))

    if month:
      where += f" AND MONTH({table_alias}.created_at) = %s"
      params.append(int(month))

    return where, params


def safe_count(sql, params=None):
    try:
        row = fetch_one(sql, params or ())
        return row["count"] if row else 0
    except Exception:
        return 0


def role_to_chinese(role):
    if role == "student":
        return "本校學生"
    if role == "staff":
        return "教職員"
    if role == "outsider":
        return "外校人士"
    return role or ""


@admin_bp.route("/admin/stats", methods=["GET"])
@require_admin_auth
def admin_stats():
    report_where, report_params = build_admin_date_filter("r")
    claim_where, claim_params = build_admin_date_filter_without_deleted("cr")

    total_reports = safe_count(
        f"""
        SELECT COUNT(*) AS count
        FROM report r
        {report_where}
        """,
        tuple(report_params),
    )
    lost_count = safe_count(
        f"""
        SELECT COUNT(*) AS count
        FROM report r
        {report_where}
          AND r.type = 'L'
        """,
        tuple(report_params),
    )
    found_count = safe_count(
        f"""
        SELECT COUNT(*) AS count
        FROM report r
        {report_where}
          AND r.type = 'F'
        """,
        tuple(report_params),
    )
    processed_lost_count = safe_count(
        f"""
        SELECT COUNT(*) AS count
        FROM report r
        {report_where}
          AND r.type = 'L'
          AND r.status = '已處理'
        """,
        tuple(report_params),
    )
    claimed_found_count = safe_count(
        f"""
        SELECT COUNT(*) AS count
        FROM report r
        {report_where}
          AND r.type = 'F'
          AND r.status = '已認領'
        """,
        tuple(report_params),
    )
    success_count = processed_lost_count + claimed_found_count

    claim_request_count = safe_count(
        f"""
        SELECT COUNT(*) AS count
        FROM claim_request cr
        {claim_where}
        """,
        tuple(claim_params),
    )
    claim_completed_count = safe_count(
        f"""
        SELECT COUNT(*) AS count
        FROM claim_request cr
        {claim_where}
          AND cr.status = '已完成'
        """,
        tuple(claim_params),
    )
    claim_rejected_count = safe_count(
        f"""
        SELECT COUNT(*) AS count
        FROM claim_request cr
        {claim_where}
          AND cr.status = '已拒絕'
        """,
        tuple(claim_params),
    )

    user_count = safe_count("SELECT COUNT(*) AS count FROM user_account")
    chat_count = safe_count("SELECT COUNT(*) AS count FROM conversation")

    report_rate = "0%"
    if total_reports > 0:
        report_rate = f"{round((success_count / total_reports) * 100, 1)}%"

    hotspots = fetch_all(
        """
        SELECT COALESCE(l.building, l.location_name, '未填寫') AS name, COUNT(*) AS count
        FROM report r
        JOIN location l ON r.location_id = l.location_id
        {report_where}
        GROUP BY COALESCE(l.building, l.location_name, '未填寫')
        ORDER BY count DESC
        LIMIT 8
        """.format(report_where=report_where),
        tuple(report_params),
    )

    category_distribution = fetch_all(
        """
        SELECT c.category_name AS name, COUNT(*) AS count
        FROM report r
        JOIN item i ON r.item_id = i.item_id
        JOIN category c ON i.category_id = c.category_id
        {report_where}
        GROUP BY c.category_id, c.category_name
        ORDER BY count DESC
        """.format(report_where=report_where),
        tuple(report_params),
    )

    monthly_trend = fetch_all(
        """
        SELECT DATE_FORMAT(r.created_at, '%Y-%m') AS month, COUNT(*) AS count
        FROM report r
        {report_where}
        GROUP BY DATE_FORMAT(r.created_at, '%Y-%m')
        ORDER BY month ASC
        """.format(report_where=report_where),
        tuple(report_params),
    )

    recent_reports = fetch_all(
        """
        SELECT
            r.report_id,
            r.type,
            r.status,
            r.event_date,
            r.created_at,
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
            l.map_x,
            l.map_y,
            fr.storage_location,
            fr.trusted_user_id
        FROM report r
        JOIN user_account u ON r.user_id = u.user_id
        JOIN item i ON r.item_id = i.item_id
        JOIN category c ON i.category_id = c.category_id
        JOIN location l ON r.location_id = l.location_id
        LEFT JOIN found_report fr ON r.report_id = fr.report_id
        {report_where}
        ORDER BY r.created_at DESC
        LIMIT 8
        """.format(report_where=report_where),
        tuple(report_params),
    )

    return jsonify({
        "success": True,
        "stats": {
            "total_reports": total_reports,
            "lost_count": lost_count,
            "found_count": found_count,
            "processed_lost_count": processed_lost_count,
            "claimed_found_count": claimed_found_count,
            "success_count": success_count,
            "report_rate": report_rate,
            "claim_request_count": claim_request_count,
            "claim_completed_count": claim_completed_count,
            "claim_rejected_count": claim_rejected_count,
            "user_count": user_count,
            "chat_count": chat_count,
        },
        "hotspots": hotspots,
        "categories": category_distribution,
        "monthly_trend": monthly_trend,
        "recent_reports": recent_reports,
    })


@admin_bp.route("/admin/export", methods=["GET"])
@require_admin_auth
def export_admin_csv():
    report_where, report_params = build_admin_date_filter("r")

    rows = fetch_all(
        """
        SELECT
            r.report_id,
            CASE
                WHEN r.type = 'L' THEN '遺失物'
                WHEN r.type = 'F' THEN '拾獲物'
                ELSE r.type
            END AS report_type,
            r.status,
            r.event_date,
            r.created_at,
            r.resolved_at,
            u.user_id,
            u.name AS submitter_name,
            u.role AS submitter_role,
            u.student_id,
            u.staff_id,
            u.phone_number,
            i.item_name,
            i.note,
            c.category_name,
            l.location_name,
            l.building,
            l.floor,
            l.room,
            fr.storage_location
        FROM report r
        JOIN user_account u ON r.user_id = u.user_id
        JOIN item i ON r.item_id = i.item_id
        JOIN category c ON i.category_id = c.category_id
        JOIN location l ON r.location_id = l.location_id
        LEFT JOIN found_report fr ON r.report_id = fr.report_id
        {report_where}
        ORDER BY r.created_at DESC
        """.format(report_where=report_where),
        tuple(report_params),
    )

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "通報ID",
        "通報類型",
        "狀態",
        "事件日期",
        "建立時間",
        "完成時間",
        "使用者ID",
        "通報者姓名",
        "身分",
        "學號",
        "教師編號",
        "電話",
        "物品名稱",
        "類別",
        "補充描述",
        "地點名稱",
        "建築物",
        "樓層",
        "教室",
        "目前放置處",
    ])

    for row in rows:
        writer.writerow([
            row.get("report_id"),
            row.get("report_type"),
            row.get("status"),
            row.get("event_date"),
            row.get("created_at"),
            row.get("resolved_at"),
            row.get("user_id"),
            row.get("submitter_name"),
            role_to_chinese(row.get("submitter_role")),
            row.get("student_id"),
            row.get("staff_id"),
            row.get("phone_number"),
            row.get("item_name"),
            row.get("category_name"),
            row.get("note"),
            row.get("location_name"),
            row.get("building"),
            row.get("floor"),
            row.get("room"),
            row.get("storage_location"),
        ])

    csv_content = "\ufeff" + output.getvalue()
    output.close()

    year = request.args.get("year") or "all"
    month = request.args.get("month") or "all"
    filename = f"lost_and_found_report_{year}_{month}.csv"

    return Response(
        csv_content,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@admin_bp.route("/admin/suspicious-users", methods=["GET"])
@require_admin_auth
def get_suspicious_users():
    users = fetch_all(
        """
        SELECT
            u.user_id,
            u.name,
            u.role,
            u.student_id,
            u.staff_id,
            u.phone_number,
            u.is_blocked,
            u.blocked_reason,
            COUNT(l.activity_id) AS recent_activity_count
        FROM user_account u
        LEFT JOIN user_activity_log l
          ON u.user_id = l.user_id
         AND l.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY
            u.user_id,
            u.name,
            u.role,
            u.student_id,
            u.staff_id,
            u.phone_number,
            u.is_blocked,
            u.blocked_reason
        HAVING recent_activity_count >= 5 OR u.is_blocked = 1
        ORDER BY u.is_blocked DESC, recent_activity_count DESC
        """
    )

    return jsonify({"success": True, "users": users})


@admin_bp.route("/admin/users", methods=["GET"])
@require_admin_auth
def get_all_users():
    users = fetch_all(
        """
        SELECT
            u.user_id,
            u.name,
            u.role,
            u.student_id,
            u.staff_id,
            u.phone_number,
            u.created_at,
            u.is_blocked,
            u.blocked_reason,
            u.blocked_at,
            COALESCE(COUNT(r.report_id), 0) AS total_reports,
            COALESCE(SUM(
                CASE
                    WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                    THEN 1
                    ELSE 0
                END
            ), 0) AS reports_last_hour,
            CASE
                WHEN COALESCE(SUM(
                    CASE
                        WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                        THEN 1
                        ELSE 0
                    END
                ), 0) > 10
                THEN 1
                ELSE 0
            END AS too_many_reports_in_hour,
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM report r2
                    JOIN item i2 ON r2.item_id = i2.item_id
                    JOIN category c2 ON i2.category_id = c2.category_id
                    JOIN location l2 ON r2.location_id = l2.location_id
                    WHERE r2.user_id = u.user_id
                      AND r2.deleted_at IS NULL
                    GROUP BY
                        r2.type,
                        i2.item_name,
                        c2.category_name,
                        l2.location_name,
                        r2.event_date
                    HAVING COUNT(*) >= 2
                )
                THEN 1
                ELSE 0
            END AS has_duplicate_reports
        FROM user_account u
        LEFT JOIN report r
          ON u.user_id = r.user_id
         AND r.deleted_at IS NULL
        GROUP BY
            u.user_id,
            u.name,
            u.role,
            u.student_id,
            u.staff_id,
            u.phone_number,
            u.created_at,
            u.is_blocked,
            u.blocked_reason,
            u.blocked_at
        ORDER BY
            u.is_blocked DESC,
            too_many_reports_in_hour DESC,
            has_duplicate_reports DESC,
            u.created_at DESC
        """
    )

    for user in users:
        user["is_suspicious"] = bool(
            user.get("too_many_reports_in_hour") or user.get("has_duplicate_reports")
        )

    return jsonify({"success": True, "users": users})


@admin_bp.route("/admin/users/<int:user_id>/block", methods=["PATCH"])
@require_admin_auth
def block_user(user_id):
    data = request.get_json() or {}
    reason = (data.get("reason") or "疑似惡意操作，帳號已被管理員限制").strip()

    user = fetch_one(
        """
        SELECT user_id, name, student_id, staff_id, phone_number
        FROM user_account
        WHERE user_id = %s
        """,
        (user_id,),
    )

    if not user:
        return jsonify({"success": False, "message": "找不到使用者"}), 404

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            UPDATE user_account
            SET is_blocked = 1,
                blocked_reason = %s,
                blocked_at = NOW()
            WHERE user_id = %s
            """,
            (reason, user_id),
        )

        cursor.execute(
            """
            DELETE FROM blocked_identity
            WHERE user_id = %s
            """,
            (user_id,),
        )

        cursor.execute(
            """
            INSERT INTO blocked_identity
                (user_id, name, student_id, staff_id, phone_number, reason)
            VALUES
                (%s, %s, %s, %s, %s, %s)
            """,
            (
                user["user_id"],
                user["name"],
                user.get("student_id"),
                user.get("staff_id"),
                user["phone_number"],
                reason,
            ),
        )

        cursor.execute(
            """
            INSERT INTO notification
                (user_id, type, content)
            VALUES
                (%s, 'security', %s)
            """,
            (user_id, f"你的帳號已被管理員限制使用。原因：{reason}"),
        )

        connection.commit()
    except Exception as exc:
        connection.rollback()
        return jsonify({"success": False, "message": f"封鎖失敗：{str(exc)}"}), 500
    finally:
        cursor.close()
        connection.close()

    return jsonify({"success": True, "message": "已封鎖使用者"})


@admin_bp.route("/admin/users/<int:user_id>/unblock", methods=["PATCH"])
@require_admin_auth
def unblock_user(user_id):

    user = fetch_one(
        """
        SELECT user_id
        FROM user_account
        WHERE user_id = %s
        """,
        (user_id,),
    )

    if not user:
        return jsonify({"success": False, "message": "找不到使用者"}), 404

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            UPDATE user_account
            SET is_blocked = 0,
                blocked_reason = NULL,
                blocked_at = NULL
            WHERE user_id = %s
            """,
            (user_id,),
        )

        cursor.execute(
            """
            DELETE FROM blocked_identity
            WHERE user_id = %s
            """,
            (user_id,),
        )

        cursor.execute(
            """
            INSERT INTO notification
                (user_id, type, content)
            VALUES
                (%s, 'security', '你的帳號限制已被解除。')
            """,
            (user_id,),
        )

        connection.commit()
    except Exception as exc:
        connection.rollback()
        return jsonify({"success": False, "message": f"解除封鎖失敗：{str(exc)}"}), 500
    finally:
        cursor.close()
        connection.close()

    return jsonify({"success": True, "message": "已解除封鎖"})
