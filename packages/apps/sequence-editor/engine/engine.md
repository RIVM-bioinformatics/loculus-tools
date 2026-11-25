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
- **Simple, compact history:** Undo/redo via compact, reversible `UndoCommand`
  deltas and pointer swaps ($O(\text{affected cells/indices})$ memory) bounded by
  both depth (`2000`) and byte budget (`256 MiB`).

> [!NOTE]
> **If the intended usecase is ~16MB, why go through all this effort to make a separate engine instead of doing everything in the React app?**
>
> It's a fair question — at ~16MB the data trivially fits in memory, so why add a
> Rust/WASM layer and a Web Worker at all? The short answer is that the 16MB footprint only makes the *memory* trivial; it says nothing about the harder problems of *who owns the data*, *how edits stay consistent and atomic*, *how the UI stays responsive*, and *how the logic is verified*. The separate engine addresses these concerns. Concretely:
>
> 1. **Separation of concerns & testability:** Keeping the business logic
> (parsing, matrix layout, mutation logic, history) in a pure Rust crate
> decoupled from the UI makes it testable in isolation (see
> [section 7.1](#71-from-rust-native-tests)).
> 2. **Previous lessons:** In an earlier PoC of this project we implemented
> the same editing logic *inside* the React app, and it quickly became
> completely unmaintainable (by hand at least).
> 3. **A single source of truth for the alignment.** The sequence information,
> and all its derived information (e.g. `alignment_width`), lives in only
> one place: the engine. The React side can now only be concerned with
> the questions *how to render?* and *how to pass on interactions?*.
> 4. **Windowed access keeps the frontend cheap.** Because the engine owns the
> full matrix and only hands out bounded viewport slices, the entire React
> layer operates on O(visible cells) data. This is what makes the
> sliding-window Canvas renderer viable and keeps scrolling smooth no matter
> the size of the alignment (with some limits of course).
> 5. **The Web Worker model keeps the UI thread responsive.** All parsing, structural
> edits, compact undo/redo history recording, and search run synchronously in the
> worker, off the main thread, so a large FASTA parse or a structural insert
> across 80 sequences never drops a frame on the UI thread. Doing this in
> React would block rendering for a noticeable period.
> 6. **Future features require speed.** Features that are not yet implemented,
> such as live 3-frame nucleotide→amino-acid translation, and especially searching
> the sequences for exact (multiple) matches of user-input are computationally expensive.
> These actions gain massively from compiled language implementation and the ability to
> run off the main thread.

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
serde-wasm-bindgen = "0.6"
mafft = "0.2.0"                   # pure-Rust MAFFT v7.526 implementation

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
pub const DEFAULT_MAX_UNDO_DEPTH: usize = 2000;
pub const DEFAULT_MAX_HISTORY_BYTES: usize = 256 * 1024 * 1024;

#[wasm_bindgen]
pub struct MsaEngine {
    nucleotide_sequences: Vec<Vec<u8>>,       // the alignment matrix, row-major
    aminoacid_sequences: Vec<AminoacidSequence>, // lazily computed 3-frame translation cache
    names: Vec<String>,                       // one row identifier per sequence
    alignment_width: usize,                   // global column count
    viewport_buffer: Vec<u8>,                 // reusable slice buffer
    undo_stack: VecDeque<UndoCommand>,
    redo_stack: VecDeque<UndoCommand>,
    history_bytes: usize,
    max_undo_depth: usize,
    max_history_bytes: usize,
    revision: usize,
}
```

| Field | Purpose |
| ------- | --------- |
| `nucleotide_sequences` | The matrix. Each inner `Vec<u8>` is one sequence of ASCII bytes (`b'A'`, `b'-'`, ...). |
| `aminoacid_sequences` | Lazily populated 3-frame translation cache; invalidated on every applied mutation, `undo()`, `redo()`, and `load_fasta()`. |
| `names` | Row identifiers, parallel to `nucleotide_sequences`. |
| `alignment_width` | The global number of columns. Set from the longest sequence at load time. |
| `viewport_buffer` | A single reusable buffer for viewport extraction, pre-allocated to ~5000 bytes and grown on demand. |
| `undo_stack` / `redo_stack` | Bounded transactional edit history (`VecDeque` for O(1) oldest-entry FIFO eviction on `undo_stack`). |
| `history_bytes` | Exact sum of `UndoCommand::estimated_byte_size()` across `undo_stack` and `redo_stack`. |
| `max_undo_depth` / `max_history_bytes` | Dual history bounds (defaults `2000` commands and `256 MiB`). |
| `revision` | Monotonically wrapping counter incremented on applied mutations, non-empty loads, `undo()`, `redo()`, and `reset()`. |

### 3.2 `UndoCommand`

History is stored without `Clone` using compact reversible record structs and pointer swaps:

- **`Substitutions(SubstitutionRecord { positions: Vec<(usize, usize, u8)> })`**: `(row, col, base_to_restore)` tuples swapped in-place on `undo`/`redo`.
- **`HorizontalMove(HorizontalMoveRecord { rows, start_col, end_col, direction })`**: 1-column block rotation across `rows` over inclusive `[start_col, end_col]`.
- **`RowReorder(RowReorderRecord { inverse_order: Vec<usize> })`**: row permutation applied in-place via cycle decomposition (moving `Vec<u8>`/`String` headers without cloning bytes).
- **`InsertAtSubset(InsertAtSubsetRecord { target_rows, insertion_col, padded_short_rows, previous_alignment_width })`**: records target rows plus `(row_idx, orig_len)` only for ragged short rows padded before insertion.
- **`DeleteAtSubset(DeleteAtSubsetRecord { target_rows, column_index })`**: target rows had `b'-'` removed at `column_index` and `b'-'` appended at end.
- **`DeleteColumn(DeleteColumnRecord { column_index, removed_bases, previous_alignment_width })`**: stores 1 `Option<u8>` per row (`None` for short ragged rows).
- **`DeletedRow(DeletedRowRecord { row_indices, names, sequences, previous_alignment_width })`**: owns moved `names` and `sequences` on `undo_stack`; when undone onto `redo_stack`, clears `names`/`sequences` and retains only `row_indices` to re-delete.
- **`PrependedSequences(PrependedSequencesRecord { count, names, sequences, previous_alignment_width })`**: stores `count` only on `undo_stack`; when undone onto `redo_stack`, holds drained `names`/`sequences`.
- **`ReplaceMatrix(ReplacedMatrixRecord { sequences, previous_alignment_width })`**: swaps `nucleotide_sequences` via `std::mem::replace`/`std::mem::swap` for `realign` and `apply_aligned_fasta`.

`UndoCommand::estimated_byte_size(&self) -> usize` computes `size_of::<Self>()` plus heap capacities of owned vectors/strings. `push_to_undo_stack()` clears `redo_stack`, evicts oldest `undo_stack` entries via `pop_front()` until both `max_undo_depth` and `max_history_bytes` are satisfied, recomputes `history_bytes`, increments `revision`, and clears `aminoacid_sequences`.

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
| `reset()` | `reset(): void` | Reset the engine to its initial empty state, clearing all sequences, names, caches, and undo/redo history while monotonically advancing `revision`. |

### 4.2 Loading

| Method | Signature | Description |
|--------|-----------|-------------|
| `load_fasta` | `load_fasta(fasta: string): number` | Validate and parse FASTA atomically; prepend sequences ahead of existing rows, update width, and record a compact `PrependedSequences` command if prior state exists. Throw a structured error on invalid input. |

`load_fasta` behavior:

- Parses into temporary sequence/name buffers first. Only after the complete
  input is valid are sequences prepended ahead of existing rows;
  invalid input leaves the current engine state intact.
- If the engine already contains state (sequences or undo/redo history), a
  `PrependedSequences` command is recorded so the addition can be undone (`Ctrl+Z` / `Cmd+Z`).
  Initial load into a fresh or reset engine keeps `undo_depth == 0` and advances `revision`.
- Empty or whitespace-only input is a no-op that returns the current sequence
  count without modifying `revision`, `redo_stack`, or `aminoacid_sequences`.
- Scans line by line. A line starting with `>` begins a new record; the complete
  trimmed header after `>` becomes the row name. Validation diagnostics use the
  first whitespace-delimited token as the sequence ID.
- Sequence lines are appended as **uppercased** ASCII bytes; internal whitespace
  is skipped. Sequences may span multiple lines.
- Sequence bodies accept only IUPAC nucleotide characters
  (`ACGTURYSWKMBDHVN`, either case) and `-`. Other characters, including
  non-ASCII characters, reject with `StructuredEngineError` code
  `InvalidAlphabet`. The `invalidCharacters` context array lists every
  occurrence across all records, with its sequence ID, invalid character,
  1-based sequence position, and 1-based input line. Scalar context fields
  mirror the first occurrence.
- Sequence data before the first header rejects with `InvalidFastaFormat`.
- The global `alignment_width` is updated to `max(existing_width, batch_width)`.
  Sequences are loaded as-is even if they differ in length — the engine does
  **not** enforce uniform length. Shorter sequences pad with spaces during
  viewport extraction. The caller can detect ragged alignments via `get_row_length`.
- Blank lines are ignored.
- Returns the total number of sequences in the engine.

> **Assumption:** The input is expected to be *pre-aligned* (as provided by
> Loculus). The engine does not perform alignment itself.

### 4.3 Viewport Extraction

| Method | Signature | Description |
| -------- | ----------- | ------------- |
| `update_viewport` | `update_viewport(startRow, endRow, startCol, endCol, includeTranslationMap, readingFrame)` | Return two `Uint8Array`s: the nucleotide viewport and, when requested, the full codon overlay. The overlay uses the full alignment width as its stride, and the reading frame is one-based (`1`, `2`, or `3`). Otherwise the second array is empty. |
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
| -------- | ----------- | ------------- |
| `get_sequence_count` | `(): number` | Number of loaded sequences. |
| `get_alignment_width` | `(): number` | Global column count (0 if empty). |
| `get_name` | `(row: number): string` | Row name, or `""` if out of range. |
| `get_base` | `(row: number, col: number): number` | Raw byte at `(row, col)`, or `0` if out of range. Useful for spot-checking cells. |
| `get_row_length` | `(row: number): number` | Length of a specific row, or `0` if invalid. Useful for detecting ragged alignments. |
| `undo_depth` | `(): number` | Number of commands on the undo stack. |
| `redo_depth` | `(): number` | Number of commands on the redo stack. |
| `get_revision` | `(): number` | Monotonic revision counter across applied edits, non-empty loads, `undo`, `redo`, and `reset`. |
| `get_history_bytes` | `(): number` | Estimated heap byte footprint across undo and redo stacks. |
| `get_max_undo_depth` | `(): number` | Configured maximum undo stack depth (default `2000`). |
| `set_max_undo_depth` | `(max_depth: number): void` | Set maximum undo stack depth and immediately evict oldest undo entries if exceeded. |
| `get_max_history_bytes` | `(): number` | Configured maximum history byte budget (default `256 MiB`). |
| `set_max_history_bytes` | `(max_bytes: number): void` | Set maximum history byte budget and immediately evict oldest entries if exceeded. |

### 4.5 FASTA Export

| Method | Signature | Description |
| -------- | ----------- | ------------- |
| `export_gapped_fasta` | `(): Uint8Array` | Serialize the full matrix as deterministic, unwrapped gapped FASTA. |
| `export_ungapped_fasta` | `(): Uint8Array` | Serialize the full matrix as deterministic, unwrapped ungapped FASTA (stripping all `-` gaps). |

Both methods return a `Uint8Array` of UTF-8 encoded FASTA bytes. Headers preserve their original UTF-8 text, while nucleotide sequence bodies contain ASCII characters (`ACGTURYSWKMBDHVN` and `-`). Records are emitted in current row order with `\n` line endings. An empty engine returns an empty buffer.

---

## 5. The Mutation Core

All mutation methods run **synchronously** on the worker thread. Each one
records an `UndoCommand` onto `undo_stack` *before* mutating, and clears the
`redo_stack` (a new edit invalidates the redo branch). The main thread only
sends a command and awaits an acknowledgment.

### 5.0 Editing constraints (the ruleset)

The mutation core is governed by a fixed set of editing constraints. These
constraints define exactly which combinations of actions are allowed and which
are rejected. Every mutation method below enforces them and returns a
`StructuredEngineError` (see [section 5.10](#510-structured-errors)) when a
constraint is violated, leaving the matrix **unchanged**
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

### 5.1 `mutate_base(rows, cols, base)`

Simultaneous block character change (substitution) on a subset of rows and
columns.

- Only the cells in the Cartesian product of `rows` and `cols` are touched; all others are left unchanged.
- Out-of-range rows or columns are silently skipped.
- **Validation (Rule 3, [section 5](#50-editing-constraints-the-ruleset)):** The existing character at each target position must
  be an IUPAC nucleotide or `-`, **and** the new base must itself be an IUPAC
  nucleotide or `-`. If any target position contains a character that is
  neither, or the new base is neither, the method returns `EditError::MutateNotIupac`
  and **no rows are modified** (all-or-nothing).
- Records a `Substitutions` undo command capturing only the cells whose byte
  actually changed (`seq[c] != new_base`).
- If no cells are actually mutated (empty inputs, all out of range, or all
  targets already equal `new_base`), it is a no-op and leaves `undo_stack`,
  `redo_stack`, `revision`, and `aminoacid_sequences` untouched.
- Returns `Ok(())` on success, or `Err(EditError::MutateNotIupac)` on validation failure.

### 5.2 `insert_at_subset(rows, col)`

Simultaneous gap insertion at a single column on a **subset** of rows. The
inserted character is always `-` (there is no `base` parameter).

- If the matrix is empty or no valid in-bounds row indices are provided, returns `Ok(())` as a no-op.
- Target rows receive `-` at `col_idx` (ragged short rows are padded first and their original lengths saved in `padded_short_rows`).
- **Non-target rows have a `-` appended at the end** to keep matrix width
  consistent (they are not modified at `col_idx`).
- `alignment_width` is updated from the resulting row lengths.
- Records an `InsertAtSubset` undo command.
- Returns `Ok(())` (no validation is needed since only `-` can be inserted).

### 5.3 `delete_at_subset(rows, col)`

Simultaneous deletion at a single column on a **subset** of rows.

- Only the in-bounds rows in `rows` where `col < seq.len()` are affected. The character at `col` is **removed**
  and a `-` is appended at the end to keep the row length unchanged.
- **Non-target rows are completely untouched** (no gap-fill, no modification).
- `alignment_width` is left unchanged.
- **Validation (Rule 1, [section 5](#50-editing-constraints-the-ruleset)):** The character at `col` in every in-bounds target row (`col < seq.len()`) must be
  `-`. If any target row has a non-`-` character, the method returns
  `EditError::DeleteNotGap` and **no rows are modified** (all-or-nothing).
- If no valid in-bounds target rows have a base at `col`, returns `Ok(())` as a no-op.
- Records a `DeleteAtSubset` undo command.
- Returns `Ok(())` on success, or `Err(EditError::DeleteNotGap)` on validation failure.

### 5.4 `delete_column(col)`

Delete a column from **every** row, shrinking `alignment_width` by 1.

- No-op if the matrix is empty or `col >= alignment_width`.
- This is the width-preserving inverse of a full-column insert.
- Records a `DeleteColumn` undo command storing one `Option<u8>` per row.
- Returns `Ok(())`.

### 5.5 `move_horizontal(row_indices, col_indices, direction)`

Move a contiguous block of IUPAC characters horizontally by **1 position**
across one or more rows. Each call moves exactly 1 position; callers issue multiple
calls for multi-position moves.

- `col_indices` is treated as the range `[min, max]` — non-contiguous indices
  are clamped to their min/max.
- `row_indices` specifies the rows to move. Duplicate row indices are deduplicated
  while preserving order.
- **Left move:** validates all selected chars are IUPAC and the position to the
  left is `-`, then rotates the block left by 1 (the `-` moves to the end of
  the block).
- **Right move:** validates all selected chars are IUPAC and the position to the
  right is `-`, then rotates the block right by 1 (the `-` moves to the start
  of the block).
- Returns `Err(EditError::MoveNotIupac)` if any selected character is not IUPAC,
  or `Err(EditError::MoveNoGapTarget)` if the adjacent position is not `-` (all-or-nothing:
  if any target row fails validation, no row is modified).
- Out-of-range rows or rows shorter than the selected column range are skipped.
- Records a single `HorizontalMove` undo command for the entire multi-row operation.

### 5.6 Row reordering (`move_rows_relative`, `move_rows_grouped`, `move_rows_to_top`, `move_rows_to_bottom`, `move_rows_up`, `move_rows_down`)

Reorder rows without character constraints, updating both `sequences` and `names` together.

- `move_rows_relative(row_indices, delta)`:
  - Shifts each specified row by `delta` positions (`+` for down, `-` for up).
  - Partitions selection into contiguous blocks. Disjoint rows (e.g. `[1, 3, 8]` with delta `+1` -> `[2, 4, 9]`) preserve their spacing. Joined blocks (e.g. `[1, 2, 3]` with delta `+1` -> `[2, 3, 4]`) move as a unit.
  - Rows hitting boundaries are pinned while other unconstrained blocks continue shifting.
- `move_rows_up(row_indices)`: convenience wrapper calling `move_rows_relative(row_indices, -1)`.
- `move_rows_down(row_indices)`: convenience wrapper calling `move_rows_relative(row_indices, 1)`.
- `move_rows_grouped(row_indices, target_row)`:
  - Gathers the selected rows into a contiguous block placed starting at `target_row` (e.g. rows `[4, 5, 10]` with target `6` move to `6, 7, 8`).
  - Selected rows retain their relative internal order; surrounding unselected rows retain their relative order around the group.
  - Clamps `target_row` to `0..=(sequence_count - selected_count)`.
- `move_rows_to_top(row_indices)`: snaps and groups the selected rows at the top (index `0`).
- `move_rows_to_bottom(row_indices)`: snaps and groups the selected rows at the bottom (index `sequence_count - selected_count`).
- **Undo History & No-Op Rule**: Every row movement permutes rows in-place via cycle decomposition and records at most **one** `RowReorder { inverse_order }` undo command. If the resulting order is identical to the current order (e.g. attempting to move rows already at boundary), no undo entry is recorded.
- Returns `Ok(())`.

### 5.7 Row Deletion (`delete_rows`)

`MsaEngine::delete_rows(&mut self, row_indices: &[usize]) -> Result<(), StructuredEngineError>`

- **Atomicity**: Deduplicates and bounds-checks `row_indices`. If no valid rows exist, returns `Ok(())` without pushing an undo entry. Otherwise, moves deleted rows in ascending index order into `DeletedRow`.
- **Width recalculation**: Recomputes `alignment_width` from the maximum length of remaining rows, or `0` if all rows are removed.
- **Cache invalidation**: Clears `aminoacid_sequences` via `push_to_undo_stack`.
- **Zero-row state**: The matrix safely supports `sequence_count == 0`; `undo()` restores all deleted rows and original width.

### 5.8 Sequence re-alignment (`realign`)

Re-aligns all loaded sequences across the whole matrix using the pure-Rust `mafft` crate (`AlignmentMode::FftNs2` with `ScoringModel::Dna` and `with_retree(1)` for FFT-NS-1).

- Safe no-op when fewer than 2 sequences are loaded (no undo entry recorded).
- Enforces size bounds (`MAX_ALIGNMENT_SEQUENCES = 1,000`, `MAX_ALIGNMENT_TOTAL_RESIDUES = 5,000,000`, and `MAX_ALIGNMENT_OUTPUT_CELLS = 500,000,000`) returning `InputTooLarge` if exceeded to prevent WASM linear memory exhaustion.
- Strips existing gap characters (`-`) prior to invoking MAFFT progressive alignment.
- Preserves all-gap or empty rows mid-edit, emitting them as uniform all-gap rows with length equal to the aligned width.
- Requires at least 2 sequences containing non-gap nucleotide residues; rejects with `EmptySequence` error before mutating state if fewer than 2 sequences have residues.
- Unaligned/ragged sequences are progressively aligned; `alignment_width` is updated to the maximum sequence length after alignment.
- Swaps the previous matrix into a `ReplaceMatrix` undo entry prior to mutating, enabling complete multi-level transactional `undo()` and `redo()`.
- Invalidates and clears `aminoacid_sequences` cache so subsequent translated views reflect the new alignment coordinates.
- Returns `Ok(())`.

### 5.9 External alignment integration (`apply_aligned_fasta` & `align_fasta`)

To support non-blocking and cancelable sequence re-alignment, the engine provides:
- Standalone `align_fasta(fasta_content: &str) -> Result<String, StructuredEngineError>`: Computes MAFFT FFT-NS-1 on an unaligned or gapped FASTA string, suitable for execution inside an ephemeral worker without initializing the full engine. Preserves all-gap rows and returns formatted FASTA or returns `StructuredEngineError` if UTF-8 encoding or validation fails.
- Method `apply_aligned_fasta(&mut self, fasta_content: &str, expected_revision: Option<usize>) -> Result<(), StructuredEngineError>`: Checks `expected_revision` first (returning `"StaleRevision"` before parsing FASTA if mismatched), then validates that sequence counts match, all aligned rows have uniform equal lengths, sequence headers and order match the current matrix, and ungapped residue identities are strictly conserved. Swaps the previous matrix into a `ReplaceMatrix` command onto `undo_stack`, updates `alignment_width`, increments `revision`, and clears `aminoacid_sequences`.

### 5.10 Structured errors

WASM-facing edit methods and `load_fasta` return
`Result<_, StructuredEngineError>`. The
private `MutateError`, `DeleteError`, and `MoveError` variants preserve the
failing coordinates, base, and direction. Their conversions create a stable
error code, readable message, and optional `ErrorContext` fields. The
`translate` method similarly returns `InvalidReadingFrame` with the invalid
frame in context instead of silently selecting frame 0.

```rust
pub struct StructuredEngineError {
  pub code: String,
  pub message: String,
  pub context: Option<Box<ErrorContext>>,
}

pub struct ErrorContext {
  pub row: Option<usize>,
  pub col: Option<usize>,
  pub base: Option<String>,
  pub frame: Option<u8>,
  pub mode: Option<String>,
  pub direction: Option<String>,
  pub sequence_id: Option<String>,
  pub position: Option<usize>,
  pub line: Option<usize>,
  pub invalid_char: Option<String>,
  pub byte: Option<u8>,
  pub invalid_characters: Option<Vec<InvalidCharacterContext>>,
}

pub struct InvalidCharacterContext {
  pub sequence_id: String,
  pub position: usize,
  pub line: usize,
  pub invalid_char: String,
  pub byte: Option<u8>,
}
```

The types derive `serde::Serialize`; `From<StructuredEngineError> for JsValue`
uses `serde_wasm_bindgen` so wasm-bindgen throws the structured object. Context is
boxed (`Option<Box<ErrorContext>>`) to keep the error type compact and avoid
oversized `Result` types, while serializing identically to JavaScript. Optional
context fields are omitted when absent. The worker normalizes that thrown value
and posts `{ ok: false, error }` for edit, load, translation, and viewport
failures; unexpected exceptions use code `UnexpectedRuntimeError`. Invalid or
oversized viewport requests use `InvalidViewport` with the available starting
row/column.
Direct Rust/WASM translation calls also check inclusive dimensions and their
product against `MAX_VIEWPORT_BYTES` before reserving viewport memory. Overflow,
oversized results, or reservation failures return `InvalidViewport` with
`row`, `col`, and `frame` context.

| Code | Meaning | Context |
| ---------- | ------- | --------- |
| `DeleteNotGap` | Attempted to delete a non-`-` character. | `row`, `col`, `base` |
| `MutateNotIupac` | Target or replacement character is not IUPAC or `-`. | `row`, `col`, and/or `base` |
| `MoveNotIupac` | Selected block contains a non-IUPAC character. | `row`, `col`, `base` |
| `MoveNoGapTarget` | No adjacent gap or alignment boundary reached. | `row`, `col`, `direction`, and optional `base` |
| `InvalidReadingFrame` | Translation requested a frame outside 0, 1, or 2. | `frame` |
| `InvalidViewport` | Viewport bounds overflow, exceed capacity, or translation memory cannot be reserved. | `row`, `col`, and `frame` for translation |
| `UnexpectedRuntimeError` | Unrecognized runtime failure. | None unless available |
| `InvalidAlphabet` | Sequence contains characters outside IUPAC nucleotides and `-`. | `invalidCharacters` lists every occurrence; scalar fields mirror the first |
| `InvalidFastaFormat` | Sequence data appears before a FASTA header. | `line` |
| `StaleRevision` | `apply_aligned_fasta` received an `expected_revision` that does not match `self.revision`. | None |
| `AlignmentMismatch` | `apply_aligned_fasta` sequence count, lengths, headers, or residues do not match the current matrix. | `row`, `sequenceId` on residue mismatch |
| `EmptySequence` | Fewer than 2 sequences contain nucleotide residues for alignment. | `row`, `sequenceId` |
| `InputTooLarge` | Matrix or alignment exceeds `MAX_ALIGNMENT_*` limits. | None |
| `AlignmentFailed` | MAFFT returned an invalid aligned sequence set. | None |

---

## 6. Undo / Redo

The engine maintains bounded `VecDeque<UndoCommand>` stacks (`undo_stack` and `redo_stack`). Every applied mutation pushes onto `undo_stack` via `push_to_undo_stack()`, clears `redo_stack`, evicts oldest entries in FIFO order when `max_undo_depth` (`2000`) or `max_history_bytes` (`256 MiB`) would be exceeded, recomputes `history_bytes`, increments `revision`, and clears `aminoacid_sequences`.

### 6.1 `undo(): boolean`

Pops the most recent command (`pop_back()`) and reverses it in-place:

- **`Substitutions`**: swaps `(row, col, target_base)` in-place inside `positions` with zero heap allocations (filtering out-of-bounds entries via compaction); returns `false` without incrementing `revision` if zero cells were in-bounds.
- **`HorizontalMove` / `RowReorder` / `InsertAtSubset` / `DeleteAtSubset` / `DeleteColumn` / `DeletedRow` / `PrependedSequences` / `ReplaceMatrix`**: applies the exact compact inverse in-place or via pointer swaps (`DeletedRow` moves restored rows back into the matrix and keeps only `row_indices` on `redo_stack`; `PrependedSequences` drains prepended rows onto `redo_stack`; `ReplaceMatrix` swaps buffers via `std::mem::swap`).

Recomputes `history_bytes`, enforces `max_history_bytes` across both stacks, increments `revision`, and clears `aminoacid_sequences`. Specifically:

- If the reverse command's `estimated_byte_size()` alone exceeds `max_history_bytes`, `redo_stack` is cleared and the oversized redo entry is not pushed (preserving earlier `undo_stack` entries while preventing older redo entries from skipping over the un-recorded undone step).
- Otherwise, the reverse command is pushed onto `redo_stack`, `history_bytes` is recomputed, and if `history_bytes > max_history_bytes`, oldest `undo_stack` entries are evicted first (`pop_front()`), followed by oldest `redo_stack` entries (`pop_front()`) if `undo_stack` is empty.

Returns `true` if an undo was applied, `false` if the undo stack was empty or degenerate.

### 6.2 `redo(): boolean`

Symmetric to `undo`. Pops from `redo_stack`, re-applies the forward edit in-place, pushes the reverse command back to `undo_stack` while enforcing `max_undo_depth` and `max_history_bytes` (clearing `undo_stack` without pushing if the command itself exceeds `max_history_bytes` or `max_undo_depth == 0`, otherwise evicting oldest `undo_stack` then oldest `redo_stack` entries as needed), recomputes `history_bytes`, increments `revision`, and clears `aminoacid_sequences`.

Returns `true` if a redo was applied, `false` if the redo stack was empty or degenerate.

### 6.3 Invariants

- No-op mutations leave `undo_stack`, `redo_stack`, `revision`, and `aminoacid_sequences` untouched.
- A new applied edit after an undo clears `redo_stack` (the redo branch is invalidated).
- `history_bytes` is always recomputed from `undo_stack` + `redo_stack` so payload transitions (`DeletedRow`, `PrependedSequences`, `ReplaceMatrix`) never drift, and `get_history_bytes() <= get_max_history_bytes()` holds across `push_to_undo_stack()`, `undo()`, `redo()`, `set_max_undo_depth()`, and `set_max_history_bytes()`.
- `undo()` and `redo()` clear the cached `aminoacid_sequences` so translated views remain consistent with restored nucleotide states.

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
e.load_fasta(">seq1\nATGCATGC\n>seq2\nATGGTG-A").unwrap();
assert_eq!(e.get_sequence_count(), 2);
assert_eq!(e.get_alignment_width(), 8);

// Mutation methods return Result<(), StructuredEngineError>.
assert_eq!(e.mutate_base(&[0], &[3], b'G'), Ok(()));
assert_eq!(e.get_base(0, 3), b'G');
assert!(e.undo());
assert_eq!(e.get_base(0, 3), b'C');

// Attempting to delete a non-gap returns a structured error.
let err = e.delete_at_subset(&[0], 0); // col 0 is 'A', not '-'
let err = err.unwrap_err();
assert_eq!(err.code, "DeleteNotGap");
assert_eq!(err.context.unwrap().base.as_deref(), Some("A"));
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
   and `meta` requests. Edit and translation failures are normalized to
   `{ok: false, error: {code, message, context?}}`; successful calls post
   `{ok: true}`. Unknown exceptions use `UnexpectedRuntimeError`.
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
- **Structural edits** record compact O(affected rows/cells) deltas or O(1)
  pointer swaps (`ReplaceMatrix`, `DeletedRow`, `PrependedSequences`), bounded by
  `max_undo_depth` (`2000`) and `max_history_bytes` (`256 MiB`).
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
| ------ | -------- |
| Core data structures & memory layout | ✅ Done (`MsaEngine`, viewport buffer) |
| WASM boundary API | ✅ Done (`load_fasta`, `update_viewport`, `update_viewport_into`, metadata getters) |
| Mutation core | ✅ Done (`mutate_base`, `insert_at_subset`, `delete_at_subset`, `delete_column`, `delete_rows`, `move_horizontal`, `move_rows_relative`, `move_rows_grouped`, `move_rows_to_top`, `move_rows_to_bottom`, `move_rows_up`, `move_rows_down`) with IUPAC/gap validation and typed `EditError` results |
| Undo/Redo | ✅ Done (9 compact `UndoCommand` variants + bounded `VecDeque` depth/byte eviction) |
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
