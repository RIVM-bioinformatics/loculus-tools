---
name: "investigate-feature"
description: "Assess a loculus-tools feature idea for viability across packages and scope practical implementation options."
argument-hint: "Describe the feature idea, target application/package, constraints, or relevant files."
---

Use the [deep-dive researcher skill](../skills/deep-dive-researcher/SKILL.md) for the investigation. This is a research and planning prompt: do not edit files unless the request explicitly asks for implementation.

Feature idea: ${input:feature:Describe the feature idea, target application/package, constraints, or relevant files.}

1. Define the user problem, intended behavior, acceptance criteria, and decision this investigation must support.
2. Trace the affected monorepo packages, layer boundaries (React UI vs Web Worker vs Rust WASM engine), configuration, documentation, and tests.
3. Assess viability using concrete evidence: architectural fit, browser/WASM performance impact, memory and buffer transfers, packaging constraints, and maintenance burden.
4. Score viability from 1 to 5 and explain each score (1 = not viable without major redesign; 5 = strong fit with limited risk). Separate confirmed facts, assumptions, and open questions.
5. If viable, outline one recommended implementation approach and up to two alternatives. For each, identify affected packages/files, API and worker protocol changes, and the smallest useful validation plan.
6. If not viable, explain the blocking constraints and suggest the smallest viable reformulation, if one exists.

Return:

- Decision: viable, viable with conditions, or not viable
- Viability score: 1-5 with rationale
- Target packages and architectural layers
- Evidence and assumptions
- Recommended scope and implementation approach
- Alternatives and tradeoffs
- Risks, open questions, and validation plan
