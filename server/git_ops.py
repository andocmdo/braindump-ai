"""
Git operations for Braindump.

Handles repository initialization, commits, and branching for the notes storage.
"""

from pathlib import Path
from git import Repo, InvalidGitRepositoryError
from git.exc import GitCommandError


class GitOps:
    """Manages git operations for the notes repository."""

    def __init__(self, repo_path: Path):
        self.repo_path = Path(repo_path)
        self.repo = None
        self._load_repo()

    def _load_repo(self):
        """Load existing repo or prepare for initialization."""
        if self.repo_path.exists():
            try:
                self.repo = Repo(self.repo_path)
            except InvalidGitRepositoryError:
                self.repo = None

    def is_initialized(self) -> bool:
        """Check if the repository is initialized."""
        return self.repo is not None

    def initialize(self) -> bool:
        """Initialize a new git repository."""
        self.repo_path.mkdir(parents=True, exist_ok=True)
        self.repo = Repo.init(self.repo_path)

        # Create initial .gitignore
        gitignore_path = self.repo_path / '.gitignore'
        gitignore_path.write_text('# Braindump notes repository\n.DS_Store\n')

        # Initial commit
        self.repo.index.add(['.gitignore'])
        self.repo.index.commit('Initialize notes repository')

        return True

    def commit_file(self, filename: str, message: str, delete: bool = False):
        """Commit a single file change."""
        if not self.repo:
            return False

        try:
            if delete:
                # Stage deletion
                self.repo.index.remove([filename])
            else:
                # Stage addition/modification
                self.repo.index.add([filename])

            self.repo.index.commit(message)
            return True
        except GitCommandError as e:
            print(f"Git commit error: {e}")
            return False

    def get_file_history(self, filename: str, limit: int = 10) -> list:
        """Get commit history for a specific file."""
        if not self.repo:
            return []

        try:
            commits = list(self.repo.iter_commits(paths=filename, max_count=limit))
            return [
                {
                    'sha': c.hexsha[:8],
                    'message': c.message.strip(),
                    'date': c.committed_datetime.isoformat(),
                    'author': str(c.author),
                }
                for c in commits
            ]
        except GitCommandError:
            return []

    def create_branch(self, branch_name: str) -> bool:
        """Create a new branch from current HEAD."""
        if not self.repo:
            return False

        try:
            self.repo.create_head(branch_name)
            return True
        except GitCommandError:
            return False

    def checkout_branch(self, branch_name: str) -> bool:
        """Checkout an existing branch."""
        if not self.repo:
            return False

        try:
            self.repo.heads[branch_name].checkout()
            return True
        except (GitCommandError, IndexError):
            return False

    def get_current_branch(self) -> str:
        """Get the name of the current branch."""
        if not self.repo:
            return ''
        return self.repo.active_branch.name

    def merge_branch(self, branch_name: str) -> bool:
        """Merge a branch into current branch."""
        if not self.repo:
            return False

        try:
            self.repo.git.merge(branch_name)
            return True
        except GitCommandError:
            return False

    def delete_branch(self, branch_name: str) -> bool:
        """Delete a branch."""
        if not self.repo:
            return False

        try:
            self.repo.delete_head(branch_name, force=True)
            return True
        except GitCommandError:
            return False

    def get_diff(self, branch_name: str) -> str:
        """Get diff between current branch and another branch."""
        if not self.repo:
            return ''

        try:
            return self.repo.git.diff(f'HEAD..{branch_name}')
        except GitCommandError:
            return ''

    def get_recent_activity(self, hours: int = 24) -> list:
        """Get files modified in the last N hours."""
        if not self.repo:
            return []

        from datetime import datetime, timedelta
        cutoff = datetime.now() - timedelta(hours=hours)

        try:
            commits = list(self.repo.iter_commits(since=cutoff.isoformat()))
            files = set()
            for commit in commits:
                files.update(commit.stats.files.keys())
            return list(files)
        except GitCommandError:
            return []
