/**
 * Braindump - Consolidation Module
 *
 * Handles document consolidation and diff viewing.
 */

const API_BASE = '/api';

export class ConsolidationAPI {
    /**
     * Start consolidation for a document.
     */
    async consolidate(documentId) {
        const response = await fetch(`${API_BASE}/consolidate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_id: documentId }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Consolidation failed');
        }

        return response.json();
    }

    /**
     * Start consolidation for multiple documents.
     */
    async consolidateMultiple(documentIds) {
        const response = await fetch(`${API_BASE}/consolidate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_ids: documentIds }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Consolidation failed');
        }

        return response.json();
    }

    /**
     * List active consolidation proposals.
     */
    async listProposals() {
        const response = await fetch(`${API_BASE}/consolidate/proposals`);
        if (!response.ok) throw new Error('Failed to fetch proposals');
        return response.json();
    }

    /**
     * Get a specific proposal.
     */
    async getProposal(branchName) {
        const response = await fetch(`${API_BASE}/consolidate/proposals/${branchName}`);
        if (!response.ok) throw new Error('Failed to fetch proposal');
        return response.json();
    }

    /**
     * Accept a consolidation proposal.
     */
    async acceptProposal(branchName) {
        const response = await fetch(`${API_BASE}/consolidate/proposals/${branchName}/accept`, {
            method: 'POST',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Accept failed');
        }

        return response.json();
    }

    /**
     * Reject a consolidation proposal.
     */
    async rejectProposal(branchName) {
        const response = await fetch(`${API_BASE}/consolidate/proposals/${branchName}/reject`, {
            method: 'POST',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Reject failed');
        }

        return response.json();
    }
}


export class ConsolidationModal {
    constructor(options = {}) {
        this.options = {
            onAccept: () => {},
            onReject: () => {},
            ...options
        };
        this.api = new ConsolidationAPI();
        this.modal = null;
        this.currentProposal = null;
        this.createModal();
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'modal consolidation-modal';
        this.modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content consolidation-modal-content">
                <div class="modal-header">
                    <h2>Consolidation Preview</h2>
                    <div class="modal-header-actions">
                        <button class="btn-icon modal-close" title="Close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="modal-body consolidation-body">
                    <div class="consolidation-loading">
                        <div class="spinner"></div>
                        <p>Processing with AI...</p>
                    </div>
                    <div class="consolidation-error hidden">
                        <p class="error-message"></p>
                        <button class="btn btn-primary retry-btn">Try Again</button>
                    </div>
                    <div class="consolidation-diff hidden">
                        <div class="diff-container">
                            <div class="diff-pane diff-original">
                                <div class="diff-pane-header">Original</div>
                                <div class="diff-pane-content"></div>
                            </div>
                            <div class="diff-pane diff-consolidated">
                                <div class="diff-pane-header">Consolidated</div>
                                <div class="diff-pane-content"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer hidden">
                    <div class="consolidation-actions">
                        <button class="btn reject-btn">Reject</button>
                        <button class="btn btn-primary accept-btn">Accept Changes</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        // Bind events
        this.modal.querySelector('.modal-backdrop').addEventListener('click', () => this.hide());
        this.modal.querySelector('.modal-close').addEventListener('click', () => this.hide());
        this.modal.querySelector('.accept-btn').addEventListener('click', () => this.handleAccept());
        this.modal.querySelector('.reject-btn').addEventListener('click', () => this.handleReject());
        this.modal.querySelector('.retry-btn').addEventListener('click', () => {
            if (this.pendingDocId) {
                this.consolidate(this.pendingDocId);
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('open')) {
                this.hide();
            }
        });
    }

    async show() {
        this.modal.classList.add('open');
    }

    hide() {
        this.modal.classList.remove('open');
        this.currentProposal = null;
    }

    showLoading() {
        this.modal.querySelector('.consolidation-loading').classList.remove('hidden');
        this.modal.querySelector('.consolidation-error').classList.add('hidden');
        this.modal.querySelector('.consolidation-diff').classList.add('hidden');
        this.modal.querySelector('.modal-footer').classList.add('hidden');
    }

    showError(message) {
        this.modal.querySelector('.consolidation-loading').classList.add('hidden');
        this.modal.querySelector('.consolidation-error').classList.remove('hidden');
        this.modal.querySelector('.consolidation-diff').classList.add('hidden');
        this.modal.querySelector('.modal-footer').classList.add('hidden');
        this.modal.querySelector('.error-message').textContent = message;
    }

    showDiff(proposal) {
        this.modal.querySelector('.consolidation-loading').classList.add('hidden');
        this.modal.querySelector('.consolidation-error').classList.add('hidden');
        this.modal.querySelector('.consolidation-diff').classList.remove('hidden');
        this.modal.querySelector('.modal-footer').classList.remove('hidden');

        // Render original content
        const originalPane = this.modal.querySelector('.diff-original .diff-pane-content');
        originalPane.innerHTML = this.renderContent(proposal.diff.original);

        // Render consolidated content
        const consolidatedPane = this.modal.querySelector('.diff-consolidated .diff-pane-content');
        consolidatedPane.innerHTML = this.renderContent(proposal.diff.consolidated);

        this.currentProposal = proposal;
    }

    renderContent(content) {
        // Escape HTML and preserve line breaks
        const lines = content.split('\n');
        return lines.map((line, i) => {
            const lineNum = i + 1;
            const escapedLine = this.escapeHtml(line) || '&nbsp;';
            const highlightClass = this.getLineHighlight(line);
            return `<div class="diff-line ${highlightClass}"><span class="line-number">${lineNum}</span><span class="line-content">${escapedLine}</span></div>`;
        }).join('');
    }

    getLineHighlight(line) {
        // Highlight special markers
        if (line.match(/^\s*#/)) return 'highlight-heading';
        if (line.match(/\bTODO\b|\bTASK\b/)) return 'highlight-todo';
        if (line.match(/\[QUESTION:/)) return 'highlight-question';
        if (line.match(/\bDONE\b/)) return 'highlight-done';
        return '';
    }

    async consolidate(documentId) {
        this.pendingDocId = documentId;
        this.show();
        this.showLoading();

        try {
            const result = await this.api.consolidate(documentId);
            this.showDiff(result);
        } catch (error) {
            console.error('Consolidation failed:', error);
            this.showError(error.message || 'Consolidation failed. Please try again.');
        }
    }

    async handleAccept() {
        if (!this.currentProposal) return;

        const acceptBtn = this.modal.querySelector('.accept-btn');
        acceptBtn.disabled = true;
        acceptBtn.textContent = 'Applying...';

        try {
            const result = await this.api.acceptProposal(this.currentProposal.branch_name);
            this.hide();
            this.options.onAccept(result);
        } catch (error) {
            console.error('Accept failed:', error);
            this.showError(error.message || 'Failed to accept changes.');
        } finally {
            acceptBtn.disabled = false;
            acceptBtn.textContent = 'Accept Changes';
        }
    }

    async handleReject() {
        if (!this.currentProposal) return;

        try {
            await this.api.rejectProposal(this.currentProposal.branch_name);
            this.hide();
            this.options.onReject();
        } catch (error) {
            console.error('Reject failed:', error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
