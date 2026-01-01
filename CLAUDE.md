# Claude Code Instructions

## Python Environment

Use `uv` for all Python package management and execution:

```bash
# Install dependencies
uv sync

# Add new packages
uv add <package-name>

# Run the server
uv run braindump

# Run any Python command
uv run python <script.py>
```

Do not use pip, venv, or virtualenv directly.

## Project Status

Always update `PROJECT-STATUS.md` after completing major items or phases of work. Keep it current with completed features, remaining work, and any implementation details.
