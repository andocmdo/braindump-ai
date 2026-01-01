/**
 * Braindump - Search Module
 *
 * Handles semantic search functionality.
 */

const API_BASE = '/api';

export class SearchManager {
    constructor(options = {}) {
        this.options = {
            onSelect: () => {},
            debounceMs: 300,
            ...options
        };

        this.searchInput = null;
        this.resultsPanel = null;
        this.searchTimeout = null;
        this.isSearching = false;

        this.init();
    }

    init() {
        this.searchInput = document.getElementById('search-input');
        this.createResultsPanel();
        this.bindEvents();
    }

    createResultsPanel() {
        this.resultsPanel = document.createElement('div');
        this.resultsPanel.className = 'search-results-panel';
        this.resultsPanel.innerHTML = `
            <div class="search-results-header">
                <span class="search-results-title">Search Results</span>
                <button class="btn-icon search-close" title="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="search-results-body">
                <div class="search-results-list"></div>
            </div>
        `;
        document.body.appendChild(this.resultsPanel);

        // Close button
        this.resultsPanel.querySelector('.search-close').addEventListener('click', () => {
            this.hideResults();
        });

        // Result clicks
        this.resultsPanel.querySelector('.search-results-list').addEventListener('click', (e) => {
            const item = e.target.closest('.search-result-item');
            if (item) {
                this.hideResults();
                this.searchInput.value = '';
                this.options.onSelect(item.dataset.id);
            }
        });
    }

    bindEvents() {
        // Search input
        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }

            if (!query) {
                this.hideResults();
                return;
            }

            this.searchTimeout = setTimeout(() => {
                this.performSearch(query);
            }, this.options.debounceMs);
        });

        // Focus/blur
        this.searchInput.addEventListener('focus', () => {
            if (this.searchInput.value.trim()) {
                this.showResults();
            }
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!this.resultsPanel.contains(e.target) &&
                !this.searchInput.contains(e.target)) {
                this.hideResults();
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideResults();
                this.searchInput.blur();
            }
        });

        // Keyboard navigation
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateResults(e.key === 'ArrowDown' ? 1 : -1);
            } else if (e.key === 'Enter') {
                const selected = this.resultsPanel.querySelector('.search-result-item.selected');
                if (selected) {
                    e.preventDefault();
                    this.hideResults();
                    this.searchInput.value = '';
                    this.options.onSelect(selected.dataset.id);
                }
            }
        });
    }

    async performSearch(query) {
        if (this.isSearching) return;

        this.isSearching = true;
        this.showLoading();

        try {
            const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&limit=10`);

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const results = await response.json();
            this.renderResults(results, query);
        } catch (error) {
            console.error('Search error:', error);
            this.renderError();
        } finally {
            this.isSearching = false;
        }
    }

    showLoading() {
        const list = this.resultsPanel.querySelector('.search-results-list');
        list.innerHTML = `
            <div class="search-loading">
                <span>Searching...</span>
            </div>
        `;
        this.showResults();
    }

    renderResults(results, query) {
        const list = this.resultsPanel.querySelector('.search-results-list');

        if (results.length === 0) {
            list.innerHTML = `
                <div class="search-empty">
                    <p>No results for "${this.escapeHtml(query)}"</p>
                </div>
            `;
            return;
        }

        list.innerHTML = results.map((result, index) => `
            <div class="search-result-item ${index === 0 ? 'selected' : ''}" data-id="${result.id}">
                <div class="search-result-title">${this.escapeHtml(result.title)}</div>
                ${result.snippet ? `<div class="search-result-snippet">${this.escapeHtml(result.snippet)}</div>` : ''}
                <div class="search-result-meta">
                    ${result.score ? `<span class="search-result-score">${Math.round(result.score * 100)}% match</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    renderError() {
        const list = this.resultsPanel.querySelector('.search-results-list');
        list.innerHTML = `
            <div class="search-error">
                <p>Search failed. Please try again.</p>
            </div>
        `;
    }

    navigateResults(direction) {
        const items = this.resultsPanel.querySelectorAll('.search-result-item');
        if (items.length === 0) return;

        const current = this.resultsPanel.querySelector('.search-result-item.selected');
        let nextIndex = 0;

        if (current) {
            current.classList.remove('selected');
            const currentIndex = Array.from(items).indexOf(current);
            nextIndex = currentIndex + direction;
            if (nextIndex < 0) nextIndex = items.length - 1;
            if (nextIndex >= items.length) nextIndex = 0;
        }

        items[nextIndex].classList.add('selected');
        items[nextIndex].scrollIntoView({ block: 'nearest' });
    }

    showResults() {
        this.resultsPanel.classList.add('open');
    }

    hideResults() {
        this.resultsPanel.classList.remove('open');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
