# Sequence Editor

MindTheGap is an English-first nucleotide alignment editor for pre-aligned FASTA data. The React/Vite application renders a virtualized two-dimensional canvas grid while the Rust/WASM engine remains the sole source of truth for sequence bytes, names, row order, edits, history, and export.

## Layout

- `engine/` — the Rust crate and native tests.
- `engine/wasm/` — generated `wasm-bindgen` output consumed through a workspace dependency. Do not hand-edit generated files.
- `frontend/` — the React application, worker bridge, pure editor helpers, unit tests, and Playwright smoke test.

Companion references:

- [`engine/engine-api.md`](./engine/engine-api.md) — worker-facing TypeScript API.
- [`engine/engine.md`](./engine/engine.md) — Rust data structures and WASM boundary.

## Quick Start

Prerequisites are Node.js 18+, pnpm 12, Rust via rustup, and `wasm-pack` for rebuilding the engine.

From the repository root:

```bash
pnpm install
pnpm --filter @rivm-loculus-tools/sequence-editor start
```

The development server runs on Vite's configured port, normally `http://localhost:5173`. It sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`; `window.crossOriginIsolated` should be `true` so the SharedArrayBuffer viewport path is exercised.

## Architecture

The runtime has four focused layers:

1. `engine/src/lib.rs` owns the alignment matrix, FASTA parsing, mutations, row/column operations, undo/redo, search, metadata, viewport slices, and deterministic FASTA export.
2. `frontend/src/engine/` runs the generated WASM module in a Web Worker and correlates typed requests and responses.
3. `useSequenceEditor` owns UI-only state and serializes commands. React never stores or reconstructs the full alignment.
4. `AlignmentGrid` requests only an overscanned visible rectangle, paints base and selection layers on canvas, caches visible names, and exposes keyboard and pointer interaction through an accessible grid surface.

`TestHarness`, `BenchmarkPanel`, and `SliceCanvas` remain available as developer diagnostics but are not mounted by [`main.tsx`](./frontend/src/main.tsx). Material UI supplies the application controls and the shared frontend package supplies the visual theme.

## Import And Export

Import accepts `.fasta`/`.fa` files, pasted FASTA, and the bundled SARS-CoV-2 demo. The UI preflights input using the engine's semantics: the first whitespace-delimited header token is the record name, sequence whitespace is removed, and bases are uppercased. Empty, malformed, and ragged alignments are rejected before loading. Loading a dirty dataset requires confirmation.

A remote FASTA can be loaded through the `input-fasta` query parameter. The URL must use HTTP or HTTPS; the import dialog opens with the URL prefilled and starts loading it automatically once the WASM engine is ready. For example:

```text
http://localhost:5173/?input-fasta=https%3A%2F%2Fraw.githubusercontent.com%2Fnextstrain%2Fnextclade_data%2Frefs%2Fheads%2Fmaster%2Fdata_output%2Fnextstrain%2Frsv%2Fa%2FEPI_ISL_412866%2F2026-04-14--11-55-23Z%2Fsequences.fasta
```

The remote server must allow browser CORS requests. The dataset label is derived from the URL path, so the supplied example appears as `sequences.fasta`.

Export serializes the current engine state as deterministic, unwrapped FASTA with a final newline. The browser downloads a sanitized dataset filename such as `sarscov2_demo.fasta`; the dirty flag is cleared only after the download succeeds.

## Editing

- Click a cell to focus it. Arrow keys move the active cell; Shift+Left/Right extends a same-row block; Home/End and PageUp/PageDown are bounded.
- `A C G T U R Y S W K M B D H V N` mutate the active column and advance the cursor. `-` and `Delete` mutate to a gap and do not delete structure.
- `Space` inserts a gap immediately before the active base. `Backspace` deletes only a gap immediately before the cursor; the engine rejects other bases without changing data.
- Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl+Y undo or redo. Alt+Left/Right moves a contiguous same-row block.
- Row selection supports click, Shift range, and Ctrl/Cmd toggle. Row movement and whole-column deletion are available from Settings; column deletion asks for confirmation.

The engine enforces IUPAC and gap constraints and applies multi-row operations atomically. The frontend refreshes metadata and viewport revisions after every mutation, undo, redo, reorder, or structural change.

## Checks And Development Commands

```bash
pnpm --filter @rivm-loculus-tools/sequence-editor lint
pnpm --filter @rivm-loculus-tools/sequence-editor check-types
pnpm --filter @rivm-loculus-tools/sequence-editor test-run
pnpm --filter @rivm-loculus-tools/sequence-editor build
pnpm --filter @rivm-loculus-tools/sequence-editor test-e2e
```

The unit suite covers FASTA preflight, reducer revisions and error mapping, selection/navigation, keyboard commands, search navigation, palette migration/reset, filenames, grid geometry, and the empty-state component. The Playwright smoke test covers the bundled demo, editing constraints, history, search, palette reset, export contents, responsive settings, screenshots, and cross-origin isolation.

For engine changes:

```bash
cargo fmt --manifest-path packages/apps/sequence-editor/engine/Cargo.toml -- --check
cargo test --manifest-path packages/apps/sequence-editor/engine/Cargo.toml
cargo clippy --manifest-path packages/apps/sequence-editor/engine/Cargo.toml --all-targets --all-features -- -D warnings
pnpm build-wasm
```

## Deliberately Deferred

The first release does not include Loculus API integration, authentication, autosave, metadata tables, additional palette presets, amino-acid rendering, or deployment configuration. Amino-acid palette entries are stored for forward compatibility, but the editor is currently nucleotide-focused.
