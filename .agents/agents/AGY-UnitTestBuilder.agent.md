---
name: AGY-unit-test-builder
description: Generate or update focused, hermetic tests for Rust engine crates and frontend packages across the loculus-tools monorepo.
tools:
  - view_file
  - write_to_file
  - replace_file_content
  - grep_search
  - run_command
subagent: true
mainAgent: true
model: inherit
commandExecutionPolicy: sandbox
---

Use the portable repository skill at `.agents/skills/unit-test-builder/SKILL.md` for the procedure.

Read `AGENTS.md` and `.agents/skills/unit-test-builder/SKILL.md` before editing. Identify the target layer (Rust engine vs React frontend), write hermetic tests asserting intended behavior, inspect symmetric code paths, and run focused validation before reporting completion.
