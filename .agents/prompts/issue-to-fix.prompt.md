---
name: "issue-to-fix"
description: "Investigate a loculus-tools issue, defect, or review comment and implement a behavior-backed fix."
argument-hint: "Describe the issue, failure, review comment, or affected package and files."
---

Use the [deep-dive researcher skill](../skills/deep-dive-researcher/SKILL.md) for investigation, the [create-issue skill](../skills/create-issue/SKILL.md) when secondary findings require opening tracked issues, and the [unit-test builder skill](../skills/unit-test-builder/SKILL.md) when the issue requires creating or updating tests.

Request: ${input:request:Describe the issue, failure, review comment, or affected package and files.}

1. Write a compact reproduction brief: trigger, expected behavior, observed behavior, affected package/layer, smallest reproducer (or why unavailable), and current evidence.
2. Scope & Cross-Reference Check (prevent scope creep):
   - Decompose review comments and findings: separate immediate correctness defects/invariants from secondary architectural suggestions or pre-existing technical debt.
   - Cross-reference open issues: run `gh issue list --search "<keywords>" --state open` to see if an existing issue owns the broader concept.
   - Triage development tracks: if a finding is best handled in a separate development track:
     - Keep the current PR fix strictly minimal, localized, and on-track.
     - If tracked by an existing issue, post a context comment linking the review finding.
     - If untracked, use the `create-issue` skill to open a new, well-scoped GitHub issue with standard sections, repository labels, and mandatory AI attribution.
3. Identify the nearest code path that controls the behavior; do not stop at an outer React wrapper or wiring layer. Read the nearest tests and callers.
4. State the intended behavior, one falsifiable hypothesis, and one focused check before editing.
5. Implement the smallest coherent fix. Respect package boundaries and invariants (inclusive coordinates, row-major matrices, immutable worker buffers).
6. Run the narrowest relevant validation immediately (e.g. `cargo test <target>` or `pnpm --filter <package> <script>`), repair local failures, and only then widen scope.

Report a lightweight evidence receipt: diagnosis, trigger and expected/observed behavior, changed files, validation command and result, remaining risks, and any environmental limitation. Distinguish observed results from assumptions, omit unavailable fields rather than inventing them, and do not claim completion when validation was not run. Explicitly report what was resolved in-scope and what secondary issues were cross-referenced or opened.
