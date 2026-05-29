import os

from dotenv import load_dotenv


load_dotenv()


class Config:
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"

    DB_HOST = os.getenv("DB_HOST")
    DB_PORT = int(os.getenv("DB_PORT"))
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_NAME = os.getenv("DB_NAME", "lost_and_found_system")
    DB_SSL_DISABLED = os.getenv("DB_SSL_DISABLED", "false").lower() == "true"

    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024
