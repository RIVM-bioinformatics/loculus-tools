---
name: GH-UnitTestBuilder
description: Generate or update focused, hermetic tests for Rust engine crates and frontend packages across the loculus-tools monorepo.
argument-hint: "A target package, module, or test file to create or update."
tools: [execute, read, edit, search, todo]
---

Use the portable repository skill at `.agents/skills/unit-test-builder/SKILL.md` for the procedure.

Read `AGENTS.md` and `.agents/skills/unit-test-builder/SKILL.md` before editing. Identify the target layer (Rust engine vs React frontend), write hermetic tests asserting intended behavior, inspect symmetric code paths, and run focused validation before reporting completion.
