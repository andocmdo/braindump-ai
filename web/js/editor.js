/**
 * Braindump - Editor Module
 *
 * Manages the CodeMirror editor with auto-save functionality.
 */

export class Editor {
    constructor(elementId, options = {}) {
        this.textarea = document.getElementById(elementId);
        this.options = {
            autosaveDelay: 500,
            onSave: () => {},
            onTitleChange: () => {},
            ...options
        };

        this.cm = null;
        this.saveTimeout = null;
        this.dirty = false;
        this.lastSavedContent = '';

        this.init();
    }

    init() {
        // Initialize CodeMirror
        this.cm = CodeMirror.fromTextArea(this.textarea, {
            mode: 'markdown',
            theme: 'dracula',
            lineNumbers: true,
            lineWrapping: true,
            autofocus: false,
            tabSize: 2,
            indentWithTabs: false,
            extraKeys: {
                'Tab': (cm) => cm.execCommand('indentMore'),
                'Shift-Tab': (cm) => cm.execCommand('indentLess'),
            }
        });

        // Listen for changes
        this.cm.on('change', () => this.handleChange());
    }

    handleChange() {
        const content = this.cm.getValue();

        // Check if actually dirty
        if (content === this.lastSavedContent) {
            this.dirty = false;
            return;
        }

        this.dirty = true;

        // Extract title from first line
        const firstLine = content.split('\n')[0];
        const title = firstLine.replace(/^#+\s*/, '').trim();
        this.options.onTitleChange(title);

        // Debounced auto-save
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(() => {
            this.save();
        }, this.options.autosaveDelay);
    }

    async save() {
        if (!this.dirty) return;

        const content = this.cm.getValue();
        await this.options.onSave(content);

        this.lastSavedContent = content;
        this.dirty = false;
    }

    async forceSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        await this.save();
    }

    setContent(content) {
        this.cm.setValue(content);
        this.lastSavedContent = content;
        this.dirty = false;

        // Move cursor to end
        this.cm.setCursor(this.cm.lineCount(), 0);
    }

    getContent() {
        return this.cm.getValue();
    }

    isDirty() {
        return this.dirty;
    }

    focus() {
        this.cm.focus();
    }

    goToLine(lineNumber) {
        // CodeMirror uses 0-based line numbers
        const line = Math.max(0, lineNumber - 1);
        this.cm.setCursor(line, 0);
        this.cm.scrollIntoView({ line, ch: 0 }, 100);
    }

    clear() {
        this.setContent('');
    }
}
