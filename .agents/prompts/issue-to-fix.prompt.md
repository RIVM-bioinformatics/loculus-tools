---
name: "issue-to-fix"
description: "Investigate a loculus-tools issue, defect, or review comment and implement a behavior-backed fix."
argument-hint: "Describe the issue, failure, review comment, or affected package and files."
---

Use the [deep-dive researcher skill](../skills/deep-dive-researcher/SKILL.md) for investigation. Use the [unit-test builder skill](../skills/unit-test-builder/SKILL.md) when the issue requires creating or updating tests.

Request: ${input:request:Describe the issue, failure, review comment, or affected package and files.}

1. Write a compact reproduction brief: trigger, expected behavior, observed behavior, affected package/layer, smallest reproducer (or why unavailable), and current evidence.
2. Identify the nearest code path that controls the behavior; do not stop at an outer React wrapper or wiring layer. Read the nearest tests and callers.
3. State the intended behavior, one falsifiable hypothesis, and one focused check before editing.
4. Implement the smallest coherent fix. Respect package boundaries and invariants (inclusive coordinates, row-major matrices, immutable worker buffers).
5. Run the narrowest relevant validation immediately (e.g. `cargo test <target>` or `pnpm --filter <package> <script>`), repair local failures, and only then widen scope.

Report a lightweight evidence receipt: diagnosis, trigger and expected/observed behavior, changed files, validation command and result, remaining risks, and any environmental limitation. Distinguish observed results from assumptions, omit unavailable fields rather than inventing them, and do not claim completion when validation was not run.
