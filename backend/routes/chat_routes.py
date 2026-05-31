from flask import Blueprint, jsonify, request

from concurrency_utils import blocked_response, is_user_blocked
from db import execute, fetch_all, fetch_one, get_connection

chat_bp = Blueprint("chat_bp", __name__)


def get_conversation_full(conversation_id):
    conversation = fetch_one(
        """
        SELECT conversation_id, report_id, created_at, updated_at
        FROM conversation
        WHERE conversation_id = %s
        """,
        (conversation_id,)
    )

    if not conversation:
        return None

    participants = fetch_all(
        """
        SELECT user_id
        FROM conversation_participant
        WHERE conversation_id = %s
        ORDER BY user_id
        """,
        (conversation_id,)
    )

    messages = fetch_all(
        """
        SELECT
            m.message_id,
            m.conversation_id,
            m.sender_id,
            u.name AS sender_name,
            m.content,
            m.created_at
        FROM message m
        JOIN user_account u ON m.sender_id = u.user_id
        WHERE m.conversation_id = %s
        ORDER BY m.created_at ASC
        """,
        (conversation_id,)
    )

    report = fetch_one(
        """
        SELECT
            r.report_id,
            r.type,
            r.status,
            r.user_id,
            i.item_name,
            l.location_name,
            fr.trusted_user_id,
            fr.storage_location
        FROM report r
        JOIN item i ON r.item_id = i.item_id
        JOIN location l ON r.location_id = l.location_id
        LEFT JOIN found_report fr ON r.report_id = fr.report_id
        WHERE r.report_id = %s
        """,
        (conversation["report_id"],)
    )

    conversation["participant_ids"] = [participant["user_id"] for participant in participants]
    conversation["messages"] = messages
    conversation["report"] = report

    return conversation


@chat_bp.route("/chat/<int:conversation_id>", methods=["GET"])
def get_chat(conversation_id):
    conversation = get_conversation_full(conversation_id)

    if not conversation:
        return jsonify({"success": False, "message": "找不到聊天室"}), 404

    return jsonify({"success": True, "conversation": conversation})


@chat_bp.route("/chat/open", methods=["POST"])
def open_chat():
    data = request.get_json() or {}

    report_id = data.get("report_id")
    current_user_id = data.get("current_user_id")
    other_user_id = data.get("other_user_id")

    if not report_id or not current_user_id or not other_user_id:
        return jsonify({"success": False, "message": "缺少聊天室資訊"}), 400

    if str(current_user_id) == str(other_user_id):
        return jsonify({"success": False, "message": "不能與自己建立聊天室"}), 400

    existed = fetch_one(
        """
        SELECT c.conversation_id
        FROM conversation c
        JOIN conversation_participant p1
          ON c.conversation_id = p1.conversation_id
         AND p1.user_id = %s
        JOIN conversation_participant p2
          ON c.conversation_id = p2.conversation_id
         AND p2.user_id = %s
        WHERE c.report_id = %s
        LIMIT 1
        """,
        (current_user_id, other_user_id, report_id)
    )

    if existed:
        return jsonify({"success": True, "conversation": get_conversation_full(existed["conversation_id"])})

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        connection.start_transaction()

        if is_user_blocked(cursor, current_user_id):
            connection.rollback()
            return blocked_response()

        cursor.execute(
            """
            INSERT INTO conversation (report_id)
            VALUES (%s)
            """,
            (report_id,)
        )
        conversation_id = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO conversation_participant (conversation_id, user_id)
            VALUES (%s, %s), (%s, %s)
            """,
            (conversation_id, current_user_id, conversation_id, other_user_id)
        )

        connection.commit()
    except Exception as exc:
        connection.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500
    finally:
        cursor.close()
        connection.close()

    return jsonify({"success": True, "conversation": get_conversation_full(conversation_id)})


@chat_bp.route("/chat/send", methods=["POST"])
def send_message():
    data = request.get_json() or {}

    conversation_id = data.get("conversation_id")
    sender_id = data.get("sender_id")
    content = data.get("content", "").strip()

    if not conversation_id or not sender_id or not content:
        return jsonify({"success": False, "message": "訊息資料不完整"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        conn.start_transaction()

        if is_user_blocked(cursor, sender_id):
            conn.rollback()
            return blocked_response()

        # 1. 一次查聊天室基本資料
        cursor.execute(
            """
            SELECT conversation_id, report_id
            FROM conversation
            WHERE conversation_id = %s
            """,
            (conversation_id,)
        )
        conversation_base = cursor.fetchone()

        if not conversation_base:
            return jsonify({"success": False, "message": "找不到聊天室"}), 404

        report_id = conversation_base["report_id"]

        # 2. 查參與者
        cursor.execute(
            """
            SELECT user_id
            FROM conversation_participant
            WHERE conversation_id = %s
            """,
            (conversation_id,)
        )
        participants = cursor.fetchall()
        participant_ids = [p["user_id"] for p in participants]

        if int(sender_id) not in [int(uid) for uid in participant_ids]:
            return jsonify({"success": False, "message": "你不是此聊天室參與者"}), 403

        receiver_ids = [
            uid for uid in participant_ids
            if str(uid) != str(sender_id)
        ]

        # 3. 查發送者姓名
        cursor.execute(
            """
            SELECT name
            FROM user_account
            WHERE user_id = %s
            """,
            (sender_id,)
        )
        sender = cursor.fetchone()
        sender_name = sender["name"] if sender else "未知使用者"

        # 4. 新增訊息
        cursor.execute(
            """
            INSERT INTO message (conversation_id, sender_id, content)
            VALUES (%s, %s, %s)
            """,
            (conversation_id, sender_id, content)
        )

        # 5. 新增通知
        for receiver_id in receiver_ids:
            cursor.execute(
                """
                INSERT INTO notification (user_id, report_id, conversation_id, type, content)
                VALUES (%s, %s, %s, 'chat', %s)
                """,
                (
                    receiver_id,
                    report_id,
                    conversation_id,
                    f"{sender_name} 傳了訊息給你"
                )
            )

        conn.commit()

        # 6. 只查必要的聊天室訊息，不要整個 get_conversation_full 重複查太多次
        cursor.execute(
            """
            SELECT
                c.conversation_id,
                c.report_id,
                c.created_at,
                c.updated_at
            FROM conversation c
            WHERE c.conversation_id = %s
            """,
            (conversation_id,)
        )
        conversation = cursor.fetchone()

        cursor.execute(
            """
            SELECT
                m.message_id,
                m.conversation_id,
                m.sender_id,
                u.name AS sender_name,
                m.content,
                m.created_at
            FROM message m
            JOIN user_account u ON m.sender_id = u.user_id
            WHERE m.conversation_id = %s
            ORDER BY m.created_at ASC
            """,
            (conversation_id,)
        )
        messages = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                r.report_id,
                r.type,
                r.status,
                r.user_id,
                i.item_name,
                l.location_name,
                fr.trusted_user_id
            FROM report r
            JOIN item i ON r.item_id = i.item_id
            JOIN location l ON r.location_id = l.location_id
            LEFT JOIN found_report fr ON r.report_id = fr.report_id
            WHERE r.report_id = %s
            """,
            (report_id,)
        )
        report = cursor.fetchone()

        conversation["participant_ids"] = participant_ids
        conversation["messages"] = messages
        conversation["report"] = report

        return jsonify({
            "success": True,
            "conversation": conversation
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()


@chat_bp.route("/chat/trust", methods=["POST"])
def trust_user():
    data = request.get_json() or {}

    report_id = data.get("report_id")
    owner_user_id = data.get("owner_user_id")
    trusted_user_id = data.get("trusted_user_id")

    report = fetch_one(
        """
        SELECT r.report_id, r.user_id, r.type
        FROM report r
        WHERE r.report_id = %s
        """,
        (report_id,)
    )

    if not report:
        return jsonify({"success": False, "message": "找不到通報"}), 404

    if report["type"] != "F":
        return jsonify({"success": False, "message": "只有拾獲物可以使用信任機制"}), 400

    if str(report["user_id"]) != str(owner_user_id):
        return jsonify({"success": False, "message": "只有拾獲者本人可以信任遺失者"}), 403

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        connection.start_transaction()

        if is_user_blocked(cursor, owner_user_id):
            connection.rollback()
            return blocked_response()

        cursor.execute(
            """
            UPDATE found_report
            SET trusted_user_id = %s
            WHERE report_id = %s
            """,
            (trusted_user_id, report_id)
        )

        cursor.execute(
            """
            INSERT INTO trusted_claim (found_report_id, trusted_lost_user_id, trusted_by_user_id)
            VALUES (%s, %s, %s)
            """,
            (report_id, trusted_user_id, owner_user_id)
        )

        connection.commit()
    except Exception as exc:
        connection.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500
    finally:
        cursor.close()
        connection.close()

    updated_report = fetch_one(
        """
        SELECT
            r.report_id,
            r.type,
            r.status,
            r.user_id,
            i.item_name,
            l.location_name,
            fr.trusted_user_id,
            fr.storage_location
        FROM report r
        JOIN item i ON r.item_id = i.item_id
        JOIN location l ON r.location_id = l.location_id
        LEFT JOIN found_report fr ON r.report_id = fr.report_id
        WHERE r.report_id = %s
        """,
        (report_id,)
    )

    return jsonify({
        "success": True,
        "message": "已信任遺失者，現在可以將此拾獲物改成已認領",
        "report": updated_report,
    })


@chat_bp.route("/notifications/<int:user_id>", methods=["GET"])
def get_notifications(user_id):
    notifications = fetch_all(
        """
        SELECT
            notification_id,
            user_id,
            report_id,
            conversation_id,
            type,
            content,
            is_read,
            created_at
        FROM notification
        WHERE user_id = %s
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        """,
        (user_id,)
    )

    return jsonify({"success": True, "notifications": notifications})


@chat_bp.route("/notifications/<int:notification_id>/read", methods=["PATCH"])
def mark_notification_read(notification_id):
    execute(
        """
        UPDATE notification
        SET is_read = TRUE
        WHERE notification_id = %s
        """,
        (notification_id,)
    )

    return jsonify({"success": True})
