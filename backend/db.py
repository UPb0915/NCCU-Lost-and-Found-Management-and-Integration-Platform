from datetime import date, datetime
from decimal import Decimal

from mysql.connector import Error, pooling

from config import Config


connection_pool = pooling.MySQLConnectionPool(
    pool_name="lost_found_pool",
    pool_size=5,
    pool_reset_session=True,
    host=Config.DB_HOST,
    port=Config.DB_PORT,
    user=Config.DB_USER,
    password=Config.DB_PASSWORD,
    database=Config.DB_NAME,
    ssl_disabled=Config.DB_SSL_DISABLED,
    autocommit=False,
)


def get_connection():
    try:
        conn = connection_pool.get_connection()

        cursor = conn.cursor()
        cursor.execute("SET time_zone = '+08:00'")
        cursor.close()

        return conn

    except Error as exc:
        print("MySQL connection error:", exc)
        raise


def _normalize_value(value):
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, Decimal):
        return float(value)
    return value


def _normalize_row(row):
    if row is None:
        return None
    if isinstance(row, dict):
        return {key: _normalize_row(value) for key, value in row.items()}
    if isinstance(row, list):
        return [_normalize_row(item) for item in row]
    return _normalize_value(row)


def fetch_all(sql, params=None):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(sql, params or ())
        return _normalize_row(cursor.fetchall())
    finally:
        cursor.close()
        conn.close()


def fetch_one(sql, params=None):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(sql, params or ())
        return _normalize_row(cursor.fetchone())
    finally:
        cursor.close()
        conn.close()


def execute(sql, params=None):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(sql, params or ())
        conn.commit()
        return cursor.lastrowid
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def execute_many(sql, params_list):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.executemany(sql, params_list)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()
