# Braindump Project Status

## Completed

- [x] **Phase 1: Basic Capture** - Flask backend, git storage, document CRUD, auto-save editor, recent documents list
- [x] **Phase 2: Index & TODOs** - SQLite index, TODO/TASK extraction, DONE detection, Master TODO modal with click-to-source
- [x] **Phase 3: Semantic Search** - sentence-transformers embeddings, cosine similarity search, search dropdown UI with Cmd+K

## Remaining

- [ ] **Phase 4: Consolidation** - LLM integration (Claude API), git branching, diff view for review/approve/reject
- [ ] **Phase 5: Morning Summary** - Activity queries, open TODOs, suggested next action, landing page view
- [ ] **Phase 6: Polish** - PWA manifest/service worker, multi-device sync polling, UI refinements, [QUESTION:] aggregation

## Tech Stack

- **Backend:** Python/Flask, SQLite, gitpython, sentence-transformers
- **Frontend:** Vanilla JS, CodeMirror, CSS (dark theme)
- **Storage:** Git repo (canonical), SQLite (derived index)
