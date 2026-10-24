---
name: deep-dive-researcher
description: Investigate repository behavior, issues, pull requests, reviews, and failures across packages to find root causes and produce evidence-based conclusions. Use when a task asks for a deep investigation or implementation plan.
---

# Deep Dive Researcher

Investigate one concrete question deeply enough to reach a decision across the `loculus-tools` monorepo. Read `AGENTS.md` and the relevant package implementations, tests, history, or review artifacts.

## Procedure

1. **Define the question**: State the question, expected behavior, and the decision the investigation must support.
2. **Capture a compact reproduction brief** before broad exploration:
   - **Trigger**: input, UI action, worker message, dataset (e.g. FASTA/metadata), or review comment that exposes the problem.
   - **Expected and observed behavior**: exact error, rendering defect, calculation mismatch, or performance degradation.
   - **Environment & Packages**: target application (`phylogeny-viewer`, `sequence-editor`), package layer (`frontend`, `engine`, `wasm`), Node/pnpm/Rust versions, and browser context.
   - **Smallest reproducer**: minimal test case, mock FASTA, or concrete reason reproduction is unavailable.
   - **Evidence already collected**: logs, console outputs, stack traces, and initial confidence.
3. **Trace the architectural layer path**:
   - For UI/rendering issues: trace React component -> Zustand store/hook -> service/worker bridge -> WASM engine.
   - For alignment/computation issues: trace Rust engine matrix, coordinate ranges, and edit operations.
   - Find the nearest code path that computes, mutates, or controls the behavior; do not stop at a wiring layer.
4. **Gather the smallest useful evidence set**:
   - Inspect package manifests (`package.json`, `Cargo.toml`), exports, worker protocols, and unit tests.
   - Compare observed behavior with intended behavior and distinguish confirmed facts from assumptions.
5. **Identify edge cases and constraints**:
   - Memory and performance: large alignments, transferred ArrayBuffers, WASM allocations, worker serialization overhead.
   - Coordinates: inclusive 0-indexed column/row ranges, boundary conditions, ASCII padding.
   - Package boundaries: build dependencies, export maps, and cross-package version sync.
6. **Classify Scope & Cross-Reference Existing Issues**:
   - Separate immediate correctness defects/invariants from secondary architectural suggestions, broader refactoring, or pre-existing technical debt.
   - Query open issues (`gh issue list --search "<keyword>" --state open`) and linked PR issues.
   - Triage development tracks:
     - **In-Scope (Current Task/PR)**: The minimal change necessary to satisfy correctness and safety invariants.
     - **Secondary Development Track**: Broader architectural ideas, multi-package refactorings, or new public APIs. If tracked, link and comment on the existing issue. If untracked, scope and open a new dedicated issue via the `create-issue` skill.
7. **Choose a cheap discriminating check**:
   - A focused unit test (`cargo test <target>` or package test runner), a minimal Node/browser script, or direct call-site inspection.
8. **Run the check** when execution is requested and use its result to confirm or revise the hypothesis.
9. **Produce one conclusion and a concrete next action**. Explicitly separate in-scope fixes from deferred/tracked secondary issues. Do not repeat an unchanged investigation without new evidence.

## Output Structure

Use this structure when useful:

```markdown
# Investigation

## Conclusion
[Direct answer and confidence level]

## Reproduction Brief
- Trigger: [input, action, or dataset]
- Expected: [intended behavior]
- Observed: [actual behavior, error, or defect]
- Affected Packages / Layers: [e.g. packages/apps/sequence-editor/engine]
- Smallest Reproducer: [minimal reproducer or why unavailable]

## Scope Boundary & Issue Triage
- In-Scope (Current Task/PR): [narrowest localized fix required for correctness]
- Secondary Track / Out-of-Scope: [broader suggestions deferred; linked existing issue #X or newly opened issue]

## Evidence
- [Code or test evidence]
- [Architectural or invariant constraint]

## Risks and Edge Cases
- [Material risks: memory, worker transfer, inclusive coordinates, performance]

## Recommended Action
[Smallest justified fix, architectural adjustment, or why no change is needed]

## Validation
[Focused validation command run, result, or environmental blocker]
```

Keep the brief proportional to the issue. Never fill missing facts with guesses; label assumptions and blockers explicitly.
