from flask import Blueprint, jsonify, request

from db import execute, fetch_one

auth_bp = Blueprint("auth_bp", __name__)


def normalize_role(raw_role):
    if raw_role in ["student", "本校學生"]:
        return "student"
    if raw_role in ["staff", "教職員"]:
        return "staff"
    if raw_role in ["outsider", "外校人士"]:
        return "outsider"
    return None


def build_user_response(user):
    if not user:
        return None

    role = user.get("role") or ("outsider" if user.get("outsider") else "student")

    return {
        "user_id": user["user_id"],
        "name": user["name"],
        "role": role,
        "student_id": user.get("student_id"),
        "staff_id": user.get("staff_id"),
        "phone_number": user.get("phone_number"),
        "outsider": bool(user.get("outsider")),
        "created_at": user.get("created_at"),
    }


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    role = normalize_role(data.get("role"))
    name = (data.get("name") or "").strip()
    student_id = (data.get("student_id") or "").strip() or None
    staff_id = (data.get("staff_id") or "").strip() or None
    phone_number = (data.get("phone_number") or "").strip()

    if role is None:
        return jsonify({"success": False, "message": "請選擇正確身分"}), 400

    if not name:
        return jsonify({"success": False, "message": "請輸入姓名"}), 400

    if not phone_number:
        return jsonify({"success": False, "message": "請輸入電話"}), 400

    if role == "student" and not student_id:
        return jsonify({"success": False, "message": "本校學生請輸入學號"}), 400

    if role == "staff" and not staff_id:
        return jsonify({"success": False, "message": "教職員請輸入教師編號"}), 400

    blocked_identity = fetch_one(
        """
        SELECT blocked_id, reason
        FROM blocked_identity
        WHERE phone_number = %s
           OR (student_id IS NOT NULL AND student_id <> '' AND student_id = %s)
           OR (staff_id IS NOT NULL AND staff_id <> '' AND staff_id = %s)
           OR (name = %s AND phone_number = %s)
        LIMIT 1
        """,
        (
            phone_number,
            student_id,
            staff_id,
            name,
            phone_number,
        ),
    )

    if blocked_identity:
        return jsonify({
            "success": False,
            "message": "此身分資料已被限制註冊，請聯絡管理員。",
        }), 403

    if role == "student":
        existed = fetch_one(
            """
            SELECT user_id
            FROM user_account
            WHERE role = 'student'
              AND student_id = %s
            LIMIT 1
            """,
            (student_id,),
        )
    elif role == "staff":
        existed = fetch_one(
            """
            SELECT user_id
            FROM user_account
            WHERE role = 'staff'
              AND staff_id = %s
            LIMIT 1
            """,
            (staff_id,),
        )
    else:
        existed = fetch_one(
            """
            SELECT user_id
            FROM user_account
            WHERE role = 'outsider'
              AND name = %s
              AND phone_number = %s
            LIMIT 1
            """,
            (name, phone_number),
        )

    if existed:
        return jsonify({"success": False, "message": "此使用者已註冊，請直接登入"}), 409

    outsider = role == "outsider"

    try:
        user_id = execute(
            """
            INSERT INTO user_account
                (name, student_id, staff_id, phone_number, outsider, role)
            VALUES
                (%s, %s, %s, %s, %s, %s)
            """,
            (name, student_id, staff_id, phone_number, outsider, role),
        )
    except Exception as exc:
        return jsonify({"success": False, "message": f"註冊失敗：{str(exc)}"}), 500

    user = fetch_one(
        """
        SELECT
            user_id,
            name,
            role,
            student_id,
            staff_id,
            phone_number,
            outsider,
            created_at
        FROM user_account
        WHERE user_id = %s
        """,
        (user_id,),
    )

    return jsonify({
        "success": True,
        "message": "註冊成功",
        "user": build_user_response(user),
    })


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    role = normalize_role(data.get("role"))
    name = (data.get("name") or "").strip()
    student_id = (data.get("student_id") or "").strip() or None
    staff_id = (data.get("staff_id") or "").strip() or None
    phone_number = (data.get("phone_number") or "").strip()

    if role is None:
        return jsonify({"success": False, "message": "請選擇正確身分"}), 400

    if not name:
        return jsonify({"success": False, "message": "請輸入姓名"}), 400

    if not phone_number:
        return jsonify({"success": False, "message": "請輸入電話"}), 400

    if role == "student":
        if not student_id:
            return jsonify({"success": False, "message": "本校學生請輸入學號"}), 400

        user = fetch_one(
            """
            SELECT
                user_id,
                name,
                role,
                student_id,
                staff_id,
                phone_number,
                outsider,
                created_at,
                is_blocked,
                blocked_reason
            FROM user_account
            WHERE role = 'student'
              AND name = %s
              AND student_id = %s
              AND phone_number = %s
            LIMIT 1
            """,
            (name, student_id, phone_number),
        )
    elif role == "staff":
        if not staff_id:
            return jsonify({"success": False, "message": "教職員請輸入教師編號"}), 400

        user = fetch_one(
            """
            SELECT
                user_id,
                name,
                role,
                student_id,
                staff_id,
                phone_number,
                outsider,
                created_at,
                is_blocked,
                blocked_reason
            FROM user_account
            WHERE role = 'staff'
              AND name = %s
              AND staff_id = %s
              AND phone_number = %s
            LIMIT 1
            """,
            (name, staff_id, phone_number),
        )
    else:
        user = fetch_one(
            """
            SELECT
                user_id,
                name,
                role,
                student_id,
                staff_id,
                phone_number,
                outsider,
                        created_at,
                        is_blocked,
                        blocked_reason
            FROM user_account
            WHERE role = 'outsider'
              AND name = %s
              AND phone_number = %s
            LIMIT 1
            """,
            (name, phone_number),
        )

    if not user:
        return jsonify({"success": False, "message": "登入失敗，查無此使用者"}), 401

    if user.get("is_blocked"):
        return jsonify({
            "success": False,
            "message": user.get("blocked_reason") or "此帳號已被管理員封鎖，無法登入。",
        }), 403

    return jsonify({
        "success": True,
        "message": "登入成功",
        "user": build_user_response(user),
    })


@auth_bp.route("/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json() or {}

    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    admin = fetch_one(
        """
        SELECT admin_id, username, password_hash, display_name
        FROM admin_account
        WHERE username = %s
        LIMIT 1
        """,
        (username,),
    )

    if not admin or admin["password_hash"] != password:
        return jsonify({"success": False, "message": "Admin 帳號或密碼錯誤"}), 401

    return jsonify({
        "success": True,
        "message": "Admin 登入成功",
        "admin": {
            "admin_id": admin["admin_id"],
            "username": admin["username"],
            "display_name": admin["display_name"],
        },
    })
