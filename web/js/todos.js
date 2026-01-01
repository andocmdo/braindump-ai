/**
 * Braindump - TODOs Module
 *
 * Manages the Master TODO list view and TODO API interactions.
 */

const API_BASE = '/api';

export class TodoManager {
    constructor() {
        this.todos = [];
        this.stats = null;
    }

    async fetchTodos(includeDone = false) {
        try {
            const url = `${API_BASE}/todos${includeDone ? '?include_done=true' : ''}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch TODOs');

            this.todos = await response.json();
            return this.todos;
        } catch (error) {
            console.error('Error fetching TODOs:', error);
            return [];
        }
    }

    async fetchStats() {
        try {
            const response = await fetch(`${API_BASE}/todos/stats`);
            if (!response.ok) throw new Error('Failed to fetch stats');

            this.stats = await response.json();
            return this.stats;
        } catch (error) {
            console.error('Error fetching stats:', error);
            return null;
        }
    }

    groupByDocument() {
        const grouped = {};
        for (const todo of this.todos) {
            const docId = todo.document_id;
            if (!grouped[docId]) {
                grouped[docId] = {
                    document_id: docId,
                    document_title: todo.document_title,
                    filename: todo.filename,
                    todos: []
                };
            }
            grouped[docId].todos.push(todo);
        }
        return Object.values(grouped);
    }
}

export class TodoModal {
    constructor(options = {}) {
        this.options = {
            onNavigate: () => {},
            ...options
        };
        this.manager = new TodoManager();
        this.modal = null;
        this.includeDone = false;

        this.createModal();
    }

    createModal() {
        // Create modal element
        this.modal = document.createElement('div');
        this.modal.className = 'modal todo-modal';
        this.modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Master TODO List</h2>
                    <div class="modal-header-actions">
                        <label class="checkbox-label">
                            <input type="checkbox" id="todo-include-done">
                            Show completed
                        </label>
                        <button class="btn-icon modal-close" title="Close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="todo-stats"></div>
                    <div class="todo-list"></div>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        // Bind events
        this.modal.querySelector('.modal-backdrop').addEventListener('click', () => this.hide());
        this.modal.querySelector('.modal-close').addEventListener('click', () => this.hide());
        this.modal.querySelector('#todo-include-done').addEventListener('change', (e) => {
            this.includeDone = e.target.checked;
            this.refresh();
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('open')) {
                this.hide();
            }
        });

        // Event delegation for todo items
        this.modal.querySelector('.todo-list').addEventListener('click', (e) => {
            const item = e.target.closest('.todo-item');
            if (item) {
                const docId = item.dataset.docId;
                const lineNumber = parseInt(item.dataset.line, 10);
                this.hide();
                this.options.onNavigate(docId, lineNumber);
            }
        });
    }

    async show() {
        this.modal.classList.add('open');
        await this.refresh();
    }

    hide() {
        this.modal.classList.remove('open');
    }

    async refresh() {
        const statsEl = this.modal.querySelector('.todo-stats');
        const listEl = this.modal.querySelector('.todo-list');

        // Show loading
        listEl.innerHTML = '<div class="todo-loading">Loading...</div>';

        // Fetch data
        const [todos, stats] = await Promise.all([
            this.manager.fetchTodos(this.includeDone),
            this.manager.fetchStats()
        ]);

        // Render stats
        if (stats) {
            statsEl.innerHTML = `
                <div class="stat-item">
                    <span class="stat-value">${stats.open_todos}</span>
                    <span class="stat-label">Open</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${stats.completed_todos}</span>
                    <span class="stat-label">Done</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${stats.documents}</span>
                    <span class="stat-label">Documents</span>
                </div>
            `;
        }

        // Render todos
        if (todos.length === 0) {
            listEl.innerHTML = `
                <div class="todo-empty">
                    <p>No TODOs found</p>
                    <p class="text-muted">Add TODO or TASK markers in your documents</p>
                </div>
            `;
            return;
        }

        // Group by document
        const grouped = this.manager.groupByDocument();

        listEl.innerHTML = grouped.map(group => `
            <div class="todo-group">
                <div class="todo-group-header">
                    <span class="todo-group-title">${this.escapeHtml(group.document_title)}</span>
                    <span class="todo-group-count">${group.todos.length}</span>
                </div>
                <div class="todo-group-items">
                    ${group.todos.map(todo => `
                        <div class="todo-item ${todo.is_done ? 'done' : ''}"
                             data-doc-id="${todo.document_id}"
                             data-line="${todo.line_number}">
                            <span class="todo-checkbox">${todo.is_done ? '&#10003;' : ''}</span>
                            <span class="todo-text">${this.escapeHtml(todo.text)}</span>
                            <span class="todo-line">L${todo.line_number}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
