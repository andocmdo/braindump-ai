/**
 * ConfigView - Settings/Configuration UI
 */

export class ConfigView {
    constructor(apiClient) {
        this.api = apiClient;
        this.config = null;
        this.prompts = null;
        this.modal = null;
    }

    async show() {
        // Load current config
        await this.loadConfig();
        await this.loadPrompts();

        // Create modal
        this.createModal();

        // Populate fields
        this.populateFields();
    }

    async loadConfig() {
        const response = await fetch('/api/config');
        this.config = await response.json();
    }

    async loadPrompts() {
        const response = await fetch('/api/config/prompts');
        this.prompts = await response.json();
    }

    createModal() {
        // Remove existing modal if present
        const existing = document.getElementById('config-modal');
        if (existing) {
            existing.remove();
        }

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'config-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content config-modal-content">
                <div class="modal-header">
                    <h2>Settings</h2>
                    <button class="modal-close" id="config-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="config-section">
                        <h3>LLM Configuration</h3>
                        <div class="form-group">
                            <label for="llm-provider">Provider</label>
                            <select id="llm-provider">
                                <option value="openrouter">OpenRouter</option>
                                <option value="anthropic">Anthropic</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="llm-model">Model</label>
                            <input type="text" id="llm-model" placeholder="anthropic/claude-3.5-sonnet">
                            <small>Examples: anthropic/claude-3.5-sonnet, google/gemini-2.5-flash</small>
                        </div>
                        <div class="form-group">
                            <label for="llm-api-key">API Key</label>
                            <input type="password" id="llm-api-key" placeholder="Enter new API key (leave blank to keep current)">
                            <small id="api-key-status"></small>
                        </div>
                        <div class="form-group">
                            <label for="llm-site-name">Site Name</label>
                            <input type="text" id="llm-site-name" placeholder="Braindump">
                        </div>
                        <div class="form-group">
                            <label for="llm-site-url">Site URL</label>
                            <input type="text" id="llm-site-url" placeholder="https://github.com/user/repo">
                        </div>
                    </div>

                    <div class="config-section">
                        <h3>Summary Settings</h3>
                        <div class="form-group">
                            <label for="summary-recency">Recency Window (hours)</label>
                            <input type="number" id="summary-recency" min="1" max="168" value="24">
                            <small>How far back to look for recent activity (1-168 hours)</small>
                        </div>
                    </div>

                    <div class="config-section">
                        <h3>Sync Settings</h3>
                        <div class="form-group">
                            <label for="sync-interval">Poll Interval (seconds)</label>
                            <input type="number" id="sync-interval" min="5" max="300" value="15">
                            <small>How often to check for updates (5-300 seconds)</small>
                        </div>
                    </div>

                    <div class="config-section">
                        <h3>Consolidation Prompts</h3>
                        <div class="form-group">
                            <label for="prompt-system">System Prompt</label>
                            <textarea id="prompt-system" rows="8"></textarea>
                            <small>The AI's instructions for consolidation</small>
                        </div>
                        <div class="form-group">
                            <label for="prompt-user">User Prompt Template</label>
                            <textarea id="prompt-user" rows="8"></textarea>
                            <small>Template for user requests (use {content} placeholder)</small>
                        </div>
                        <div class="form-note">
                            <strong>Note:</strong> Prompt changes apply immediately but reset on server restart.
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" id="config-cancel">Cancel</button>
                    <button class="btn btn-primary" id="config-save">Save Settings</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modal = modal;

        // Add event listeners
        modal.querySelector('#config-close').addEventListener('click', () => this.close());
        modal.querySelector('#config-cancel').addEventListener('click', () => this.close());
        modal.querySelector('#config-save').addEventListener('click', () => this.save());

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close();
            }
        });

        // Show modal
        setTimeout(() => modal.classList.add('open'), 10);
    }

    populateFields() {
        // LLM config
        document.getElementById('llm-provider').value = this.config.llm.provider;
        document.getElementById('llm-model').value = this.config.llm.model;
        document.getElementById('llm-site-name').value = this.config.llm.site_name;
        document.getElementById('llm-site-url').value = this.config.llm.site_url;

        // Show API key status
        const apiKeyStatus = document.getElementById('api-key-status');
        if (this.config.llm.api_key_set) {
            apiKeyStatus.textContent = 'API key is set';
            apiKeyStatus.style.color = '#2ecc71';
        } else {
            apiKeyStatus.textContent = 'No API key configured';
            apiKeyStatus.style.color = '#e74c3c';
        }

        // Summary config
        document.getElementById('summary-recency').value = this.config.summary.recency_hours;

        // Sync config
        document.getElementById('sync-interval').value = this.config.sync.poll_interval_seconds;

        // Prompts
        document.getElementById('prompt-system').value = this.prompts.system_prompt;
        document.getElementById('prompt-user').value = this.prompts.user_prompt;
    }

    async save() {
        try {
            // Collect config data
            const configData = {
                llm: {
                    provider: document.getElementById('llm-provider').value,
                    model: document.getElementById('llm-model').value,
                    site_name: document.getElementById('llm-site-name').value,
                    site_url: document.getElementById('llm-site-url').value,
                },
                summary: {
                    recency_hours: parseInt(document.getElementById('summary-recency').value)
                },
                sync: {
                    poll_interval_seconds: parseInt(document.getElementById('sync-interval').value)
                }
            };

            // Include API key if changed
            const apiKey = document.getElementById('llm-api-key').value;
            if (apiKey) {
                configData.llm.api_key = apiKey;
            }

            // Save config
            const configResponse = await fetch('/api/config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configData)
            });

            if (!configResponse.ok) {
                throw new Error('Failed to save config');
            }

            // Collect and save prompts
            const promptsData = {
                system_prompt: document.getElementById('prompt-system').value,
                user_prompt: document.getElementById('prompt-user').value
            };

            const promptsResponse = await fetch('/api/config/prompts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(promptsData)
            });

            if (!promptsResponse.ok) {
                throw new Error('Failed to save prompts');
            }

            // Show success message
            this.showMessage('Settings saved successfully!', 'success');

            // Close modal after a short delay
            setTimeout(() => this.close(), 1000);

        } catch (error) {
            console.error('Error saving config:', error);
            this.showMessage('Error saving settings: ' + error.message, 'error');
        }
    }

    showMessage(text, type) {
        // Create or update message element
        let msg = this.modal.querySelector('.config-message');
        if (!msg) {
            msg = document.createElement('div');
            msg.className = 'config-message';
            const footer = this.modal.querySelector('.modal-footer');
            footer.parentNode.insertBefore(msg, footer);
        }

        msg.textContent = text;
        msg.className = `config-message ${type}`;
        msg.style.display = 'block';

        // Hide after 3 seconds
        setTimeout(() => {
            msg.style.display = 'none';
        }, 3000);
    }

    close() {
        if (this.modal) {
            this.modal.classList.remove('open');
            setTimeout(() => {
                this.modal.remove();
                this.modal = null;
            }, 300);
        }
    }
}
