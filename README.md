# Braindump

A lightweight, git-backed personal knowledge base with AI-powered consolidation. Capture thoughts quickly, search semantically, and let AI help organize your notes.

<!-- Screenshot placeholder - add screenshot here -->

## Features

- **Fast Capture**: Auto-saving markdown editor with instant document creation
- **Semantic Search**: Find notes by meaning, not just keywords (powered by sentence-transformers)
- **AI Consolidation, Organization, and Summary**: Merge related notes intelligently using LLM (OpenRouter/Anthropic)
- **TODO Tracking**: Automatic extraction and aggregation of TODOs across all documents
- **Git-Backed**: Every change versioned in git with smart commit debouncing
- **PWA Ready**: Install on mobile devices, works offline
- **Private**: Password-protected with session-based authentication
- **Zero Lock-In**: Plain markdown files in a git repository

## Tech Stack

- **Backend**: Python/Flask, SQLite, sentence-transformers
- **Frontend**: Vanilla JS, CodeMirror, CSS
- **Storage**: Git (canonical), SQLite (search index)
- **Package Manager**: uv

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/braindump.git
cd braindump

# Install dependencies
uv sync

# Run the server
uv run braindump
```

Visit `http://localhost:3000` and create your password on first launch.

## Configuration

Create a `config.json` or set environment variables:

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "llm": {
    "provider": "openrouter",
    "model": "anthropic/claude-3.5-sonnet",
    "api_key": "your-api-key"
  },
  "git": {
    "commit_debounce_minutes": 5
  }
}
```

Or use environment variables:
```bash
BRAINDUMP_PORT=8080 BRAINDUMP_HOST=127.0.0.1 uv run braindump
```

See `config.example.json` for all options.

## Usage

- **Dashboard**: Provides a full overview of recent activity, suggests next TODO tasks, displays open questions.
- **New Document**: Click "New Document" or navigate to `/`
- **View TODOs**: Click the TODO counter badge
- **Process**: Use the "Process" button to organize and summarize a messy note
- **Archive**: Move old documents to the archive folder

All changes are automatically committed to git with smart batching to keep history clean.

## License

MIT
