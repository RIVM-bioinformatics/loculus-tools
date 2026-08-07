# Engine API — Frontend Developer Guide

This document is written for **frontend developers** who will interact with the
sequence-editor engine **only through JavaScript/TypeScript** — you never need to
look at or touch the Rust code. It describes every function available to you,
what arguments they take, what they return, and how to use them correctly.

> **Companion documents**
> - [`engine.md`](./engine.md) — how the engine is implemented internally (Rust).
> - [`README.md`](./README.md) — how to build and run the app.

---

## 1. How You Talk to the Engine

You never call the Rust/WASM functions directly. The engine lives inside a
**Web Worker** (so parsing, mutations, and undo never block the UI thread), and
you interact with it through a single React hook:

```ts
import { useEngineWorker } from "./engine/useEngineWorker";

function MyComponent() {
  const engine = useEngineWorker();
  // engine.load(...), engine.viewport(...), engine.mutate(...), ...
}
```

The hook returns an `EngineClient` object. Every method is **asynchronous** and
returns a `Promise`. The hook handles all the `postMessage` plumbing, request
correlation, and error propagation for you — you just `await` the calls.

### The `EngineClient` shape

```ts
interface EngineClient {
  // State
  ready: boolean;                 // true once the WASM engine is initialized
  error: string | null;           // last error surfaced by the worker
  lastTiming: CallTiming | null;  // timing of the most recent call (state)
  lastTimingRef: React.MutableRefObject<CallTiming | null>; // sync timing ref

  // Operations
  load: (fasta: string) => Promise<number>;
  viewport: (r: ViewportRequest) => Promise<ViewportResult & { bytes: Uint8Array }>;
  mutate: (rows: number[], col: number, base: string) => Promise<void>;
  insert: (rows: number[], col: number, base: string) => Promise<void>;
  delete: (rows: number[], col: number) => Promise<void>;
  deleteColumn: (col: number) => Promise<void>;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  meta: () => Promise<Meta>;
  name: (row: number) => Promise<string>;
}
```

> **Important:** Call `useEngineWorker()` **once** and pass the returned object
> down as a prop. Calling the hook multiple times spawns multiple independent
> workers, each with its own (empty) engine — data loaded in one will not be
> visible in another.

---

## 2. Lifecycle & State

### `ready: boolean`

`false` initially. Flips to `true` once the worker has instantiated the WASM
module and constructed the engine. The worker self-initializes on startup, so
`ready` becomes `true` shortly after the hook mounts — you do **not** need to
send a command to trigger it.

```ts
if (!engine.ready) {
  return <div>Loading engine…</div>;
}
```

### `error: string | null`

Set to the last error message surfaced by the worker (e.g. a WASM init failure
or a worker crash). `null` when there is no error.

### `lastTiming` / `lastTimingRef`

Timing information for the most recent completed call (see §7). `lastTiming` is
React state; `lastTimingRef` is a synchronous ref you can read immediately after
an `await` (useful in benchmark loops, where React state may not have flushed
yet).

---

## 3. Loading Data

### `load(fasta: string): Promise<number>`

Parses FASTA content into the engine and returns the **number of sequences**
loaded.

```ts
const count = await engine.load(">seq1\nATGCATGC\n>seq2\nATGGTG-A");
console.log(count); // 2
```

**Behavior to know:**

- Calling `load` **replaces** all previous data and clears the undo/redo history.
- Sequence bytes are uppercased; internal whitespace is skipped; sequences may
  span multiple lines.
- The row name is the first whitespace-delimited token after the `>` header.
- The input is expected to be **pre-aligned**. The engine does not enforce
  uniform row length — use `meta()` and `name()` to inspect the result.

---

## 4. Reading Data

### `meta(): Promise<Meta>`

Returns overall alignment metadata:

```ts
interface Meta {
  sequences: number;  // number of loaded sequences (rows)
  width: number;      // global alignment width (columns)
  undoDepth: number;  // commands currently on the undo stack
  redoDepth: number;  // commands currently on the redo stack
}
```

Use this to size scroll areas, enable/disable Undo/Redo buttons, etc.

### `name(row: number): Promise<string>`

Returns the name/identifier of a given row, or `""` if the row index is out of
range.

```ts
const name = await engine.name(0); // e.g. "seq1"
```

### `viewport(r): Promise<ViewportResult & { bytes: Uint8Array }>`

Fetches a windowed slice of the alignment. This is the **primary read path** for
rendering — you never fetch the whole matrix, only the visible window.

```ts
interface ViewportRequest {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

interface ViewportResult {
  rows: number;      // rows actually present in `bytes`
  cols: number;      // columns per row
  startRow: number;  // row index of the first row in the slice
  startCol: number;  // column index of the first column in the slice
  bytes: Uint8Array; // the raw slice data (row-major)
}
```

**Slice semantics:**

- Rows `[startRow, endRow]` and columns `[startCol, endCol]` are **inclusive**.
- Every row contributes exactly `cols` bytes, so you can index
  `bytes[row * cols + col]` directly.
- Columns beyond the end of a sequence are padded with **space** (`0x20`).
- Invalid ranges are safe: if `startRow > endRow` or `startCol > endCol`, the
  returned `bytes` is empty (`cols` will be `0` for invalid column ranges).
- **Important:** `rows` must be derived from the actual returned data, not from
  the request. When column range is invalid (`startCol > endCol`), `cols` is `0`
  and `bytes.length === 0`, so `rows === 0`. Always enforce the invariant
  `bytes.length === rows * cols`.
- The returned `bytes` is a **standalone copy** — you own it and it will not be
  overwritten by later calls.

**Interpreting the bytes:** each byte is an ASCII character code. Common values:

| Byte | Char | Meaning |
|------|------|---------|
| `0x41` | `A` | Adenine |
| `0x43` | `C` | Cytosine |
| `0x47` | `G` | Guanine |
| `0x54` | `T` | Thymine |
| `0x2D` | `-` | Gap |
| `0x20` | ` ` | Padding (beyond sequence end) |

```ts
const { bytes, rows, cols } = await engine.viewport({
  startRow: 0, endRow: 2, startCol: 0, endCol: 7,
});
// bytes.length === rows * cols
const baseAt = (row: number, col: number) =>
  String.fromCharCode(bytes[row * cols + col]);
```

---

## 5. Editing Data

All edit methods are **asynchronous** and resolve once the engine has applied
the change. After an edit, refetch the affected viewport to see the new state.

### `mutate(rows: number[], col: number, base: string): Promise<void>`

Changes the base at a single column on a **subset** of rows. Rows not listed are
untouched.

```ts
await engine.mutate([0, 1], 3, "G"); // set col 3 to 'G' on rows 0 and 1
```

- `rows` — array of row indices to change.
- `col` — the column index.
- `base` — a single character (e.g. `"A"`, `"G"`, `"-"`). Only the first
  character's code is used.
- Out-of-range rows/columns are silently skipped.

### `insert(rows: number[], col: number, base: string): Promise<void>`

Inserts a base at a single column across **all** rows. Target rows receive
`base`; **non-target rows receive a gap (`-`)** to preserve alignment. The
alignment width increases by 1.

```ts
await engine.insert([0, 1], 2, "A");
// row 0,1 get 'A' at col 2; all other rows get '-' at col 2
```

### `delete(rows: number[], col: number): Promise<void>`

Deletes a column on a **subset** of rows. Target rows have the column removed;
**non-target rows have it replaced with a gap (`-`)**. The global width is left
unchanged (the matrix may become ragged).

```ts
await engine.delete([0, 2], 1);
```

### `deleteColumn(col: number): Promise<void>`

Deletes a column from **every** row, shrinking the alignment width by 1. This is
the width-shrinking inverse of a full-column insert.

```ts
await engine.deleteColumn(4);
```

---

## 6. Undo / Redo

### `undo(): Promise<boolean>`

Reverses the most recent edit. Returns `true` if an undo was applied, `false` if
the undo stack is empty.

```ts
const didUndo = await engine.undo();
```

### `redo(): Promise<boolean>`

Re-applies the most recently undone edit. Returns `true` if a redo was applied,
`false` if the redo stack is empty.

```ts
const didRedo = await engine.redo();
```

**Behavior to know:**

- A new edit after an undo **clears the redo stack** (the redo branch is
  invalidated).
- Use `meta().undoDepth` / `meta().redoDepth` to enable/disable buttons.

---

## 7. Timing & Performance

Every call reports timing information you can read from `lastTimingRef` (or
`lastTiming`). This is useful for benchmarking and for understanding where time
goes.

```ts
interface CallTiming {
  totalMs: number;      // call → response received (main thread)
  engineMs: number;     // time inside the Rust engine call (worker-reported)
  workerMs: number;     // total time the worker held the request
  bridgeOutMs: number;  // estimated main→worker postMessage latency
  bridgeBackMs: number; // estimated worker→main postMessage latency
  bytes: number;        // bytes transferred (viewport), else 0
}
```

```ts
await engine.viewport({ startRow: 0, endRow: 2, startCol: 0, endCol: 11 });
const t = engine.lastTimingRef.current;
console.log(`engine took ${t?.engineMs}ms`);
```

> **Note:** `lastTiming` (React state) is intentionally **not** updated on every
> response to avoid re-render storms during benchmarks. Read `lastTimingRef`
> synchronously after an `await` instead.

---

## 8. Typical Usage Flow

```tsx
function AlignmentView() {
  const engine = useEngineWorker();

  useEffect(() => {
    (async () => {
      await engine.load(SAMPLE_FASTA);
      const m = await engine.meta();
      setDimensions({ rows: m.sequences, cols: m.width });
    })();
  }, [engine]);

  async function refreshSlice() {
    const { bytes, rows, cols } = await engine.viewport({
      startRow: 0, endRow: 2, startCol: 0, endCol: 11,
    });
    setSlice({ bytes, rows, cols });
  }

  async function onEdit() {
    await engine.mutate([0, 1], 3, "G");
    await refreshSlice(); // refetch to see the change
  }

  // ...render...
}
```

---

## 9. Error Handling

All methods return promises that **reject** on failure. Wrap calls in
`try/catch` (or use `.catch`) to surface errors to the user:

```ts
try {
  await engine.load(badFasta);
} catch (err) {
  setError(String(err));
}
```

The `error` field on the client also reflects the last worker error.

---

## 10. Quick Reference

| Method | Arguments | Returns | Purpose |
|--------|-----------|---------|---------|
| `load` | `fasta: string` | `Promise<number>` | Parse FASTA; returns sequence count |
| `meta` | — | `Promise<Meta>` | Alignment metadata (rows, width, undo/redo depth) |
| `name` | `row: number` | `Promise<string>` | Row name |
| `viewport` | `{startRow, endRow, startCol, endCol}` | `Promise<ViewportResult & {bytes}>` | Fetch a windowed slice |
| `mutate` | `rows: number[], col, base: string` | `Promise<void>` | Change bases on a subset of rows |
| `insert` | `rows: number[], col, base: string` | `Promise<void>` | Insert a base (gaps on non-targets) |
| `delete` | `rows: number[], col` | `Promise<void>` | Delete a column on a subset (gaps on non-targets) |
| `deleteColumn` | `col: number` | `Promise<void>` | Delete a column from all rows |
| `undo` | — | `Promise<boolean>` | Undo last edit |
| `redo` | — | `Promise<boolean>` | Redo last undone edit |
