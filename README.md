# loculus-tools

A collection of web based tooling to enable curation and ad-hoc analysis through the loculus platform.

This is a pnpm/lerna monorepo. Each tool lives under `packages/<name>` and typically has a `frontend/` folder (the web app), and some also have `engine/` (a Rust crate compiled to WebAssembly) and `engine/wasm/` (the generated WASM package, consumed by `frontend/` as a workspace dependency).

## Packages

- [`mst-viewer`](packages/apps/mst-viewer) — minimum spanning tree viewer.
- [`phylogeny-viewer`](packages/apps/phylogeny-viewer/frontend/README.md) — client-side interactive phylogenetic tree analysis tool.
- [`record-merger`](packages/apps/record-merger) — record merging tool.
- [`sequence-editor`](packages/apps/sequence-editor/README.md) — WebAssembly MSA (Multiple Sequence Alignment) editor.

## Prerequisites

- **Node.js** (18+)
- **pnpm** (pinned via `packageManager` in [package.json](package.json), currently `pnpm@12.3.4`)
- **Rust + wasm-pack**, only required for packages with an `engine/` folder (e.g. `sequence-editor`):
  - Install Rust via [rustup](https://rustup.rs) (not just the Homebrew/OS package). `wasm-pack` needs the `wasm32-unknown-unknown` target, which rustup manages automatically; non-rustup Rust installs require [manual target setup](https://wasm-bindgen.github.io/wasm-pack/book/prerequisites/non-rustup-setups.html).
  - Install `wasm-pack` with `cargo install wasm-pack`.

## Getting Started

```bash
pnpm install
```

This installs all workspace dependencies and, via the root `postinstall` script ([scripts/build-wasm.mjs](scripts/build-wasm.mjs)), scans every `packages/apps/*/engine` folder for a `Cargo.toml` and runs `wasm-pack build` for it, writing the output into `packages/apps/*/engine/wasm`. Those `engine/wasm` folders are consumed as `workspace:*` dependencies by the corresponding `frontend` package.

> **Adding a new engine package:** after the first successful build, force-add the generated `packages/apps/<name>/engine/wasm/package.json` to git (`git add -f`). That folder is otherwise gitignored, but pnpm needs the `package.json` present at checkout time to resolve the `workspace:*` dependency — before `postinstall` has a chance to run the actual build.

> **`postinstall` not running?** If `pnpm install` prints `Already up to date` and finishes almost instantly, it short-circuited and skipped lifecycle scripts entirely (this can happen even after editing a script in `package.json`, since that alone doesn't invalidate pnpm's up-to-date check). Run `pnpm install --force` to force scripts (including `postinstall`) to actually execute.

### SSL installation

Install mkcert: [docs](https://github.com/FiloSottile/mkcert)

Goto your home directory (`~`) and run:

`mkcert -install`

`mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1`

Two files have now been created in your home directory `key.pem` and `cert.pem`. Copy these two files to the cert directory of this project (root directory).

## Common Scripts

Run from the repo root (see [package.json](package.json)):

- `pnpm lint` / `pnpm lint-fix` — lint all packages.
- `pnpm check-types` — type-check all packages.
- `pnpm test` — run tests across all packages.
- `pnpm build` — build all packages.
- `pnpm validate` — lint + type-check.
- `pnpm update-exports` — regenerate package exports maps.
- `pnpm clean` — remove all `node_modules` (via lerna).
- `pnpm start-phylogeny-viewer` — start the phylogeny-viewer dev server.
