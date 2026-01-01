"""
Braindump Indexer

SQLite-based index for fast queries, TODO extraction, and semantic search.
The index is derived from the git repository and can be rebuilt at any time.
"""

import sqlite3
import json
import re
from pathlib import Path
from datetime import datetime
from typing import Optional


class Indexer:
    """Manages the SQLite index for documents and TODOs."""

    # Patterns for TODO detection
    TODO_PATTERN = re.compile(
        r'^(.*?)\b(TODO|TASK)\b[:\s]*(.*)$',
        re.IGNORECASE
    )
    DONE_PATTERN = re.compile(r'\bDONE\b', re.IGNORECASE)
    QUESTION_PATTERN = re.compile(r'\[QUESTION:\s*([^\]]+)\]', re.IGNORECASE)

    def __init__(self, db_path: Path, repo_path: Path, embedding_manager=None):
        self.db_path = Path(db_path)
        self.repo_path = Path(repo_path)
        self.embedding_manager = embedding_manager
        self.conn = None
        self._init_db()

    def _init_db(self):
        """Initialize the database schema."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row

        self.conn.executescript('''
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                title TEXT,
                content_hash TEXT,
                created_at REAL,
                modified_at REAL,
                indexed_at REAL
            );

            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id TEXT NOT NULL,
                line_number INTEGER NOT NULL,
                todo_type TEXT NOT NULL,
                text TEXT NOT NULL,
                is_done INTEGER DEFAULT 0,
                created_at REAL,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
                UNIQUE(document_id, line_number)
            );

            CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id TEXT NOT NULL,
                line_number INTEGER NOT NULL,
                text TEXT NOT NULL,
                is_resolved INTEGER DEFAULT 0,
                created_at REAL,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS embeddings (
                document_id TEXT PRIMARY KEY,
                content_hash TEXT NOT NULL,
                embedding TEXT NOT NULL,
                created_at REAL,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_todos_document ON todos(document_id);
            CREATE INDEX IF NOT EXISTS idx_todos_done ON todos(is_done);
            CREATE INDEX IF NOT EXISTS idx_questions_document ON questions(document_id);
            CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON embeddings(content_hash);
        ''')
        self.conn.commit()

    def set_embedding_manager(self, embedding_manager):
        """Set the embedding manager after initialization."""
        self.embedding_manager = embedding_manager

    def index_document(self, doc_id: str, filename: str, content: str,
                       created_at: float, modified_at: float,
                       generate_embedding: bool = True) -> dict:
        """Index a single document, extracting TODOs and questions."""
        import hashlib
        content_hash = hashlib.md5(content.encode()).hexdigest()

        # Check if content has changed
        existing = self.conn.execute(
            'SELECT content_hash FROM documents WHERE id = ?', (doc_id,)
        ).fetchone()

        if existing and existing['content_hash'] == content_hash:
            # Content unchanged, skip re-indexing
            return {'status': 'unchanged', 'doc_id': doc_id}

        # Extract title from first line
        lines = content.split('\n')
        title = lines[0].lstrip('#').strip() if lines else filename

        # Update or insert document
        now = datetime.now().timestamp()
        self.conn.execute('''
            INSERT INTO documents (id, filename, title, content_hash, created_at, modified_at, indexed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                filename = excluded.filename,
                title = excluded.title,
                content_hash = excluded.content_hash,
                modified_at = excluded.modified_at,
                indexed_at = excluded.indexed_at
        ''', (doc_id, filename, title, content_hash, created_at, modified_at, now))

        # Clear existing TODOs and questions for this document
        self.conn.execute('DELETE FROM todos WHERE document_id = ?', (doc_id,))
        self.conn.execute('DELETE FROM questions WHERE document_id = ?', (doc_id,))

        # Extract TODOs
        todos_found = 0
        for line_num, line in enumerate(lines, start=1):
            todo_match = self.TODO_PATTERN.search(line)
            if todo_match:
                is_done = 1 if self.DONE_PATTERN.search(line) else 0
                prefix = todo_match.group(1).strip()
                todo_type = todo_match.group(2).upper()
                todo_text = todo_match.group(3).strip()

                # Combine prefix context if meaningful
                full_text = todo_text if not prefix or prefix in ['-', '*', '•'] else f"{prefix}: {todo_text}"
                if not full_text:
                    full_text = line.strip()

                self.conn.execute('''
                    INSERT INTO todos (document_id, line_number, todo_type, text, is_done, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (doc_id, line_num, todo_type, full_text, is_done, now))
                todos_found += 1

            # Extract questions
            for q_match in self.QUESTION_PATTERN.finditer(line):
                self.conn.execute('''
                    INSERT INTO questions (document_id, line_number, text, created_at)
                    VALUES (?, ?, ?, ?)
                ''', (doc_id, line_num, q_match.group(1).strip(), now))

        self.conn.commit()

        # Generate embedding if manager is available
        embedding_generated = False
        if generate_embedding and self.embedding_manager and content.strip():
            embedding_generated = self._update_embedding(doc_id, content, content_hash)

        return {
            'status': 'indexed',
            'doc_id': doc_id,
            'todos_found': todos_found,
            'embedding_generated': embedding_generated
        }

    def _update_embedding(self, doc_id: str, content: str, content_hash: str) -> bool:
        """Generate and store embedding for a document."""
        # Check if we already have an embedding for this content hash
        existing = self.conn.execute(
            'SELECT content_hash FROM embeddings WHERE document_id = ?', (doc_id,)
        ).fetchone()

        if existing and existing['content_hash'] == content_hash:
            return False  # Embedding already exists for this content

        try:
            embedding = self.embedding_manager.get_embedding(content)
            now = datetime.now().timestamp()

            self.conn.execute('''
                INSERT INTO embeddings (document_id, content_hash, embedding, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(document_id) DO UPDATE SET
                    content_hash = excluded.content_hash,
                    embedding = excluded.embedding,
                    created_at = excluded.created_at
            ''', (doc_id, content_hash, json.dumps(embedding), now))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Error generating embedding for {doc_id}: {e}")
            return False

    def remove_document(self, doc_id: str):
        """Remove a document and its TODOs from the index."""
        self.conn.execute('DELETE FROM documents WHERE id = ?', (doc_id,))
        self.conn.execute('DELETE FROM embeddings WHERE document_id = ?', (doc_id,))
        # TODOs and questions are cascade deleted
        self.conn.commit()

    def get_all_todos(self, include_done: bool = False) -> list:
        """Get all TODOs across all documents."""
        query = '''
            SELECT t.*, d.title as document_title, d.filename
            FROM todos t
            JOIN documents d ON t.document_id = d.id
        '''
        if not include_done:
            query += ' WHERE t.is_done = 0'
        query += ' ORDER BY t.created_at DESC'

        rows = self.conn.execute(query).fetchall()
        return [dict(row) for row in rows]

    def get_todos_for_document(self, doc_id: str) -> list:
        """Get TODOs for a specific document."""
        rows = self.conn.execute('''
            SELECT * FROM todos WHERE document_id = ? ORDER BY line_number
        ''', (doc_id,)).fetchall()
        return [dict(row) for row in rows]

    def get_all_questions(self, include_resolved: bool = False) -> list:
        """Get all unresolved questions."""
        query = '''
            SELECT q.*, d.title as document_title, d.filename
            FROM questions q
            JOIN documents d ON q.document_id = d.id
        '''
        if not include_resolved:
            query += ' WHERE q.is_resolved = 0'
        query += ' ORDER BY q.created_at DESC'

        rows = self.conn.execute(query).fetchall()
        return [dict(row) for row in rows]

    def get_document_stats(self) -> dict:
        """Get statistics about indexed documents."""
        doc_count = self.conn.execute('SELECT COUNT(*) FROM documents').fetchone()[0]
        todo_count = self.conn.execute('SELECT COUNT(*) FROM todos WHERE is_done = 0').fetchone()[0]
        done_count = self.conn.execute('SELECT COUNT(*) FROM todos WHERE is_done = 1').fetchone()[0]
        question_count = self.conn.execute('SELECT COUNT(*) FROM questions WHERE is_resolved = 0').fetchone()[0]
        embedding_count = self.conn.execute('SELECT COUNT(*) FROM embeddings').fetchone()[0]

        return {
            'documents': doc_count,
            'open_todos': todo_count,
            'completed_todos': done_count,
            'open_questions': question_count,
            'embeddings': embedding_count,
        }

    def get_all_embeddings(self) -> list[tuple[str, list[float]]]:
        """Get all embeddings for search."""
        rows = self.conn.execute('''
            SELECT document_id, embedding FROM embeddings
        ''').fetchall()
        return [(row['document_id'], json.loads(row['embedding'])) for row in rows]

    def semantic_search(self, query: str, limit: int = 10) -> list:
        """Perform semantic search using embeddings."""
        if not self.embedding_manager:
            return []

        embeddings = self.get_all_embeddings()
        if not embeddings:
            return []

        # Get search results
        results = self.embedding_manager.search(query, embeddings, top_k=limit)

        # Fetch document details for results
        search_results = []
        for doc_id, score in results:
            doc = self.conn.execute('''
                SELECT id, filename, title, modified_at FROM documents WHERE id = ?
            ''', (doc_id,)).fetchone()
            if doc:
                result = dict(doc)
                result['score'] = score
                # Get a snippet of content
                filepath = self.repo_path / f"{doc_id}.md"
                if filepath.exists():
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # Get first 200 chars as snippet
                        result['snippet'] = content[:200].replace('\n', ' ').strip()
                        if len(content) > 200:
                            result['snippet'] += '...'
                search_results.append(result)

        return search_results

    def rebuild_index(self, generate_embeddings: bool = True) -> dict:
        """Rebuild the entire index from the repository."""
        if not self.repo_path.exists():
            return {'status': 'error', 'message': 'Repository path does not exist'}

        # Clear all data
        self.conn.execute('DELETE FROM todos')
        self.conn.execute('DELETE FROM questions')
        self.conn.execute('DELETE FROM embeddings')
        self.conn.execute('DELETE FROM documents')
        self.conn.commit()

        indexed = 0
        total_todos = 0
        embeddings_generated = 0

        for md_file in self.repo_path.glob('*.md'):
            stat = md_file.stat()
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()

            result = self.index_document(
                doc_id=md_file.stem,
                filename=md_file.name,
                content=content,
                created_at=stat.st_ctime,
                modified_at=stat.st_mtime,
                generate_embedding=generate_embeddings
            )
            indexed += 1
            total_todos += result.get('todos_found', 0)
            if result.get('embedding_generated'):
                embeddings_generated += 1

        return {
            'status': 'success',
            'documents_indexed': indexed,
            'todos_found': total_todos,
            'embeddings_generated': embeddings_generated,
        }

    def search_documents(self, query: str, limit: int = 20) -> list:
        """Search documents - uses semantic search if available, falls back to text search."""
        # Try semantic search first
        if self.embedding_manager:
            results = self.semantic_search(query, limit)
            if results:
                return results

        # Fallback to simple text search
        rows = self.conn.execute('''
            SELECT id, filename, title, modified_at
            FROM documents
            WHERE title LIKE ? OR filename LIKE ?
            ORDER BY modified_at DESC
            LIMIT ?
        ''', (f'%{query}%', f'%{query}%', limit)).fetchall()

        return [dict(row) for row in rows]

    def close(self):
        """Close the database connection."""
        if self.conn:
            self.conn.close()
