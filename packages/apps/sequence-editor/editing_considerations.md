# Sequence Editor Editing Considerations

This document is the normative editing contract for the sequence editor. It describes the rules that must be preserved when changing the React UI, Web Worker bridge, WASM API, Rust engine, selection model, viewport cache, or undo/redo implementation.

The document is intentionally more detailed than a user guide. It exists to remove ambiguity from editing behavior and to make future changes testable.

Status: current implementation contract as of 2026-09-19.

## 0. Can this document reproduce the current implementation?

After the rules in this section and the sections below are followed, a future
implementer should be able to rebuild the current editing behavior without
guessing. The rules below describe current behavior, including behavior that is
not ideal but is observable today. They are not only design recommendations.

Use this order when implementing a replacement:

1. Copy the data shapes and initial values in section 0.1.
2. Copy the pure selection and keyboard algorithms in sections 4 and 6.
3. Copy the command state transitions in section 0.2.
4. Copy the engine and worker rules in sections 7 and 9.
5. Copy the cache and rendering rules in section 10.
6. Use the current-behavior notes in section 0.3 when behavior looks unusual.
7. Run the tests listed in section 17.

The Rust engine is authoritative for matrix bytes and history. The current
React controller and grid are authoritative for cursor, selection, scrolling,
and presentation state.

### 0.1 Exact initial UI state

The controller starts with these values:

```text
activeCell       = { row: 0, col: 0 }
announcement     = ''
busy             = false
busyLabel        = null
cellFocused      = false
currentHit       = 0
dataRevision     = 0
datasetLabel     = 'Untitled alignment'
datasetRevision  = 0
dirty            = false
error            = null
metadata         = null
openDialog       = 'none'
openPanel        = 'none'
palette          = 'AliView Default'
searchResults    = null
selectedRows     = []
selectionAnchorRow = null
selectionBlock   = null
status           = null
```

`SelectionBlock` has this exact shape:

```ts
interface SelectionBlock {
  endCol: number;
  endRow?: number;
  startCol: number;
  startRow?: number;
}
```

The row fields are optional because keyboard-created horizontal selections can
omit them. Pointer-created rectangles include both row fields. When a row
field is missing, use `activeCell.row` for that bound.

### 0.2 Exact controller state transitions

Every queued controller command behaves as follows:

1. Add the command to the promise queue.
2. Dispatch `setBusy` with the command label.
3. Await the engine operation.
4. If the operation succeeds, await metadata refresh when the command performs
   an edit.
5. Dispatch `commandSucceeded`.
6. `commandSucceeded` sets `busy = false`, clears `error`, sets the supplied
   `status`, sets `dirty` to the command's `dirty` value, and increments
   `dataRevision` when `updateRevision` is true.
7. When `updateRevision` is true, it also clears `searchResults` and resets
   `currentHit` to `0`.

If the engine rejects:

1. Dispatch `commandFailed` with the mapped message.
2. Set `busy = false` and `busyLabel = null`.
3. Set `error` and `announcement` to the mapped message.
4. Set `status = null`.
5. Do not dispatch an active-cell or selection change for that command.
6. Preserve the previous `dirty`, `dataRevision`, active cell, selection, and
   redo stack.
7. Re-throw the original error to the caller.

The queue continues after failure: the next command is allowed to run even
when the previous command rejected.

The exact current status strings are:

| Operation | Success status |
| --- | --- |
| Load | `Loaded N sequence(s).` |
| Single-cell mutation | `Edit applied.` |
| Rectangle mutation | `Selection edit applied.` |
| Insert | `Gaps inserted.` |
| Structural subset deletion | `Gaps deleted.` |
| Whole-column deletion | `Alignment column deleted.` |
| Horizontal movement | `Bases moved.` |
| Row movement | `Rows moved.` |
| Undo | `Undo complete.` or `Nothing to undo.` |
| Redo | `Redo complete.` or `Nothing to redo.` |
| Export | `FASTA exported.` |

Undo and redo currently pass `dirty = true` even when the engine returns
`false` because its stack was empty. A replacement that must match the current
implementation must keep this behavior.

### 0.3 Current behavior that must not be inferred differently

These details are easy to implement differently. They are listed explicitly so
an exact replacement does not silently become a behavior change:

- A rectangle mutation leaves the active cell at the mouse endpoint. It does
  not move it to the rectangle's top-left corner and does not advance it.
- Clicking a FASTA header selects rows only. It does not move the cell cursor to
  that header's row. The cell cursor and header-row selection are independent.
- `cellFocused = false` is header-selection mode. In this mode the selected
  headers are full-row selections, but `A`/IUPAC mutation, `-`, Delete,
  Backspace, Space, arrows, Home, End, PageUp, PageDown, and horizontal cell
  movement do nothing. Ctrl/Cmd+ArrowUp/Down remain available for moving the
  selected records, and undo/redo remain available.
- Loading a dataset sets `activeCell = { row: 0, col: 0 }` as the fallback
  coordinate, but sets `cellFocused = false`; no cursor outline is painted and
  no cursor-visibility scroll is performed until a user focuses a cell.
- A single-cell mutation advances the active cell by one column, including when
  multiple rows were selected through the name gutter but no cell rectangle
  exists.
- A rectangle `-`/Delete mutation uses `mutateRange`; it does not use the
  structural engine `delete()` method.
- A rectangle insertion shifts the rectangle and active cell right by one
  column. It does not widen the rectangle.
- After a rectangle insertion, `selectedRows` stays the same because the row
  span did not change.
- Undo and redo do not restore a previous React selection or cursor snapshot.
  The current UI keeps the current UI selection unless a separate clamp is
  needed.
- Row reordering changes engine row order but does not remap the React row
  numbers in `selectedRows`, `selectionAnchorRow`, or `selectionBlock`.
- Whole-column deletion clamps the active cell after the width refresh, but the
  current implementation does not translate the selection block's columns.
- Horizontal movement changes the active cell by one column in the movement
  direction and does not clear the current selection block.
- The grid paints a loading/padding cell when a cell is outside the current
  viewport cache. It does not block pointer interaction just because the byte
  is temporarily unavailable.

## 1. Scope and ownership

The sequence editor has three relevant ownership layers:

1. The Rust/WASM engine owns the alignment matrix, row names, row order, alignment width, and edit history.
2. The Web Worker owns the live WASM engine instance and executes every engine call off the main thread.
3. React owns UI state only: focus, active cell, selection, dataset metadata, search state, palette state, busy state, messages, revisions, and viewport-local byte/name caches.

React must never reconstruct, mirror, or optimistically mutate the complete alignment matrix. React may hold only the bytes returned for the currently cached viewport window and the names requested for visible or overscanned rows.

Every edit must be sent to the engine through the worker. The UI must wait for the engine response before treating the edit as successful, changing the dirty state, advancing a cursor, or changing a selection range.

The engine is synchronous internally, but every frontend-facing worker method is asynchronous and must be awaited.

### 1.1 Single engine instance

- Call `useEngineWorker()` exactly once for an editor instance.
- Pass the resulting `EngineClient` through props or controller boundaries.
- Do not call `useEngineWorker()` independently from the grid, benchmark panel, toolbar, or dialogs.
- Independent hook calls create independent workers and independent empty engines.
- The controller serializes edit commands through one queue. Do not bypass that queue for UI edits.

### 1.2 Single source of truth

The following values must come from the engine after a successful command:

- sequence count;
- alignment width;
- undo depth;
- redo depth;
- viewport bytes;
- row names;
- exported FASTA.

The React controller may store the returned metadata and viewport bytes, but it must not infer new sequence bytes from the previous cache.

## 2. Character alphabet and byte rules

### 2.1 Valid nucleotide symbols

The engine accepts these IUPAC nucleotide symbols in both uppercase and lowercase form:

```text
A C G T U R Y S W K M B D H V N
```

The gap symbol is exactly:

```text
-
```

The UI sends uppercase mutation characters. FASTA loading uppercases sequence bytes before storing them in the engine.

### 2.2 Invalid sequence characters

A character that is not an IUPAC nucleotide symbol and is not `-` is invalid for mutation purposes. Examples include:

```text
X  .  ?  _  space  amino-acid-only symbols
```

Viewport padding is a special case. A space byte (`0x20`) may be returned by the viewport for a column beyond the physical end of a ragged row. It is not a valid editable nucleotide and must not be treated as a real gap.

The application preflight normally rejects ragged FASTA input, but the lower-level engine remains permissive and can contain rows of different lengths. Engine methods must therefore retain their out-of-range and padding behavior.

### 2.3 Character comparisons

- Mutation validation uses the engine alphabet predicates.
- Do not validate nucleotide characters with a frontend-only hard-coded check if the operation crosses the engine boundary.
- Do not silently convert invalid characters into gaps.
- Do not treat viewport padding spaces as `-`.

## 3. Coordinate conventions

There are three coordinate conventions. Confusing them is a primary source of editing bugs.

### 3.1 Alignment coordinates

Alignment row and column indices are zero-based:

```text
row 0 = first sequence
col 0 = first alignment column
```

User-visible coordinates are one-based:

```text
displayed row = row + 1
displayed column = col + 1
```

The live region and ruler display one-based coordinates. Engine requests use zero-based coordinates.

### 3.2 Engine mutation ranges

Engine mutation ranges are inclusive at both ends.

For a rectangle:

```text
startRow <= row <= endRow
startCol <= col <= endCol
```

The frontend `mutate(rows, columns, base)` API passes row and column index lists. The Rust `mutate_base(rows, cols, base)` method operates on these row and column shapes.

The row list is the authoritative row target for the engine call. For a UI
rectangle, build it as every integer from the normalized row start through the
normalized row end. Do not send only the active row.

### 3.3 Viewport ranges

Worker viewport requests also use inclusive ranges:

```text
startRow <= row <= endRow
startCol <= col <= endCol
```

The frontend cache uses half-open bounds internally:

```text
[startRow, endRow)
[startCol, endCol)
```

Therefore, a half-open cache request must be converted as follows before crossing the worker boundary:

```text
engine endRow = cache endRow - 1
engine endCol = cache endCol - 1
```

A viewport response has `rows * cols` bytes. `cols` is the fixed row stride. Never index a response using the requested end values without first using the response metadata.

## 4. Selection model

The editor selection is represented by three related concepts:

1. `activeCell`: the cell that owns keyboard focus and is shown with the cursor outline.
2. `selectionBlock`: an optional normalized rectangular block.
3. `selectedRows`: the row set affected by row selection and rectangle operations.

The alignment bytes are not stored in selection state.

### 4.1 Active cell

`activeCell` is one zero-based `{ row, col }` coordinate.

`cellFocused` is a separate boolean. It starts as `false` and becomes `true`
only after an explicit cell action:

- clicking a cell;
- pressing a cell-navigation key such as ArrowLeft/ArrowRight/ArrowUp/ArrowDown,
  Home, End, PageUp, or PageDown;
- performing a cell edit or horizontal movement through the grid.

Clicking a FASTA header and moving rows with Ctrl/Cmd+ArrowUp/Down do not set it
to `true`. While it is `false`, the grid does not paint the active-cell outline
and does not run the scroll-into-view calculation. This prevents a row-only
operation at the bottom of the alignment from scrolling back to the fallback
coordinate `{ row: 0, col: 0 }`.

The two selection modes are:

| Mode | Entered by | Visual selection | Allowed keyboard actions |
| --- | --- | --- | --- |
| Header-row mode (`cellFocused = false`) | Dataset load, or click/Shift-click/Ctrl-click in the FASTA gutter | Selected full rows, including their gutter labels and visible alignment cells | Ctrl/Cmd+ArrowUp/Down, undo, redo |
| Alignment-cell mode (`cellFocused = true`) | Click a cell, Shift-click a cell, drag across cells, or use cell commands after cell focus | Active cell and optional rectangular cell block | Cell navigation, mutation, insertion, deletion, horizontal movement, row movement, undo, redo |

Clicking a cell clears `selectedRows` and the row-only mode. Clicking a header
clears `selectionBlock`, updates `selectedRows`, and enters row-only mode. A
header selection is therefore not an implicit cell selection even though the
same row is visibly shaded across the alignment canvas.

The active cell is used for:

- the focus outline;
- the live coordinate announcement;
- single-cell mutations;
- the endpoint for keyboard navigation;
- the fallback row/column when there is no rectangle selection.

The active cell is not necessarily the top-left cell of a rectangle. A mouse drag may finish at any corner. The drag endpoint remains the active cell for navigation and display, while operations that require an origin use normalized selection bounds.

### 4.2 Normalized selection block

A `selectionBlock` stores inclusive bounds:

```ts
interface SelectionBlock {
  startRow?: number;
  endRow?: number;
  startCol: number;
  endCol: number;
}
```

When a block is created from an anchor and endpoint, normalize each axis independently:

```text
startRow = min(anchorRow, endpointRow)
endRow   = max(anchorRow, endpointRow)
startCol = min(anchorCol, endpointCol)
endCol   = max(anchorCol, endpointCol)
```

The block is therefore identical regardless of drag direction. A left-to-right drag and a right-to-left drag that cover the same cells must produce the same normalized bounds.

When a block has only one row, `startRow` and `endRow` may be omitted. Consumers must treat omitted row bounds as the active row.

The exact fallback is:

```text
effectiveStartRow = selectionBlock.startRow ?? activeCell.row
effectiveEndRow   = selectionBlock.endRow   ?? activeCell.row
```

The current pointer-drag path always supplies both row fields. The current
keyboard Shift+Left/Shift+Right path can preserve or omit them depending on
whether the previous block came from a pointer rectangle.

### 4.3 Selected rows

For a rectangle, `selectedRows` must contain every row between `startRow` and `endRow`, inclusive, in ascending order.

For a row-label selection:

- clicking selects one row;
- Shift-click selects the inclusive row range from the anchor row to the clicked row;
- Ctrl-click or Cmd-click toggles the clicked row;
- row indices are deduplicated, bounded, and sorted.

For a cell rectangle, the row list is derived from the rectangle. Do not use only the active row for a rectangle mutation.

### 4.4 Selection rendering

A cell is inside the rectangle if and only if:

```text
startRow <= row <= endRow
and
startCol <= col <= endCol
```

Selection overlays must not replace the nucleotide identity color. The rendering order is:

1. base background and foreground identity;
2. search-hit overlay;
3. selected-row and selected-block overlay;
4. active-cell outline;
5. fixed ruler/gutter and separators.

The active-cell outline is independent from the rectangle overlay. The endpoint may be anywhere inside the selected rectangle.

### 4.5 Pointer behavior

A pointer drag over cells creates a rectangular selection:

- pointer down establishes the drag anchor;
- pointer move updates the endpoint and normalized rectangle;
- pointer up commits the rectangle;
- dragging may proceed left or right and up or down;
- the rectangle includes both the anchor cell and endpoint cell;
- the active cell is the endpoint cell;
- `selectedRows` is regenerated from the normalized row bounds;
- the selection anchor is retained for row-range behavior.

A plain click on a cell clears the previous block and row selection and makes that cell the active cell.

A Shift-click on a cell extends a rectangle from the current active cell to the clicked cell.

A click in the name gutter performs row selection and clears the cell block.

The current interaction layer does not store a selected-column list separately. Columns are always derived from `selectionBlock.startCol` through `selectionBlock.endCol`, inclusive.

The exact pointer sequence is:

1. On primary-button pointer down, focus the grid root.
2. Hit-test the pointer against the scroll container.
3. Ignore the event if it is outside the loaded row/column range, on the ruler,
  or outside the cell/gutter surfaces.
4. If it is in the gutter, apply row selection and return. Do not start a cell
  drag.
5. If it is in a cell, store `{ startRow: point.row, startCol: point.col }` in
  the drag ref and capture the pointer on the scroll container.
6. Without Shift, set the clicked cell active, clear `selectedRows`, set the
  row anchor to the clicked row, and clear `selectionBlock`.
7. With Shift, create a rectangle from the previous active cell to the clicked
  cell, set the clicked cell active, set `selectedRows` to the rectangle's
  row span, set the row anchor to the previous active row, and store the
  rectangle.
8. While the pointer is captured, every cell pointer move creates a new
  normalized rectangle from the drag anchor to the pointer cell. Set the
  pointer cell active and replace `selectedRows` with the rectangle's row
  span.
9. On pointer up, release pointer capture and clear the drag ref. Keep the
  last active cell and selection state.

The grid does not require a minimum drag distance. A pointer down followed by
one pointer move over the same cell produces a one-cell rectangle. A pointer
down and pointer up with no pointer move is a plain click and leaves
`selectionBlock = null`.

The hit-test formulas are exact. Let `screenX = clientX - rect.left`,
`screenY = clientY - rect.top`, `contentX = screenX + scrollLeft` for cells,
and `contentY = screenY + scrollTop`:

```text
if screenX < labelWidth:
  surface = 'ruler' when contentY < rulerHeight, otherwise 'gutter'
  row = max(0, floor((contentY - rulerHeight) / cellHeight))
  col = 0
else:
  surface = 'ruler' when contentY < rulerHeight, otherwise 'cell'
  col = max(0, floor((contentX - labelWidth) / cellWidth))
  row = max(0, floor((contentY - rulerHeight) / cellHeight))
```

The current geometry values are `cellWidth = 18`, `cellHeight = 22`,
`rulerHeight = 26`, and the initial `labelWidth = 190`. The label width can be
resized between `120` and `420` pixels and the live value is used in all of
these formulas.

### 4.6 Selection origin versus active endpoint

This rule is mandatory:

> The active endpoint is for focus and display. The normalized block origin is for rectangle operations.

For an operation over a selected block:

```text
operationStartCol = min(selectionBlock.startCol, selectionBlock.endCol)
operationEndCol   = max(selectionBlock.startCol, selectionBlock.endCol)
operationStartRow = min(selectionBlock.startRow, selectionBlock.endRow)
operationEndRow   = max(selectionBlock.startRow, selectionBlock.endRow)
```

Never use `activeCell.col` as the insertion origin when a block exists. Doing so makes left-to-right drags insert at the wrong edge because the active cell is the drag endpoint.

## 5. Edit command routing

Every command follows this sequence:

1. Ignore the key if focus is inside an input, textarea, select, contenteditable element, or open dialog.
2. Convert the key event to a pure `EditorCommand`.
3. Ignore the command when no alignment is loaded or another command is busy.
4. Prevent the browser default only when the command is handled by the editor.
5. Resolve the current active cell, selection block, and selected rows from the controller state.
6. If `cellFocused = false`, reject every command except `moveRows`, `undo`, and `redo`.
7. Normalize the operation bounds.
8. Await the controller command, which awaits the worker and engine.
9. Only after success update cursor/selection state that depends on the edit.
10. Refresh metadata and increment the data revision through the controller.
11. Invalidate and refetch the affected viewport. Never optimistically edit cached bytes.

The controller queue must preserve command order. If a user presses keys quickly, commands execute sequentially in the order received.

## 6. Exact keyboard semantics

### 6.1 Navigation

| Key | Behavior |
| --- | --- |
| ArrowLeft | Move active cell one column left, bounded at column 0. Clears the block unless Shift is held. |
| ArrowRight | Move active cell one column right, bounded at the final column. Clears the block unless Shift is held. |
| ArrowUp | Move active cell one row up, bounded at row 0. Clears the block. |
| ArrowDown | Move active cell one row down, bounded at the final row. Clears the block. |
| Shift+ArrowLeft | Move left and extend the same-row block. |
| Shift+ArrowRight | Move right and extend the same-row block. |
| Home | Move to column 0 on the active row and clear the block. |
| End | Move to the final alignment column on the active row and clear the block. |
| PageUp | Move up by the current bounded page step of 10 rows and clear the block. |
| PageDown | Move down by the current bounded page step of 10 rows and clear the block. |
| Ctrl/Cmd+ArrowUp | Move the selected FASTA header rows up by one engine step. |
| Ctrl/Cmd+ArrowDown | Move the selected FASTA header rows down by one engine step. |

Navigation is UI-only and does not create an undo entry or mark the dataset dirty.

A plain left/right arrow must collapse a previous selection instead of retaining the old rectangle.

Ctrl/Cmd+ArrowUp and Ctrl/Cmd+ArrowDown are checked before ordinary ArrowUp
and ArrowDown. They therefore never move the cell cursor. They call the row
move command instead. If `selectedRows` is non-empty, those rows are moved. If
it is empty, only `[activeCell.row]` is moved. The selected row indices are
then remapped to the rows where the same records ended up.

This makes repeated movement possible without reselecting. For example, after
selecting row `0`, pressing Ctrl/Cmd+ArrowDown five times sends five row-move
commands for the moving record. The selected row index becomes `1`, then `2`,
then `3`, then `4`, then `5`, assuming none of those moves is blocked by a
boundary.

The key mapper checks combinations in this order:

1. Ctrl/Cmd+Z becomes undo, or redo when Shift is also held.
2. Ctrl+Y or Cmd+Y becomes redo. The normal modifier check also treats Cmd as
  a modifier for nucleotide keys.
3. Alt+Left and Alt+Right become horizontal movement.
4. The remaining key name is matched against the direct key table below.
5. Any other key is considered a nucleotide mutation only when its uppercase
   form is in the IUPAC key set and neither Ctrl/Cmd nor Alt is held.

For direct key-table entries, Ctrl, Cmd, Alt, and Shift are not otherwise
checked. Therefore, for exact compatibility:

- Shift+ArrowLeft/Right extends a block because Shift is read explicitly.
- Shift+A still mutates to `A` because Shift does not disable nucleotide keys.
- Ctrl+Delete still maps to `deleteGap` because `Delete` is a direct key-table
  entry.
- Ctrl+Space still maps to insertion because Space is a direct key-table entry.
- Alt+Up and Alt+Down still map to vertical movement; only Alt+Left/Right are
  intercepted as horizontal movement.
- Ctrl/Cmd/Alt nucleotide keys are ignored unless they were already handled by
  the undo/redo rules.

The recognized direct keys are exactly:

```text
' '          -> insert
'-'          -> deleteGap
'Delete'     -> deleteGap
'ArrowDown'  -> move down, extend false
'ArrowLeft'  -> move left, extend = Shift
'ArrowRight' -> move right, extend = Shift
'ArrowUp'    -> move up, extend false
'Backspace'  -> backspace
'End'        -> end
'Home'       -> home
'PageDown'   -> pageDown
'PageUp'     -> pageUp
```

The nucleotide key set is exactly `ACGTURYKMSWBDHVN`. The mapper uppercases
`event.key` before checking it, so lowercase letter keys map to the same
uppercase mutation. The mapper returns no command for any other key.

The editor ignores a key only when the event target is an `HTMLElement` that
matches `input`, `textarea`, `select`, or `[contenteditable="true"]`, or when
that element has an ancestor with `role="dialog"`. A non-HTMLElement target is
not ignored by this helper.

### 6.2 Nucleotide mutation keys

The keys below produce a mutation command with an uppercase base:

```text
A C G T U R Y S W K M B D H V N
```

When no rectangle exists:

- target rows are `selectedRows` if non-empty, otherwise `[activeCell.row]`;
- target column is `activeCell.col`;
- the engine uses the single-column `mutate` operation;
- on success the active cell advances one column, bounded to the alignment width.

When a rectangle exists:

- target rows are every row in the normalized block;
- target columns are every column from `startCol` through `endCol`, inclusive;
- the engine uses one `mutateRange` operation;
- the operation is atomic and creates one history entry;
- the active cell does not advance;
- the rectangle remains anchored to the same coordinates because mutation does not change alignment structure.

A rectangle mutation must never be implemented as one frontend command per column. Doing so would create multiple history entries and could produce partial edits.

### 6.3 Space insertion

`Space` inserts gaps. It is structural and changes alignment width.

Without a rectangle:

- target rows are `selectedRows` if non-empty, otherwise `[activeCell.row]`;
- insert at `activeCell.col`;
- the engine inserts `-` in target rows;
- non-target rows receive an appended `-` to preserve matrix width;
- alignment width increases by one;
- after success, the active cell advances one column.

With a rectangle:

- target rows are all rows in the normalized rectangle;
- insertion column is `selectionBlock.startCol`, never the active endpoint column;
- only one gap is inserted at that left edge, not one gap per selected column;
- the alignment width increases by one;
- every selected block column shifts right by one coordinate;
- `selectionBlock.startCol` and `selectionBlock.endCol` each increase by one;
- row bounds do not change;
- the active cell column increases by one so it remains associated with the same original base;
- the active row does not change;
- the shifted rectangle remains selected after the edit.

The selected rectangle is not widened by insertion. It is translated one column to the right because the original selected cells moved right together.

### 6.4 Dash mutation and Delete

The `-` key and the `Delete` key are mapped to `deleteGap`, but in the current UI this means **mutate the target cell(s) to `-`**. It is not the engine's structural `delete()` operation.

Without a rectangle:

- mutate the selected target rows at `activeCell.col` to `-`;
- on success, advance the active cell one column.

With a rectangle:

- mutate every selected row and every selected column to `-` using one `mutateRange` call;
- do not structurally remove any column;
- do not shift the rectangle;
- do not advance the active cell.

This distinction must remain explicit in code and documentation:

```text
Delete key / '-' key in the grid = set selected bases to '-'
Backspace = structural subset deletion at the previous column
Engine delete() = structural subset deletion, gap-only
Engine deleteColumn() = structural full-column deletion
```

### 6.5 Backspace

Backspace performs structural subset deletion at the column immediately before the active cell.

- If `activeCell.col === 0`, no engine call is made and an announcement states that the cursor is already at the first column.
- Otherwise, the target column is `activeCell.col - 1`.
- The engine `delete()` operation requires every targeted row at that column to contain `-`.
- On success, the target rows remove that gap and append a gap at the end, preserving row length.
- The alignment width does not change.
- The active cell moves one column left.
- An invalid target returns `DeleteNotGap`, leaves all bytes unchanged, and must not move the cursor.

Current implementation note: with a rectangle selected, Backspace uses the selected rows but still targets one column, `activeCell.col - 1`. It does not structurally delete every column in the rectangle. Do not describe Backspace as rectangle-wide unless that behavior is deliberately implemented and tested separately.

### 6.6 Undo and redo

| Key | Behavior |
| --- | --- |
| Ctrl/Cmd+Z | Undo one engine command. |
| Ctrl/Cmd+Shift+Z | Redo one engine command. |
| Ctrl+Y | Redo one engine command. |

Undo and redo are engine operations, not React cache operations. After either operation:

- fetch fresh metadata;
- increment the data revision;
- invalidate the viewport cache;
- refetch the visible/overscanned range;
- preserve the current scroll position unless the dataset itself was reloaded;
- do not reconstruct bytes from old React state.

A rectangle mutation must undo and redo as one command. A structural insertion must undo and redo as one structural snapshot command.

### 6.7 Horizontal movement

Alt+Left and Alt+Right, and the matching toolbar buttons, invoke `moveHorizontal`.

- The engine moves by exactly one column per command.
- The selected columns are normalized from the current block if one exists; otherwise only the active column is used.
- The engine operation is row-specific.
- The current implementation applies the move to the active row, not every row of a multi-row rectangle.
- All moved characters must be IUPAC symbols, not gaps.
- The adjacent destination must be a gap.
- The move is rejected atomically with `MoveNotIupac` or `MoveNoGapTarget` when invalid.
- Structural movement creates a structural history snapshot.

### 6.8 Row movement

Row movement is explicit toolbar behavior:

- Move selected rows up by one row.
- Move selected rows down by one row.
- If no rows are selected, operate on the active row.
- Rows at the relevant boundary are skipped by the engine.
- Names and nucleotide sequences move together.
- Row movement creates a structural history snapshot.
- A rectangle selection supplies its selected row span to row movement.

After a successful row move, remap positions by simulating the engine's exact
swap order:

- Up: sort the requested row indices ascending and swap each valid row `r` with
  `r - 1` in that order.
- Down: sort the requested row indices descending and swap each valid row `r`
  with `r + 1` in that order.

Apply the same swaps to every tracked position: each selected row, the active
row if it is one of the moved records, the row-selection anchor if it is one of
the moved records, and the rectangle's start/end rows if a rectangle exists.
Then sort and deduplicate the resulting selected row indices. This is not
equivalent to simply adding or subtracting one when selected rows are adjacent
or include the first/last row.

Header selection and cell focus are independent. Clicking a header changes
`selectedRows` and `selectionAnchorRow`, clears `selectionBlock`, and leaves
`activeCell` unchanged. Therefore a row move can preserve a selected header
record even when the cell cursor is on another row.

### 6.9 Whole-column deletion

Whole-column deletion is explicit toolbar/menu behavior and requires confirmation.

- The active column is deleted from every row.
- The alignment width decreases by one when the column is valid.
- The active cell is clamped to the new final column if necessary.
- The operation creates a structural history snapshot.
- It is distinct from the `Delete` key, which currently mutates bases to `-`.

### 6.10 Exact keyboard-selection extension behavior

For Shift+Left/Right, the current helper uses the previous block's
`startCol`, not its `endCol`, as the retained anchor. In plain language:

```text
newStartCol = min(previousBlock.startCol or activeCol, nextCol)
newEndCol   = max(previousBlock.startCol or activeCol, nextCol)
```

The previous block's optional row bounds are copied unchanged. This is the
current implementation behavior even when repeated leftward extension causes a
selection to shrink differently from a conventional spreadsheet selection.
An exact replacement must either reproduce this helper or deliberately record
the behavior change and update its tests and this document.

## 7. Rust engine mutation rules

The Rust engine is the authoritative validator. All mutation methods validate before changing any sequence. A validation failure must leave every targeted and non-targeted cell unchanged.

### 7.1 Single-column mutation

`mutate_base_subset(rows, col, new_base)`:

- validates `new_base` before inspecting or changing rows;
- validates every in-range target cell before changing any cell;
- changes only in-range target rows at one column;
- silently skips out-of-range rows and columns;
- records old bases for one substitution history command when at least one in-range cell exists;
- clears redo history after a successful recorded mutation;
- does not change row length or alignment width.

If a target row/column is out of range, that position is skipped rather than treated as padding and rather than causing an error.

The JavaScript `mutate()` method sends only the first UTF-16 code unit of the
`base` string as the byte value. The UI always supplies one uppercase ASCII
character. A replacement API that accepts a string must either preserve this
first-character rule or reject non-single-character input before sending it.

### 7.2 Base mutation
 
`mutate_base(rows, cols, new_base)`:

- operates across the target shape defined by rows and columns;
- validates `new_base` before changing anything;
- deduplicates duplicate row and column indices;
- validates every in-range target cell before changing any target cell;
- silently skips out-of-range rows and columns;
- stores each changed position as `(row, col, old_base)`;
- changes every collected position to `new_base`;
- creates one `Substitutions` history command;
- clears redo history after a successful recorded mutation;
- leaves names, row order, row lengths, and alignment width unchanged.

If the shape is empty or no in-range positions exist, the operation is a no-op and creates no history command.

If the new base equals the old base, the current engine still records the in-range position because it records positions rather than filtering equal-value writes. Any change to that behavior must update history tests and UI expectations.

The Rust method uses an all-or-nothing validation phase. It must never mutate the first part of a shape and then discover an invalid character later.

### 7.3 Structural insertion

`insert_at_subset(rows, col)`:

- inserts only `-`;
- clamps the requested insertion column to the current alignment width;
- inserts at the requested position in target rows;
- pads short target rows with gaps until the insertion position exists;
- appends one gap to every non-target row;
- increases the global alignment width by one after the operation;
- records a full structural snapshot;
- clears redo history.

The frontend must calculate target rows from the selection rectangle, but must pass only one insertion column: the normalized left edge.

Additional engine edge cases:

- Inserting into an empty engine returns success, changes nothing, and creates
  no history entry.
- Inserting into a non-empty engine with an empty row list still records a
  structural snapshot and appends one gap to every row, because every row is a
  non-target.
- A column greater than the current alignment width is clamped to the current
  width. The result is an appended gap in target rows and a width increase of
  one.

### 7.4 Structural subset deletion

`delete_at_subset(rows, col)`:

- first validates that every in-range target cell at `col` is `-`;
- if any target cell is not a gap, returns `DeleteNotGap` without changing anything;
- removes the target cell from each target row;
- appends `-` to each target row to preserve its length;
- leaves non-target rows untouched;
- leaves global alignment width unchanged;
- records a full structural snapshot after validation;
- clears redo history.

Additional engine edge cases:

- An empty row list passes validation and records a structural snapshot, but
  changes no row bytes.
- An out-of-range row is ignored during validation and mutation.
- An out-of-range column is ignored for each row; it does not count as a
  non-gap and does not produce `DeleteNotGap`.

### 7.5 Whole-column deletion

`delete_column(col)`:

- applies to every row;
- removes the cell at `col` when present;
- decreases alignment width by one only when `col` is within the global width;
- is a no-op outside the global width;
- records a full structural snapshot for a valid operation;
- clears redo history.

### 7.6 Horizontal movement

`move_horizontal(row, cols, direction)`:

- reduces `cols` to the inclusive range from its minimum to maximum value;
- requires every character in that range to be IUPAC, not `-`;
- requires a gap immediately outside the range in the requested direction;
- rotates the block by one position;
- does not change row length or global width;
- records a structural snapshot;
- returns `MoveNotIupac` or `MoveNoGapTarget` on failure without modifying anything.

### 7.7 Row reordering

`move_rows_up(rows)` and `move_rows_down(rows)`:

- move by exactly one row per call;
- move names and sequences together;
- tolerate boundary rows as no-ops;
- create structural snapshots according to current engine behavior;
- do not change sequence bytes within a row.

`move_rows_up()` and `move_rows_down()` return success without a history entry
when the engine is empty or the row list is empty. On a non-empty engine with
at least two rows, the current implementation records a structural snapshot
even when every requested row is out of range or already at the relevant
boundary.

## 8. History rules

### 8.1 History command types

The engine currently has three logical history categories:

1. `Substitutions` for one-column mutations.
2. `RangeSubstitutions` for rectangular mutations.
3. `StructuralSnapshot` for insertions, deletions, whole-column deletion, horizontal movement, and row reordering.

### 8.2 Atomicity

One user-visible editing action must map to one engine history command.

Do not implement a rectangle mutation by looping over columns and calling `mutate()` once per column. That would make one user action require multiple undo presses and could leave a partial edit if a later call fails.

Do not implement a structural rectangle insertion as one insertion per selected column. A rectangle insertion means one gap insertion at one normalized origin column.

### 8.3 Redo invalidation

Any successful new edit clears the redo stack. Navigation and selection changes do not clear redo history.

A failed edit must not clear redo history.

### 8.4 Undo/redo and UI selection

Undo and redo restore engine bytes, row order, row names, and width. The UI must then refetch metadata and viewport bytes.

Selection and cursor state are UI state, not part of engine history. The controller may preserve the active cell/selection when the coordinates remain valid, but must clamp them if the restored width or row count makes them invalid.

## 9. Controller and worker rules

### 9.1 Command serialization

The controller's `runCommand()` queue is mandatory for edits.

- Set busy before the operation starts.
- Await the worker operation.
- Refresh metadata after the engine operation succeeds.
- Increment the data revision after success.
- Clear stale search hits after data changes.
- Clear busy only after metadata refresh and command state dispatch complete.
- Map engine error codes to user-facing messages without discarding the original `Error.code`.

### 9.2 Worker request representation

Rows are transmitted as `Uint32Array`, not ordinary arrays, because the WASM binding accepts typed row vectors.

A range mutation request has this shape:

```ts
{
  type: 'mutateRange',
  rows: Uint32Array,
  startCol: number,
  endCol: number,
  base: number,
  reqId: number,
}
```

`startCol` and `endCol` are inclusive and zero-based. `base` is the ASCII code of the uppercase one-character mutation symbol.

The worker must call `mutate_base()` exactly once for one mutation operation and return the structured engine error code on rejection.

### 9.3 WASM regeneration

When the Rust public API changes:

1. Run the native Rust formatter and tests.
2. Run `pnpm build-wasm` from the repository root.
3. Confirm the generated TypeScript binding contains the new method.
4. Run the sequence-editor TypeScript check and production build.

Never hand-edit generated WASM JavaScript, declarations, or binaries.

### 9.4 Worker failures

Worker crashes, initialization failures, message-channel failures, and unmounts reject pending calls. These failures are not engine validation failures and do not have an engine mutation code such as `DeleteNotGap`.

The UI must not remain busy forever after a worker failure.

### 9.5 Exact controller operation table

The current controller wraps operations with these exact options:

| Controller method | Engine call(s) | `dirty` on success | `updateRevision` | Cursor/selection update after success |
| --- | --- | ---: | ---: | --- |
| `loadFasta` | `load`, then `meta` | `false` | `true` plus dataset reset | Reset by dataset reset to cell `{0, 0}` and no selection |
| `mutate` | `mutate`, then `meta` | `true` | `true` | Mutates target shape; preserves selection |
| `insert` | `insert`, then `meta` | `true` | `true` | Caller handles insertion transform |
| `delete` | `delete`, then `meta` | `true` | `true` | Caller moves active cell left on success |
| `deleteColumn` | `deleteColumn`, then `meta` | `true` | `true` | Controller clamps active cell after metadata returns |
| `moveHorizontal` | `moveHorizontal`, then `meta` | `true` | `true` | Caller moves active cell one column in the direction |
| `moveRowsUp` | `moveRowsUp`, then `meta` | `true` | `true` | No cursor/selection remapping |
| `moveRowsDown` | `moveRowsDown`, then `meta` | `true` | `true` | No cursor/selection remapping |
| `undo` | `undo`, then `meta` | `true` | `true` | No cursor/selection restore |
| `redo` | `redo`, then `meta` | `true` | `true` | No cursor/selection restore |
| `exportGappedFasta` / `exportUngappedFasta` | `exportGappedFasta` / `exportUngappedFasta`, then browser download | `false` | `false` | None |

`loadFasta` dispatches `resetForDataset` inside its queued operation and then
dispatches `commandSucceeded` after the operation returns. Therefore the
current reducer increments `dataRevision` once in the dataset-reset action and
once again in the successful command action. It increments `datasetRevision`
once. Reproducing the current reducer exactly requires retaining both data
revision increments.

The controller's `setMetadata` action is dispatched when `meta()` returns,
before `commandSucceeded`. This means a render can briefly contain fresh
metadata with the previous `dataRevision` before the success action is
processed. The grid must use the revision token on its cache and discard stale
responses; it must not assume metadata and bytes arrive in one React dispatch.

## 10. Revision, cache, and viewport rules after edits

### 10.1 Data revision

Every successful data-changing command increments `dataRevision`:

- mutation;
- rectangle mutation;
- insertion;
- structural deletion;
- whole-column deletion;
- horizontal movement;
- row movement;
- undo;
- redo.

A data revision invalidates cached viewport bytes and stale name requests. Stale requests must be discarded if their revision no longer matches.

### 10.2 Dataset revision

Loading a new FASTA dataset increments `datasetRevision`.

A dataset revision resets:

- scroll position to the origin;
- active cell to row 0, column 0;
- selection block;
- selected rows;
- search results;
- dataset-local caches.

An ordinary edit must not reset scroll position to zero. Preserving the user's current horizontal and vertical viewport is mandatory.

### 10.3 Edit repaint sequence

After an edit:

1. The engine applies the operation.
2. The controller fetches fresh metadata.
3. The controller increments `dataRevision`.
4. The grid clears the old cache and invalidates pending requests.
5. The grid requests the visible overscanned rectangle for the new revision.
6. The grid paints the returned bytes.

The grid must not wait for a subsequent scroll event to repaint. A successful revision change must itself trigger a fetch.

### 10.4 Cursor visibility

The active cell should remain visible after navigation and edits, but cursor visibility must not reset the scroll anchor unnecessarily.

- Dataset load may intentionally scroll to the origin.
- An edit must preserve the current scroll position whenever the active cell is still visible.
- If an edit causes the active cell to become genuinely outside the viewport, scroll only enough to reveal it.
- Do not first reset scroll to zero and then call cursor visibility. That produces the historical jump where a cursor around column 3000 appears at the screen edge after an edit.

### 10.5 Structural width changes

Insertion increases width by one. Whole-column deletion decreases width by one. Subset deletion and mutations do not change width.

After a width change:

- preserve the current scroll anchor where possible;
- clamp scroll positions to the new scrollable extent;
- refetch the visible rectangle using the new metadata;
- update the selection block coordinates according to the structural change;
- clamp the active cell only if it exceeds the new final column.

### 10.6 Exact viewport cache lifecycle

The grid stores one replacement cache, not a set of independently stitched
tiles. A cache entry contains:

```text
startRow, startCol       inclusive cache origin
endRow, endCol           exclusive cache end
rows, cols               response dimensions
bytes                    standalone row-major Uint8Array
revision                 dataRevision used for the request
```

When the visible range is not fully contained in the cache, the grid requests a
new complete overscanned rectangle and replaces the old cache when the response
is current. It does not merge the new response into the old response.

The current geometry and overscan values are:

```text
cellWidth       = 18 CSS pixels
cellHeight      = 22 CSS pixels
rulerHeight     = 26 CSS pixels
initial gutter  = 190 CSS pixels
min gutter      = 120 CSS pixels
max gutter      = 420 CSS pixels
overscan rows   = 16
overscan cols   = 128
```

For a viewport of width `viewportWidth` and height `viewportHeight`, the visible
range is calculated as follows:

```text
visibleStartCol = max(0, floor(scrollLeft / cellWidth))
visibleEndCol   = min(cols,
  visibleStartCol + max(1, ceil((viewportWidth - labelWidth) / cellWidth) + 1))

visibleStartRow = max(0,
  floor(max(0, scrollTop - rulerHeight) / cellHeight))
visibleEndRow   = min(rows,
  visibleStartRow + max(1, ceil((viewportHeight - rulerHeight) / cellHeight) + 1))

cacheStartCol = max(0, visibleStartCol - 128)
cacheEndCol   = min(cols, visibleEndCol + 128)
cacheStartRow = max(0, visibleStartRow - 16)
cacheEndRow   = min(rows, visibleEndRow + 16)
```

The cache request sends `cacheEndRow - 1` and `cacheEndCol - 1` to the engine
because the engine request is inclusive.

There is at most one viewport request in flight. If a scroll or revision occurs
while one is active, the grid invalidates its request token. When the old
request finishes it is discarded. A subsequent render-version change causes a
fresh containment check and request.

The cache is cleared and its request token is incremented on every data
revision. Names are cleared and name-request tokens are incremented at the
same time. A dataset revision additionally sets both native scroll positions
to zero and stores `{ left: 0, top: 0 }` in React state.

The native scroll handler schedules at most one React `setScroll()` per
animation frame with `requestAnimationFrame`. It also measures the native
horizontal scrollbar as `offsetHeight - clientHeight`; the fixed gutter and
divider stop above that measured strip.

The canvas is sized in device pixels as:

```text
canvas.width  = floor(containerCssWidth  * devicePixelRatio)
canvas.height = floor(containerCssHeight * devicePixelRatio)
```

The drawing context is then scaled by `devicePixelRatio`. The grid paints only
the visible rows and columns, not the entire cache window.

## 11. Selection transformations after structural edits

### 11.1 Insertion before a selected block

For a selected rectangle with bounds:

```text
[startRow..endRow, startCol..endCol]
```

and insertion at `startCol`:

```text
new block = [startRow..endRow, startCol + 1..endCol + 1]
```

The rectangle's height is unchanged. Its width is unchanged. Its coordinate position shifts right one column.

The active cursor also shifts right one column so it remains associated with the same original cell content. The visual selection must move with the original selected bases rather than remaining over the old numeric coordinates.

### 11.2 Insertion before a non-selected active cell

With no rectangle, insertion occurs at `activeCell.col`. The active cursor advances to `activeCell.col + 1` after success.

### 11.3 Mutation

Mutation does not alter row length, alignment width, or cell coordinates. The block and active cursor coordinates remain unchanged for rectangle mutation.

Single-cell mutation retains the existing one-column advance behavior. Rectangle mutation does not advance because the action applies to a range rather than a single cursor cell.

### 11.4 Structural subset deletion

Backspace deletes one previous column position in each target row, but the global column coordinate system remains the same because each target row receives an appended gap. The current UI does not transform a rectangle's column bounds for Backspace; it targets one column derived from the active endpoint.

### 11.5 Whole-column deletion

For deletion of a full alignment column `deletedCol`:

- cells after `deletedCol` shift left by one;
- a selection start or end strictly after `deletedCol` shifts left by one;
- a selection coordinate equal to `deletedCol` must be clamped or collapsed according to the product decision for that command;
- active cell coordinates after the deleted column shift left by one;
- active cells at the removed final column clamp to the new final column.

The current implementation clamps the active cell after whole-column deletion. Any future selection transformation must be specified and tested before implementation.

## 12. Import, ragged data, and padding

The application-level import preflight is stricter than the lower-level engine:

- input must be non-empty;
- every record must have a non-empty header and sequence;
- the first whitespace-delimited header token becomes the name;
- internal sequence whitespace is removed;
- sequence data is uppercased;
- all records must have the same length for the alignment editor workflow;
- malformed or ragged input is rejected before replacing the current dataset.

The engine itself remains permissive with ragged rows. It sets `alignment_width` to the longest row and returns spaces for viewport columns beyond a short row.

A space returned from viewport padding is display-only. It cannot be deleted as a gap and cannot be mutated as if it were `-`; the engine's validation rules apply to the physical cell only when the coordinate is in range.

## 13. Error behavior

The current engine error codes are:

| Code | Meaning | Required UI behavior |
| --- | --- | --- |
| `DeleteNotGap` | Structural deletion targeted a non-gap character. | Show a non-destructive error; leave bytes, cursor, and selection unchanged. |
| `MutateNotIupac` | Source or destination is not an accepted IUPAC/gap character. | Show a non-destructive error; leave all target bytes unchanged. |
| `MoveNoGapTarget` | Horizontal movement has no gap in the requested direction. | Show a non-destructive error; leave bytes unchanged. |
| `MoveNotIupac` | Horizontal movement includes a non-IUPAC character. | Show a non-destructive error; leave bytes unchanged. |

On any engine rejection:

- do not advance the active cell;
- do not shift or clear the selection;
- do not mark a clean dataset dirty because of that failed command;
- do not increment the data revision;
- do not invalidate valid viewport bytes unnecessarily;
- preserve the structured error code for tests and diagnostics.

Worker lifecycle errors are separate from engine errors and may require retrying or reloading the application.

The current controller maps those codes to these exact messages:

```text
DeleteNotGap     -> Delete failed: the selected position is not a gap.
MoveNoGapTarget  -> Move failed: the target position must be a gap.
MoveNotIupac     -> Move failed: only nucleotide or gap characters can move.
MutateNotIupac   -> Edit failed: use a nucleotide, IUPAC ambiguity code, or gap.
```

An unknown error code uses the worker/JavaScript error message when one is
available; otherwise the fallback message is:

```text
The sequence-editor command failed.
```

## 14. Focus and browser-default rules

The grid has `role="grid"` and is keyboard focusable.

Editor keyboard commands must be ignored when the event target is:

- an `input`;
- a `textarea`;
- a `select`;
- a contenteditable element;
- an element inside an open dialog.

Prevent the browser default only for a recognized, handled editor command. Do not suppress normal typing, copy/paste, text-field editing, or dialog keyboard behavior.

The grid must retain a visible focus indicator. The live region must announce at least:

- one-based sequence number;
- one-based coordinate;
- current base or padding state;
- selected row count;
- loading/editing state when applicable;
- current edit error or result through the application status region.

## 15. Rendering and fixed-layer rules

The grid has two canvas layers and one native scroll layer:

1. The base canvas paints visible cells, search overlays, selection overlays, and active-cell outline.
2. The fixed overlay canvas paints the ruler and FASTA name gutter.
3. The transparent native scroll container owns scrolling and pointer interaction.

The fixed name gutter must not cover the horizontal scrollbar. Its paint height must stop above the native scrollbar strip. The divider must remain draggable above the scroll layer but must not intercept grid cell pointer events outside the divider.

The label width is shared by:

- viewport visible-column calculation;
- cell x-coordinate painting;
- ruler x-coordinate painting;
- name-gutter width;
- pointer hit testing;
- cursor visibility calculations;
- total scrollable width.

A change to one use of label width must be checked against all others.

## 16. Performance constraints

The grid is a two-dimensional overscanned viewport, not a full-matrix DOM renderer.

- Request only visible rows/columns plus overscan.
- Current overscan constants are 16 rows and 128 columns.
- Paint only visible rows and columns.
- Keep viewport bytes in a local cache keyed by data revision and half-open cache bounds.
- Discard stale viewport and name responses.
- Batch native scroll state updates with `requestAnimationFrame`.
- Do not call React state setters for every worker response unless the response changes a visible UI state.
- Do not copy or decode the full alignment in React.
- Do not create one DOM node per cell.
- Do not send one worker request per cell or per column for a rectangle mutation.

If scroll feels sluggish, profile in this order:

1. number of visible cells painted per frame;
2. number and size of viewport requests;
3. whether the cache covers the complete visible rectangle;
4. whether a stale request is causing repeated invalidation;
5. whether scroll events are causing more than one React update per animation frame;
6. whether fixed overlay painting is being repeated unnecessarily;
7. whether the worker is blocked by a structural snapshot or another command.

## 17. Testing requirements

Any change to editing behavior must include pure tests and at least one engine or browser integration test at the appropriate layer.

### 17.1 Pure selection tests

Cover:

- left-to-right rectangle normalization;
- right-to-left rectangle normalization;
- top-to-bottom and bottom-to-top normalization;
- single-cell selection;
- selected row derivation;
- row-label range selection;
- Ctrl/Cmd row toggling;
- insertion transformation of block bounds;
- active endpoint versus normalized operation origin.

### 17.2 Pure keyboard tests

Cover:

- all IUPAC keys;
- lowercase key normalization;
- `-` and `Delete` mapping to gap mutation;
- Backspace mapping to structural deletion;
- Space mapping to insertion;
- Shift+Left/Right extension;
- Home/End/PageUp/PageDown;
- Ctrl/Cmd undo/redo;
- Alt+Left/Right movement;
- ignored form/dialog targets.

### 17.3 Rust engine tests

Cover:

- single-column mutation validation;
- rectangular mutation across rows and columns;
- rectangle mutation preflight rejection with no partial writes;
- duplicate row deduplication;
- ragged-row out-of-range skipping;
- range mutation undo and redo as one command;
- insertion at a normalized selection origin;
- structural deletion gap validation;
- no width change for mutation and subset deletion;
- width change for insertion and whole-column deletion;
- redo invalidation after a new edit.

### 17.4 Browser tests

At minimum, verify:

1. Load the bundled demo.
2. Drag left-to-right across several columns.
3. Press Space and verify the selection shifts right with the original cells.
4. Press `A` and verify every selected cell changes.
5. Press `-` and verify every selected cell changes to a gap.
6. Repeat `G`, `A`, and `-` and verify the active cursor coordinate does not advance for rectangle mutations.
7. Repeat the same tests right-to-left and bottom-to-top.
8. Select several rows and columns and verify all rows are edited.
9. Attempt Backspace on a non-gap and verify `DeleteNotGap` leaves state unchanged.
10. Undo and redo a rectangle mutation and verify one command restores/reapplies the entire rectangle.
11. Verify viewport bytes repaint without requiring a scroll event.
12. Verify scroll position is preserved after edits.

## 18. Safe extension rules

When adding a new edit operation:

1. Define whether it is a character mutation or structural mutation.
2. Define exact inclusive target coordinates.
3. Define behavior for ragged rows and out-of-range coordinates.
4. Define validation order and the exact error code.
5. Define whether the operation changes width, row order, names, or row lengths.
6. Define the history command and whether the user action is one undo step.
7. Define active-cell behavior after success and failure.
8. Define selection transformation after success and failure.
9. Define revision/cache invalidation.
10. Add a typed worker request and client method if the operation crosses the worker boundary.
11. Regenerate WASM bindings after Rust API changes.
12. Add pure, Rust, and browser tests before changing neighboring behavior.

Do not infer any of these rules from the visual result alone. The engine, controller, selection helpers, and renderer must agree on the same coordinates and operation boundaries.

## 19. Quick reference

```text
Zero-based engine coordinates; one-based display coordinates.
Engine ranges are inclusive; frontend cache ranges are half-open.
Active cell is the focus endpoint, not necessarily the operation origin.
Rectangle operations use normalized min/max row and column bounds.
Space inserts one gap at the rectangle's left edge.
Insert shifts the selected rectangle right by one column.
A/C/G/T/IUPAC mutates the whole rectangle atomically.
'-' and Delete mutate the whole rectangle to gaps; they do not remove columns.
Backspace structurally deletes one previous gap column per target row.
Rectangle mutations do not advance the active cursor.
Single-cell mutations advance the active cursor by one column.
One user action maps to one engine history command.
Failed edits change no bytes, selection, cursor, revision, or redo history.
Edits invalidate/refetch data but preserve scroll position.
Dataset loads reset scroll, cursor, selection, and caches.
React never owns the complete alignment matrix.
```
