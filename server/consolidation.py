"""
Braindump Consolidation

Handles AI-driven document consolidation: cleaning, organizing, and structuring notes.
"""

import re
import time
from typing import Optional
from dataclasses import dataclass


# System prompt for the consolidation AI
CONSOLIDATION_SYSTEM_PROMPT = """You are a personal knowledge librarian helping organize notes. Your job is to consolidate raw, unstructured notes into clean, well-organized documents.

Your responsibilities:
1. **Clean up formatting** - Fix typos, improve grammar, standardize formatting
2. **Remove redundancy** - Merge duplicate information, eliminate repetition
3. **Organize content** - Group related ideas, create logical sections
4. **Identify uncertainties** - Mark unclear or contradictory statements with [QUESTION: ...]
5. **Preserve meaning** - Never lose information or change the user's intent
6. **Extract action items** - Ensure all TODOs/TASKs are preserved and visible

Output format:
- Use Markdown formatting
- Structure the document with clear headings
- Preserve all TODO and TASK markers exactly as written
- Insert [QUESTION: your question here] for anything unclear or needing clarification
- Keep the tone consistent with the original notes"""


CONSOLIDATION_USER_PROMPT = """Please consolidate the following note(s) into a well-organized document.

Use this structure when appropriate:
# Title
(A clear, descriptive title based on the content)

## Summary
(A brief 1-3 sentence summary of the main points)

## Details
(The organized content, with logical sections as needed)

## Open Questions
(Any [QUESTION: ...] blocks, either carried forward or newly identified)

## TODOs
(All TODO and TASK items extracted and listed)

---

CONTENT TO CONSOLIDATE:

{content}

---

Please provide the consolidated version. Preserve all task markers (TODO, TASK, DONE) exactly as they appear. If you identify anything unclear or contradictory, insert [QUESTION: your question] inline or in the Open Questions section."""


@dataclass
class ConsolidationResult:
    """Result of a consolidation operation."""
    original_content: str
    consolidated_content: str
    document_id: str
    branch_name: str
    created_at: float


class ConsolidationManager:
    """Manages the consolidation process."""

    def __init__(self, llm_manager, git_ops):
        self.llm = llm_manager
        self.git = git_ops
        self.active_proposals: dict[str, ConsolidationResult] = {}

    def consolidate(self, document_id: str, content: str) -> ConsolidationResult:
        """
        Consolidate a document using AI.

        Args:
            document_id: The ID of the document being consolidated
            content: The raw content to consolidate

        Returns:
            ConsolidationResult with the proposed changes
        """
        # Generate consolidated content via LLM
        user_prompt = CONSOLIDATION_USER_PROMPT.format(content=content)
        consolidated = self.llm.complete(
            prompt=user_prompt,
            system=CONSOLIDATION_SYSTEM_PROMPT,
            max_tokens=8192
        )

        # Clean up the response (remove any markdown code blocks if present)
        consolidated = self._clean_response(consolidated)

        # Create a branch for the proposal
        timestamp = int(time.time())
        branch_name = f"consolidate-{document_id[:8]}-{timestamp}"

        # Create the proposal
        result = ConsolidationResult(
            original_content=content,
            consolidated_content=consolidated,
            document_id=document_id,
            branch_name=branch_name,
            created_at=time.time()
        )

        # Store in active proposals
        self.active_proposals[branch_name] = result

        return result

    def consolidate_multiple(self, documents: list[tuple[str, str]]) -> ConsolidationResult:
        """
        Consolidate multiple documents into one.

        Args:
            documents: List of (document_id, content) tuples

        Returns:
            ConsolidationResult with the proposed merged content
        """
        # Combine all documents with separators
        combined_content = ""
        doc_ids = []
        for doc_id, content in documents:
            doc_ids.append(doc_id)
            combined_content += f"--- Document: {doc_id} ---\n\n{content}\n\n"

        # Generate merged document ID
        merged_id = "-".join([d[:4] for d in doc_ids[:3]])
        if len(doc_ids) > 3:
            merged_id += f"-plus{len(doc_ids)-3}"

        return self.consolidate(merged_id, combined_content)

    def _clean_response(self, response: str) -> str:
        """Clean up LLM response, removing wrapper code blocks if present."""
        # Remove markdown code block wrappers if the LLM added them
        response = response.strip()
        if response.startswith("```markdown"):
            response = response[11:]
        elif response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
        return response.strip()

    def get_proposal(self, branch_name: str) -> Optional[ConsolidationResult]:
        """Get an active proposal by branch name."""
        return self.active_proposals.get(branch_name)

    def list_proposals(self) -> list[dict]:
        """List all active proposals."""
        return [
            {
                "branch_name": result.branch_name,
                "document_id": result.document_id,
                "created_at": result.created_at,
            }
            for result in self.active_proposals.values()
        ]

    def accept_proposal(self, branch_name: str) -> bool:
        """
        Accept a consolidation proposal.

        This writes the consolidated content back to the document.
        """
        proposal = self.active_proposals.get(branch_name)
        if not proposal:
            return False

        # Remove from active proposals
        del self.active_proposals[branch_name]
        return True

    def reject_proposal(self, branch_name: str) -> bool:
        """
        Reject a consolidation proposal.

        This discards the proposed changes.
        """
        if branch_name not in self.active_proposals:
            return False

        # Remove from active proposals
        del self.active_proposals[branch_name]
        return True

    def generate_diff(self, original: str, consolidated: str) -> dict:
        """
        Generate a simple diff representation for the UI.

        Returns a dict with:
        - original_lines: list of lines from original
        - consolidated_lines: list of lines from consolidated
        - changes: list of change operations for rendering
        """
        original_lines = original.split('\n')
        consolidated_lines = consolidated.split('\n')

        # Simple diff: just return both versions for side-by-side display
        # A more sophisticated diff could use difflib
        return {
            "original": original,
            "consolidated": consolidated,
            "original_lines": original_lines,
            "consolidated_lines": consolidated_lines,
            "original_line_count": len(original_lines),
            "consolidated_line_count": len(consolidated_lines),
        }
