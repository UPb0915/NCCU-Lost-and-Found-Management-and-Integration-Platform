import hashlib

from db import execute, fetch_one


def make_content_hash(content):
    if not content:
        return None

    text = str(content).strip().lower()
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def check_user_blocked(user_id):
    user = fetch_one(
        """
        SELECT user_id, is_blocked, blocked_reason
        FROM user_account
        WHERE user_id = %s
        """,
        (user_id,),
    )

    if not user:
        return {
            "allowed": False,
            "message": "找不到使用者",
        }

    if user.get("is_blocked"):
        return {
            "allowed": False,
            "message": user.get("blocked_reason") or "此帳號已被管理員限制使用",
        }

    return {
        "allowed": True,
        "message": "OK",
    }


def log_activity(user_id, activity_type, target_id=None, content=None, ip_address=None):
    content_hash = make_content_hash(content)

    execute(
        """
        INSERT INTO user_activity_log
            (user_id, activity_type, target_id, content_hash, ip_address)
        VALUES
            (%s, %s, %s, %s, %s)
        """,
        (user_id, activity_type, target_id, content_hash, ip_address),
    )


def check_rate_limit(user_id, activity_type, limit=5, minutes=10):
    row = fetch_one(
        """
        SELECT COUNT(*) AS count
        FROM user_activity_log
        WHERE user_id = %s
          AND activity_type = %s
          AND created_at >= DATE_SUB(NOW(), INTERVAL %s MINUTE)
        """,
        (user_id, activity_type, minutes),
    )

    count = row["count"] if row else 0

    if count >= limit:
        return {
            "allowed": False,
            "message": f"你在短時間內操作過於頻繁，請 {minutes} 分鐘後再試。",
        }

    return {
        "allowed": True,
        "message": "OK",
    }


def check_duplicate_content(user_id, activity_type, content, minutes=30):
    content_hash = make_content_hash(content)

    if not content_hash:
        return {
            "allowed": True,
            "message": "OK",
        }

    row = fetch_one(
        """
        SELECT COUNT(*) AS count
        FROM user_activity_log
        WHERE user_id = %s
          AND activity_type = %s
          AND content_hash = %s
          AND created_at >= DATE_SUB(NOW(), INTERVAL %s MINUTE)
        """,
        (user_id, activity_type, content_hash, minutes),
    )

    count = row["count"] if row else 0

    if count >= 2:
        return {
            "allowed": False,
            "message": "你在短時間內提交了太多相同或高度重複的內容，請稍後再試。",
        }

    return {
        "allowed": True,
        "message": "OK",
    }


def check_duplicate_claim(user_id, found_report_id):
    existed = fetch_one(
        """
        SELECT claim_id
        FROM claim_request
        WHERE claimant_user_id = %s
          AND found_report_id = %s
          AND status IN ('待審核', '已接受')
        """,
        (user_id, found_report_id),
    )

    if existed:
        return {
            "allowed": False,
            "message": "你已經對此拾獲物提出過認領申請。",
        }

    return {
        "allowed": True,
        "message": "OK",
    }


def check_security_before_claim(user_id, found_report_id, content=None):
    blocked_result = check_user_blocked(user_id)
    if not blocked_result["allowed"]:
        return blocked_result

    rate_result = check_rate_limit(
        user_id=user_id,
        activity_type="create_claim",
        limit=5,
        minutes=10,
    )
    if not rate_result["allowed"]:
        return rate_result

    duplicate_claim_result = check_duplicate_claim(user_id, found_report_id)
    if not duplicate_claim_result["allowed"]:
        return duplicate_claim_result

    duplicate_content_result = check_duplicate_content(
        user_id=user_id,
        activity_type="create_claim",
        content=content,
        minutes=30,
    )
    if not duplicate_content_result["allowed"]:
        return duplicate_content_result

    return {
        "allowed": True,
        "message": "OK",
    }


def check_security_before_report(user_id, content=None):
    blocked_result = check_user_blocked(user_id)
    if not blocked_result["allowed"]:
        return blocked_result

    rate_result = check_rate_limit(
        user_id=user_id,
        activity_type="create_report",
        limit=5,
        minutes=10,
    )
    if not rate_result["allowed"]:
        return rate_result

    duplicate_content_result = check_duplicate_content(
        user_id=user_id,
        activity_type="create_report",
        content=content,
        minutes=30,
    )
    if not duplicate_content_result["allowed"]:
        return duplicate_content_result

    return {
        "allowed": True,
        "message": "OK",
    }
