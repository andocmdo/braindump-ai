# Braindump Project Status

## Completed

- [x] **Phase 1: Basic Capture** - Flask backend, git storage, document CRUD, auto-save editor, recent documents list
- [x] **Phase 2: Index & TODOs** - SQLite index, TODO/TASK extraction, DONE detection, Master TODO modal with click-to-source
- [x] **Phase 3: Semantic Search** - sentence-transformers embeddings, cosine similarity search, search dropdown UI with Cmd+K
- [x] **Phase 4: Consolidation** - LLM integration (OpenRouter/Anthropic), consolidation API, side-by-side diff view, accept/reject flow

## Remaining

- [ ] **Phase 5: Morning Summary** - Activity queries, open TODOs, suggested next action, landing page view
- [ ] **Phase 6: Polish** - PWA manifest/service worker, multi-device sync polling, UI refinements, [QUESTION:] aggregation

## Tech Stack

- **Backend:** Python/Flask, SQLite, gitpython, sentence-transformers, httpx
- **Frontend:** Vanilla JS, CodeMirror, CSS (dark theme)
- **Storage:** Git repo (canonical), SQLite (derived index)
- **LLM:** OpenRouter API (configurable, Anthropic support built-in)

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
