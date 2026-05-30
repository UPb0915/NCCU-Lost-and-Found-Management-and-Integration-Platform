import os

from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS

from config import Config
from routes.auth_routes import auth_bp
from routes.meta_routes import meta_bp
from routes.report_routes import report_bp
from routes.chat_routes import chat_bp
from routes.admin_routes import admin_bp
from routes.claim_routes import claim_bp
from routes.location_routes import location_bp


def create_app():
    app = Flask(__name__)

    app.config.from_object(Config)
    app.config["UPLOAD_FOLDER"] = os.path.join(os.path.dirname(__file__), Config.UPLOAD_FOLDER)
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    frontend_dir = os.path.join(base_dir, "frontend")

    CORS(app)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(meta_bp, url_prefix="/api")
    app.register_blueprint(report_bp, url_prefix="/api")
    app.register_blueprint(chat_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api")
    app.register_blueprint(claim_bp, url_prefix="/api")
    app.register_blueprint(location_bp, url_prefix="/api")

    @app.route("/")
    def home():
        return send_from_directory(frontend_dir, "index.html")

    @app.route("/index.html")
    def index():
        return send_from_directory(frontend_dir, "index.html")

    @app.route("/assets/<path:filename>")
    def frontend_assets(filename):
        return send_from_directory(os.path.join(frontend_dir, "assets"), filename)

    @app.route("/api/health")
    def health():
        return jsonify({"success": True, "message": "Flask + MySQL is running"})

    @app.route("/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=Config.FLASK_DEBUG)
