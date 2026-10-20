---
name: "Rust Engine and WebAssembly Guidelines"
description: "Use for Rust engine crates compiled natively and targeted for WebAssembly (wasm32-unknown-unknown)."
applyTo: "packages/apps/**/engine/**/*.{rs,toml}"
---

- The Rust engine is the authoritative single source of truth for alignment data and computational logic; it must not interact with DOM, browser APIs, or React.
- Target compatibility: engines compile for `wasm32-unknown-unknown`. Avoid native-only APIs such as direct filesystem operations (`std::fs`), host network calls, or unsupported multi-threading primitives.
- Coordinate system & slice invariants:
  - Coordinate ranges are 0-indexed and **inclusive** `[start_row, end_row]` and `[start_col, end_col]`.
  - The returned byte slice length invariant is strictly `bytes.len() == (end_row - start_row + 1) * (end_col - start_col + 1)`.
  - Out-of-bounds or invalid ranges must return empty results or error results, never partially filled or corrupt buffers.
  - Columns extending past a sequence's end must be padded with ASCII space (`0x20`).
- State mutations and history:
  - Differentiate structural edits (row insertion/deletion/reordering, full alignment shifts) from single base substitutions.
  - Preserve undo/redo history invariants according to the engine design documentation (`packages/apps/sequence-editor/engine/engine.md`).
- Test organization:
  - Do not place unit tests inline inside implementation source files.
  - Keep unit tests in separate linked module files `<module>_tests.rs` under `src/` (e.g. `engine_tests.rs`, `alphabets_tests.rs`), conditionally declared in `lib.rs` with `#[cfg(test)] mod <module>_tests;`. This keeps implementation modules focused and cleanly namespaces `cargo test` results.
- Quality checks:
  - Run checks inside the engine directory:
    ```bash
    cargo fmt -- --check
    cargo test
    cargo clippy --all-targets --all-features -- -D warnings
    ```
  - When changes affect WebAssembly bindings, rebuild via `pnpm run build-wasm` and verify generated typescript interfaces before committing.
  - Never hand-edit files in the generated `wasm/` directory; always change Rust sources or build scripts.
