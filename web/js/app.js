/**
 * Braindump - Main Application
 *
 * Initializes the app and coordinates between modules.
 */

import { DocumentManager } from './documents.js';
import { Editor } from './editor.js';

class App {
    constructor() {
        this.documents = new DocumentManager();
        this.editor = null;
        this.currentDocId = null;
    }

    async init() {
        // Initialize editor
        this.editor = new Editor('editor', {
            onSave: (content) => this.handleSave(content),
            onTitleChange: (title) => this.handleTitleChange(title),
        });

        // Bind UI events
        this.bindEvents();

        // Load documents
        await this.loadDocuments();

        // Keyboard shortcuts
        this.bindKeyboardShortcuts();

        console.log('Braindump initialized');
    }

    bindEvents() {
        // New document buttons
        document.getElementById('btn-new').addEventListener('click', () => this.createNewDocument());
        document.getElementById('btn-new-placeholder').addEventListener('click', () => this.createNewDocument());

        // Refresh button
        document.getElementById('btn-refresh').addEventListener('click', () => this.loadDocuments());

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

    async openDocument(docId) {
        // Save current document first if dirty
        if (this.currentDocId && this.editor.isDirty()) {
            await this.editor.forceSave();
        }

        const doc = await this.documents.get(docId);
        if (!doc) return;

        this.currentDocId = docId;

        // Update UI
        document.getElementById('editor-placeholder').classList.add('hidden');
        document.getElementById('editor-container').classList.remove('hidden');
        document.getElementById('editor-title').textContent = doc.title || 'Untitled';

        // Load content into editor
        this.editor.setContent(doc.content);
        this.editor.focus();

        // Update active state in list
        document.querySelectorAll('.document-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === docId);
        });
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
