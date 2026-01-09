# Braindump Project Status

## Completed Phases

- **Phase 1:** Basic Capture - Flask backend, git storage, document CRUD, auto-save editor
- **Phase 2:** Index & TODOs - SQLite index, TODO/TASK extraction, Master TODO modal
- **Phase 3:** Semantic Search - sentence-transformers embeddings, cosine similarity, Cmd+K search
- **Phase 4:** Consolidation - LLM integration (OpenRouter/Anthropic), diff view, accept/reject flow
- **Phase 5:** Recent Summary - Activity queries, open TODOs, suggested next action, landing page
- **Phase 6:** PWA Support - Installable on mobile, service worker, offline caching
- **Phase 7:** Settings Page - User-configurable LLM, prompts, and summary settings
- **Phase 8:** Authentication - Password protection with session-based login
- **Phase 9:** Delete & Archive - Document deletion, archive folder with SQLite tracking

## Remaining

- [ ] Multi-device Sync - Polling for remote git changes
- [ ] Hybrid Search (BM25 + Semantic) - Full SQLite FTS5 integration

## Tech Stack

- **Backend:** Python/Flask, SQLite, gitpython, sentence-transformers, httpx
- **Frontend:** Vanilla JS, CodeMirror, CSS (dark theme)
- **Storage:** Git repo (canonical), SQLite (derived index)
- **LLM:** OpenRouter API (Anthropic support built-in)
- **Package Management:** uv

## Configuration

### Server (Host/Port)

Three options, in order of precedence:

**1. Environment variables** (highest priority):
```bash
BRAINDUMP_PORT=8080 BRAINDUMP_HOST=127.0.0.1 uv run braindump
```

**2. .env file** (loaded by python-dotenv):
```
BRAINDUMP_PORT=8080
BRAINDUMP_HOST=127.0.0.1
BRAINDUMP_DEBUG=true
```

**3. config.json** (default):
```json
"server": {
  "port": 3000,
  "host": "0.0.0.0",
  "debug": false
}
```

### LLM

Set in `config.json` or via Settings page:
```json
"llm": {
  "provider": "openrouter",
  "model": "anthropic/claude-3.5-sonnet",
  "api_key": "your-key"
}
```

### Authentication

First visit prompts password creation. To reset: delete `password_hash` from config.json.

## Key API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET/POST /api/documents` | List/create documents |
| `GET/PUT/DELETE /api/documents/<id>` | Read/update/delete document |
| `POST /api/documents/<id>/archive` | Archive document |
| `GET /api/search?q=` | Semantic search |
| `GET /api/todos` | List all TODOs |
| `GET /api/recent-summary` | Landing page summary |
| `POST /api/consolidate` | Start LLM consolidation |
| `GET/PATCH /api/config` | Read/update settings |

## Notes

### Search (Jan 2026)
- Semantic search with 0.25 minimum similarity threshold
- Exact match boosting for title (+0.15) and content (+0.10)
- Fallback text search when semantic returns no results

### Safari Flexbox
Add webkit prefixes (`-webkit-box`, `-webkit-flex`) when flexbox breaks in Safari.
