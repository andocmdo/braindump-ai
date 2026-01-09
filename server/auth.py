"""
Authentication module for Braindump.

Provides simple password-based authentication with session management.
"""

import secrets
from functools import wraps
from flask import session, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash


class AuthManager:
    """Manages authentication for the Braindump application."""

    def __init__(self, config):
        """Initialize the auth manager with configuration."""
        self.config = config
        self.enabled = config.get('enabled', False)
        self.password_hash = config.get('password_hash')

    def is_enabled(self):
        """Check if authentication is enabled in config."""
        return self.enabled

    def needs_setup(self):
        """Check if initial password setup is required."""
        return self.enabled and self.password_hash is None

    def verify_password(self, password):
        """Verify a password against the stored hash."""
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def set_password(self, password):
        """Set a new password (returns the hash to be saved to config)."""
        return generate_password_hash(password, method='pbkdf2:sha256')

    def login(self, password):
        """Attempt to log in with the provided password."""
        if not self.is_enabled():
            return True  # Auth is disabled, allow access

        if self.verify_password(password):
            session['authenticated'] = True
            session.permanent = True  # Remember login across browser sessions
            return True
        return False

    def logout(self):
        """Log out the current user."""
        session.pop('authenticated', None)

    def is_authenticated(self):
        """Check if the current session is authenticated."""
        if not self.is_enabled():
            return True  # Auth is disabled, allow access
        # If auth is enabled, user must be authenticated (even if setup is needed)
        return session.get('authenticated', False)

    def generate_secret_key(self):
        """Generate a random secret key for Flask sessions."""
        return secrets.token_hex(32)


def require_auth(auth_manager):
    """Decorator to require authentication for a route."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not auth_manager.is_authenticated():
                return jsonify({'error': 'Authentication required', 'auth_required': True}), 401
            return f(*args, **kwargs)
        return decorated_function
    return decorator
