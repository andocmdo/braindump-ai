# Claude Code Kickoff Prompt: Braindump

Use this prompt to initialize development with Claude Code.

---

## Initial Prompt

```
I'm starting a new project called "Braindump" - a personal knowledge base system with AI-powered consolidation. I have a complete specification document that I'll share with you.

**Project Overview:**
Braindump is a low-friction capture system where I can quickly write notes (like opening a Notepad++ tab), and an AI background process cleans, consolidates, and organizes them. It also tracks TODO items inline in documents.

**Core Architecture:**
- Git repository as canonical store (all notes are markdown files)
- SQLite index for fast queries and semantic search
- Web app frontend (PWA-capable)
- REST API backend
- Manual consolidation trigger (AI proposes changes, shown as git diff)

**Key Features:**
1. Zero-friction capture: New fragment instantly, auto-save, no formatting required
2. TODO tracking: `TODO` or `TASK` markers inline, `DONE` to complete
3. Master TODO list: Aggregated view across all documents (read-through, click to source)
4. Consolidation: Manual trigger, AI structures messy notes, git diff for review/approval
5. Semantic search: Query all content via embeddings
6. Morning summary: Yesterday's activity, open TODOs, suggested next action
7. Multi-device: Polling sync (~15s), last-write-wins with warning

**Tech Decisions:**
- Backend: Node.js or Python (your recommendation welcome, although leaning towards very simple/basic Python setup, prioritizing simplicity and readability, rather than performance or abstraction and complex code architecture)
- Git operations: simple-git (Node) or gitpython (Python)
- Embeddings: Configurable via config.json (local model or API)
- LLM: Configurable (Claude API for consolidation)
- Frontend: Lightweight - vanilla JS (or Preact/Svelte or similar if needed to achieve the technical requirements of the user interface)
- Diff viewer: Use existing library (if possible and expedient).

**File Structure:**
- Flat file naming (title of note + UUID or simple timestamp) in git repo
- Standard note structure post-consolidation:
  - # Title
  - ## Summary
  - ## Details
  - ## Open Questions
  - ## TODOs

**What I need first:**
1. Project scaffolding with recommended structure
2. Configuration file setup (config.json)
3. Git repository initialization logic
4. Basic REST API skeleton
5. Simple frontend with:
   - Left panel: recent documents list
   - Main panel: markdown editor with auto-save
   - Top bar: New, Search, Consolidate buttons

**Reference:**
I have a previous attempt at: https://github.com/andocmdo/focus-notes
Some UI patterns from there may be useful. Specifically the auto save feature, the clean and simple 
tabs of documents and the text editing area. 

Please start by:
1. Recommending the tech stack (Node vs Python for backend, frontend framework choice)
2. Proposing a project directory structure
3. Creating the initial scaffolding

You can always reference the braindump-spec.md in the current root folder of this project which contains all the above information (and sometimes more specific details).

I'll be hosting this on my VPS. Let's build incrementally - get the basic capture and display working first, then add features.

Please think deeply about implmenting this and then we will get started.
```

---

## Follow-up Prompts

### After Initial Scaffolding

```
Great. Now let's implement the core capture flow:

1. "New Fragment" button creates a new markdown file with timestamp-based name
2. Auto-save: debounced save on every keystroke (500ms delay)
3. Git commit on save (or batched commits)
4. Recent documents list updates to show new/modified files
5. Click document in list to open in editor

Keep it simple - no consolidation or search yet. Just capture and retrieve.
```

### Adding the Index

```
Now let's add the SQLite index:

1. On file save, update index with:
   - File path
   - Title (first line or filename)
   - Last modified timestamp
   - Extracted TODO lines with line numbers
2. Index rebuild command that scans all files
3. Update recent documents list to query from index instead of filesystem
```

### Adding TODO Tracking

```
Let's add TODO extraction and the master list:

1. When indexing, find all lines containing TODO or TASK (not followed by DONE)
2. Store: file path, line number, todo text, timestamp
3. Create Master TODO view:
   - List all open TODOs
   - Each item shows: text, source file (clickable), timestamp
   - Click jumps to source file at that line
```

### Adding Semantic Search

```
Now let's add semantic search:

1. Set up embedding generation (use config.json for provider selection)
2. On index rebuild, generate embedding for each document
3. Cache embeddings by content hash (skip regeneration if unchanged)
4. Add search endpoint: query embedding -> cosine similarity -> top N results
5. Frontend: search box that shows results panel
6. Click result to open document
```

### Adding Consolidation

```
Now the big feature - consolidation:

1. "Consolidate" button on current document
2. Backend:
   - Create git branch
   - Send document content to LLM with consolidation prompt
   - Write proposed content to branch
   - Return diff between main and branch
3. Frontend:
   - Show diff view (use diff2html or similar library)
   - Accept/Edit/Reject buttons
4. On accept: merge branch, rebuild index
5. On reject: delete branch

Consolidation prompt should:
- Clean up formatting
- Remove redundancy
- Structure into: Summary, Details, Open Questions, TODOs
- Insert [QUESTION: ...] for ambiguities
```

### Adding Morning Summary

```
Let's add the morning summary view:

1. Query git log for files modified in last 24 hours
2. Query index for TODOs marked DONE recently
3. Query index for open TODOs sorted by age
4. Query for unresolved [QUESTION: ...] blocks
5. Display as landing page:
   - Yesterday's activity
   - Open TODOs
   - Open questions
6. Optionally: send to LLM for natural language summary
```

---

## Key Reminders for Development

- **Git is truth**: All notes live as markdown in git. Database is derived.
- **Auto-save always**: Never require manual save
- **Inline is authoritative**: TODOs live in documents, master list is a view
- **Manual triggers first**: Automate later after patterns are clear
- **Flat files**: No folders for v1, just timestamps/UUIDs
- **Config-driven**: Embedding provider, LLM provider in config.json
- **PWA-capable**: Service worker, manifest for mobile install

---

## Config Template

```json
{
  "storage": {
    "git_repo_path": "./data/notes",
    "sqlite_db_path": "./data/index.db"
  },
  "embeddings": {
    "provider": "local",
    "model": "all-MiniLM-L6-v2",
    "api_key": null
  },
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "api_key": "${ANTHROPIC_API_KEY}"
  },
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "sync": {
    "poll_interval_seconds": 15
  },
  "ui": {
    "default_view": "morning_summary",
    "autosave_delay_ms": 500
  }
}
```
