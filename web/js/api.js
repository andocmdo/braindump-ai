/**
 * API utility module for handling authenticated requests
 */

const API_BASE = '/api';

/**
 * Wrapper around fetch that handles authentication errors
 */
export async function apiFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);

        // Check for 401 authentication errors
        if (response.status === 401) {
            const data = await response.json();
            if (data.auth_required) {
                // Session expired or not authenticated, redirect to login
                window.location.href = '/login.html';
                throw new Error('Authentication required');
            }
        }

        return response;
    } catch (error) {
        // Re-throw the error for the caller to handle
        throw error;
    }
}

/**
 * Check if user is authenticated
 */
export async function checkAuthStatus() {
    try {
        const response = await fetch(`${API_BASE}/auth/status`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to check auth status:', error);
        return { authenticated: false, auth_enabled: false, needs_setup: false };
    }
}

/**
 * Log out the current user
 */
export async function logout() {
    try {
        const response = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
        });
        if (response.ok) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}
