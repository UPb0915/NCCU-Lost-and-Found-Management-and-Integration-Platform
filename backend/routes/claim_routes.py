from flask import Blueprint, jsonify, request

from db import fetch_all, fetch_one, get_connection
from services.security_service import check_security_before_claim, log_activity

claim_bp = Blueprint("claim_bp", __name__)


def get_claim_detail(claim_id):
    return fetch_one(
        """
        SELECT
            cr.claim_id,
            cr.found_report_id,
            cr.lost_report_id,
            cr.claimant_user_id,
            cr.owner_user_id,
            cr.claim_message,
            cr.verification_answer,
            cr.status,
            cr.reject_reason,
            cr.cancel_reason,
            cr.created_at,
            cr.reviewed_at,
            cr.completed_at,
            cr.cancelled_at,

            claimant.name AS claimant_name,
            claimant.phone_number AS claimant_phone,

            owner.name AS owner_name,
            owner.phone_number AS owner_phone,

            found_item.item_name AS found_item_name,
            found_item.item_photo AS found_item_photo,
            found_item.note AS found_item_note,

            found_report.status AS found_status,
            found_location.location_name AS found_location_name,
            found_location.building AS found_building,

            fr.storage_location,
            fr.has_verification_question,

            vq.question_text,
            vq.reference_answer,

            lost_item.item_name AS lost_item_name,
            lost_report.status AS lost_status

        FROM claim_request cr

        JOIN user_account claimant
          ON cr.claimant_user_id = claimant.user_id

        JOIN user_account owner
          ON cr.owner_user_id = owner.user_id

        JOIN report found_report
          ON cr.found_report_id = found_report.report_id

        JOIN item found_item
          ON found_report.item_id = found_item.item_id

        JOIN location found_location
          ON found_report.location_id = found_location.location_id

        JOIN found_report fr
          ON cr.found_report_id = fr.report_id

        LEFT JOIN verification_question vq
          ON cr.found_report_id = vq.found_report_id

        LEFT JOIN report lost_report
          ON cr.lost_report_id = lost_report.report_id

        LEFT JOIN item lost_item
          ON lost_report.item_id = lost_item.item_id

        WHERE cr.claim_id = %s
        """,
        (claim_id,),
    )


@claim_bp.route("/claims", methods=["POST"])
def create_claim():
    data = request.get_json() or {}

    found_report_id = data.get("found_report_id")
    lost_report_id = data.get("lost_report_id")
    claimant_user_id = data.get("claimant_user_id")
    claim_message = (data.get("claim_message") or "").strip()
    verification_answer = (data.get("verification_answer") or "").strip()

    if not found_report_id or not claimant_user_id:
        return jsonify({"success": False, "message": "缺少認領申請資料"}), 400

    security_result = check_security_before_claim(
        user_id=claimant_user_id,
        found_report_id=found_report_id,
        content=f"{claim_message} {verification_answer}",
    )

    if not security_result["allowed"]:
        return jsonify({"success": False, "message": security_result["message"]}), 403

    found_report = fetch_one(
        """
        SELECT
            r.report_id,
            r.user_id AS owner_user_id,
            r.status,
            i.item_name,
            fr.has_verification_question
        FROM report r
        JOIN item i ON r.item_id = i.item_id
        JOIN found_report fr ON r.report_id = fr.report_id
        WHERE r.report_id = %s
          AND r.type = 'F'
          AND r.deleted_at IS NULL
        """,
        (found_report_id,),
    )

    if not found_report:
        return jsonify({"success": False, "message": "找不到拾獲物通報"}), 404

    if found_report["status"] != "待認領":
        return jsonify({"success": False, "message": "此拾獲物目前不可認領"}), 400

    if str(found_report["owner_user_id"]) == str(claimant_user_id):
        return jsonify({"success": False, "message": "不能認領自己通報的拾獲物"}), 400

    if found_report.get("has_verification_question") and not verification_answer:
        return jsonify({"success": False, "message": "請回答拾獲者設定的特徵問題"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            INSERT INTO claim_request
                (
                    found_report_id,
                    lost_report_id,
                    claimant_user_id,
                    owner_user_id,
                    claim_message,
                    verification_answer,
                    status
                )
            VALUES
                (%s, %s, %s, %s, %s, %s, '待審核')
            """,
            (
                found_report_id,
                lost_report_id,
                claimant_user_id,
                found_report["owner_user_id"],
                claim_message,
                verification_answer,
            ),
        )

        claim_id = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO notification
                (user_id, report_id, type, content)
            VALUES
                (%s, %s, 'claim', %s)
            """,
            (
                found_report["owner_user_id"],
                found_report_id,
                f"有人想認領你的拾獲物「{found_report['item_name']}」，請前往我收到的認領申請審核。",
            ),
        )

        conn.commit()

        log_activity(
            user_id=claimant_user_id,
            activity_type="create_claim",
            target_id=claim_id,
            content=claim_message,
        )

    except Exception as exc:
        conn.rollback()
        return jsonify({"success": False, "message": f"建立認領申請失敗：{str(exc)}"}), 500

    finally:
        cursor.close()
        conn.close()

    return jsonify({"success": True, "message": "認領申請已送出", "claim": get_claim_detail(claim_id)})


@claim_bp.route("/claims/mine/<int:user_id>", methods=["GET"])
def get_my_claims(user_id):
    claims = fetch_all(
        """
        SELECT
            cr.claim_id,
            cr.found_report_id,
            cr.lost_report_id,
            cr.status,
            cr.claim_message,
            cr.verification_answer,
            cr.reject_reason,
            cr.cancel_reason,
            cr.created_at,
            cr.reviewed_at,
            cr.completed_at,
            cr.cancelled_at,

            i.item_name AS found_item_name,
            i.item_photo AS found_item_photo,
            fr.storage_location,
            owner.name AS owner_name,
            owner.phone_number AS owner_phone

        FROM claim_request cr
        JOIN report r ON cr.found_report_id = r.report_id
        JOIN item i ON r.item_id = i.item_id
        JOIN found_report fr ON cr.found_report_id = fr.report_id
        JOIN user_account owner ON cr.owner_user_id = owner.user_id

        WHERE cr.claimant_user_id = %s
        ORDER BY cr.created_at DESC
        """,
        (user_id,),
    )

    return jsonify({"success": True, "claims": claims})


@claim_bp.route("/claims/received/<int:user_id>", methods=["GET"])
def get_received_claims(user_id):
    claims = fetch_all(
        """
        SELECT
            cr.claim_id,
            cr.found_report_id,
            cr.lost_report_id,
            cr.status,
            cr.claim_message,
            cr.verification_answer,
            cr.reject_reason,
            cr.cancel_reason,
            cr.created_at,
            cr.reviewed_at,
            cr.completed_at,
            cr.cancelled_at,

            claimant.name AS claimant_name,
            claimant.phone_number AS claimant_phone,

            i.item_name AS found_item_name,
            i.item_photo AS found_item_photo,

            vq.question_text,
            vq.reference_answer,

            lost_item.item_name AS lost_item_name

        FROM claim_request cr
        JOIN user_account claimant
          ON cr.claimant_user_id = claimant.user_id

        JOIN report found_report
          ON cr.found_report_id = found_report.report_id

        JOIN item i
          ON found_report.item_id = i.item_id

        LEFT JOIN verification_question vq
          ON cr.found_report_id = vq.found_report_id

        LEFT JOIN report lost_report
          ON cr.lost_report_id = lost_report.report_id

        LEFT JOIN item lost_item
          ON lost_report.item_id = lost_item.item_id

        WHERE cr.owner_user_id = %s
        ORDER BY cr.created_at DESC
        """,
        (user_id,),
    )

    return jsonify({"success": True, "claims": claims})


@claim_bp.route("/claims/<int:claim_id>", methods=["GET"])
def get_claim(claim_id):
    claim = get_claim_detail(claim_id)

    if not claim:
        return jsonify({"success": False, "message": "找不到認領申請"}), 404

    return jsonify({"success": True, "claim": claim})


@claim_bp.route("/claims/<int:claim_id>/accept", methods=["PATCH"])
def accept_claim(claim_id):
    data = request.get_json() or {}
    owner_user_id = data.get("owner_user_id")

    claim = get_claim_detail(claim_id)

    if not claim:
        return jsonify({"success": False, "message": "找不到認領申請"}), 404

    if str(claim["owner_user_id"]) != str(owner_user_id):
        return jsonify({"success": False, "message": "只有拾獲者可以接受認領"}), 403

    if claim["status"] != "待審核":
        return jsonify({"success": False, "message": "此申請目前不可接受"}), 400

    accepted_claim = fetch_one(
        """
        SELECT claim_id
        FROM claim_request
        WHERE found_report_id = %s
          AND status = '已接受'
          AND claim_id <> %s
        """,
        (claim["found_report_id"], claim_id),
    )

    if accepted_claim:
        return jsonify({"success": False, "message": "此拾獲物已經有一筆已接受的認領申請"}), 409

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            UPDATE claim_request
            SET status = '已接受',
                reviewed_at = NOW()
            WHERE claim_id = %s
            """,
            (claim_id,),
        )

        cursor.execute(
            """
            INSERT INTO notification
                (user_id, report_id, type, content)
            VALUES
                (%s, %s, 'claim_accept', %s)
            """,
            (
                claim["claimant_user_id"],
                claim["found_report_id"],
                f"你的認領申請已通過，請至「{claim['storage_location']}」領取物品。",
            ),
        )

        conn.commit()

    except Exception as exc:
        conn.rollback()
        return jsonify({"success": False, "message": f"接受認領失敗：{str(exc)}"}), 500

    finally:
        cursor.close()
        conn.close()

    return jsonify({"success": True, "message": "已接受認領申請", "claim": get_claim_detail(claim_id)})


@claim_bp.route("/claims/<int:claim_id>/reject", methods=["PATCH"])
def reject_claim(claim_id):
    data = request.get_json() or {}
    owner_user_id = data.get("owner_user_id")
    reject_reason = (data.get("reject_reason") or "").strip()

    claim = get_claim_detail(claim_id)

    if not claim:
        return jsonify({"success": False, "message": "找不到認領申請"}), 404

    if str(claim["owner_user_id"]) != str(owner_user_id):
        return jsonify({"success": False, "message": "只有拾獲者可以拒絕認領"}), 403

    if claim["status"] != "待審核":
        return jsonify({"success": False, "message": "此申請目前不可拒絕"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            UPDATE claim_request
            SET status = '已拒絕',
                reject_reason = %s,
                reviewed_at = NOW()
            WHERE claim_id = %s
            """,
            (reject_reason, claim_id),
        )

        cursor.execute(
            """
            INSERT INTO notification
                (user_id, report_id, type, content)
            VALUES
                (%s, %s, 'claim_reject', %s)
            """,
            (
                claim["claimant_user_id"],
                claim["found_report_id"],
                "你的認領申請未通過，請確認是否為正確物品。",
            ),
        )

        conn.commit()

    except Exception as exc:
        conn.rollback()
        return jsonify({"success": False, "message": f"拒絕認領失敗：{str(exc)}"}), 500

    finally:
        cursor.close()
        conn.close()

    return jsonify({"success": True, "message": "已拒絕認領申請", "claim": get_claim_detail(claim_id)})


@claim_bp.route("/claims/<int:claim_id>/cancel", methods=["PATCH"])
def cancel_claim(claim_id):
    data = request.get_json() or {}
    claimant_user_id = data.get("claimant_user_id")
    cancel_reason = (data.get("cancel_reason") or "").strip()

    claim = get_claim_detail(claim_id)

    if not claim:
        return jsonify({"success": False, "message": "找不到認領申請"}), 404

    if str(claim["claimant_user_id"]) != str(claimant_user_id):
        return jsonify({"success": False, "message": "只有申請者可以取消認領"}), 403

    if claim["status"] not in ["待審核", "已接受"]:
        return jsonify({"success": False, "message": "此申請目前不可取消"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            UPDATE claim_request
            SET status = '已取消',
                cancel_reason = %s,
                cancelled_at = NOW()
            WHERE claim_id = %s
            """,
            (cancel_reason, claim_id),
        )

        cursor.execute(
            """
            INSERT INTO notification
                (user_id, report_id, type, content)
            VALUES
                (%s, %s, 'claim', %s)
            """,
            (
                claim["owner_user_id"],
                claim["found_report_id"],
                f"{claim['claimant_name']} 已取消認領申請。",
            ),
        )

        conn.commit()

    except Exception as exc:
        conn.rollback()
        return jsonify({"success": False, "message": f"取消認領失敗：{str(exc)}"}), 500

    finally:
        cursor.close()
        conn.close()

    return jsonify({"success": True, "message": "已取消認領申請", "claim": get_claim_detail(claim_id)})


@claim_bp.route("/claims/<int:claim_id>/complete", methods=["PATCH"])
def complete_claim(claim_id):
    data = request.get_json() or {}
    claimant_user_id = data.get("claimant_user_id")

    claim = get_claim_detail(claim_id)

    if not claim:
        return jsonify({"success": False, "message": "找不到認領申請"}), 404

    if str(claim["claimant_user_id"]) != str(claimant_user_id):
        return jsonify({"success": False, "message": "只有申請者可以確認取回"}), 403

    if claim["status"] != "已接受":
        return jsonify({"success": False, "message": "只有已接受的申請可以完成取回"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            UPDATE claim_request
            SET status = '已完成',
                completed_at = NOW()
            WHERE claim_id = %s
            """,
            (claim_id,),
        )

        cursor.execute(
            """
            UPDATE report
            SET status = '已認領',
                resolved_at = NOW()
            WHERE report_id = %s
            """,
            (claim["found_report_id"],),
        )

        if claim.get("lost_report_id"):
            cursor.execute(
                """
                UPDATE report
                SET status = '已處理',
                    resolved_at = NOW()
                WHERE report_id = %s
                """,
                (claim["lost_report_id"],),
            )

        cursor.execute(
            """
            UPDATE claim_request
            SET status = '已取消',
                cancel_reason = '同一拾獲物已完成認領',
                cancelled_at = NOW()
            WHERE found_report_id = %s
              AND claim_id <> %s
              AND status IN ('待審核', '已接受')
            """,
            (claim["found_report_id"], claim_id),
        )

        cursor.execute(
            """
            INSERT INTO notification
                (user_id, report_id, type, content)
            VALUES
                (%s, %s, 'claim_complete', %s)
            """,
            (
                claim["owner_user_id"],
                claim["found_report_id"],
                f"{claim['claimant_name']} 已確認取回「{claim['found_item_name']}」，系統已完成結案。",
            ),
        )

        conn.commit()

    except Exception as exc:
        conn.rollback()
        return jsonify({"success": False, "message": f"完成取回失敗：{str(exc)}"}), 500

    finally:
        cursor.close()
        conn.close()

    return jsonify({"success": True, "message": "已完成取回，系統已自動結案", "claim": get_claim_detail(claim_id)})
