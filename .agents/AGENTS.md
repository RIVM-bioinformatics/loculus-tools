# AGENTS.md

## Repository Overview

`loculus-tools` is a private pnpm/Lerna monorepo containing browser-based tools
for curation and ad-hoc analysis in the Loculus platform. The repository is
organized around independently runnable applications rather than a shared
runtime service. Most application code is TypeScript/React; computationally
intensive functionality can be implemented in Rust and compiled to WebAssembly.

The current top-level layout is:

```text
.
├── package.json              # Root scripts, package manager, and dev tooling
├── pnpm-workspace.yaml       # Workspace package globs and approved builds
├── lerna.json                # Lerna package globs and pnpm client
├── packages/apps/
│   ├── mst-viewer/           # Minimum spanning tree viewer (placeholder here)
│   ├── phylogeny-viewer/     # React/Vite phylogenetic tree viewer
│   ├── record-merger/        # Record merging tool (placeholder here)
│   └── sequence-editor/      # React/Vite UI plus Rust/WASM MSA engine
├── scripts/
│   ├── build-wasm.mjs         # Builds every discovered Rust engine
│   ├── installDep.mjs        # Dependency/install helper
│   ├── install-linked.mjs     # Linked-package install helper
│   └── update-exports.mjs    # Generates package export maps
├── .husky/                   # Git hook configuration
└── .vscode/                  # Workspace/editor settings
```

`CLAUDE.md` delegates repository instructions to this file. Keep this document
as the shared source of truth for Copilot, Codex, Cursor, and other agents.

## Package and Workspace Model

The root `package.json` uses pnpm `12.14.0` and Lerna `10.1.1`. Lerna and the
pnpm workspace discover the following package families:

```text
packages/apps/**/frontend
packages/apps/**/frontend-demo
packages/apps/**/engine/wasm
packages/common/**
```

The pnpm workspace includes:

```yaml
packages:
  - packages/apps/**/frontend
  - packages/apps/**/frontend-demo
  - packages/apps/**/engine/wasm
  - packages/common/**
```

The Rust `engine` directories are build inputs, not pnpm packages. Their output
is written into sibling `wasm` packages. A frontend that consumes an engine uses
a `workspace:^` dependency on that generated package.

### Application status

- `packages/apps/phylogeny-viewer/frontend` is a reusable React/Vite library
  package (`@rivm-loculus-tools/phylogeny-viewer`) with validate, lint,
  lint-fix, update-exports, check-types, build, and preview scripts.
- `packages/apps/phylogeny-viewer/frontend-demo` is a standalone React/Vite demo
  application (`@rivm-loculus-tools/phylogeny-viewer-demo`) with start, build,
  preview, and validation scripts.
- `packages/apps/sequence-editor/engine` is a Rust crate compiled for native
  tests and WebAssembly.
- `packages/apps/sequence-editor/frontend` is a reusable React/Vite UI component
  and library package (`@rivm-loculus-tools/sequence-editor`) with validate,
  lint, lint-fix, update-exports, check-types, start, build, and preview scripts.
- `packages/apps/sequence-editor/frontend-demo` is a standalone React/Vite demo
  application (`@rivm-loculus-tools/sequence-editor-demo`) mounting
  `SequenceEditorDemoApp`, with start, build, preview, and validation scripts.
- `packages/common/frontend` is a shared frontend foundation package
  (`@rivm-loculus-tools/common-frontend`).
- `packages/apps/mst-viewer` currently contains only `.gitkeep` files in its
  `frontend`, `engine`, and `wasm` directories. Do not assume it is buildable.
- `packages/apps/record-merger` currently contains only `.gitkeep` files in its
  `frontend`, `engine`, and `wasm` directories. Do not assume it is buildable.

Do not add a package to the root scripts merely because its directory exists.
First add the package manifest and the scripts expected by the Lerna commands.

## Architecture

### Common frontend shape

Frontend packages are browser applications built with React and Vite. Their
usual boundary is:

```text
index.html
  -> src/main.tsx
    -> application root component
      -> pages / feature components
        -> services, stores, hooks, models, and utilities
```

The UI owns presentation, user interaction, routing/deep-link handling, and
browser APIs. Domain-specific computation should remain behind a service,
worker, or engine boundary instead of being spread through view components.

### Phylogeny viewer

`packages/apps/phylogeny-viewer/frontend-demo/src/main.tsx` mounts the demo
application `PhylogenyViewerDemoApp` under `StrictMode`. The reusable library source
tree under `packages/apps/phylogeny-viewer/frontend/src/` is organized into:

- `components/app` and `components/pages` for application/page composition.
- `components/dialogs` for import and validation feedback flows.
- `components/ui` for reusable UI wrappers.
- `classes/services` for long-lived services, including the FastTree and TN93
  Aioli services and their shared abstract service.
- `models` for calculation, FASTA, metadata, and tree data shapes.
- `stores` for UI state managed with Zustand.
- `hooks` for cross-cutting behavior such as deep linking.
- `utils` for color generation, export, FASTA parsing, metadata parsing, and URL
  handling.
- `theme` and `@types` for styling, fonts, and local/external type declarations.

The application performs analysis in the browser. It supports two calculation
paths: TN93 distance calculation followed by neighbor joining, and FastTree via
Biowasm/Aioli. Tool preloading is worker-backed. Tree rendering is delegated to
the Gen-EpiX phylogenetic tree component on an HTML5 Canvas. FASTA alignment
validation, TSV metadata enrichment, search, inspection, collapse/expand, and
Newick/image export remain client-side concerns.

The viewer also supports deep links with `input-fasta` and `input-metadata`
query parameters. Keep URL parsing and data-import error handling in the
existing hook/dialog boundaries rather than inside the tree renderer.

### Sequence editor

The sequence editor has three explicit layers:

```text
React UI
  -> useEngineWorker() / RPC protocol
    -> Web Worker
      -> wasm-bindgen MsaEngine
        -> Rust alignment matrix and edit history
```

The Rust engine in `engine/src/lib.rs` is the single source of truth for the
alignment. It parses FASTA, owns the row-major byte matrix, applies edits,
maintains undo/redo, and returns bounded viewport slices. It does not access the
DOM, network, or React.

The frontend worker bridge lives under `frontend/src/engine/`. The hook exposes
an asynchronous `EngineClient` and handles request correlation, message
serialization, initialization, errors, and transferred buffers. Call
`useEngineWorker()` once for an editor instance and pass the returned client
through props. Multiple hook calls create independent workers and independent
engines.

The renderer should request only the visible viewport. The engine uses inclusive
row/column ranges and pads columns beyond a sequence's end with ASCII space.
After a mutation, refetch the affected viewport. The engine's API and design
contracts are documented in:

- `packages/apps/sequence-editor/engine/engine-api.md` for frontend consumers.
- `packages/apps/sequence-editor/engine/engine.md` for Rust implementation and
  data-structure details.

The standalone demo entry point in `packages/apps/sequence-editor/frontend-demo/src/main.tsx`
mounts `SequenceEditorDemoApp`, while `packages/apps/sequence-editor/frontend`
exposes the production-facing library components (`SequenceEditor`, `SequenceEditorApp`),
services, and state stores.

### Rust/WASM build boundary

Any app with an `engine/Cargo.toml` is discovered by
`scripts/build-wasm.mjs`. The script:

1. Checks that `wasm-pack` is installed.
2. Prefers `~/.cargo/bin` so rustup's toolchain is used.
3. Runs `wasm-pack build --target web --out-dir wasm` from the engine.
4. Rewrites the generated WASM package name to
   `@rivm-loculus-tools/<app>-wasm`.
5. Removes the engine's generated `target` directory.

The generated `wasm` directory is ignored by default. Its `package.json` must
be force-added for a new engine package so pnpm can resolve its `workspace:^`
dependency on a fresh checkout before the first postinstall build.

Do not hand-edit generated WASM JavaScript, TypeScript declarations, or binary
files. Change Rust sources or the build script, then regenerate the output.

## Tooling and Commands

Run commands from the repository root unless a command explicitly says
otherwise.

### Initial setup

Prerequisites:

- Node.js 18 or newer.
- pnpm 12.14.0, as pinned by the root `packageManager` field.
- Rust via rustup and `wasm-pack` for the sequence editor or any Rust engine.

```bash
pnpm install
```

The root `postinstall` invokes `pnpm run build-wasm`. If pnpm reports
`Already up to date` and does not run lifecycle scripts, force the lifecycle:

```bash
pnpm install --force
```

This behavior matters after changing a lifecycle script without changing the
dependency graph.

### Root scripts

```bash
pnpm build-wasm              # Build every discovered Rust engine to WASM
pnpm start-phylo             # Start phylogeny-viewer demo through its workspace filter
pnpm start-seq               # Start sequence-editor demo through its workspace filter
pnpm update-exports          # Run export-map generation across Lerna packages
pnpm validate                # Run each package's validate script with streaming
pnpm lint                    # Run each package's lint script
pnpm lint-fix                # Auto-fix lint issues package-wide
pnpm check-types             # Type-check packages that expose this script
pnpm test                    # Run packages' test-run scripts
pnpm build                   # Build packages that expose build scripts
pnpm add-missing-translations
pnpm clean                   # Remove Lerna package node_modules and root modules
```

`validate`, `lint`, `check-types`, `test`, and `build` are Lerna fan-out
commands. A package must define the corresponding script to participate
reliably. The root currently has no application runtime or backend server.

### Package-scoped commands

Use pnpm filters to avoid running unrelated packages:

```bash
pnpm --filter @rivm-loculus-tools/phylogeny-viewer-demo start
pnpm --filter @rivm-loculus-tools/phylogeny-viewer lint
pnpm --filter @rivm-loculus-tools/phylogeny-viewer check-types
pnpm --filter @rivm-loculus-tools/phylogeny-viewer build
pnpm --filter @rivm-loculus-tools/phylogeny-viewer preview

pnpm --filter @rivm-loculus-tools/sequence-editor-demo start
pnpm --filter @rivm-loculus-tools/sequence-editor lint
pnpm --filter @rivm-loculus-tools/sequence-editor check-types
pnpm --filter @rivm-loculus-tools/sequence-editor build
```

Both the phylogeny viewer and sequence editor packages define `validate`, `lint`,
and `check-types` scripts (`validate` executes `lint` followed by `check-types`).
Neither frontend package currently defines an automated unit test runner script (`test-run`).

### Rust checks

Run Rust checks from `packages/apps/sequence-editor/engine`:

```bash
cargo test
cargo fmt -- --check
cargo clippy --all-targets --all-features -- -D warnings
```

Use `wasm-pack build --target web --out-dir wasm` there when a focused WASM
rebuild is needed. The root script is preferred when multiple engine packages
must be rebuilt.

## Development Conventions

- Preserve the existing package boundaries. Put shared behavior in an existing
  service, hook, model, utility, or engine layer before introducing a new
  cross-package abstraction.
- Keep browser-only behavior in frontend packages. Keep alignment state and
  mutations in the Rust engine; keep worker protocol concerns in the worker
  bridge; keep rendering concerns in React/canvas components.
- Use the existing React, MUI, Emotion, Zustand, i18next, and Gen-EpiX patterns
  already present in the package being changed.
- Always respect the repository's `.editorconfig`: use UTF-8, LF line endings,
  two-space indentation, spaces rather than tabs, single quotes where the
  language/tooling supports quote configuration, and a final newline.
- Use the package's existing TypeScript configuration and ESLint configuration.
  Do not introduce a second formatter or a new build system for one package.
- Prefer named types and existing models over duplicating object shapes in
  components or services.
- Treat generated WASM output, Vite `dist`, Cargo `target`, and dependency
  directories as build artifacts. Do not make source changes there.
- Keep public package exports synchronized with source entry points. When a
  package uses the generated export workflow, run `pnpm update-exports` from the
  package root as required by `scripts/update-exports.mjs`.
- Keep user-facing translations in the established i18next setup and use the
  existing translation maintenance command when adding keys.

## Change and Validation Workflow

Before editing:

1. Identify the owning package and the nearest code that directly controls the
   behavior.
2. Read the package manifest and nearby README/API documentation.
3. Inspect the applicable ESLint configuration and rules before generating or
  modifying TypeScript/JavaScript code. The phylogeny viewer uses the flat
  config in `packages/apps/phylogeny-viewer/frontend/eslint.config.js`, which
  delegates to `@gen-epix/eslint-config`.
4. Check the working tree and preserve unrelated user changes.

After editing TypeScript/React:

```bash
pnpm --filter <package> lint
pnpm --filter <package> check-types
```

Always try the package's ESLint auto-fix command first when lint errors are
present. For a direct ESLint invocation, use `eslint --fix` with the same file
or source path as the package lint command. Review the result rather than
assuming auto-fix is harmless. If errors remain after auto-fix, fix them with
an LLM-guided code edit while preserving the configured rules; do not suppress
rules or disable checks merely to make the command pass.

For the phylogeny viewer, run the package `validate` script when both checks are
needed. For the sequence editor, run its build and the Rust checks when the
corresponding layer changes.

After editing Rust:

```bash
cargo fmt -- --check
cargo test
cargo clippy --all-targets --all-features -- -D warnings
pnpm run build-wasm
```

When behavior crosses the worker/WASM boundary, validate both the Rust engine
and the consuming frontend. Pay particular attention to request ordering,
buffer ownership, viewport dimensions, and error propagation.

## Important Operational Pitfalls

- A successful no-op `pnpm install` may skip root lifecycle scripts. Use
  `pnpm install --force` when WASM output is missing or stale.
- `wasm-pack` must be installed and its `wasm32-unknown-unknown` target must be
  available through rustup.
- The generated WASM package name is rewritten by the build script. Do not
  rename it manually in generated output.
- The engine expects pre-aligned FASTA input. It does not perform alignment and
  does not force every loaded row to have the same length.
- Sequence-editor viewport ranges are inclusive. The returned byte invariant is
  `bytes.length === rows * cols`; invalid ranges return an empty result.
- Structural sequence edits use full matrix snapshots for undo/redo, while base
  substitutions use compact edit records. Performance changes must preserve
  these semantics unless the engine design documentation is updated too.
- Phylogeny calculations run in the browser and may depend on worker-preloaded
  Biowasm tools. Avoid moving large calculations onto the React render path.
- `mst-viewer` and `record-merger` are not currently implemented packages in
  this checkout, despite their directory names appearing in the repository
  README.

## Agent Customization

This file is the canonical entry point for repository work. Organization of skills,
prompts, scoped instructions, custom agents, and client adapters lives in
`.agents/CUSTOMIZATION.md`.

## Documentation Map

- `README.md`: repository setup, package inventory, prerequisites, and root
  commands.
- `packages/apps/phylogeny-viewer/frontend/README.md`: phylogeny viewer
  features, development, demo data, and deep-link inputs.
- `packages/apps/sequence-editor/README.md`: sequence editor layout, setup, and
  layer architecture.
- `packages/apps/sequence-editor/engine/engine-api.md`: worker-facing frontend
  API and editing rules.
- `packages/apps/sequence-editor/engine/engine.md`: Rust engine internals,
  memory model, viewport behavior, and WASM boundary.
- `scripts/build-wasm.mjs`: authoritative engine discovery and generated package
  build process.
- `scripts/update-exports.mjs`: authoritative source-to-export-map generation.

When this guide conflicts with executable configuration, prefer the manifests,
scripts, and package-local implementation, then update this guide to match.
