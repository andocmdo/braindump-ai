/**
 * Braindump - Recent Summary Module
 *
 * Manages the Recent Summary landing page view.
 */

const API_BASE = '/api';

export class RecentSummaryView {
    constructor(options = {}) {
        this.options = {
            onNavigate: () => {},
            ...options
        };
        this.data = null;
        this.container = null;

        this.createView();
    }

    createView() {
        // Get the container from the DOM (added to index.html)
        this.container = document.getElementById('recent-summary-view');
        if (!this.container) {
            console.error('Recent summary container not found');
            return;
        }

        // Event delegation for clickable items
        this.container.addEventListener('click', (e) => {
            const todoItem = e.target.closest('.summary-todo-item');
            const docItem = e.target.closest('.summary-doc-item');
            const questionItem = e.target.closest('.summary-question-item');

            if (todoItem) {
                const docId = todoItem.dataset.docId;
                const lineNumber = parseInt(todoItem.dataset.line, 10);
                this.options.onNavigate(docId, lineNumber);
            } else if (docItem) {
                const docId = docItem.dataset.docId;
                this.options.onNavigate(docId);
            } else if (questionItem) {
                const docId = questionItem.dataset.docId;
                const lineNumber = parseInt(questionItem.dataset.line, 10);
                this.options.onNavigate(docId, lineNumber);
            }
        });
    }

    async show() {
        if (!this.container) return;

        this.container.classList.remove('hidden');
        await this.refresh();
    }

    hide() {
        if (!this.container) return;
        this.container.classList.add('hidden');
    }

    isVisible() {
        return this.container && !this.container.classList.contains('hidden');
    }

    async refresh() {
        if (!this.container) return;

        // Show loading state
        this.container.innerHTML = `
            <div class="summary-loading">
                <div class="spinner"></div>
                <p>Loading summary...</p>
            </div>
        `;

        try {
            const response = await fetch(`${API_BASE}/recent-summary`);
            if (!response.ok) throw new Error('Failed to fetch summary');

            this.data = await response.json();
            this.render();
        } catch (error) {
            console.error('Error fetching summary:', error);
            this.container.innerHTML = `
                <div class="summary-error">
                    <p>Failed to load summary</p>
                    <button class="btn" onclick="window.app.recentSummaryView.refresh()">Retry</button>
                </div>
            `;
        }
    }

    render() {
        if (!this.data || !this.container) return;

        const { recent_activity, open_todos, suggested_next, open_questions, stats, recency_hours } = this.data;

        this.container.innerHTML = `
            <div class="summary-content">
                <div class="summary-header">
                    <h2>Recent Summary</h2>
                    <span class="summary-period">Last ${recency_hours} hours</span>
                </div>

                <!-- Stats Overview -->
                <div class="summary-stats">
                    <div class="summary-stat">
                        <span class="summary-stat-value">${recent_activity.documents_count}</span>
                        <span class="summary-stat-label">Docs Modified</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-stat-value">${recent_activity.todos_completed_count}</span>
                        <span class="summary-stat-label">Tasks Done</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-stat-value">${stats.open_todos}</span>
                        <span class="summary-stat-label">Open Tasks</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-stat-value">${stats.open_questions}</span>
                        <span class="summary-stat-label">Questions</span>
                    </div>
                </div>

                <!-- Suggested Next Action -->
                ${this.renderSuggestedNext(suggested_next)}

                <!-- Open TODOs -->
                ${this.renderOpenTodos(open_todos, stats.open_todos)}

                <!-- Recent Activity -->
                ${this.renderRecentActivity(recent_activity)}

                <!-- Open Questions -->
                ${this.renderOpenQuestions(open_questions)}
            </div>
        `;
    }

    renderSuggestedNext(suggested) {
        if (!suggested) {
            return `
                <div class="summary-section">
                    <h3>Suggested Next</h3>
                    <div class="summary-empty">No pending tasks</div>
                </div>
            `;
        }

        const todo = suggested.todo;
        return `
            <div class="summary-section summary-suggested">
                <h3>Suggested Next</h3>
                <div class="summary-suggested-item summary-todo-item"
                     data-doc-id="${todo.document_id}"
                     data-line="${todo.line_number}">
                    <div class="suggested-content">
                        <span class="suggested-type">${todo.todo_type}</span>
                        <span class="suggested-text">${this.escapeHtml(todo.text)}</span>
                    </div>
                    <div class="suggested-meta">
                        <span class="suggested-doc">${this.escapeHtml(todo.document_title)}</span>
                        <span class="suggested-reason">${suggested.reason}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderOpenTodos(todos, totalCount) {
        if (!todos || todos.length === 0) {
            return `
                <div class="summary-section">
                    <h3>Open Tasks</h3>
                    <div class="summary-empty">No open tasks</div>
                </div>
            `;
        }

        const showingAll = todos.length >= totalCount;
        return `
            <div class="summary-section">
                <h3>Open Tasks ${!showingAll ? `<span class="summary-count">(showing ${todos.length} of ${totalCount})</span>` : ''}</h3>
                <div class="summary-todo-list">
                    ${todos.map(todo => `
                        <div class="summary-todo-item"
                             data-doc-id="${todo.document_id}"
                             data-line="${todo.line_number}">
                            <span class="todo-type-badge">${todo.todo_type}</span>
                            <span class="todo-text">${this.escapeHtml(todo.text)}</span>
                            <span class="todo-doc">${this.escapeHtml(todo.document_title)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderRecentActivity(activity) {
        const { documents_modified, todos_completed } = activity;

        if (documents_modified.length === 0 && todos_completed.length === 0) {
            return `
                <div class="summary-section">
                    <h3>Recent Activity</h3>
                    <div class="summary-empty">No recent activity</div>
                </div>
            `;
        }

        return `
            <div class="summary-section">
                <h3>Recent Activity</h3>

                ${documents_modified.length > 0 ? `
                    <div class="activity-subsection">
                        <h4>Documents Modified</h4>
                        <div class="summary-doc-list">
                            ${documents_modified.slice(0, 5).map(doc => `
                                <div class="summary-doc-item" data-doc-id="${doc.id}">
                                    <span class="doc-title">${this.escapeHtml(doc.title)}</span>
                                    <span class="doc-time">${this.formatTime(doc.modified_at)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${todos_completed.length > 0 ? `
                    <div class="activity-subsection">
                        <h4>Tasks Completed</h4>
                        <div class="summary-completed-list">
                            ${todos_completed.slice(0, 5).map(todo => `
                                <div class="summary-completed-item summary-todo-item"
                                     data-doc-id="${todo.document_id}"
                                     data-line="${todo.line_number}">
                                    <span class="completed-check">&#10003;</span>
                                    <span class="completed-text">${this.escapeHtml(todo.text)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderOpenQuestions(questions) {
        if (!questions || questions.length === 0) {
            return `
                <div class="summary-section">
                    <h3>Open Questions</h3>
                    <div class="summary-empty">No open questions</div>
                </div>
            `;
        }

        return `
            <div class="summary-section">
                <h3>Open Questions</h3>
                <div class="summary-question-list">
                    ${questions.map(q => `
                        <div class="summary-question-item"
                             data-doc-id="${q.document_id}"
                             data-line="${q.line_number}">
                            <span class="question-icon">?</span>
                            <span class="question-text">${this.escapeHtml(q.text)}</span>
                            <span class="question-doc">${this.escapeHtml(q.document_title)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return `${mins}m ago`;
        }
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        }
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
