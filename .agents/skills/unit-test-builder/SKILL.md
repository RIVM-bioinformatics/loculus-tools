---
name: unit-test-builder
description: Generate or update focused, hermetic tests for Rust engine crates and frontend packages. Use when adding coverage, fixing test failures, or validating behavior and boundary cases across the monorepo.
---

# Unit Test Builder

Create fast, deterministic tests for `loculus-tools` packages. Read `AGENTS.md` and the target package's code and manifests before editing.

## Layer-Specific Procedures

Because `loculus-tools` is a monorepo with heterogeneous packages, first identify the target package and layer:

### 1. Rust Engine Crate (`packages/apps/**/engine`)

Engine crates are native Rust crates with `Cargo.toml`.

1. **Test Location and Organization**:
   - Do **not** place tests inline inside implementation source files.
   - Place unit tests in separate linked test module files under `src/`, named `<module>_tests.rs` (e.g. `engine_tests.rs` for `lib.rs`, `alphabets_tests.rs` for `alphabets.rs`, `search_algorithms_tests.rs` for `search_algorithms.rs`).
   - Declare and link test modules in `src/lib.rs` using `#[cfg(test)] mod <module>_tests;`. This keeps implementation source files focused strictly on their code and ensures `cargo test` output is clearly namespaced (e.g. `engine_tests::...`, `alphabets_tests::...`).
   - Broader integration tests spanning multiple subsystems or full binary/WASM flows can live in `engine/tests/`.
2. **Key Invariants to Test**:
   - Inclusive coordinate ranges `(start_row..=end_row, start_col..=end_col)`.
   - Byte slice length invariant: `bytes.len() == (end_row - start_row + 1) * (end_col - start_col + 1)`.
   - Padding beyond sequence ends with ASCII spaces (`0x20`).
   - Mutations: single-base edits, rectangular range edits, row reordering, and gap insertions.
   - Undo/redo stacks: structural operations (full snapshots) vs base substitutions (compact records).
   - Error handling: malformed FASTA, invalid coordinate bounds, empty inputs.
3. **Execution**:
   ```bash
   cd packages/apps/<app>/engine
   cargo test <test_name_or_module>
   ```
4. **Hermeticity**: Keep engine tests pure and native; do not rely on DOM, network, or filesystem paths outside `tmp_dir` if needed.

### 2. Frontend Packages (`packages/apps/**/frontend`, `packages/apps/**/frontend-demo`, `packages/common/frontend`)

Frontend packages are React/Vite applications managed by pnpm.

1. **Manifest Inspection**: Always check `package.json` in the target package to see whether `test` or a test runner (e.g. Vitest, Jest) is configured. If no test runner is configured yet, do not assume `pnpm test` will succeed.
2. **Test Scope**:
   - Focus tests on pure domain logic: stores (Zustand), services, utilities (FASTA parsing, metadata parsing, color palettes, export formatters), and worker RPC serialization.
   - Mock browser-only globals (Canvas, Web Workers, fetch) where needed.
3. **Execution**:
   - When a test runner is configured in `package.json`:
     ```bash
     pnpm --filter <package-name> test -- <test-file>
     ```
   - When no automated unit test runner is configured, execute static validation instead:
     ```bash
     pnpm --filter <package-name> validate
     # or separately:
     pnpm --filter <package-name> check-types
     ```

## General Workflow

1. Identify the public behavior and the smallest relevant test file.
2. Test intended behavior and contracts rather than mirroring internal implementation details.
3. Cover success paths, expected errors, empty inputs, malformed data, and edge boundaries.
4. Inspect symmetric branches together (e.g., move rows up vs down, single vs batch edits, collapsed vs expanded tree nodes).
5. Run the narrowest relevant test immediately after editing.
6. If it fails, repair the failure in that same slice before widening test scope.
7. Report the exact validation command run and its result.
