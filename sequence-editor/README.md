# Sequence Editor

A Rust-powered WebAssembly MSA (Multiple Sequence Alignment) engine for viral genome alignment editing, optimized for 60 FPS performance with instantaneous mutations.

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

- **Rust/WASM (Referred to as Engine)**: Manages the alignment matrix and handles all mutations and parsing
- **Web Worker (Referred to as Bridge)**: Runs the WASM engine off the main thread via `postMessage`
- **React UI**: High-level UI state management and controls
- **WebGL (still experimental, actually renderer of data fetched from the engine)**: GPU-accelerated rendering of the sequence grid at 60 FPS
- Note; the testHarnass interface is not intended to be used in production, it's only for testing interactions between the engine and a react UI. This uses Canvas to render the sequence grid. The sliding viewport test is closer to the intended product (but doesn't support interactions yet).
