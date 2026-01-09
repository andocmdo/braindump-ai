"""
Pending commits manager for debounced git commits.

Instead of committing on every save, this tracks files that need to be committed
and batches them together after a configurable delay.
"""

import time
from typing import Dict, Optional
from pathlib import Path


class PendingCommitManager:
    """Manages pending git commits with debouncing."""

    def __init__(self, debounce_minutes: int = 5):
        """
        Initialize the pending commit manager.

        Args:
            debounce_minutes: Minimum minutes since last change before committing.
        """
        self.debounce_minutes = debounce_minutes
        # Maps filename -> timestamp of first pending change
        self._pending: Dict[str, float] = {}

    def mark_pending(self, filename: str) -> None:
        """
        Mark a file as having uncommitted changes.

        Only records the first change timestamp - subsequent changes don't reset it.
        This ensures files eventually get committed even with continuous edits.
        """
        if filename not in self._pending:
            self._pending[filename] = time.time()

    def has_pending(self) -> bool:
        """Check if there are any pending commits."""
        return len(self._pending) > 0

    def get_pending_files(self) -> list:
        """Get list of files with pending commits."""
        return list(self._pending.keys())

    def should_flush(self) -> bool:
        """
        Check if any pending commits are old enough to flush.

        Returns True if the oldest pending change is older than debounce_minutes.
        """
        if not self._pending:
            return False

        oldest_time = min(self._pending.values())
        age_minutes = (time.time() - oldest_time) / 60
        return age_minutes >= self.debounce_minutes

    def flush_if_ready(self, git_ops) -> Optional[dict]:
        """
        Commit all pending files if the debounce period has passed.

        Args:
            git_ops: GitOps instance to use for committing.

        Returns:
            Dict with commit info if committed, None otherwise.
        """
        if not self.should_flush():
            return None

        return self.flush_all(git_ops)

    def flush_all(self, git_ops) -> Optional[dict]:
        """
        Force commit all pending files regardless of debounce timer.

        Args:
            git_ops: GitOps instance to use for committing.

        Returns:
            Dict with commit info if files were committed, None if nothing to commit.
        """
        if not self._pending:
            return None

        files = list(self._pending.keys())
        count = len(files)

        # Stage all pending files
        try:
            for filename in files:
                git_ops.repo.index.add([filename])

            # Create a single commit for all files
            if count == 1:
                message = f"Update: {files[0]}"
            else:
                message = f"Update {count} documents"

            git_ops.repo.index.commit(message)

            # Clear pending
            self._pending.clear()

            return {
                'committed': True,
                'files': files,
                'count': count,
                'message': message
            }

        except Exception as e:
            print(f"Error committing pending files: {e}")
            return None

    def clear_file(self, filename: str) -> None:
        """Remove a file from pending (e.g., after deletion)."""
        self._pending.pop(filename, None)

    def get_stats(self) -> dict:
        """Get statistics about pending commits."""
        if not self._pending:
            return {
                'pending_count': 0,
                'oldest_age_minutes': 0,
                'files': []
            }

        oldest_time = min(self._pending.values())
        age_minutes = (time.time() - oldest_time) / 60

        return {
            'pending_count': len(self._pending),
            'oldest_age_minutes': round(age_minutes, 1),
            'files': list(self._pending.keys())
        }


def commit_uncommitted_on_startup(git_ops, repo_path: Path) -> Optional[dict]:
    """
    Check for any uncommitted .md files and commit them on startup.

    This handles the case where the server was restarted with pending changes.

    Args:
        git_ops: GitOps instance
        repo_path: Path to the repository

    Returns:
        Dict with commit info if files were committed, None otherwise.
    """
    if not git_ops.repo:
        return None

    try:
        # Get list of modified/untracked files
        # Changed files (modified but not staged)
        changed = [item.a_path for item in git_ops.repo.index.diff(None)]
        # Untracked files
        untracked = git_ops.repo.untracked_files

        # Filter to only .md files in root (not archive)
        md_files = []
        for f in changed + untracked:
            if f.endswith('.md') and '/' not in f:
                md_files.append(f)

        if not md_files:
            return None

        # Stage and commit
        for filename in md_files:
            git_ops.repo.index.add([filename])

        count = len(md_files)
        if count == 1:
            message = f"Commit on startup: {md_files[0]}"
        else:
            message = f"Commit on startup: {count} documents"

        git_ops.repo.index.commit(message)

        return {
            'committed': True,
            'files': md_files,
            'count': count,
            'message': message
        }

    except Exception as e:
        print(f"Error committing uncommitted files on startup: {e}")
        return None
