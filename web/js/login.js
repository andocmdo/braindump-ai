/**
 * Login page functionality
 */

const API_BASE = '/api';

// Check if we need setup or login
async function checkAuthStatus() {
    try {
        const response = await fetch(`${API_BASE}/auth/status`);
        const data = await response.json();

        if (data.needs_setup) {
            // Show setup form
            document.getElementById('login-subtitle').textContent = 'Create your password';
            document.getElementById('btn-text').textContent = 'Set Password';
            document.getElementById('password').placeholder = 'Create Password (min 4 characters)';
            return 'setup';
        } else if (!data.authenticated) {
            // Show login form
            document.getElementById('login-subtitle').textContent = 'Enter your password';
            document.getElementById('btn-text').textContent = 'Login';
            return 'login';
        } else {
            // Already authenticated, redirect to main app
            window.location.href = '/';
            return 'authenticated';
        }
    } catch (error) {
        console.error('Failed to check auth status:', error);
        showError('Failed to connect to server');
        return 'error';
    }
}

// Handle form submission
async function handleSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const password = form.password.value;
    const submitButton = form.querySelector('button[type="submit"]');
    const errorMessage = document.getElementById('error-message');

    // Clear previous error
    hideError();

    // Disable form
    submitButton.disabled = true;

    try {
        const mode = await checkAuthStatus();
        const endpoint = mode === 'setup' ? `${API_BASE}/auth/setup` : `${API_BASE}/auth/login`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Success! Redirect to main app
            window.location.href = '/';
        } else {
            // Show error
            showError(data.error || 'Authentication failed');
            submitButton.disabled = false;
            form.password.value = '';
            form.password.focus();
        }
    } catch (error) {
        console.error('Login/setup failed:', error);
        showError('Failed to connect to server');
        submitButton.disabled = false;
    }
}

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    const errorMessage = document.getElementById('error-message');
    errorMessage.classList.add('hidden');
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check auth status on load
    await checkAuthStatus();

    // Set up form handler
    const form = document.getElementById('login-form');
    form.addEventListener('submit', handleSubmit);
});
