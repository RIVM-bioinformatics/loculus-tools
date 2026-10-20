---
name: "test-failure"
description: "Reproduce and fix a test failure in loculus-tools with the correct package runner and behavior-focused coverage."
argument-hint: "Paste the test failure or specify the failing test and package."
---

Use the [unit-test builder skill](../skills/unit-test-builder/SKILL.md) for the testing procedure.

Failure or target: ${input:failure:Paste the test failure or specify the failing test and package.}

1. Identify the owning package and test runner:
   - For Rust engine crates (`packages/apps/**/engine`), use `cargo test <target_test>`.
   - For frontend packages (`packages/apps/**/frontend`), inspect `package.json` for test commands (e.g. `pnpm --filter <package> test`).
2. Read the nearest implementation, test, and fixtures before editing.
3. Check boundary conditions, empty inputs, malformed data, and inclusive coordinate limits.
4. Run the narrowest relevant test command immediately after each edit; widen only after that check passes.

Report the root cause, behavior covered, exact validation command and result, and any environment blocker. Keep unit tests hermetic: avoid live network calls or unmocked browser globals in headless tests.
