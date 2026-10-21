---
name: "review-change"
description: "Review a loculus-tools diff, pull request, or review thread for valid behavioral, architectural, and compatibility risks."
argument-hint: "Provide a PR number, diff, issue, review comments, or packages/files to inspect."
---

Use the [deep-dive researcher skill](../skills/deep-dive-researcher/SKILL.md) for evidence gathering and the [review-pr skill](../skills/review-pr/SKILL.md) when reviewing a GitHub pull request.

Review scope: ${input:scope:Provide a PR number, diff, issue, review comments, or packages/files to inspect.}

1. Read the relevant package implementations, callers, tests, configuration, and history before judging a change.
2. Trace the complete runtime path across monorepo boundaries according to the affected package's architecture (e.g. sequence-editor: UI components -> worker RPC -> WASM engine -> Rust alignment matrix; phylogeny-viewer: UI components -> services/workers -> Aioli/Biowasm/Gen-EpiX; tooling: scripts/config -> target packages).
3. Classify each finding as valid, invalid, or requiring clarification. Separate confirmed facts from assumptions.
4. Check supported edge cases, failure behavior, security implications, and the narrowest validation command.
5. Apply a Poka-yoke footgun lens to monorepo and computational changes:
   - Buffer transfers: transferred ArrayBuffer reuse or postMessage cloning bottlenecks.
   - Coordinate systems: inclusive vs exclusive range mismatches, off-by-one errors in viewport slices.
   - State management: Zustand store re-render loops or missed notifications after engine mutations.
   - Monorepo exports: missing `pnpm update-exports` after modifying exported surface.
   - Build artifacts: accidental commits in `wasm/`, `dist/`, or `target/` directories.
6. For each material risk, state the failure mode and the smallest guard or validation that would catch it.

Return findings first, ordered by severity, with file links and concrete evidence. Then list open questions, missing tests, and a concise change summary. Do not edit files unless the request explicitly asks for implementation.
