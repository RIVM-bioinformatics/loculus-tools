# Agent Customization

This document describes how repository customization is organized in `loculus-tools`. It is separate from `.agents/AGENTS.md`, which is the canonical, client-neutral entry point for working in the repository.

## Canonical Layout

Keep reusable guidance in `.agents/`:

- `.agents/AGENTS.md` is the canonical project guide for coding work.
- `.agents/skills/<name>/SKILL.md` contains focused, reusable workflows. Skills use lowercase-hyphenated names and frontmatter with `name` and `description`.
- `.agents/prompts/` contains short, task-specific `*.prompt.md` templates. Prompts are entry points, not duplicate skill bodies.
- `.agents/instructions/` contains conditional `*.instructions.md` rules with `applyTo` globs for specific languages, directories, or package types.
- `.agents/agents/` contains Antigravity-native custom-agent adapters; portable role procedures belong in `.agents/skills/`.
- `.agents/references/` contains detailed material loaded only when a skill needs it.
- `.agents/scripts/` contains deterministic helpers (e.g. PR creation and commenting scripts). Audit scripts before using them.

## Monorepo Considerations

`loculus-tools` is a pnpm/Lerna monorepo containing multiple independently runnable applications with distinct tech stacks and lifecycles:

1. **Package Heterogeneity**: Not all packages share the exact same build, lint, or test commands. Always inspect the target package's `package.json` (under `packages/apps/**/frontend`) or `Cargo.toml` (under `packages/apps/**/engine`) rather than assuming a universal command exists.
2. **Layer Separation**:
   - Frontend packages (`packages/apps/**/frontend`): React, Vite, Emotion/MUI, Zustand, ESLint flat config.
   - Computational engines (`packages/apps/**/engine`): Native Rust crates compiled to WebAssembly via `wasm-pack`.
   - Engine WASM bridge (`packages/apps/**/engine/wasm`): Generated artifacts consumed via pnpm `workspace:^`.
3. **Placeholder Packages**: `mst-viewer` and `record-merger` currently contain only `.gitkeep` files. Do not invoke package scripts on placeholder packages.
4. **Targeted Scoping**: Prefer package-scoped checks (`pnpm --filter <package> <script>` or `cargo test` within the crate) over repository-wide fan-out unless testing the whole workspace.

## Choosing A Customization Type

Use the smallest primitive that matches the job:

| Primitive | Purpose | Activation | Location |
| --- | --- | --- | --- |
| Always-on instructions | Project facts, monorepo architecture, coding standards, and cross-cutting rules | Automatic | `.agents/AGENTS.md` |
| File-based instructions | Rules for a specific package type, layer, or directory (e.g., Rust engines, React frontends, GitHub Actions) | Automatic when a path matches | `.agents/instructions/<topic>.instructions.md` |
| Skill | A reusable, multi-step procedure with optional references, scripts, or templates | Agent-selected or explicitly invoked | `.agents/skills/<name>/SKILL.md` |
| Prompt | A manually invoked task template that supplies inputs and expected output | User-selected (slash command) | `.agents/prompts/<name>.prompt.md` |
| Custom agent | A role with a focused instruction set and client-specific tool/model permissions | User-selected or delegated | `.agents/agents/<name>.agent.md` for Antigravity, with client adapters where required |

Keep the boundaries strict:

- Put stable project rules, package boundaries, and invariants in `AGENTS.md`.
- Use a file-based instruction only when a rule should apply conditionally to matching paths (e.g. `applyTo: "packages/apps/**/engine/**/*"`).
- Use a skill when the agent should recognize and execute a reusable procedure. A skill explains *how* to do the work across packages without being locked to one single task.
- Use a prompt when the user wants a repeatable entry point with task-specific variables (such as an issue, feature request, or target package). A prompt references a skill instead of duplicating its steps.
- Use a custom agent when the distinction is role, permissions, or tools. Keep the reusable procedure in `.agents/skills/`.

## Client Adapters

- **Symlinked Entrypoints**: Root `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` symlink to `.agents/AGENTS.md` so that VS Code Copilot, Claude Code, Antigravity, and other clients receive the canonical project guide directly without content duplication or unexpanded `@` directives.
- **Agent Adapters**: Adapters use client-identifying prefixes so users know which harness they belong to:
  - `.github/agents/GH-<Name>.agent.md`: GitHub Copilot adapters in VS Code with native Copilot tools (`[execute, read, edit, search, todo]`).
  - `.claude/agents/Claude-<Name>.md`: Claude Code adapters with native Claude tools (`Read, Grep, Glob, Bash, Edit`).
  - `.agents/agents/AGY-<Name>.agent.md`: Antigravity adapters with native Antigravity tools (`view_file, grep_search, replace_file_content, run_command`).
- **VS Code Settings**: `.vscode/settings.json` points `chat.instructionsFilesLocations` and `chat.promptFilesLocations` to `.agents/instructions` and `.agents/prompts` for native VS Code Copilot discovery.
- **Thin Wrappers**: All agent adapters remain thin wrappers pointing to the reusable functional procedure in `.agents/skills/<name>/SKILL.md`.
