---
name: "create-issue"
description: "Draft and create a structured GitHub issue with proper repository labels and mandatory AI attribution."
argument-hint: "Describe the bug, technical debt, or feature request to log as an issue."
---

Use the [create-issue skill](../skills/create-issue/SKILL.md) for the workflow and `.agents/scripts/create-issue.sh` helper.

Request: ${input:request:Describe the bug, technical debt, or feature request to log as an issue.}

1. Check open issues using `gh issue list --search "<keywords>"` to ensure no duplicate issue exists.
2. Select appropriate labels from the repository taxonomy (`enhancement`, `bug`, `Rust`, `sequence-editor`, `phylogeny-viewer`, `WASM/web-worker`, `documentation`).
3. Draft the issue body using standard sections:
   - `## Summary`
   - `## Context & Problem`
   - `## Proposed Objectives` (or `## Steps to Reproduce` / `## Proposed Fix` for bugs)
   - `## Related Issues`
4. Guarantee the AI attribution footer is present:
   `*AI-generated issue description; not written by the person posting this issue.*`
5. Use `.agents/scripts/create-issue.sh` to preview (`--dry-run`) or create the issue, assigning to `@me` by default.
