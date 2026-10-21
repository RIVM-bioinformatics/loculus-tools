---
name: create-issue
description: >-
  Create well-structured GitHub issues using the GitHub CLI with mandatory AI
  attribution, standard problem/objective sections, label selection, and preflight
  checks. Use when the user asks to open or create a GitHub issue, file a bug, or
  log a technical debt or feature request ticket. Also use when generating a
  ready-to-run gh issue create command.
---

# Create GitHub Issue

Create well-structured, reproducible, and actionable GitHub issues using the GitHub CLI
(`gh`), enforcing mandatory AI attribution, applicable labels, and structured markdown bodies.

## Workflow

1. **Preflight Checks:**
   - Verify `gh` is authenticated: `gh auth status`
   - Check existing open issues to avoid duplicates:
     `gh issue list --search "<keywords>" --state open`
   - Determine relevant labels from the repository taxonomy:
     - Component: `sequence-editor`, `phylogeny-viewer`, `record-merger`, `frontend`
     - Technology: `Rust`, `WASM/web-worker`
     - Nature: `enhancement`, `bug`, `documentation`, `Cleanup`

2. **Compose Issue Title:**
   - Keep titles concise, imperative, and focused (e.g., `Rework undo/redo history stack for optimal memory allocations and compaction`).
   - For bug fixes, name the failing condition and component (e.g., `Prevent invalid row reordering on ragged alignments`).

3. **Compose Issue Body:**
   Use the canonical structured template:
   - `## Summary`: A clear, 1-2 sentence overview of the issue or feature request.
   - `## Context & Problem`: Detailed technical description of observed defects, bottlenecks, or limitations. Ground claims in concrete code paths, complexity analysis (e.g. $O(N)$ memory growth), or reproduction steps.
   - `## Proposed Objectives` / `## Proposed Solution`: Bulleted checklist or design goals of what needs to be changed or delivered.
   - `## Related Issues`: References to linked issues, PRs, or blocked tasks (`#<number>`).
   - **Mandatory Attribution**: Must include the exact disclaimer at the end:
     ```markdown
     ---
     *AI-generated issue description; not written by the person posting this issue.*
     ```

4. **Execution:**
   - Prefer using the deterministic helper script:
     ```bash
     .agents/scripts/create-issue.sh \
       --title "<title>" \
       --body-file "<path-to-body.md>" \
       --label "<comma-separated-labels>" \
       --assignee "@me"
     ```
   - Alternatively, execute directly with `gh`:
     ```bash
     gh issue create \
       --title "<title>" \
       --body-file "<path-to-body.md>" \
       --label "<label1>" \
       --label "<label2>" \
       --assignee "@me"
     ```

## Command-Only Mode

When the user asks only to prepare or generate the command without executing it, use `--print-command`:

```bash
.agents/scripts/create-issue.sh \
  --title "<title>" \
  --body-file "<path-to-body.md>" \
  --label "<comma-separated-labels>" \
  --print-command
```

Or produce a standalone escaped command:

```bash
gh issue create \
  --title "<title>" \
  --body "<escaped-markdown-body>" \
  --label "<label>" \
  --assignee "@me"
```

## Helper Script Reference

The repository provides `.agents/scripts/create-issue.sh`:
- Automatically appends the required AI attribution footer if omitted.
- Validates CLI prerequisites (`git`, `gh`) and authentication only when executing issue creation.
- Supports `--dry-run`, `--print-command`, and `--body-only` inspection flags without requiring `gh` installation or authentication.

## Safety Rules

- Always verify existing issues before filing to avoid duplicate reports.
- Never omit the AI attribution footer.
- Ground claims in actual codebase evidence; do not fabricate error outputs or unverified performance benchmarks.
