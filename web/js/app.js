/**
 * Braindump - Main Application
 *
 * Initializes the app and coordinates between modules.
 */

import { DocumentManager } from './documents.js';
import { Editor } from './editor.js';
import { TodoModal } from './todos.js';
import { SearchManager } from './search.js';
import { ConsolidationModal } from './consolidation.js';
import { RecentSummaryView } from './recent-summary.js';
import { ConfigView } from './config.js';
import { checkAuthStatus } from './api.js';

class App {
    constructor() {
        this.documents = new DocumentManager();
        this.editor = null;
        this.currentDocId = null;
        this.todoModal = null;
        this.searchManager = null;
        this.consolidationModal = null;
        this.recentSummaryView = null;
        this.configView = null;
    }

    async checkAuth() {
        const data = await checkAuthStatus();

        if (!data.authenticated && data.auth_enabled) {
            // Not authenticated, redirect to login
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    async init() {
        // Check authentication first
        if (!await this.checkAuth()) {
            return;
        }
        // Initialize editor
        this.editor = new Editor('editor', {
            onSave: (content) => this.handleSave(content),
            onTitleChange: (title) => this.handleTitleChange(title),
        });

        // Initialize TODO modal
        this.todoModal = new TodoModal({
            onNavigate: (docId, lineNumber) => this.navigateToLine(docId, lineNumber),
        });

        // Initialize search
        this.searchManager = new SearchManager({
            onSelect: (docId) => this.openDocument(docId),
        });

        // Initialize consolidation modal
        this.consolidationModal = new ConsolidationModal({
            onAccept: (result) => {
                console.log('Consolidation accepted:', result);
                this.loadDocuments();
                if (result.document_id) {
                    this.openDocument(result.document_id);
                }
            },
            onReject: () => {
                console.log('Consolidation rejected');
            },
        });

        // Initialize recent summary view
        this.recentSummaryView = new RecentSummaryView({
            onNavigate: (docId, lineNumber) => this.navigateToLine(docId, lineNumber),
        });

        // Initialize config view
        this.configView = new ConfigView();

        // Bind UI events
        this.bindEvents();

        // Load documents
        await this.loadDocuments();

        // Keyboard shortcuts
        this.bindKeyboardShortcuts();

        // Show recent summary as default landing page
        this.showSummary();

        console.log('Braindump initialized');
    }

    bindEvents() {
        // New document buttons
        document.getElementById('btn-new').addEventListener('click', () => this.createNewDocument());
        document.getElementById('btn-new-placeholder').addEventListener('click', () => this.createNewDocument());

        // Refresh button
        document.getElementById('btn-refresh').addEventListener('click', () => this.loadDocuments());

        // Summary button
        document.getElementById('btn-summary').addEventListener('click', () => this.showSummary());

        // TODOs button
        document.getElementById('btn-todos').addEventListener('click', () => this.todoModal.show());

        // Consolidate button
        document.getElementById('btn-consolidate').addEventListener('click', () => this.handleConsolidate());

        // Config button
        document.getElementById('btn-config').addEventListener('click', () => this.configView.show());

        // Document list clicks (event delegation)
        document.getElementById('document-list').addEventListener('click', (e) => {
            const item = e.target.closest('.document-item');
            if (item) {
                this.openDocument(item.dataset.id);
            }
        });
    }

    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + N: New document
            if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                e.preventDefault();
                this.createNewDocument();
            }

            // Cmd/Ctrl + S: Force save (though auto-save handles this)
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                if (this.currentDocId) {
                    this.editor.forceSave();
                }
            }

            // Cmd/Ctrl + K: Focus search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('search-input').focus();
            }
        });
    }

    async loadDocuments() {
        const docs = await this.documents.list();
        this.renderDocumentList(docs);
    }

    renderDocumentList(docs) {
        const list = document.getElementById('document-list');

        if (docs.length === 0) {
            list.innerHTML = `
                <div class="document-list-empty">
                    <p>No documents yet</p>
                    <p>Click "+ New" to create one</p>
                </div>
            `;
            return;
        }

        list.innerHTML = docs.map(doc => `
            <div class="document-item ${doc.id === this.currentDocId ? 'active' : ''}" data-id="${doc.id}">
                <div class="document-title">${this.escapeHtml(doc.title) || 'Untitled'}</div>
                <div class="document-meta">${this.formatDate(doc.modified)}</div>
            </div>
        `).join('');
    }

    async createNewDocument() {
        const doc = await this.documents.create('');
        await this.loadDocuments();
        this.openDocument(doc.id);
    }

    showSummary() {
        // Hide editor and placeholder, show summary
        this.currentDocId = null;
        document.getElementById('editor-placeholder').classList.add('hidden');
        document.getElementById('editor-container').classList.add('hidden');
        this.recentSummaryView.show();

        // Remove active state from document list
        document.querySelectorAll('.document-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    async openDocument(docId, lineNumber = null) {
        // Save current document first if dirty
        if (this.currentDocId && this.editor.isDirty()) {
            await this.editor.forceSave();
        }

        const doc = await this.documents.get(docId);
        if (!doc) return;

        this.currentDocId = docId;

        // Update UI - hide summary and placeholder, show editor
        document.getElementById('editor-placeholder').classList.add('hidden');
        this.recentSummaryView.hide();
        document.getElementById('editor-container').classList.remove('hidden');
        document.getElementById('editor-title').textContent = doc.title || 'Untitled';

        // Load content into editor
        this.editor.setContent(doc.content);

        // Refresh CodeMirror layout after container becomes visible
        this.editor.refresh();

        // Navigate to specific line if provided
        if (lineNumber) {
            this.editor.goToLine(lineNumber);
        }

        this.editor.focus();

        // Update active state in list
        document.querySelectorAll('.document-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === docId);
        });
    }

    async navigateToLine(docId, lineNumber) {
        await this.openDocument(docId, lineNumber);
    }

    async handleSave(content) {
        if (!this.currentDocId) return;

        try {
            this.setSaveStatus('saving');
            await this.documents.update(this.currentDocId, content);
            this.setSaveStatus('saved');

            // Refresh document list to update titles/timestamps
            await this.loadDocuments();
        } catch (error) {
            console.error('Save failed:', error);
            this.setSaveStatus('error');
        }
    }

    handleTitleChange(title) {
        document.getElementById('editor-title').textContent = title || 'Untitled';
    }

    handleConsolidate() {
        if (!this.currentDocId) {
            alert('Please open a document first');
            return;
        }

        // Save any pending changes first
        if (this.editor.isDirty()) {
            this.editor.forceSave().then(() => {
                this.consolidationModal.consolidate(this.currentDocId);
            });
        } else {
            this.consolidationModal.consolidate(this.currentDocId);
        }
    }

    setSaveStatus(status) {
        const el = document.getElementById('save-status');
        el.className = 'save-status ' + status;
        el.textContent = status === 'saving' ? 'Saving...' :
                         status === 'saved' ? 'Saved' :
                         'Save failed';
    }

    formatDate(timestamp) {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = now - date;

        // Less than a minute
        if (diff < 60000) return 'Just now';

        // Less than an hour
        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return `${mins}m ago`;
        }

        // Less than a day
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        }

        // Less than a week
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days}d ago`;
        }

        // Otherwise show date
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});
