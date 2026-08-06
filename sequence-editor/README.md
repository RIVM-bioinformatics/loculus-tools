# Sequence Editor

A Rust-powered WebAssembly MSA (Multiple Sequence Alignment) engine for viral genome alignment editing, optimized for 60 FPS performance with instantaneous mutations.

> **Companion documents**
> - [`engine-api.md`](./engine-api.md) — JavaScript/TypeScript API reference for frontend developers
> - [`engine.md`](./engine.md) — internal implementation details and architecture for Rust developers

## Quick Start

### Prerequisites

- **Rust** (1.70+): [Install Rust](https://www.rust-lang.org/tools/install)
- **Node.js** (18+): [Install Node.js](https://nodejs.org/)
- **wasm-pack**: Install with `cargo install wasm-pack`

### Running the App

1. **Build the WASM module** (from the `sequence-editor/` directory):
   ```bash
   wasm-pack build --target web
   ```
   This compiles the Rust code to WebAssembly and outputs to the `wasm/` folder.

2. **Install web dependencies**:
   ```bash
   cd www
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`.

### Building for Production

```bash
cd www
npm run build
```

The production-ready build will be in `www/dist/`.

## Architecture

The application uses a three-layer architecture:

- **Rust/WASM Engine** (`src/lib.rs`): Manages the alignment matrix in memory, handles all mutations, parses FASTA input, and maintains undo/redo history. For implementation details, see [`engine.md`](./engine.md).
- **Web Worker Bridge** (`www/src/engine/`): Runs the WASM engine off the main thread via `postMessage` to prevent blocking UI interactions. Handles request/response serialization and buffer transfers.
- **React UI** (`www/src/`): High-level UI state management and controls. For the complete JavaScript/TypeScript API, see [`engine-api.md`](./engine-api.md).
- **WebGL Renderer** (experimental): GPU-accelerated rendering of the sequence grid at 60 FPS.

> **For frontend developers:** Start with [`engine-api.md`](./engine-api.md) to learn how to interact with the engine through the `useEngineWorker()` hook.
>
> **For internal developers:** See [`engine.md`](./engine.md) for details on the Rust implementation, data structures, and how the WASM boundary works.
