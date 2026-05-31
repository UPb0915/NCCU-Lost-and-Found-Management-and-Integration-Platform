from __future__ import annotations

import csv
import os
import sys
from datetime import datetime

from werkzeug.security import generate_password_hash

ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from db import fetch_all, execute


def looks_hashed(s: str) -> bool:
    if not s:
        return False
    s = s.strip()
    
    if s.startswith("pbkdf2:") or s.startswith("argon2:") or s.startswith("bcrypt:"):
        return True
    
    if "$" in s or ":" in s:
        return True
    return False


def main(argv: list[str]) -> int:
    yes = "--yes" in argv or "-y" in argv

    admins = fetch_all("SELECT admin_id, username, password_hash FROM admin_account") or []

    to_update = []
    for a in admins:
        stored = (a.get("password_hash") or "").strip()
        if not stored:
            continue
        if not looks_hashed(stored):
            to_update.append((a["admin_id"], a["username"], stored))

    if not to_update:
        print("No admin passwords need hashing.")
        return 0

    print(f"Found {len(to_update)} admin accounts with non-hashed passwords.")

    if not yes:
        ans = input("Proceed to backup and hash these passwords? (y/N): ").strip().lower()
        if ans != "y":
            print("Aborted by user.")
            return 0

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(os.path.dirname(__file__), "backups")
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, f"admin_passwords_backup_{ts}.csv")

    with open(backup_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["admin_id", "username", "old_password"])
        for admin_id, username, old in to_update:
            writer.writerow([admin_id, username, old])

    try:
        os.chmod(backup_path, 0o600)
    except Exception:
        pass

    print(f"Backup written to: {backup_path}")


    updated = 0
    for admin_id, username, old in to_update:
       
        new_hash = generate_password_hash(old, method="pbkdf2:sha256")
        try:
            execute(
                """
                UPDATE admin_account
                SET password_hash = %s
                WHERE admin_id = %s
                """,
                (new_hash, admin_id),
            )
            updated += 1
            print(f"Hashed admin_id={admin_id} username={username}")
        except Exception as exc:
            print(f"Failed to update admin_id={admin_id}: {exc}")

    print(f"Completed. {updated} accounts updated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
