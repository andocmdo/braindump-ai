"""
Braindump API Server

A simple Flask server providing REST API for the Braindump knowledge base.
"""

import json
import os
from pathlib import Path
from datetime import datetime
import uuid

from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv

from server.git_ops import GitOps
from server.indexer import Indexer
from server.embeddings import EmbeddingManager
from server.llm import LLMManager
from server.consolidation import ConsolidationManager

load_dotenv()

app = Flask(__name__, static_folder='../web', static_url_path='')

# Load configuration
CONFIG_PATH = Path(__file__).parent.parent / 'config.json'
CONFIG_EXAMPLE_PATH = Path(__file__).parent.parent / 'config.example.json'

def load_config():
    """Load config from config.json, falling back to example if not found."""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return json.load(f)
    elif CONFIG_EXAMPLE_PATH.exists():
        with open(CONFIG_EXAMPLE_PATH) as f:
            return json.load(f)
    else:
        raise FileNotFoundError("No config.json or config.example.json found")

config = load_config()

# Initialize paths
REPO_PATH = Path(config['storage']['git_repo_path'])
DB_PATH = Path(config['storage']['sqlite_db_path'])

# Ensure data directories exist
REPO_PATH.parent.mkdir(parents=True, exist_ok=True)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# Initialize git operations
git_ops = GitOps(REPO_PATH)

# Initialize embedding manager (lazy - only loads model when needed)
embedding_manager = None

def get_embedding_manager():
    """Get or initialize the embedding manager."""
    global embedding_manager
    if embedding_manager is None:
        print("Initializing embedding manager...")
        embedding_manager = EmbeddingManager(config.get('embeddings', {}))
    return embedding_manager


# Initialize LLM manager (lazy - only loads when consolidation is needed)
llm_manager = None
consolidation_manager = None

def get_llm_manager():
    """Get or initialize the LLM manager."""
    global llm_manager
    if llm_manager is None:
        print("Initializing LLM manager...")
        llm_manager = LLMManager(config.get('llm', {}))
    return llm_manager

def get_consolidation_manager():
    """Get or initialize the consolidation manager."""
    global consolidation_manager
    if consolidation_manager is None:
        consolidation_manager = ConsolidationManager(get_llm_manager(), git_ops)
    return consolidation_manager

# Initialize indexer (without embeddings initially for fast startup)
indexer = Indexer(DB_PATH, REPO_PATH)


# --- Static file serving ---

@app.route('/')
def serve_index():
    """Serve the main app."""
    return send_from_directory(app.static_folder, 'index.html')


# --- Document API ---

@app.route('/api/documents', methods=['GET'])
def list_documents():
    """List all documents, sorted by last modified (most recent first)."""
    documents = []

    if not REPO_PATH.exists():
        return jsonify([])

    for md_file in REPO_PATH.glob('*.md'):
        stat = md_file.stat()
        # Read first line for title
        with open(md_file, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
            # Remove markdown heading prefix if present
            title = first_line.lstrip('#').strip() or md_file.stem

        documents.append({
            'id': md_file.stem,
            'filename': md_file.name,
            'title': title,
            'modified': stat.st_mtime,
            'created': stat.st_ctime,
        })

    # Sort by modified time, newest first
    documents.sort(key=lambda d: d['modified'], reverse=True)
    return jsonify(documents)


@app.route('/api/documents', methods=['POST'])
def create_document():
    """Create a new document."""
    data = request.get_json() or {}
    content = data.get('content', '')

    # Generate filename with timestamp and short UUID
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    short_id = str(uuid.uuid4())[:8]
    filename = f"{timestamp}-{short_id}.md"

    filepath = REPO_PATH / filename

    # Write content
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    # Git commit
    git_ops.commit_file(filename, "Create new fragment")

    # Index the document (embedding generated on first search or rebuild)
    stat = filepath.stat()
    indexer.index_document(
        doc_id=filepath.stem,
        filename=filename,
        content=content,
        created_at=stat.st_ctime,
        modified_at=stat.st_mtime,
        generate_embedding=False  # Defer embedding generation
    )

    return jsonify({
        'id': filepath.stem,
        'filename': filename,
        'title': content.split('\n')[0].lstrip('#').strip() or filepath.stem,
        'modified': stat.st_mtime,
    }), 201


@app.route('/api/documents/<doc_id>', methods=['GET'])
def get_document(doc_id):
    """Get a single document by ID."""
    filepath = REPO_PATH / f"{doc_id}.md"

    if not filepath.exists():
        return jsonify({'error': 'Document not found'}), 404

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    stat = filepath.stat()
    first_line = content.split('\n')[0] if content else ''
    title = first_line.lstrip('#').strip() or doc_id

    # Get TODOs for this document
    todos = indexer.get_todos_for_document(doc_id)

    return jsonify({
        'id': doc_id,
        'filename': filepath.name,
        'title': title,
        'content': content,
        'modified': stat.st_mtime,
        'created': stat.st_ctime,
        'todos': todos,
    })


@app.route('/api/documents/<doc_id>', methods=['PUT'])
def update_document(doc_id):
    """Update a document's content."""
    filepath = REPO_PATH / f"{doc_id}.md"

    if not filepath.exists():
        return jsonify({'error': 'Document not found'}), 404

    data = request.get_json()
    if not data or 'content' not in data:
        return jsonify({'error': 'Content required'}), 400

    content = data['content']

    # Write content
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    # Git commit
    git_ops.commit_file(filepath.name, "Update fragment")

    # Re-index the document (embedding updated on next search or rebuild)
    stat = filepath.stat()
    indexer.index_document(
        doc_id=doc_id,
        filename=filepath.name,
        content=content,
        created_at=stat.st_ctime,
        modified_at=stat.st_mtime,
        generate_embedding=False  # Defer embedding generation
    )

    first_line = content.split('\n')[0] if content else ''
    title = first_line.lstrip('#').strip() or doc_id

    return jsonify({
        'id': doc_id,
        'filename': filepath.name,
        'title': title,
        'content': content,
        'modified': stat.st_mtime,
    })


@app.route('/api/documents/<doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    """Delete a document."""
    filepath = REPO_PATH / f"{doc_id}.md"

    if not filepath.exists():
        return jsonify({'error': 'Document not found'}), 404

    # Remove file and commit
    filepath.unlink()
    git_ops.commit_file(filepath.name, "Delete fragment", delete=True)

    # Remove from index
    indexer.remove_document(doc_id)

    return jsonify({'success': True})


# --- Search API ---

@app.route('/api/search', methods=['GET'])
def search_documents():
    """Search documents using semantic search."""
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'error': 'Query parameter q is required'}), 400

    limit = request.args.get('limit', 10, type=int)

    # Ensure embedding manager is initialized and connected to indexer
    em = get_embedding_manager()
    indexer.set_embedding_manager(em)

    # Check if we have embeddings, if not trigger generation
    stats = indexer.get_document_stats()
    if stats['embeddings'] < stats['documents']:
        # Generate missing embeddings
        print(f"Generating embeddings for {stats['documents'] - stats['embeddings']} documents...")
        indexer.rebuild_index(generate_embeddings=True)

    results = indexer.search_documents(query, limit=limit)
    return jsonify(results)


# --- TODO API ---

@app.route('/api/todos', methods=['GET'])
def list_todos():
    """List all TODOs across all documents."""
    include_done = request.args.get('include_done', 'false').lower() == 'true'
    todos = indexer.get_all_todos(include_done=include_done)
    return jsonify(todos)


@app.route('/api/todos/stats', methods=['GET'])
def todo_stats():
    """Get TODO statistics."""
    stats = indexer.get_document_stats()
    return jsonify(stats)


# --- Questions API ---

@app.route('/api/questions', methods=['GET'])
def list_questions():
    """List all unresolved questions."""
    include_resolved = request.args.get('include_resolved', 'false').lower() == 'true'
    questions = indexer.get_all_questions(include_resolved=include_resolved)
    return jsonify(questions)


# --- Recent Summary API ---

@app.route('/api/recent-summary', methods=['GET'])
def recent_summary():
    """Get a recent activity summary for the landing page."""
    # Get recency window from config
    recency_hours = config.get('summary', {}).get('recency_hours', 24)

    # Get recently modified documents
    recent_docs = indexer.get_recent_documents(hours=recency_hours)

    # Get recently completed TODOs
    completed_todos = indexer.get_recent_completed_todos(hours=recency_hours)

    # Get all open TODOs sorted by age (oldest first for priority)
    all_todos = indexer.get_all_todos(include_done=False)
    # Sort by created_at ascending (oldest first)
    all_todos.sort(key=lambda t: t.get('created_at', 0))

    # Get open questions
    questions = indexer.get_all_questions(include_resolved=False)

    # Compute suggested next action (oldest open TODO)
    suggested_next = None
    if all_todos:
        oldest_todo = all_todos[0]
        suggested_next = {
            'type': 'todo',
            'todo': oldest_todo,
            'reason': 'Oldest open task'
        }

    # Get stats
    stats = indexer.get_document_stats()

    return jsonify({
        'summary_date': datetime.now().isoformat(),
        'recency_hours': recency_hours,
        'recent_activity': {
            'documents_modified': recent_docs,
            'documents_count': len(recent_docs),
            'todos_completed': completed_todos,
            'todos_completed_count': len(completed_todos),
        },
        'open_todos': all_todos[:10],  # Limit to first 10 for display
        'open_todos_count': stats['open_todos'],
        'suggested_next': suggested_next,
        'open_questions': questions,
        'open_questions_count': stats['open_questions'],
        'stats': stats,
    })


# --- Index API ---

@app.route('/api/index/rebuild', methods=['POST'])
def rebuild_index():
    """Rebuild the entire index from the repository."""
    generate_embeddings = request.args.get('embeddings', 'true').lower() == 'true'

    if generate_embeddings:
        em = get_embedding_manager()
        indexer.set_embedding_manager(em)

    result = indexer.rebuild_index(generate_embeddings=generate_embeddings)
    return jsonify(result)


@app.route('/api/index/stats', methods=['GET'])
def index_stats():
    """Get index statistics."""
    stats = indexer.get_document_stats()
    return jsonify(stats)


# --- Consolidation API ---

@app.route('/api/consolidate', methods=['POST'])
def consolidate_document():
    """Start consolidation for one or more documents."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    # Support single document or multiple documents
    doc_ids = data.get('document_ids', [])
    doc_id = data.get('document_id')

    if doc_id:
        doc_ids = [doc_id]

    if not doc_ids:
        return jsonify({'error': 'document_id or document_ids required'}), 400

    # Read document contents
    documents = []
    for did in doc_ids:
        filepath = REPO_PATH / f"{did}.md"
        if not filepath.exists():
            return jsonify({'error': f'Document not found: {did}'}), 404
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        documents.append((did, content))

    try:
        cm = get_consolidation_manager()

        if len(documents) == 1:
            result = cm.consolidate(documents[0][0], documents[0][1])
        else:
            result = cm.consolidate_multiple(documents)

        diff = cm.generate_diff(result.original_content, result.consolidated_content)

        return jsonify({
            'branch_name': result.branch_name,
            'document_id': result.document_id,
            'created_at': result.created_at,
            'diff': diff,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/consolidate/proposals', methods=['GET'])
def list_proposals():
    """List all active consolidation proposals."""
    cm = get_consolidation_manager()
    proposals = cm.list_proposals()
    return jsonify(proposals)


@app.route('/api/consolidate/proposals/<branch_name>', methods=['GET'])
def get_proposal(branch_name):
    """Get a specific consolidation proposal."""
    cm = get_consolidation_manager()
    proposal = cm.get_proposal(branch_name)

    if not proposal:
        return jsonify({'error': 'Proposal not found'}), 404

    diff = cm.generate_diff(proposal.original_content, proposal.consolidated_content)

    return jsonify({
        'branch_name': proposal.branch_name,
        'document_id': proposal.document_id,
        'created_at': proposal.created_at,
        'diff': diff,
    })


@app.route('/api/consolidate/proposals/<branch_name>/accept', methods=['POST'])
def accept_proposal(branch_name):
    """Accept a consolidation proposal and apply the changes."""
    cm = get_consolidation_manager()
    proposal = cm.get_proposal(branch_name)

    if not proposal:
        return jsonify({'error': 'Proposal not found'}), 404

    # Write the consolidated content back to the document
    filepath = REPO_PATH / f"{proposal.document_id}.md"

    # For merged documents, we might need to create a new file
    if not filepath.exists():
        # Create new merged document with timestamp
        from datetime import datetime
        import uuid as uuid_module
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        short_id = str(uuid_module.uuid4())[:8]
        filename = f"{timestamp}-{short_id}.md"
        filepath = REPO_PATH / filename
        doc_id = filepath.stem
    else:
        doc_id = proposal.document_id

    # Write the consolidated content
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(proposal.consolidated_content)

    # Git commit
    git_ops.commit_file(filepath.name, f"Consolidate document: {doc_id}")

    # Re-index the document
    stat = filepath.stat()
    indexer.index_document(
        doc_id=doc_id,
        filename=filepath.name,
        content=proposal.consolidated_content,
        created_at=stat.st_ctime,
        modified_at=stat.st_mtime,
        generate_embedding=False
    )

    # Remove from active proposals
    cm.accept_proposal(branch_name)

    return jsonify({
        'success': True,
        'document_id': doc_id,
        'filename': filepath.name,
    })


@app.route('/api/consolidate/proposals/<branch_name>/reject', methods=['POST'])
def reject_proposal(branch_name):
    """Reject a consolidation proposal."""
    cm = get_consolidation_manager()

    if not cm.reject_proposal(branch_name):
        return jsonify({'error': 'Proposal not found'}), 404

    return jsonify({'success': True})


# --- Health check ---

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    stats = indexer.get_document_stats()
    return jsonify({
        'status': 'ok',
        'repo_initialized': git_ops.is_initialized(),
        'index_stats': stats,
    })


# --- Main ---

def main():
    """Entry point for the Braindump server."""
    # Initialize git repo if needed
    if not git_ops.is_initialized():
        git_ops.initialize()
        print(f"Initialized git repository at {REPO_PATH}")

    # Rebuild index on startup (without embeddings for fast startup)
    print("Rebuilding index...")
    result = indexer.rebuild_index(generate_embeddings=False)
    print(f"Index rebuilt: {result['documents_indexed']} documents, {result['todos_found']} TODOs")
    print("Note: Embeddings will be generated on first search")

    host = config['server'].get('host', '0.0.0.0')
    port = config['server'].get('port', 3000)
    debug = config['server'].get('debug', False)

    print(f"Starting Braindump server on http://{host}:{port}")
    app.run(host=host, port=port, debug=debug)


if __name__ == '__main__':
    main()
