/* tslint:disable */
/* eslint-disable */

/**
 * Direction for horizontal character movement.
 */
export enum MoveDirection {
    Left = 0,
    Right = 1,
}

/**
 * The core MSA engine. Owns the alignment matrix, row names, the reusable
 * viewport buffer, and the undo/redo stacks.
 */
export class MsaEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Simultaneous deletion at a single column index on a subset of rows.
     * Only rows in `row_indices` are affected: the character at `col_idx`
     * is removed and a `-` is appended at the end to keep width unchanged.
     * Non-target rows are completely untouched.
     *
     * Returns an empty string on success, or `ERR_DELETE_NOT_GAP` if any
     * target position contains a non-`-` character (all-or-nothing).
     */
    delete_at_subset(row_indices: Uint32Array, col_idx: number): string;
    /**
     * Delete a column from every row, shrinking `alignment_width` by 1.
     * This is the width-preserving inverse of a full-column insert.
     * Returns an empty string on success.
     */
    delete_column(col_idx: number): string;
    /**
     * Global alignment width (columns). Zero if nothing is loaded.
     */
    get_alignment_width(): number;
    get_aminoacid_view(row: number): Uint8Array;
    /**
     * Return the raw byte at `(row, col)`, or `0` if out of range.
     * Useful for the test harness to spot-check individual cells.
     */
    get_base(row: number, col: number): number;
    /**
     * Return the name/identifier of a given row, or an empty string if the
     * index is out of range.
     */
    get_name(row: number): string;
    /**
     * Return the length of a specific row, or `0` if the row index is invalid.
     */
    get_row_length(row: number): number;
    /**
     * Number of sequences currently loaded.
     */
    get_sequence_count(): number;
    /**
     * Number of bytes currently held in the viewport buffer.
     */
    get_viewport_len(): number;
    /**
     * Simultaneous gap insertion at a single column index on a subset of
     * rows. The inserted character is always `-` (gap). Target rows receive
     * the gap at the clamped insertion column; non-target rows have a `-`
     * appended at the end to keep matrix width consistent.
     *
     * Returns an empty string on success (no validation needed since only
     * `-` can be inserted).
     */
    insert_at_subset(row_indices: Uint32Array, col_idx: number): string;
    /**
     * Parse FASTA content and populate the engine.
     *
     * Performs a line-by-line scan. Sequences may span multiple lines;
     * a new sequence begins at any line starting with `>`. Whitespace and
     * blank lines are ignored. All sequence bytes are uppercased.
     *
     * The sequences are assumed to be pre-aligned as this is given from
     * loculus as a provider of the sequence data. After all sequences are
     * parsed, `alignment_width` is set to the length of the longest
     * sequence. Shorter sequences are NOT automatically padded.
     * Callers can detect ragged alignments via `get_row_length`.
     *
     * Returns the number of sequences parsed after successful engine population.
     */
    load_fasta(fasta_content: string): number;
    /**
     * Move a contiguous block of IUPAC characters horizontally by 1 position
     * within a single row. Each call moves exactly 1 position; callers must
     * issue multiple calls for multi-position moves.
     *
     * `col_indices` is treated as a range `[min, max]`, non-contiguous
     * indices are clamped to their min/max.
     *
     * **Left move:** validates the selected chars are IUPAC and the position
     * to the left is `-`, then rotates the block left by 1.
     *
     * **Right move:** validates the selected chars are IUPAC and the position
     * to the right is `-`, then rotates the block right by 1.
     *
     * Returns an empty string on success, or an error code on failure
     * (all-or-nothing).
     */
    move_horizontal(row: number, col_indices: Uint32Array, direction: MoveDirection): string;
    /**
     * Move the specified rows down by 1 position. Each specified row swaps
     * with the row immediately below it. Rows already at the bottom are
     * silently skipped. Multiple rows may be moved simultaneously.
     * Returns an empty string on success.
     */
    move_rows_down(row_indices: Uint32Array): string;
    /**
     * Move the specified rows up by 1 position. Each specified row swaps with
     * the row immediately above it. Rows already at the top (index 0) are
     * silently skipped. Multiple rows may be moved simultaneously.
     * Returns an empty string on success.
     */
    move_rows_up(row_indices: Uint32Array): string;
    /**
     * Simultaneous block character change (substitution) on a subset of rows
     * at a single column index. Rows outside `row_indices` are untouched.
     * Out-of-range rows or columns are silently skipped.
     *
     * Returns an empty string on success, or an error code constant on
     * validation failure (all-or-nothing: no rows are modified on failure).
     */
    mutate_base_subset(row_indices: Uint32Array, col_idx: number, new_base: number): string;
    /**
     * Construct an empty engine.
     */
    constructor();
    /**
     * Redo the most recently undone command. Returns `true` if a redo was
     * applied, `false` if the redo stack is empty.
     */
    redo(): boolean;
    /**
     * Number of commands on the redo stack.
     */
    redo_depth(): number;
    search(query: string, check_record_names: boolean): any;
    /**
     * When the translate function is called, it will check if there are any untranslated sequences and then translate all rows of nucleotide sequences for all reading frames.
     * Afterwards it will select the viewport of the translated amino acid sequences for the specified range and reading frame.
     *
     * Mirrors `update_viewport`'s conventions exactly: rows and columns are
     * inclusive (`[start, end]`), and every row contributes exactly
     * `(end_col - start_col + 1)` bytes, padding short rows with `b' '`.
     * Without this fixed stride, the worker's `bytes / cols` row count would
     * be wrong whenever a translated row is shorter than the requested
     * column range (which it almost always is, since amino acid frames are
     * ~1/3 the length of the nucleotide sequence).
     */
    translate(start_row: number, end_row: number, start_col: number, end_col: number, reading_frame: number): Uint8Array;
    /**
     * Undo the most recent command. Returns `true` if an undo was applied,
     * `false` if the undo stack is empty.
     *
     * For `Substitutions`, the old bases are restored and the command is
     * pushed onto the redo stack. For `StructuralSnapshot`, the snapshot
     * becomes the current state and the *current* (post-edit) state is
     * captured as a new `StructuralSnapshot` on the redo stack so that redo
     * can re-apply the structural change.
     */
    undo(): boolean;
    /**
     * Number of commands on the undo stack.
     */
    undo_depth(): number;
    /**
     * Extract a windowed slice of the matrix into the reusable viewport buffer
     * and return it as a `Uint8Array`.
     *
     * The slice covers rows `[start_row, end_row]` inclusive and columns
     * `[start_col, end_col]` inclusive. Row indices are clamped to the
     * number of loaded sequences. Every row always contributes exactly
     * `(end_col - start_col + 1)` bytes; columns that lie beyond the end of
     * the sequence are filled with `b' '` (space). This keeps the buffer
     * strictly row-major with a fixed stride, so callers can index
     * `bytes[r * cols + c]` without inspecting per-row lengths.
     */
    update_viewport(start_row: number, end_row: number, start_col: number, end_col: number): Uint8Array;
    /**
     * Extract a windowed slice and write it directly into a caller-provided
     * buffer (e.g. a `SharedArrayBuffer` view). Returns the number of bytes
     * written, or 0 if the slice is empty or out of range.
     *
     * This is the zero-copy-across-boundary path: the worker passes a
     * `Uint8Array` view backed by a `SharedArrayBuffer` that the main thread
     * also holds. The WASM engine writes into it via a single `memcpy` per
     * row, and the main thread reads the same memory directly. There is no
     * `postMessage` transfer of binary data, structured clone, or `ArrayBuffer.slice`.
     *
     * `out` must be at least as large as the worst-case slice
     * (`(end_row - start_row + 1) * (end_col - start_col + 1)` bytes).
     */
    update_viewport_into(start_row: number, end_row: number, start_col: number, end_col: number, out: Uint8Array): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_msaengine_free: (a: number, b: number) => void;
    readonly msaengine_delete_at_subset: (a: number, b: number, c: number, d: number) => [number, number];
    readonly msaengine_delete_column: (a: number, b: number) => [number, number];
    readonly msaengine_get_alignment_width: (a: number) => number;
    readonly msaengine_get_aminoacid_view: (a: number, b: number) => any;
    readonly msaengine_get_base: (a: number, b: number, c: number) => number;
    readonly msaengine_get_name: (a: number, b: number) => [number, number];
    readonly msaengine_get_row_length: (a: number, b: number) => number;
    readonly msaengine_get_sequence_count: (a: number) => number;
    readonly msaengine_get_viewport_len: (a: number) => number;
    readonly msaengine_insert_at_subset: (a: number, b: number, c: number, d: number) => [number, number];
    readonly msaengine_load_fasta: (a: number, b: number, c: number) => number;
    readonly msaengine_move_horizontal: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly msaengine_move_rows_down: (a: number, b: number, c: number) => [number, number];
    readonly msaengine_move_rows_up: (a: number, b: number, c: number) => [number, number];
    readonly msaengine_mutate_base_subset: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly msaengine_new: () => number;
    readonly msaengine_redo: (a: number) => number;
    readonly msaengine_redo_depth: (a: number) => number;
    readonly msaengine_search: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly msaengine_translate: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
    readonly msaengine_undo: (a: number) => number;
    readonly msaengine_undo_depth: (a: number) => number;
    readonly msaengine_update_viewport: (a: number, b: number, c: number, d: number, e: number) => any;
    readonly msaengine_update_viewport_into: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any) => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
