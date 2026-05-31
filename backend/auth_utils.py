from functools import wraps

from flask import session, jsonify


def require_admin_auth(f):
    """Decorator to protect admin routes. Checks if user has valid admin session."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
    
        admin_id = session.get("admin_id")
        
        if not admin_id:
            return jsonify({
                "success": False,
                "message": "未授權存取。請先登入管理員帳號。"
            }), 401
        
        return f(*args, **kwargs)
    
    return decorated_function
