from db import execute, fetch_all, fetch_one


MATCH_THRESHOLD = 55


def normalize_text(value):
    return str(value or "").strip().lower()


def calculate_similarity_score(new_report, old_report):
    score = 0

    if new_report.get("category_id") and new_report.get("category_id") == old_report.get("category_id"):
        score += 30

    new_name = normalize_text(new_report.get("item_name"))
    old_name = normalize_text(old_report.get("item_name"))

    if new_name and old_name:
        if new_name == old_name:
            score += 25
        elif new_name in old_name or old_name in new_name:
            score += 20
        else:
            common_chars = set(new_name) & set(old_name)
            if len(common_chars) >= 2:
                score += min(len(common_chars) * 4, 15)

    new_location = normalize_text(new_report.get("location_name"))
    old_location = normalize_text(old_report.get("location_name"))

    if new_location and old_location:
        if new_location == old_location:
            score += 20
        elif new_location in old_location or old_location in new_location:
            score += 15

    new_building = normalize_text(new_report.get("building"))
    old_building = normalize_text(old_report.get("building"))

    if new_building and old_building and new_building == old_building:
        score += 10

    new_note = normalize_text(new_report.get("note"))
    old_note = normalize_text(old_report.get("note"))

    if new_note and old_note:
        common_note_chars = set(new_note) & set(old_note)
        if len(common_note_chars) >= 3:
            score += min(len(common_note_chars) * 2, 10)

    return min(score, 100)


def get_report_detail_for_match(report_id):
    return fetch_one(
        """
        SELECT
            r.report_id,
            r.type,
            r.status,
            r.user_id,
            r.created_at,
            i.item_id,
            i.item_name,
            i.note,
            i.category_id,
            c.category_name,
            l.location_id,
            l.location_name,
            l.building,
            l.floor,
            l.room,
            fr.storage_location
        FROM report r
        JOIN item i ON r.item_id = i.item_id
        JOIN category c ON i.category_id = c.category_id
        JOIN location l ON r.location_id = l.location_id
        LEFT JOIN found_report fr ON r.report_id = fr.report_id
        WHERE r.report_id = %s
          AND r.deleted_at IS NULL
        """,
        (report_id,),
    )


def get_opposite_active_reports(new_report):
    if new_report["type"] == "L":
        opposite_type = "F"
        opposite_status = "待認領"
    else:
        opposite_type = "L"
        opposite_status = "待處理"

    return fetch_all(
        """
        SELECT
            r.report_id,
            r.type,
            r.status,
            r.user_id,
            r.created_at,
            i.item_id,
            i.item_name,
            i.note,
            i.category_id,
            c.category_name,
            l.location_id,
            l.location_name,
            l.building,
            l.floor,
            l.room,
            fr.storage_location
        FROM report r
        JOIN item i ON r.item_id = i.item_id
        JOIN category c ON i.category_id = c.category_id
        JOIN location l ON r.location_id = l.location_id
        LEFT JOIN found_report fr ON r.report_id = fr.report_id
        WHERE r.deleted_at IS NULL
          AND r.type = %s
          AND r.status = %s
          AND r.report_id <> %s
        ORDER BY r.created_at DESC
        """,
        (opposite_type, opposite_status, new_report["report_id"]),
    )


def save_report_match(lost_report_id, found_report_id, score):
    execute(
        """
        INSERT INTO report_match
            (lost_report_id, found_report_id, score, match_status)
        VALUES
            (%s, %s, %s, '已通知')
        ON DUPLICATE KEY UPDATE
            score = VALUES(score),
            match_status = '已通知'
        """,
        (lost_report_id, found_report_id, score),
    )


def create_match_notification(user_id, related_report_id, content):
    execute(
        """
        INSERT INTO notification
            (user_id, report_id, type, content)
        VALUES
            (%s, %s, 'match', %s)
        """,
        (user_id, related_report_id, content),
    )


def find_matches_and_notify(new_report_id):
    new_report = get_report_detail_for_match(new_report_id)

    if not new_report:
        return []

    old_reports = get_opposite_active_reports(new_report)
    matched_results = []

    for old_report in old_reports:
        score = calculate_similarity_score(new_report, old_report)

        if score < MATCH_THRESHOLD:
            continue

        if new_report["type"] == "L":
            lost_report_id = new_report["report_id"]
            found_report_id = old_report["report_id"]
            notify_user_id = old_report["user_id"]
            notify_related_report_id = new_report["report_id"]
            notification_content = (
                f"系統發現一筆新的遺失物「{new_report['item_name']}」"
                f"可能與你的拾獲物「{old_report['item_name']}」相似。"
            )
        else:
            lost_report_id = old_report["report_id"]
            found_report_id = new_report["report_id"]
            notify_user_id = old_report["user_id"]
            notify_related_report_id = new_report["report_id"]
            notification_content = (
                f"系統發現一筆新的拾獲物「{new_report['item_name']}」"
                f"可能與你的遺失物「{old_report['item_name']}」相似。"
            )

        save_report_match(lost_report_id, found_report_id, score)
        create_match_notification(
            user_id=notify_user_id,
            related_report_id=notify_related_report_id,
            content=notification_content,
        )

        matched_results.append({
            "score": score,
            "report": old_report,
        })

    matched_results.sort(key=lambda item: item["score"], reverse=True)
    return matched_results[:3]
