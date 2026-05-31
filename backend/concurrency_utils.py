from flask import jsonify

ACTIVE_CLAIM_STATUSES = ("已接受", "交接中", "已完成")
FINAL_REPORT_STATUSES = ("已處理", "已認領")


def is_user_blocked(cursor, user_id):
    if not user_id:
        return True

    cursor.execute(
        """
        SELECT is_blocked
        FROM user_account
        WHERE user_id = %s
        """,
        (user_id,),
    )
    user = cursor.fetchone()

    if not user:
        return True

    return bool(user.get("is_blocked"))


def blocked_response():
    return jsonify({
        "success": False,
        "message": "此帳號目前無法執行此操作。",
    }), 403


def stale_data_response(message="資料狀態已更新，請重新整理後再試。"):
    return jsonify({
        "success": False,
        "message": message,
    }), 409


def duplicate_report_response():
    return jsonify({
        "success": False,
        "message": "系統偵測到短時間內已有相同通報，請勿重複送出。",
    }), 409


def has_duplicate_report_in_5_minutes(
    cursor,
    user_id,
    report_type,
    item_name,
    category_id,
    location_name,
    event_date,
):
    cursor.execute(
        """
        SELECT r.report_id
        FROM report r
        JOIN item i ON r.item_id = i.item_id
        JOIN location l ON r.location_id = l.location_id
        WHERE r.user_id = %s
          AND r.type = %s
          AND i.item_name = %s
          AND i.category_id = %s
          AND l.location_name = %s
          AND r.event_date = %s
          AND r.deleted_at IS NULL
          AND r.created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        LIMIT 1
        """,
        (
            user_id,
            report_type,
            item_name,
            category_id,
            location_name,
            event_date,
        ),
    )

    return cursor.fetchone() is not None


def has_active_claim_for_found_report(cursor, found_report_id, exclude_claim_id=None, for_update=False):
    lock_clause = " FOR UPDATE" if for_update else ""

    if exclude_claim_id is None:
        cursor.execute(
            f"""
            SELECT claim_id
            FROM claim_request
            WHERE found_report_id = %s
              AND status IN ('已接受', '交接中', '已完成')
            LIMIT 1
            {lock_clause}
            """,
            (found_report_id,),
        )
    else:
        cursor.execute(
            f"""
            SELECT claim_id
            FROM claim_request
            WHERE found_report_id = %s
              AND claim_id <> %s
              AND status IN ('已接受', '交接中', '已完成')
            LIMIT 1
            {lock_clause}
            """,
            (found_report_id, exclude_claim_id),
        )

    return cursor.fetchone() is not None
