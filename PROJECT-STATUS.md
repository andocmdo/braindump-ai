# Braindump Project Status

## Completed

- [x] **Phase 1: Basic Capture** - Flask backend, git storage, document CRUD, auto-save editor, recent documents list
- [x] **Phase 2: Index & TODOs** - SQLite index, TODO/TASK extraction, DONE detection, Master TODO modal with click-to-source
- [x] **Phase 3: Semantic Search** - sentence-transformers embeddings, cosine similarity search, search dropdown UI with Cmd+K
- [x] **Phase 4: Consolidation** - LLM integration (OpenRouter/Anthropic), consolidation API, side-by-side diff view, accept/reject flow
- [x] **Phase 5: Recent Summary** - Activity queries, open TODOs, suggested next action, open questions, configurable recency interval, landing page view
- [x] **Phase 6: PWA Support** - Progressive Web App with manifest, service worker, installable on mobile devices
- [x] **Phase 7: Settings Page** - User-configurable settings UI with LLM config, prompts, and summary settings
- [x] **Phase 8: Authentication** - Password protection with session-based login, "remember me" functionality
- [x] **Phase 9: Delete & Archive** - Document deletion with confirmation, archive functionality with folder-based storage

## Remaining

- [ ] **Future: Multi-device Sync** - Polling for remote git changes, sync notifications
- [ ] **Future: UI Refinements** - Additional polish and mobile optimizations as needed
- [ ] **Future: Hybrid Search (BM25 + Semantic)** - Full SQLite FTS5 integration for best-of-both-worlds search

## Search Improvements (January 2026)

### Changes Made
- `server/embeddings.py` - Added `min_similarity` threshold (default 0.25) to filter low-quality semantic results
- `server/indexer.py` - Added exact match boosting: title matches (+0.15), content matches (+0.10), multiple occurrences (up to +0.15 extra)
- `server/indexer.py` - Fixed fallback text search to search actual document content (was only searching title/filename)
- `server/indexer.py` - Added `_text_search()` method with relevance scoring and contextual snippets

### How It Works
1. Semantic search runs first with a minimum similarity threshold (0.25)
2. Results are boosted based on exact term matches in title and content
3. Multiple occurrences of search terms further boost the score
4. If semantic search returns no results, fallback text search scans actual document content
5. Snippets now show context around the matching term

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

## Phase 6 Implementation Details

### PWA Support
App is now installable as a Progressive Web App on mobile devices (Android/iOS).

### New Files Created
- `web/manifest.json` - PWA manifest with app metadata and icons
- `web/service-worker.js` - Service worker for offline caching and PWA capabilities
- `web/icons/icon-192.png` - App icon (192x192)
- `web/icons/icon-512.png` - App icon (512x512)
- `generate_icons.py` - Utility script to generate PWA icons

### Files Modified
- `web/index.html` - Added PWA meta tags, manifest link, and service worker registration
- `pyproject.toml` - Added Pillow dependency for icon generation

### Features
- **Installable**: Can be installed on home screen (Android/iOS)
- **Offline Support**: Service worker caches app shell and API responses
- **App-like Experience**: Standalone display mode, custom theme colors
- **Icons**: Custom Braindump icons for home screen

### Installation
On mobile devices:
1. Open Braindump in browser (Chrome/Safari)
2. Tap browser menu → "Add to Home Screen" or "Install App"
3. App will be available as a standalone application

## Phase 7 Implementation Details

### Settings/Config Page
User-configurable settings interface for customizing the app.

### New Files Created
- `web/js/config.js` - ConfigView class for settings modal

### API Endpoints Added
- `GET /api/config` - Get current configuration (sanitized)
- `PATCH /api/config` - Update configuration settings
- `GET /api/config/prompts` - Get consolidation prompts
- `PATCH /api/config/prompts` - Update consolidation prompts

### Files Modified
- `server/app.py` - Added config API endpoints
- `web/index.html` - Added Settings button
- `web/js/app.js` - Integrated ConfigView
- `web/css/style.css` - Added config modal styles
- `config.example.json` - Added summary.recency_hours default

### Configurable Settings
- **LLM Configuration**:
  - Provider (OpenRouter, Anthropic)
  - Model selection
  - API key
  - Site name and URL
- **Summary Settings**:
  - Recency window (hours)
- **Sync Settings**:
  - Poll interval (seconds)
- **Consolidation Prompts**:
  - System prompt (AI instructions)
  - User prompt template

### Usage
Click "Settings" button in top bar to open configuration modal. Changes to config are saved to `config.json`. Prompt changes are runtime-only and reset on server restart.

## Phase 9 Implementation Details

### Delete & Archive Functionality
Document deletion with confirmation dialogs, and archive functionality using folder-based storage with SQLite metadata tracking.

### Files Modified
- `server/app.py` - Added archive/unarchive endpoints, archived documents list endpoint
- `server/indexer.py` - Added archived column to documents table, migration logic, archive-aware queries
- `server/git_ops.py` - Added move_to_archive and move_from_archive methods
- `web/index.html` - Added delete/archive buttons to editor header, confirmation dialog
- `web/css/style.css` - Added styles for delete/archive buttons, confirmation dialog, archived badge
- `web/js/app.js` - Added delete/archive handlers, confirmation dialog logic
- `web/js/documents.js` - Added archive/unarchive methods
- `web/js/search.js` - Added "include archived" checkbox

### API Endpoints Added
- `POST /api/documents/<id>/archive` - Move document to archive folder
- `POST /api/documents/<id>/unarchive` - Restore document from archive
- `GET /api/documents/archived` - List all archived documents
- `GET /api/search?include_archived=true` - Search with optional archived documents

### Features
- **Delete**: Removes document from git repo with confirmation dialog
- **Archive**: Moves document to `archive/` folder in git repo
- **Index Tracking**: SQLite tracks `archived` flag for each document
- **Filtered Lists**: TODOs, questions, and document stats exclude archived by default
- **Search Integration**: "Include archived" checkbox in search results
- **Visual Indicators**: Archived badge shown in search results

## Phase 8 Implementation Details

### Password Protection & Authentication
Simple session-based authentication with password protection.

### New Files Created
- `server/auth.py` - AuthManager class with password hashing and session management
- `web/login.html` - Login/setup page
- `web/css/login.css` - Login page styles
- `web/js/login.js` - Login/setup page functionality
- `web/js/api.js` - API utility with authentication error handling

### API Endpoints Added
- `GET /api/auth/status` - Check authentication status and setup requirements
- `POST /api/auth/setup` - Set up initial password (one-time)
- `POST /api/auth/login` - Log in with password
- `POST /api/auth/logout` - Log out current session

### Files Modified
- `server/app.py` - Added session support, auth middleware, protected all API routes
- `web/js/app.js` - Added authentication check on app initialization
- `config.json` and `config.example.json` - Added auth configuration section

### Configuration
Authentication settings in `config.json`:
```json
{
  "auth": {
    "enabled": true,
    "password_hash": null,
    "session_secret": "<auto-generated>"
  }
}
```

### Features
- **Initial Setup**: First visit prompts to create password
- **Session-based Auth**: Uses Flask sessions with 30-day expiration
- **Remember Me**: Sessions persist across browser restarts
- **Route Protection**: All API routes require authentication (except auth routes)
- **Auto-redirect**: Unauthenticated users redirected to login page
- **Secure Password Storage**: Passwords hashed using PBKDF2-SHA256

### Usage
1. On first run, visit the app and create a password (minimum 4 characters)
2. Login with your password - session will be remembered for 30 days
3. To disable auth, set `"enabled": false` in config.json
4. To reset password, delete `password_hash` from config.json and restart server

## Browser Compatibility Notes

### Safari Flexbox Fix (January 2026)

**Issue:** Flex containers like `.editor-header-actions` and `.search-header-controls` displayed children stacked vertically in Safari, but correctly inline in Chrome.

**Cause:** Safari requires older webkit prefixes for reliable flexbox behavior.

**Solution:** Add webkit prefixes to flex containers. Example:

```css
.editor-header-actions {
    display: -webkit-box;
    display: -webkit-flex;
    display: flex;
    -webkit-box-orient: horizontal;
    -webkit-box-direction: normal;
    -webkit-flex-direction: row;
    flex-direction: row;
    -webkit-flex-wrap: nowrap;
    flex-wrap: nowrap;
    -webkit-box-align: center;
    -webkit-align-items: center;
    align-items: center;
    gap: 8px;
}
```

**Files Modified:**
- `web/css/style.css` - Added webkit prefixes to `.editor-header-actions` and `.search-header-controls`

**Key Takeaway:** When flexbox layouts break in Safari but work in Chrome, add `-webkit-box`, `-webkit-flex`, and related prefixes as fallbacks
