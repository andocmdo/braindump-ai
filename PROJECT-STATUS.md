# Braindump Project Status

## Completed

- [x] **Phase 1: Basic Capture** - Flask backend, git storage, document CRUD, auto-save editor, recent documents list
- [x] **Phase 2: Index & TODOs** - SQLite index, TODO/TASK extraction, DONE detection, Master TODO modal with click-to-source
- [x] **Phase 3: Semantic Search** - sentence-transformers embeddings, cosine similarity search, search dropdown UI with Cmd+K
- [x] **Phase 4: Consolidation** - LLM integration (OpenRouter/Anthropic), consolidation API, side-by-side diff view, accept/reject flow
- [x] **Phase 5: Recent Summary** - Activity queries, open TODOs, suggested next action, open questions, configurable recency interval, landing page view

## Remaining

- [ ] **Phase 6: Polish** - PWA manifest/service worker, multi-device sync polling, UI refinements

## Tech Stack

- **Backend:** Python/Flask, SQLite, gitpython, sentence-transformers, httpx
- **Frontend:** Vanilla JS, CodeMirror, CSS (dark theme)
- **Storage:** Git repo (canonical), SQLite (derived index)
- **LLM:** OpenRouter API (configurable, Anthropic support built-in)
- **Package Management:** uv (see `pyproject.toml`)

## Phase 4 Implementation Details

### New Files Created
- `server/llm.py` - LLM provider abstraction (OpenRouter, Anthropic)
- `server/consolidation.py` - Consolidation logic and prompts
- `web/js/consolidation.js` - Frontend consolidation modal and diff viewer

### API Endpoints Added
- `POST /api/consolidate` - Start consolidation for document(s)
- `GET /api/consolidate/proposals` - List active proposals
- `GET /api/consolidate/proposals/<branch>` - Get proposal details
- `POST /api/consolidate/proposals/<branch>/accept` - Accept changes
- `POST /api/consolidate/proposals/<branch>/reject` - Discard proposal

### Configuration
Update `config.json` with your OpenRouter API key:
```json
{
  "llm": {
    "provider": "openrouter",
    "model": "anthropic/claude-3.5-sonnet",
    "api_key": "${OPENROUTER_API_KEY}"
  }
}
```
Or set the environment variable: `export OPENROUTER_API_KEY=your_key_here`

## Phase 5 Implementation Details

### New Files Created
- `web/js/recent-summary.js` - RecentSummaryView class for landing page

### Files Modified
- `server/indexer.py` - Added `get_recent_completed_todos()` and `get_recent_documents()` methods
- `server/app.py` - Added `/api/recent-summary` endpoint
- `web/css/style.css` - Added Recent Summary styles
- `web/index.html` - Added summary container and "Summary" button
- `web/js/app.js` - Integrated RecentSummaryView

### API Endpoints Added
- `GET /api/recent-summary` - Get recent activity summary (respects configurable recency window)

### Configuration
Recency window is configurable in `config.json`:
```json
{
  "summary": {
    "recency_hours": 24
  }
}
```

### Features
- **Default Landing Page**: Recent Summary shown when app loads
- **Stats Overview**: Docs modified, tasks done, open tasks, questions
- **Suggested Next Action**: Oldest open TODO highlighted for priority
- **Open TODOs**: List of pending tasks sorted by age (oldest first)
- **Recent Activity**: Documents modified and tasks completed in recency window
- **Open Questions**: Aggregated [QUESTION:] blocks
- **Click to Navigate**: All items navigate to source document/line
