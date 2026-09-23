# The Sequence-Editor Engine

This document describes the **Rust/WASM MSA engine**, which can also be seen as the "brain" of the sequence
editor.  
Here, it is described what the engine is, how it is implemented, how it is exposed
to JavaScript, and how it fits into the wider architecture.

> [!NOTE]
> **Scope:** This document covers the engine itself (`src/lib.rs`) and its
> WASM boundary. The Web Worker bridge, the React UI, and the Canvas renderer are
> separate layers that *consume* the engine; they are referenced here only where
> they shape the engine's API.
>
> **For frontend developers:** If you only ever interact with the engine through
> JavaScript (never the Rust source), see the companion document
> [`engine-api.md`](./engine-api.md), which describes every WASM-exposed function
> from a pure JavaScript point of view.

---

## 1. What the Engine Is

The engine is a Rust crate (`sequence-editor`) compiled to WebAssembly via
`wasm-bindgen`. It is the single source of truth for the alignment data:

- It **owns** the entire alignment matrix in memory.
- It **parses** FASTA input into that matrix.
- It **mutates** the matrix (substitutions, insertions, deletions).
- It **maintains** transactional undo/redo history.
- It **extracts** windowed viewport slices for rendering.

Everything else in the system (the Web Worker, the React shell, the Canvas
renderer), is a consumer of the engine. The engine never touches the DOM, never renders, and never talks to the network.  
It is purely a synchronous in-memory data engine.

### Design goals

- **Performance:** Optimized for viral genomes (up to ~80 sequences × 200K base pairs, ~16MB raw matrix) with instant mutations and non-blocking rendering.
- **Zero-allocation scrolling:** A single reusable viewport buffer avoids
  per-scroll allocations.
- **Windowed access:** The frontend never has to deal with the whole matrix; it always works with a bounded slice to reduce memory usage and improve performance.
- **Simple, correct history:** Undo/redo via cheap per-edit records for
  substitutions and full-matrix snapshots for structural edits.

> [!NOTE]
> **If the intended usecase is ~16MB, why go through all this effort to make a separate engine instead of doing everything in the React app?**
>
> It's a fair question — at ~16MB the data trivially fits in memory, so why add a
> Rust/WASM layer and a Web Worker at all? The short answer is that the 16MB footprint only makes the *memory* trivial; it says nothing about the harder problems of *who owns the data*, *how edits stay consistent and atomic*, *how the UI stays responsive*, and *how the logic is verified*. The separate engine addresses these concerns. Concretely:
> 
> 1. **Separation of concerns & testability:** Keeping the business logic
>   (parsing, matrix layout, mutation logic, history) in a pure Rust crate
>   decoupled from the UI makes it testable in isolation (see
>   [section 7.1](#71-from-rust-native-tests)).
> 2. **Previous lessons:** In an earlier PoC of this project we implemented 
>   the same editing logic *inside* the React app, and it quickly became 
>   completely unmaintainable (by hand at least). 
> 3. **A single source of truth for the alignment.** The sequence information,
>   and all its derived information (e.g. `alignment_width`), lives in only 
>   one place: the engine. The React side can now only be concerned with 
>   the questions *how to render?* and *how to pass on interactions?*.
> 4. **Windowed access keeps the frontend cheap.** Because the engine owns the
>   full matrix and only hands out bounded viewport slices, the entire React
>   layer operates on O(visible cells) data. This is what makes the
>   sliding-window Canvas renderer viable and keeps scrolling smooth no matter
>   the size of the alignment (with some limits of course).
> 5. **The Web Worker model keeps the UI thread responsive.** All parsing, structural
>   edits, undo/redo snapshots, and (future) search run synchronously in the
>   worker, off the main thread, so a large FASTA parse or a structural insert
>   across 80 sequences never drops a frame on the UI thread. Doing this in
>   React would block rendering for a noticeable period.
> 7. **Future features require speed.** Features that are not yet implemented, 
>   such as live 3-frame nucleotide→amino-acid translation, and especially searching 
>   the sequences for exact (multiple) matches of user-input are computationally expensive.
>   These actions gain massively from compiled language implementation and the ability to
>   run off the main thread.

---

## 2. Where It Lives

```
sequence-editor/
├── Cargo.toml          # crate manifest (note: capital C)
├── src/
│   └── lib.rs          # the entire engine (MsaEngine + UndoCommand + tests)
├── www/                # Vite + React + MUI test harness (consumer)
│   ├── src/engine/     # worker bridge + RPC hook + protocol types
│   └── wasm/           # wasm-pack build output
└── target/             # cargo build artifacts
```

The engine is a single-file crate: all logic lives in `src/lib.rs`. The crate
is configured in `Cargo.toml` as:

```toml
[lib]
crate-type = ["cdylib", "rlib"]   # cdylib → .wasm; rlib → native tests

[dependencies]
wasm-bindgen = "0.2.125"
js-sys = "0.3.77"                 # requires 0.3.x; "0.2" resolves to an ancient broken version

[dependencies.serde]
version = "1.0"
features = ["derive"]

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
```

> **Note:** `js-sys` requires `0.3.x` (any `0.3` release). Using
> `js-sys = "0.2"` resolves to an ancient `0.2.7` that will not compile against
> modern `wasm-bindgen`.

---

## 3. Core Data Structures

### 3.1 `MsaEngine`

The engine is a single `#[wasm_bindgen]` struct that owns all state:

```rust
#[wasm_bindgen]
pub struct MsaEngine {
    sequences: Vec<Vec<u8>>,   // the alignment matrix, row-major
    names: Vec<String>,        // one row identifier per sequence
    alignment_width: usize,    // global column count
    viewport_buffer: Vec<u8>,  // reusable slice buffer
    undo_stack: Vec<UndoCommand>,
    redo_stack: Vec<UndoCommand>,
}
```

| Field | Purpose |
|-------|---------|
| `sequences` | The matrix. Each inner `Vec<u8>` is one sequence of ASCII bytes (`b'A'`, `b'-'`, ...). |
| `names` | Row identifiers, parallel to `sequences`. |
| `alignment_width` | The global number of columns. Set from the longest sequence at load time. |
| `viewport_buffer` | A single reusable buffer for viewport extraction, pre-allocated to ~5000 bytes and grown on demand. |
| `undo_stack` / `redo_stack` | Transactional edit history. |

### 3.2 `UndoCommand`

History is stored as an enum with two variants, chosen primarily for simplicity:

```rust
#[derive(Clone)]
enum UndoCommand {
    /// Cheap character changes: store exactly what changed and where.
    Substitutions {
        col_idx: usize,
        mutated_rows: Vec<usize>,
        old_bases: Vec<u8>,
    },
    /// Structural inserts/deletes: a lightweight clone of the full matrix.
    StructuralSnapshot {
        matrix_snapshot: Vec<Vec<u8>>,
        names_snapshot: Vec<String>,
        width_snapshot: usize,
    },
}
```

- **`Substitutions`**  
  used for base changes.  It records only the column, the
  affected rows, and the previous bases in parallel vectors (same index = same cell). This is O(changed cells), so a single base edit costs almost nothing.
- **`StructuralSnapshot`**  
  used for insertions/deletions that change row lengths, and for horizontal moves and row reorders.  
  It stores a full clone of the matrix, the names vector, and the width. This is O(matrix) but is cheap in practice given the ~16MB ceiling, and it keeps the logic trivially correct.

> **Design note:** The full-matrix snapshot approach is a deliberate trade-off.
> It is simple and fast enough for the expected ~16MB footprint, but it would
> need revisiting if the engine ever needs to support much larger alignments.

---

## 4. The WASM Boundary API

All public methods are exposed to JavaScript via `wasm-bindgen`. The engine
returns `js_sys::Uint8Array` (or writes into caller-provided buffers) rather
than raw `*const u8` pointers, because the engine lives inside a Web Worker and
raw pointers are only meaningful within that worker's WASM linear memory.

### 4.1 Lifecycle

| Method | Signature (JS-facing) | Description |
|--------|----------------------|-------------|
| `new()` | `new MsaEngine()` | Construct an empty engine. |

### 4.2 Loading

| Method | Signature | Description |
|--------|-----------|-------------|
| `load_fasta` | `load_fasta(fasta: string): number` | Parse FASTA content, populate the matrix, return the number of sequences loaded. |

`load_fasta` behavior:

- Clears all previous state (sequences, names, width, undo/redo stacks).
- Scans line by line. A line starting with `>` begins a new record; the first
  whitespace-delimited token after `>` becomes the row name (common FASTA
  convention).
- Sequence lines are appended as **uppercased** ASCII bytes; internal whitespace
  is skipped. Sequences may span multiple lines.
- The **longest** sequence sets `alignment_width` (not the first). Subsequent
  sequences are loaded as-is even if they differ in length — the engine does
  **not** enforce uniform length. The caller can detect ragged alignments via
  `get_row_length`.
- Blank lines are ignored.
- Returns the number of sequences parsed.

> **Assumption:** The input is expected to be *pre-aligned* (as provided by
> Loculus). The engine does not perform alignment itself.

### 4.3 Viewport Extraction

| Method | Signature | Description |
|--------|-----------|-------------|
| `update_viewport` | `update_viewport(startRow, endRow, startCol, endCol): Uint8Array` | Extract a windowed slice into the reusable buffer and return it as a `Uint8Array`. |
| `update_viewport_into` | `update_viewport_into(startRow, endRow, startCol, endCol, out: Uint8Array): number` | Write the slice directly into a caller-provided buffer (e.g. a `SharedArrayBuffer` view). Returns bytes written. |
| `get_viewport_len` | `get_viewport_len(): number` | Bytes currently held in the viewport buffer. |

**Slice semantics** (both methods):

- Rows `[start_row, end_row]` **inclusive**; columns `[start_col, end_col]`
  **inclusive**.
- Row indices are clamped to the number of loaded sequences.
- Every row always contributes exactly `(end_col - start_col + 1)` bytes — a
  **fixed stride**. Columns beyond the end of a sequence are padded with
  `b' '` (space). This keeps the buffer strictly row-major so callers can index
  `bytes[r * cols + c]` without inspecting per-row lengths.
- If the engine is empty, `start_row > clamped_end_row`, or
  `start_col > end_col`, an empty result is returned (`update_viewport` returns
  0 bytes; `update_viewport_into` returns 0 written bytes).

**`update_viewport` vs `update_viewport_into`:**

- `update_viewport` returns a fresh `Uint8Array` copy of the internal buffer.
  The worker can then transfer that buffer across `postMessage`.
- `update_viewport_into` writes into a caller-owned buffer and returns the byte
  count. It is the **zero-copy-across-boundary** path: the worker passes a
  `Uint8Array` view backed by a `SharedArrayBuffer` that the main thread also
  holds, and the engine writes into it via a single `memcpy` per row. The main
  thread reads the same memory directly — no `postMessage` transfer, no
  structured clone, no extra `ArrayBuffer.slice`.
- `update_viewport_into` stops early if the buffer is too small to fit a full
  row, and returns the number of complete rows written.

> **Critical gotcha:** Do **not** use `update_viewport_into` with a large
> `SharedArrayBuffer` view. `wasm-bindgen` marshals `&mut [u8]` by copying the
> **entire** JS `Uint8Array` into WASM linear memory and back out. For a 16MB
> SAB view this adds ~3ms per call. The recommended zero-copy path is
> `update_viewport` (returns a zero-copy view into WASM memory) followed by a
> single `sabView.set(view, 0)` memcpy on the worker side.

### 4.4 Metadata Getters

| Method | Signature | Description |
|--------|-----------|-------------|
| `get_sequence_count` | `(): number` | Number of loaded sequences. |
| `get_alignment_width` | `(): number` | Global column count (0 if empty). |
| `get_name` | `(row: number): string` | Row name, or `""` if out of range. |
| `get_base` | `(row: number, col: number): number` | Raw byte at `(row, col)`, or `0` if out of range. Useful for spot-checking cells. |
| `get_row_length` | `(row: number): number` | Length of a specific row, or `0` if invalid. Useful for detecting ragged alignments. |
| `undo_depth` | `(): number` | Number of commands on the undo stack. |
| `redo_depth` | `(): number` | Number of commands on the redo stack. |

---

## 5. The Mutation Core

All mutation methods run **synchronously** on the worker thread. Each one
records an `UndoCommand` onto `undo_stack` *before* mutating, and clears the
`redo_stack` (a new edit invalidates the redo branch). The main thread only
sends a command and awaits an acknowledgment.

### 5.0 Editing constraints (the ruleset)

The mutation core is governed by a fixed set of editing constraints. These
constraints define exactly which combinations of actions are allowed and which
are rejected. Every mutation method below enforces them and returns a typed
`EditError` (see [section 5.7](#57-edit-errors)) when a constraint is violated, leaving the matrix **unchanged**
(all-or-nothing).

1. **Delete only gaps.** It is only possible to delete an item in the matrix if
   that item is the `-` (dash) character. Deleting any other character is not
   allowed.
   - To delete an IUPAC character, a user must first mutate it to `-`, then
     delete it.
   - Attempting to delete a non-`-` character is rejected with
    `EditError::DeleteNotGap` and the mutation is not applied.
2. **Insert only gaps.** It is only possible to insert a `-` (dash) character
   into the matrix. Inserting any other character is not allowed.
   - To insert an IUPAC character, a user must first insert a `-`, then mutate
     it to the desired IUPAC character.
   - The insert API has no `base` parameter — only `-` can ever be inserted.
3. **Mutate only between IUPAC and `-`.** It is only possible to mutate an
   IUPAC character to another IUPAC character or to `-`. Mutating any other
   character is not allowed.
   - Both the existing character at the target position **and** the new base
     must be IUPAC or `-`.
   - Attempting to mutate a character that is not IUPAC or `-` (either as the
     source or the destination) is rejected with `EditError::MutateNotIupac` and the
     mutation is not applied.
4. **Move only IUPAC into gaps, horizontally.** Moving a character within the
   matrix is allowed, but only IUPAC characters may be moved into the place of
   `-` characters.
   - A user cannot move `-` characters into the place of an IUPAC character.
   - A user *can* move IUPAC characters into the place of `-` characters (this
     shifts the `-` character).
   - Moving may only happen horizontally (within one row); vertical movement
     between rows is not allowed.
   - If there are no `-` characters in the row to accommodate the move, the
     action is rejected with `EditError::MoveNoGapTarget` and the move is not
     applied. If the selected block contains a non-IUPAC character, the action
     is rejected with `EditError::MoveNotIupac`.
5. **Rows may be reordered freely.** It is possible to reorder the rows in the
   matrix regardless of the characters present in those rows. Reordering has no
   character-based constraints.
   - The engine exposes `move_rows_up` / `move_rows_down` (a move-up/move-down
     direction parameter).
   - Multiple rows may be moved at the same time.
   - A move-up or move-down command applies a single move of one position for
     the specified rows. To move a row multiple positions, issue multiple
     commands.
6. **Subset delete pads targets at the end.** `delete_at_subset` applies only
   to the specified rows (in conjunction with rule 1). To keep matrix width
   unchanged, the rows that were the target of the delete have a `-` appended
   at the very end of the row.
7. **Subset insert pads non-targets at the end.** `insert_at_subset` applies
   only to the specified rows (in conjunction with rule 2). Target rows receive
   the `-` at the specified column index; non-target rows have a `-` appended
   at the very end of the row so that every row grows by exactly one column and
   the global alignment width increases by 1.
8. **`alignment_width` from the longest sequence.** `alignment_width` is set
   from the longest sequence loaded into the matrix (not the first).

### 5.1 `mutate_base_subset(rows, col, base)`

Simultaneous block character change (substitution) on a subset of rows at a
single column.

- Only the rows in `rows` are touched; all others are left unchanged.
- Out-of-range rows or columns are silently skipped.
- **Validation (Rule 3, [section 5](#50-editing-constraints-the-ruleset)):** The existing character at each target position must
  be an IUPAC nucleotide or `-`, **and** the new base must itself be an IUPAC
  nucleotide or `-`. If any target position contains a character that is
  neither, or the new base is neither, the method returns `EditError::MutateNotIupac`
  and **no rows are modified** (all-or-nothing).
- Records a `Substitutions` undo command capturing the old bases of the rows it
  actually changed.
- If no rows are actually mutated (all out of range), it is a no-op and records
  nothing.
- Returns `Ok(())` on success, or `Err(EditError::MutateNotIupac)` on validation failure.

### 5.2 `insert_at_subset(rows, col)`

Simultaneous gap insertion at a single column on a **subset** of rows. The
inserted character is always `-` (there is no `base` parameter).

- Target rows receive `-` at `col_idx`.
- **Non-target rows have a `-` appended at the end** to keep matrix width
  consistent (they are not modified at `col_idx`).
- `alignment_width` is incremented by 1.
- Records a `StructuralSnapshot` undo command.
- Returns `Ok(())` (no validation is needed since only `-` can be inserted).

### 5.3 `delete_at_subset(rows, col)`

Simultaneous deletion at a single column on a **subset** of rows.

- Only the rows in `rows` are affected. The character at `col` is **removed**
  and a `-` is appended at the end to keep the row length unchanged.
- **Non-target rows are completely untouched** (no gap-fill, no modification).
- `alignment_width` is left unchanged.
- **Validation (Rule 1, [section 5](#50-editing-constraints-the-ruleset)):** The character at `col` in every target row must be
  `-`. If any target row has a non-`-` character, the method returns
  `EditError::DeleteNotGap` and **no rows are modified** (all-or-nothing).
- Records a `StructuralSnapshot` undo command.
- Returns `Ok(())` on success, or `Err(EditError::DeleteNotGap)` on validation failure.

### 5.4 `delete_column(col)`

Delete a column from **every** row, shrinking `alignment_width` by 1.

- This is the width-preserving inverse of a full-column insert.
- Records a `StructuralSnapshot` undo command.
- Returns `Ok(())`.

### 5.5 `move_horizontal(row, col_indices, direction)`

Move a contiguous block of IUPAC characters horizontally by **1 position**
within a single row. Each call moves exactly 1 position; callers issue multiple
calls for multi-position moves.

- `col_indices` is treated as the range `[min, max]` — non-contiguous indices
  are clamped to their min/max.
- **Left move:** validates all selected chars are IUPAC and the position to the
  left is `-`, then rotates the block left by 1 (the `-` moves to the end of
  the block).
- **Right move:** validates all selected chars are IUPAC and the position to the
  right is `-`, then rotates the block right by 1 (the `-` moves to the start
  of the block).
- Returns `Err(EditError::MoveNotIupac)` if any selected character is not IUPAC,
  or `Err(EditError::MoveNoGapTarget)` if the adjacent position is not `-` (all-or-nothing).
- Out-of-range rows are a no-op.
- Records a `StructuralSnapshot` undo command.

### 5.6 `move_rows_up(row_indices)` / `move_rows_down(row_indices)`

Reorder rows by swapping each specified row with its immediate neighbour.

- `move_rows_up`: each specified row swaps with the row above (row-1). Rows at
  index 0 are silently skipped.
- `move_rows_down`: each specified row swaps with the row below (row+1). Rows
  at the bottom are silently skipped.
- Multiple rows can be moved simultaneously. Indices are sorted (ascending for
  up, descending for down) so swaps don't interfere.
- No character constraints — rows can be reordered regardless of content.
- Both `sequences` and `names` are swapped together.
- Records a `StructuralSnapshot` undo command (which now captures `names`
  as well, so undo/redo of row reorder correctly restores names).
- Returns `Ok(())`.

### 5.7 Edit errors

Mutation methods return `Result<(), EditError>`. Internal validation enums
retain granular causes; `From` implementations map them to the stable public
categories. The Web Worker catches wasm-bindgen's thrown enum value and posts
`{ok: false, errorCode}`; the client rejects with `EngineEditError`.

| `EditError` variant | Code | Meaning |
|----------|-------|---------|
| `EditError::DeleteNotGap` | `"DeleteNotGap"` | Attempted to delete a non-`-` character (rule 1, [section 5](#50-editing-constraints-the-ruleset)). Mutate it to `-` first. |
| `EditError::MutateNotIupac` | `"MutateNotIupac"` | Attempted to mutate a character that is not IUPAC or `-`, or to write a base that is not IUPAC or `-` (rule 3, [section 5](#50-editing-constraints-the-ruleset)). |
| `EditError::MoveNotIupac` | `"MoveNotIupac"` | Attempted to move a block containing non-IUPAC characters (rule 4, [section 5](#50-editing-constraints-the-ruleset)). |
| `EditError::MoveNoGapTarget` | `"MoveNoGapTarget"` | No gap adjacent to the block in the move direction (rule 4, [section 5](#50-editing-constraints-the-ruleset)). |

---

## 6. Undo / Redo

The engine maintains two stacks. Every mutation pushes onto `undo_stack` and
clears `redo_stack`.

### 6.1 `undo(): boolean`

Pops the most recent command and reverses it:

- **`Substitutions`**: restores the old bases by replaying row/base pairs, and
  captures current (post-edit) bases into a new `Substitutions` command pushed
  onto the redo stack. Replay rebuilds paired vectors from actually applied
  rows, so row/base alignment is preserved even if invalid history is observed.
- **`StructuralSnapshot`**: captures the current (post-edit) state as a new
  `StructuralSnapshot` on the redo stack, then restores the stored snapshot.

Returns `true` if an undo was applied, `false` if the undo stack is empty.

### 6.2 `redo(): boolean`

Symmetric to `undo`. Pops from `redo_stack` and re-applies:

- **`Substitutions`**: re-applies stored bases by replaying row/base pairs,
  capturing current (pre-redo) bases into a new `Substitutions` command on the
  undo stack. As in `undo`, paired vectors are rebuilt from rows that were
  actually applied.
- **`StructuralSnapshot`**: captures the current state as a new snapshot on the
  undo stack, then restores the stored snapshot.

Returns `true` if a redo was applied, `false` if the redo stack is empty.

### 6.3 Invariants

- A new edit after an undo clears the redo stack (the redo branch is
  invalidated).
- Undo/redo of structural edits is implemented by swapping full snapshots, so
  the two stacks can hold interleaved `Substitutions` and `StructuralSnapshot`
  commands and still replay correctly in sequence.
- `Substitutions` commands pushed during undo/redo always keep row/base vectors
  aligned (same length, same index mapping).

---

## 7. How to Interact With the Engine

### 7.1 From Rust (native tests)

The engine is a normal Rust crate and can be exercised directly. The test module
in `src/lib.rs` is the canonical example. Run with:

```bash
cargo test          # from sequence-editor/
```

A minimal native usage:

```rust
let mut e = MsaEngine::new();
e.load_fasta(">seq1\nATGCATGC\n>seq2\nATGGTG-A");
assert_eq!(e.get_sequence_count(), 2);
assert_eq!(e.get_alignment_width(), 8);

// Mutation methods return Result<(), EditError>.
assert_eq!(e.mutate_base_subset(&[0], 3, b'G'), Ok(()));
assert_eq!(e.get_base(0, 3), b'G');
assert!(e.undo());
assert_eq!(e.get_base(0, 3), b'C');

// Attempting to delete a non-gap returns a typed error.
let err = e.delete_at_subset(&[0], 0); // col 0 is 'A', not '-'
assert_eq!(err, Err(EditError::DeleteNotGap));
assert_eq!(e.get_base(0, 0), b'A'); // unchanged
```

### 7.2 From JavaScript (via WASM)

The engine is compiled with `wasm-pack`:

```bash
wasm-pack build --target web --release --out-dir www/wasm
```

The generated bindings expose the methods described in [section 4](#4-the-wasm-boundary-api). Note that `&[usize]`
maps to a `Uint32Array` in the JS bindings (not a plain `number[]`).

### 7.3 From the Web Worker (the intended production path)

The engine instance is owned by a Web Worker (`www/src/engine/engine.worker.ts`).
The UI never calls the engine directly; it sends typed request messages over
`postMessage` and awaits responses. The worker:

1. Initializes the WASM module and constructs a single `MsaEngine` on startup
   (self-init at module load — **not** lazily on the first message, to avoid a
   chicken-and-egg problem where the UI waits for a `ready` signal that only
   fires after a command triggers init).
2. Handles `load`, `viewport`, `mutate`, `insert`, `delete`, `undo`, `redo`,
   and `meta` requests. Edit handlers catch the wasm-bindgen `EditError` value
   and post `{ok: false, errorCode}`; successful calls post `{ok: true}`.
3. For viewport requests, transfers the returned `ArrayBuffer` (or writes into a
   shared `SharedArrayBuffer`) so binary data crosses the boundary without a
   second copy.

The main thread uses a promise-based RPC hook (`useEngineWorker.ts`) that
correlates responses to requests via a `reqId` counter.

> **Transfer gotcha:** When transferring an `ArrayBuffer` via the `postMessage`
> transfer list, do **not** also embed a `Uint8Array` view of it in the
> structured-cloned `data` payload — the clone gets a detached buffer. Send
> metadata in `data`, the raw buffer in `transfer`, and reassemble on the main
> thread.

### 7.4 From the MUI Test Harness

`www/src/TestHarness.tsx` is a throwaway MUI UI that validates the engine
end-to-end: load a FASTA, fetch a slice, apply a mutation/insertion/delete,
refetch, and visually confirm the bytes changed. It renders slices as plain
colorized text (no Canvas/WebGL) — the goal is correctness, not performance.
The sliding-window viewport rendering it demonstrates is the pattern the
production Canvas renderer will build on.

---

## 8. How the Engine Fits the Architecture

```
[ React UI & Scroll States ]
           │ postMessage (request)
           ▼
   [ Web Worker ] ──owns──► [ Rust WASM Engine ]
                                  │
                                  ▼ (viewport bytes, copied/transferred)
                          [ SharedArrayBuffer / Uint8Array ]
                                  │
                                  ▼
                          [ Canvas Render Loop (rAF) ]
```

- **Rust/WASM (the engine)** — the brain: matrix, mutation math, parsing,
  history.
- **Web Worker (the bridge)** — owns the WASM instance, runs all engine calls
  off the main thread so parsing/mutation/viewport extraction never block the UI
  or the render loop.
- **React (the shell)** — high-level UI state; never touches WASM directly.
- **Canvas (the viewport)** — a 2D `<canvas>` renderer that reads raw bytes
  produced by the engine (relayed through the worker) and paints the visible
  window each frame. This mirrors the sliding-window viewport approach used in
  the test harness and is deliberately preferred over a WebGL pipeline for
  long-term maintainability.

The engine is deliberately decoupled from all of this. It exposes a synchronous,
windowed, mutation-oriented API; the worker and UI layers decide how to schedule
and render.

---

## 9. Performance Characteristics

- **Viewport extraction** is O(visible cells) and reuses a pre-allocated buffer
  (no per-scroll allocation).
- **Substitutions** are O(changed cells) and record O(changed cells) undo data.
- **Structural edits** are O(matrix) for the snapshot, acceptable at the ~16MB
  ceiling.
- **Zero-copy path:** `update_viewport` + `sabView.set()` gives near-zero
  bridge-back latency (a single typed-array memcpy into shared memory), versus
  ~0.28ms for the `buffer.slice` + transfer path.
- Typical measured timings (3×12 slice): engine ~0.04ms, bridge out ~0.005ms,
  bridge back ~0.8ms, render ~26ms (dominated by the double-rAF frame wait).

---

## 10. Current Status & Roadmap

The engine currently implements the core data layer and mutation/history
capabilities. The surrounding consumer layers (worker bridge, test harness) are
implemented in `www/` and are described in the companion documents.

| Area | Status |
|------|--------|
| Core data structures & memory layout | ✅ Done (`MsaEngine`, viewport buffer) |
| WASM boundary API | ✅ Done (`load_fasta`, `update_viewport`, `update_viewport_into`, metadata getters) |
| Mutation core | ✅ Done (`mutate_base_subset`, `insert_at_subset`, `delete_at_subset`, `delete_column`, `move_horizontal`, `move_rows_up`, `move_rows_down`) with IUPAC/gap validation and typed `EditError` results |
| Undo/Redo | ✅ Done (`Substitutions` + `StructuralSnapshot`) |
| Web Worker bridge | ✅ Done (in `www/`, consumes the engine) |
| MUI test harness | ✅ Done (in `www/`, consumes the engine) |
| Canvas renderer | ⏳ Planned (2D `<canvas>` sliding-window viewport, in `www/`) |
| Translation layer | ⏳ Not yet implemented in the engine |
| Sequence search | ⏳ Not yet implemented in the engine |

The engine covers the core data, mutation, and history layers. The worker bridge
and test harness are implemented as consumers in `www/`. The Canvas renderer,
the dynamic 3-frame translation layer, and sequence search are future work and
would extend the engine's API (e.g. `RenderMode`, `set_render_mode`,
`set_reading_frame`, `get_display_width`, a codon-translating viewport path, and
a search/hit-navigation API).

---

## 11. Known Limitations & Future Work

- **Ragged alignments:** `load_fasta` does not enforce uniform row length; the
  caller must detect and handle raggedness via `get_row_length`.
- **Structural snapshot cost:** Full-matrix snapshots are fine at ~16MB but
  would need revisiting for much larger alignments.
- **Canvas renderer:** The production renderer will be a 2D `<canvas>` that
  paints the sliding-window viewport (the same pattern demonstrated by the test
  harness), rather than a WebGL pipeline. This keeps the rendering layer simple
  and maintainable while still hitting 60 FPS for the expected dataset sizes.
- **Translation layer:** Not yet implemented. When added, the engine will
  translate nucleotides to amino acids on the fly for the visible viewport
  only, keeping nucleotides as the single source of truth. Editing in amino-acid
  mode will require validation (e.g. disallowing single-base substitutions,
  which are ambiguous at the codon level).
- **Sequence search:** Not yet implemented. When added, the engine will search
  the full matrix in Rust (exact match, and gap-insensitive matching for
  primers/motifs), cache hit coordinates internally, and expose navigation
  (next/previous hit) so the frontend can jump between matches without ever
  holding the full matrix. In amino-acid mode, search will switch to searching
  translated peptide motifs.
