# Braindump: Personal Knowledge Base System

## Specification Document v1.0

---

## Executive Summary

Braindump is a low-friction personal knowledge capture system with intelligent background consolidation. The core philosophy is that the moment of capture and the moment of organization are fundamentally different cognitive modes—forcing them together creates friction that kills the habit.

The system has three functional layers:

1. **Capture** — instant, unstructured, zero ceremony
2. **Consolidation** — AI-driven process that cleans, merges, and organizes
3. **Retrieval & Guidance** — semantic search plus proactive task intelligence

---

## Design Principles

### Zero Friction Capture
The system must feel as fast as opening a new Notepad++ tab. No formatting required. No decisions about where to file. Just start typing.

### Recency as Primary Navigation
No folders. No tags as the primary interface. A stack of recently-touched documents with AI handling connections to historical context. The "filing" problem disappears for the user.

### The AI is a Librarian, Not a Secretary
The AI notices patterns, suggests consolidations, and maintains coherence across time. The human approves; the AI proposes.

### Context-Aware Task Intelligence
"What's next?" isn't just a sorted to-do list. It's aware of what you were *just* doing, what's open, and what would be efficient to continue vs. switch away from.

### Asynchronous Processing
The system works in the background. You return to a tidied state, not a backlog of organizational debt.

---

## Entities

| Entity | Description |
|--------|-------------|
| **Fragment** | Raw, timestamped text capture. The atomic unit. Lives as a markdown file. |
| **Note** | Consolidated reference document. Has standard structure after processing. Also a markdown file. |
| **Task** | A `TODO` or `TASK` marker inline in any document. Not a separate record—identified by semantic marker in text. |
| **Project** | A note that serves as a container/hub for related work. May have its own inline TODOs. |

---

## Storage Architecture

### Canonical Store: Git Repository

All content lives as markdown files in a git repository.

- **Location:** Server-side git repo
- **File format:** Markdown (.md)
- **File naming:** Flat structure with names taken from the title of the note, but with UUID or timestamp appended to ensure conflict free saving of possibly similarly named notes
- **History:** Full git history provides unlimited undo
- **Diffs:** Git diff for reviewing proposed changes

### Index: SQLite Database

A derived index for fast querying, rebuildable from the git repo at any time.

**Index contains:**
- File paths and metadata (created, last modified)
- Extracted TODO/TASK items with:
  - Source file path
  - Line number
  - Extracted text
  - Inferred project association
  - Timestamp (from git history)
- Embeddings for semantic search (cached by content hash)
- Unresolved `[QUESTION: ...]` blocks

---

## Core Behaviors

### Capture

- Create new fragment instantly via button or `Cmd+N`
- Auto-save continuously (no manual save required)
- No formatting or organization required
- System assigns timestamp-based identifier

### Task Marking

- Write `TODO` or `TASK` inline anywhere in a document
- AI infers project context from surrounding content
- If context is ambiguous, AI inserts `[QUESTION: Which project does this relate to?]`
- Tasks should follow SMART principles (Specific, Measurable, Actionable, Relevant, Time-bound)
- AI helps enforce SMART criteria during consolidation

### Task Completion

- Write `DONE` next to the item
- Inline is authoritative—the master list reflects this automatically
- Zombie tasks (old, unmarked) are surfaced in morning summary

### Master TODO List

- A live view/query across all documents
- Read-through interface: click to jump to source document at the relevant line
- No direct editing in the master list
- Sorted by recency (default), can group by project
- Shows: TODO text, source document, inferred project, timestamp

### Consolidation

**Trigger:** Manual button click (automated triggers can be added later)

**Process:**
1. User clicks "Consolidate" on a document (or selects multiple fragments)
2. AI processes content:
   - Cleans up formatting
   - Removes redundant information
   - Identifies contradictions or unclear statements → inserts `[QUESTION: ...]` blocks
   - Structures into standard format
   - Merges semantically similar content
3. System creates a git branch with proposed changes
4. User sees diff view (side-by-side preferred)
5. User can:
   - **Accept** → merge to main, rebuild index
   - **Edit** → modify proposal before accepting
   - **Reject** → discard branch, no changes
6. On accept, index rebuilds automatically

### Standard Note Structure (Post-Consolidation)

```markdown
# Title

## Summary
[AI-generated summary of the entire note]

## Details
[Organized content sections]

## Open Questions
[AI-generated or carried forward from [QUESTION: ...] blocks]

## TODOs
[Extracted from throughout, or manually listed]
```

### Clarifications

- AI inserts `[QUESTION: ...]` inline during consolidation
- Questions become part of the document until resolved
- User answers by editing the document
- Optional summary view aggregates all unresolved questions

### Semantic Search

- Query bar searches across all content using embeddings
- Results show: document title, snippet with match highlighted
- Clicking opens document scrolled to match

### Related Context ("Find Related")

- Manual button on any document
- Surfaces documents with high semantic similarity
- Option to "Merge into current" (concatenates for later consolidation)

### Morning Summary / "What's Next?"

Default landing page when app opens. Displays:

- **Yesterday's Activity:** Documents touched, TODOs completed
- **Open TODOs:** Listed with project context, sorted by age/priority
- **Suggested Next Action:** Based on recency, open items, TODO age
- **Open Questions:** Aggregated `[QUESTION: ...]` blocks awaiting input

---

## User Interface

### Primary View: The Stack

**Left Panel (narrow):** Recent documents list
- Vertical list of recently-touched documents, most recent at top
- Each item shows:
  - Title (or first line if untitled)
  - Timestamp
  - Type icon (fragment/note/project)
  - Visual indicator for unresolved questions
  - Visual indicator for open TODOs
- Click to open in main editor

**Main Panel (wide):** Editor
- Markdown editing, minimal chrome
- Auto-saves continuously
- Clean, distraction-free writing area

**Top Bar (minimal):**
- Search box (semantic search)
- "New" button (or `Cmd+N`)
- "Consolidate" button
- "Find Related" button
- "Master TODO" button
- Search shortcut: `Cmd+S`

### Master TODO View

- Focused list of all open TODOs
- Each item shows:
  - TODO text
  - Source document (clickable)
  - Inferred project
  - Timestamp
- Click to jump to source location
- Read-only view (edit at source)

### Consolidation Modal

1. Processing indicator while AI works
2. Diff view appears:
   - Side-by-side diff (preferred)
   - Green = additions, red = deletions
   - `[QUESTION: ...]` blocks highlighted
3. Actions:
   - Accept → commits changes
   - Edit → opens proposed version for manual tweaking
   - Reject → discards, no change

### Search Results Panel

- Appears on search
- Results show: title, snippet with highlighted match
- Click to open document at match location

### "Find Related" Panel

- Shows semantically similar documents
- Each result: title, brief summary, similarity indicator
- "Merge into current" option

### Morning Summary View

- Default landing page
- Yesterday's activity summary
- Open TODOs with context
- Suggested next action
- Aggregated open questions

---

## Background Processes

### Process 1: Index Rebuild

**Trigger:** On file save (debounced to a reasonable time period to prevent overload. This debounce interval should be configurable), or on-demand

**Steps:**
1. Scan git repo for all markdown files
2. For each file:
   - Extract metadata (title, timestamps from git log)
   - Extract TODO/TASK lines with line numbers
   - Generate or update embedding for semantic search
3. Update SQLite index

**Performance:** Cache embeddings by content hash. Only regenerate on content change.

### Process 2: Consolidation

**Trigger:** Manual (user clicks button)

**Input:** Single document or selected fragments

**Steps:**
1. Read current content
2. Send to AI with consolidation prompt
3. AI returns proposed structured content
4. Create git branch, write proposed content
5. Present diff to user
6. On accept: merge branch, rebuild index
7. On reject: delete branch

### Process 3: Related Document Finder

**Trigger:** Manual ("Find Related" button)

**Steps:**
1. Get embedding of current document
2. Query index for top N similar documents (cosine similarity)
3. Return results for display

### Process 4: Master TODO Aggregation

**Trigger:** On-demand or after index rebuild

**Steps:**
1. Query index for all TODO/TASK entries without DONE marker
2. For each, resolve: source file, line number, inferred project, timestamp
3. Sort by recency (default)
4. Return for display

### Process 5: Morning Summary Generation

**Trigger:** Manual or scheduled (daily)

**Steps:**
1. Query git log for files modified in last 24 hours
2. Query index for TODOs marked DONE in last 24 hours
3. Query index for open TODOs, sorted by age
4. Query index for unresolved `[QUESTION: ...]` blocks
5. Optionally: send to AI for natural-language summary
6. Return for display

---

## Multi-Device Sync

### Strategy: Polling with Last-Write-Wins

- Web app polls server every ~15 seconds for changes
- If server has newer version than local:
  - Display warning to user
  - Allow user to copy local changes before accepting server version
- Most recent write always takes precedence
- No real-time collaboration (single user assumed)
- Conflict scenario: User opens on laptop, writes, closes lid, adds more on phone
  - Phone version wins (most recent)
  - Warning shown if laptop had unsaved changes

---

## Technical Stack (Recommended)

### Frontend
- Web app (PWA-capable)
- Framework: Vanilla JS, or lightweight framework (Preact/Svelte)
- Markdown editor component
- Diff viewer library (for consolidation review)

### Backend
- Node.js or Python server
- Git operations via library (simple-git, gitpython)
- SQLite for index
- REST API for frontend communication

### AI/Embeddings
- Configurable via `config.json`
- Options: Local model (LEANN, sentence-transformers), or API (OpenAI, Anthropic)
- LLM for consolidation: Configurable (Claude API, local model)

### Hosting
- VPS deployment
- Git repo on server
- SQLite database on server

---

## Configuration

`config.json` structure:

```json
{
  "storage": {
    "git_repo_path": "/path/to/notes-repo",
    "sqlite_db_path": "/path/to/index.db"
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
  "sync": {
    "poll_interval_seconds": 15
  },
  "ui": {
    "default_view": "morning_summary"
  }
}
```

---

## Future Enhancements (Out of Scope for v1)

- Automated consolidation triggers (nightly, after N fragments)
- "Clippy" mode: proactive suggestions while writing
- External context integration (git commits, calendar)
- Check-in/reminder system (separate Pomodoro app with API access)
- Folder organization (AI-managed)
- Mobile-native apps
- Voice capture

---

## Reference: Previous Implementation

A previous attempt exists at: https://github.com/andocmdo/focus-notes

This repo contains:
- PWA setup patterns
- Icon assets
- JSON data file examples
- HTML templates

These may be useful for reference during implementation, particularly for UI patterns that worked well.

---

## Success Criteria

The system succeeds if:

1. **Capture latency < 2 seconds** from intent to typing
2. **Zero required formatting** at capture time
3. **All content searchable** via semantic search
4. **Morning summary useful** for daily planning
5. **Consolidation produces clean, readable notes** from messy fragments
6. **No lost data** due to sync issues (git history as safety net)
7. **Works on desktop and mobile** via PWA

---

*Document version: 1.0*
*Last updated: Based on design session conversations*
