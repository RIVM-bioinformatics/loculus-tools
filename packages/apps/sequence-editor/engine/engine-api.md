# Engine API — Frontend Developer Guide

This document is written for **frontend developers** who will interact with the
sequence-editor engine **only through JavaScript/TypeScript** — you never need to
look at or touch the Rust code. It describes every function available to you,
what arguments they take, what they return, and how to use them correctly.

> **Companion documents**
>
> - [`engine.md`](./engine.md) — how the engine is implemented internally (Rust).
> - [`README.md`](../README.md) — how to build and run the app.

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
  lastTimingRef: React.MutableRefObject<CallTiming | null>; // sync timing ref

  // Operations
  load: (fasta: string) => Promise<number>;
  viewport: (r: ViewportRequest) => Promise<ViewportResult & { bytes: Uint8Array }>;
  mutate: (rows: number[], col: number, base: string) => Promise<void>;
  insert: (rows: number[], col: number) => Promise<void>;
  delete: (rows: number[], col: number) => Promise<void>;
  deleteColumn: (col: number) => Promise<void>;
  moveHorizontal: (row: number, cols: number[], direction: "Left" | "Right") => Promise<void>;
  moveRows: (rows: number[], options: MoveRowsOptions) => Promise<void>;
  moveRowsRelative: (rows: number[], delta: number) => Promise<void>;
  moveRowsGrouped: (rows: number[], targetRow: number) => Promise<void>;
  moveRowsToTop: (rows: number[]) => Promise<void>;
  moveRowsToBottom: (rows: number[]) => Promise<void>;
  moveRowsUp: (rows: number[]) => Promise<void>;
  moveRowsDown: (rows: number[]) => Promise<void>;
  realign: () => Promise<void>;
  applyAlignedFasta: (fasta: string) => Promise<void>;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  meta: () => Promise<Meta>;
  name: (row: number) => Promise<string>;
  exportGappedFasta: () => Promise<string>;
  exportUngappedFasta: () => Promise<string>;
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

### `lastTimingRef`

Timing information for the most recent completed call (see [section 7](#7-timing--performance)). This is a
synchronous ref — read it immediately after an `await` (useful in benchmark
loops, where React state may not have flushed yet).

> **Note:** There is intentionally no `lastTiming` React state. Updating state
> on every worker response would cause re-render storms during benchmarks,
> inflating latency measurements. Read `lastTimingRef.current` instead.

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
- Sequence bodies accept only IUPAC nucleotides (`ACGTURYSWKMBDHVN`, either
  case) and `-`. Any other character rejects the entire load with an
  `EngineStructuredError` code of `InvalidAlphabet`. Its message and context
  identify the sequence, invalid character, 1-based sequence position, and
  1-based input line. A rejected load preserves the existing data and history.
- Sequence data before the first `>` header rejects with
  `InvalidFastaFormat`.
- The row name is the complete trimmed header after `>`, including any
  description. Validation diagnostics identify the sequence by its first
  whitespace-delimited token.
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
| ------ | ------ | --------- |
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

### `exportGappedFasta(): Promise<string>`

Serializes the full alignment as deterministic, unwrapped gapped FASTA.
Records are emitted in current row order with `\n` line endings. An empty
engine resolves with an empty string.

```ts
const fasta = await engine.exportGappedFasta();
```

### `exportUngappedFasta(): Promise<string>`

Serializes the full alignment as deterministic, unwrapped ungapped FASTA by
stripping all gap characters (`-`) from every sequence. Records are emitted in
current row order with `\n` line endings. An empty engine resolves with an empty
string.

```ts
const ungappedFasta = await engine.exportUngappedFasta();
```

---

## 5. Editing Data

All edit methods are **asynchronous** and resolve once the engine has applied
the change. After an edit, refetch the affected viewport to see the new state.

### 5.0 Editing constraints (the ruleset)

The engine enforces a fixed set of editing constraints. Any edit that violates
one of them is rejected with an error code (see [section 9](#9-error-handling)) and **no rows are modified**
(all-or-nothing). The rules are:

1. **Delete only gaps.** You can only delete a `-` (dash) character. To delete
   an IUPAC character, first `mutate()` it to `-`, then `delete()` it.
2. **Insert only gaps.** You can only insert a `-` character. To insert an
   IUPAC character, first `insert()` a `-`, then `mutate()` it to the desired
   base. The `insert()` method has no `base` parameter.
3. **Mutate only between IUPAC and `-`.** Both the existing character at the
   target position and the new `base` must be an IUPAC nucleotide or `-`.
4. **Move only IUPAC into gaps, horizontally.** You can move IUPAC characters
   into the place of `-` characters, but never `-` into the place of IUPAC
   characters, and only within a single row. A move requires a `-` adjacent to
   the block in the move direction.
5. **Rows may be reordered freely.** `moveRowsUp` / `moveRowsDown` have no
   character-based constraints. Each call moves the specified rows by exactly
   one position.
6. **Subset delete pads targets at the end.** `delete()` only affects the
   specified rows; those rows get a `-` appended at the end to keep width
   unchanged.
7. **Subset insert pads non-targets at the end.** `insert()` only affects the
   specified rows; non-target rows get a `-` appended at the end so every row
   grows by one column and the alignment width increases by 1.
8. **`alignment_width` from the longest sequence.** The alignment width is set
   from the longest loaded sequence.

### `mutate(rows: number[], columns: number[], base: string): Promise<void>`

Changes the base across a target shape defined by a subset of rows and columns. Rows and columns not listed are
untouched.

```ts
await engine.mutate([0, 1], [3], "G"); // set col 3 to 'G' on rows 0 and 1
await engine.mutate([0, 1], [1, 2, 3], "N"); // set cols 1..=3 to 'N' on rows 0 and 1
```

- `rows` — array of row indices to change.
- `columns` — array of column indices to change.
- `base` — a single character (e.g. `"A"`, `"G"`, `"-"`). Only the first
  character's code is used.
- Out-of-range rows/columns are silently skipped.
- The entire operation is recorded as a single transaction in the undo stack.

**Validation (Rule 3, [section 5](#50-editing-constraints-the-ruleset)):** The existing character at each target position must be
an IUPAC nucleotide (`A`, `C`, `G`, `T`, `U`, `R`, `Y`, `S`, `W`, `K`, `M`,
`B`, `D`, `H`, `V`, `N`) or a gap (`-`), **and** the `base` being written must
itself be an IUPAC nucleotide or a gap (`-`). If any target position contains a
character that is neither, or `base` is neither, the promise rejects with error
code `"MutateNotIupac"` and **no rows are modified** (all-or-nothing).

### `insert(rows: number[], col: number): Promise<void>`

Inserts a gap (`-`) at a single column on a **subset** of rows. The inserted
character is always `-` — there is no `base` parameter. Target rows receive the
gap at `col_idx`; **non-target rows have a `-` appended at the end** to keep
matrix width consistent. The alignment width increases by 1.

```ts
await engine.insert([0, 1], 2);
// row 0,1 get '-' at col 2; all other rows get '-' appended at end
```

- `rows` — array of row indices to receive the gap at `col_idx`.
- `col` — the column index where the gap is inserted in target rows.

### `delete(rows: number[], col: number): Promise<void>`

Deletes a column on a **subset** of rows. Only the rows in `rows` are affected:
the character at `col` is removed and a `-` is appended at the end to keep the
row length unchanged. **Non-target rows are completely untouched.**

```ts
await engine.delete([0, 2], 1);
```

**Validation (Rule 1, [section 5](#50-editing-constraints-the-ruleset)):** The character at `col` in every target row must be
gap (`-`). If any target row has a non-`-` character at that position, the
promise rejects with error code `"DeleteNotGap"` and **no rows are modified**
(all-or-nothing). To delete an IUPAC character, first mutate it to `-` via
`mutate()`, then call `delete()`.

### `deleteColumn(col: number): Promise<void>`

Deletes a column from **every** row, shrinking the alignment width by 1. This is
the width-shrinking inverse of a full-column insert.

```ts
await engine.deleteColumn(4);
```

### `moveHorizontal(row: number, cols: number[], direction: "Left" | "Right"): Promise<void>`

Moves a contiguous block of IUPAC characters horizontally by **1 position**
within a single row. Each call moves exactly 1 position; issue multiple calls
for multi-position moves.

```ts
await engine.moveHorizontal(0, [2, 3, 4, 5], "Left");
// Row 0: "A-GCATGC" → "AGCAT-GC"
```

- `row` — the row index to operate on.
- `cols` — column indices forming the block to move. Non-contiguous indices are
  treated as the range `[min, max]`.
- `direction` — `"Left"` or `"Right"`.

**Validation (Rule 4, [section 5](#50-editing-constraints-the-ruleset)):** All characters in the selected block must be IUPAC
nucleotides (not `-`). The adjacent position in the move direction must be a
gap (`-`). If either condition fails, the promise rejects with error code
`"MoveNotIupac"` or `"MoveNoGapTarget"` and **no rows are modified**
(all-or-nothing).

### `moveRows(rows: number[], options: MoveRowsOptions): Promise<void>`

Standardized vertical move command supporting all reordering modes:
- `{ mode: 'relative', delta: number }`: relative in-place shift.
- `{ mode: 'grouped', targetRow: number }`: grouped move to destination index.
- `{ mode: 'top' }`: snap and group to row 0.
- `{ mode: 'bottom' }`: snap and group to the bottom.

### `moveRowsRelative(rows: number[], delta: number): Promise<void>`

Shifts each specified row by `delta` positions (`-` for up, `+` for down). Disjoint rows (e.g. `[1, 3, 8]` with delta `+1` -> `[2, 4, 9]`) preserve their spacing. Contiguous joined blocks (e.g. `[1, 2, 3]` with delta `+1` -> `[2, 3, 4]`) move together as a solid unit. Rows hitting alignment boundaries remain pinned while other unconstrained rows continue shifting.

### `moveRowsUp(rows: number[]): Promise<void>`

Convenience method calling `moveRowsRelative(rows, -1)`.

### `moveRowsDown(rows: number[]): Promise<void>`

Convenience method calling `moveRowsRelative(rows, 1)`.

### `moveRowsGrouped(rows: number[], targetRow: number): Promise<void>`

Moves the specified rows and groups them into a contiguous block starting at `targetRow`. The selected rows preserve their relative order within the group; surrounding unselected rows shift cleanly around the group.

```ts
await engine.moveRowsGrouped([4, 5, 10], 6); // rows 4, 5, 10 move to 6, 7, 8
```

### `moveRowsToTop(rows: number[]): Promise<void>`

Snaps the specified rows to the top (index `0`) as a contiguous group, preserving their relative internal order.

```ts
await engine.moveRowsToTop([2, 4]); // rows 2 and 4 become rows 0 and 1
```

### `moveRowsToBottom(rows: number[]): Promise<void>`

Snaps the specified rows to the bottom as a contiguous group, preserving their relative internal order.

```ts
await engine.moveRowsToBottom([1, 3]); // rows 1 and 3 become the last rows
```

### `realign(): Promise<void>`

Re-aligns all loaded sequences in the matrix using MAFFT's fast progressive alignment (`AlignmentMode::FftNs2` with `ScoringModel::Dna` and `with_retree(1)` for FFT-NS-1). Gaps are recalculated and aligned sequences update the matrix width to the longest aligned sequence.

```ts
await engine.realign();
```

- Safe no-op if fewer than 2 sequences are loaded.
- Requires every sequence to contain at least one non-gap IUPAC nucleotide residue. Rejects with an `EngineStructuredError` code of `EmptySequence` without mutating the matrix or recording an undo snapshot if any sequence has no residues.
- Captures a structural undo snapshot so that the entire re-alignment can be reversed with `undo()` and re-applied with `redo()`.
- Invalidates the amino-acid translation cache.

### `applyAlignedFasta(fasta: string): Promise<void>`

Applies an externally aligned FASTA (e.g. calculated off-thread in an `AlignerWorker`) to the engine matrix.

```ts
await engine.applyAlignedFasta(alignedFasta);
```

- Validates that the number of sequences in the aligned FASTA matches the matrix.
- Captures a structural undo snapshot so that the entire re-alignment can be reversed with `undo()` and re-applied with `redo()`.
- Updates `alignment_width` and matrix sequences, invalidating the amino-acid translation cache.

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

Every call reports timing information you can read from `lastTimingRef`. This is
useful for benchmarking and for understanding where time goes.

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

> **Note:** `lastTimingRef` is a synchronous ref (not React state). The hook
> intentionally avoids updating React state on every response to prevent
> re-render storms during benchmarks. Read `lastTimingRef.current` synchronously
> after an `await` instead.

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
    await engine.mutate([0, 1], [3], "G");
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

### Error codes

Engine methods that fail validation reject with an `EngineStructuredError`.
It carries a stable `.code`, readable `.message`, and optional `.context` with
offending coordinates, base, movement direction, reading frame, or FASTA
diagnostics:

```ts
import { EngineStructuredError } from "./engine/useEngineWorker";

try {
  await engine.delete([0], 3); // col 3 is 'A', not '-'
} catch (err: unknown) {
  if (err instanceof EngineStructuredError && err.code === "DeleteNotGap") {
    console.log(err.message, err.context?.row, err.context?.col, err.context?.base);
    showToast("Mutate the character to '-' first, then delete.");
  }
}
```

`EngineErrorCode` covers all the stable codes below; `EditErrorCode` is its
edit-only subset. Transport and initialization failures remain worker errors.

FASTA load errors use `InvalidAlphabet`. The context's `invalidCharacters`
array contains every invalid character across all records, with its `sequenceId`,
`position`, `line`, and `invalidChar`; `byte` is present for ASCII characters.
The other FASTA context fields mirror the first occurrence for convenience.
`InvalidFastaFormat` includes the offending `line`.

```ts
try {
  await engine.load(">seq1\nACGTZ");
} catch (err: unknown) {
  if (err instanceof EngineStructuredError && err.code === "InvalidAlphabet") {
    console.error(err.message, err.context?.invalidCharacters);
  }
}
```

| Error code | Triggered by | Meaning |
| ------------ | ------------- | --------- |
| `"DeleteNotGap"` | `delete()` | Attempted to delete a non-`-` character. Mutate it to `-` first. |
| `"MutateNotIupac"` | `mutate()` | Attempted to mutate a character that is not IUPAC or `-`, or to write a base that is not IUPAC or `-`. |
| `"MoveNotIupac"` | `moveHorizontal()` | Attempted to move a block containing non-IUPAC characters. |
| `"MoveNoGapTarget"` | `moveHorizontal()` | No gap adjacent to the block in the move direction. |
| `"InvalidAlphabet"` | `load()` | A sequence contains a character outside IUPAC nucleotides and `-`; the rejected load is atomic. |
| `"InvalidFastaFormat"` | `load()` | Sequence data appears before the first FASTA header. |
| `"InvalidReadingFrame"` | `translate()` | Reading frame is not 0, 1, or 2; context includes `frame`. |
| `"InvalidViewport"` | `viewport()`, `translate()` | Bounds are invalid or the requested/resulting slice exceeds the shared buffer capacity; context includes `row` and `col` (and `frame` for translation). |
| `"UnexpectedRuntimeError"` | Worker request handling | An unrecognized engine or runtime exception occurred; the message describes the failure. |

---

## 10. Quick Reference

| Method | Arguments | Returns | Purpose |
| -------- | ----------- | --------- | --------- |
| `load` | `fasta: string` | `Promise<number>` | Parse FASTA; returns sequence count |
| `meta` | — | `Promise<Meta>` | Alignment metadata (rows, width, undo/redo depth) |
| `name` | `row: number` | `Promise<string>` | Row name |
| `exportGappedFasta` | — | `Promise<string>` | Export full alignment as gapped FASTA |
| `exportUngappedFasta` | — | `Promise<string>` | Export full alignment as ungapped FASTA |
| `viewport` | `{startRow, endRow, startCol, endCol}` | `Promise<ViewportResult & {bytes}>` | Fetch a windowed slice |
| `mutate` | `rows: number[], col, base: string` | `Promise<void>` | Change bases on a subset of rows (validates existing char and new base are IUPAC or `-`) |
| `insert` | `rows: number[], col` | `Promise<void>` | Insert a `-` at col on target rows; append `-` on non-targets |
| `delete` | `rows: number[], col` | `Promise<void>` | Delete a column on a subset (validates target is `-`; non-targets untouched) |
| `deleteColumn` | `col: number` | `Promise<void>` | Delete a column from all rows |
| `moveHorizontal` | `row, cols: number[], direction` | `Promise<void>` | Move IUPAC block 1 position left/right within a row |
| `moveRowsUp` | `rows: number[]` | `Promise<void>` | Move specified rows up by 1 |
| `moveRowsDown` | `rows: number[]` | `Promise<void>` | Move specified rows down by 1 |
| `realign` | — | `Promise<void>` | Re-align all sequences using MAFFT FFT-NS-1 |
| `applyAlignedFasta` | `fasta: string` | `Promise<void>` | Apply aligned FASTA with structural undo snapshot |
| `undo` | — | `Promise<boolean>` | Undo last edit |
| `redo` | — | `Promise<boolean>` | Redo last undone edit |

---

## 11. Roadmap & Future Work

The following features are planned and will extend the `EngineClient` API. They
are not yet implemented.

### Amino-acid translation

A button will toggle the view between nucleotides and amino acids, with a
choice of reading frame (1, 2, or 3). The engine will translate nucleotides to
amino acids **on the fly for the visible viewport only**, keeping nucleotides
as the single source of truth. Expected API additions:

- `setRenderMode(mode)` / `setReadingFrame(frame)` — switch between nucleotide
  and amino-acid display, and select the frame.
- `getDisplayWidth()` — report the display width (≈1/3 of the nucleotide width
  in amino-acid mode) so the frontend can resize scroll areas.
- The viewport bytes will be translated amino acids when in amino-acid mode.

### Sequence search

A search box will let users find a nucleotide sequence (or, in amino-acid mode,
a peptide motif) across all loaded data. Search runs entirely in Rust against
the full matrix; the frontend never holds the whole dataset. Expected API
additions:

- `executeSearch(query)` — run the search and return the number of hits.
- `getAllHitCoordinates()` — return the flattened hit coordinates.
- `jumpNext()` / `jumpPrev()` — navigate between hits; the engine returns the
  coordinates to scroll to.
- `getCurrentHitIndex()` — report the active hit (for a "Match 3 of 42" UI).

Search will support exact matching and gap-insensitive matching (for primers
and motifs that may be split by alignment gaps), and will switch to peptide
search when amino-acid mode is active.
