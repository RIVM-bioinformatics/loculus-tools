//! Sequence-editor rust based wasm engine.
//!
//! The engine stores the alignment matrix as `Vec<Vec<u8>>` of ASCII bytes
//! (e.g. `b'A'`, `b'-'`). All public methods are exposed to JavaScript via
//! `wasm-bindgen`. Viewport extraction returns a `js_sys::Uint8Array` so the
//! owning Web Worker can transfer the buffer across `postMessage` without
//! handing out raw pointers into WASM linear memory.

mod alphabets;
use alphabets::{is_gap, is_iupac};

use wasm_bindgen::prelude::*;

// ── Error code constants ──
// These are returned as `String` from mutation methods. Empty string = success.

/// Attempted to delete a character that is not `-`.
const ERR_DELETE_NOT_GAP: &str = "DeleteNotGap";
/// Attempted to mutate a character that is not IUPAC or `-`.
const ERR_MUTATE_NOT_IUPAC: &str = "MutateNotIupac";
/// Attempted to move IUPAC characters but target position(s) are not `-`.
const ERR_MOVE_NO_GAP_TARGET: &str = "MoveNoGapTarget";
/// Attempted to move non-IUPAC characters.
const ERR_MOVE_NOT_IUPAC: &str = "MoveNotIupac";

/// Direction for horizontal character movement.
#[wasm_bindgen]
pub enum MoveDirection {
    Left,
    Right,
}

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

/// The core MSA engine. Owns the alignment matrix, row names, the reusable
/// viewport buffer, and the undo/redo stacks.
#[wasm_bindgen]
pub struct MsaEngine {
    /// `sequences`; the inner matrix which is a sequences of ASCII bytes (e.g. `b'A'`, `b'-'`).
    /// `names`; row names / identifiers (one per sequence, in order).
    /// `alignment_width`; global alignment width (number of columns). Set to
    /// the length of the longest sequence after all sequences are loaded.
    /// `viewport_buffer`; reusable buffer for viewport extraction. Cleared and refilled on each `update_viewport` call to avoid per-scroll allocations.
    /// `undo_stack` and `redo_stack`; transactional history of edits for undo/redo functionality. Each command captures the minimal information needed to reverse or re-apply an edit.
    sequences: Vec<Vec<u8>>,
    names: Vec<String>,
    alignment_width: usize,
    viewport_buffer: Vec<u8>,
    undo_stack: Vec<UndoCommand>,
    redo_stack: Vec<UndoCommand>,
}

#[wasm_bindgen]
impl MsaEngine {
    /// Construct an empty engine.
    #[wasm_bindgen(constructor)]
    pub fn new() -> MsaEngine {
        MsaEngine {
            sequences: Vec::new(),
            names: Vec::new(),
            alignment_width: 0,
            // Pre-allocate for a typical screen-sized viewport (rows * cols).
            // Will grow automatically if a larger slice is requested.
            viewport_buffer: Vec::with_capacity(5000),
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
        }
    }

    /// Parse FASTA content and populate the engine.
    ///
    /// Performs a line-by-line scan. Sequences may span multiple lines;
    /// a new sequence begins at any line starting with `>`. Whitespace and
    /// blank lines are ignored. All sequence bytes are uppercased.
    /// 
    /// The sequences are assumed to be pre-aligned as this is given from
    /// loculus as a provider of the sequence data. After all sequences are
    /// parsed, `alignment_width` is set to the length of the longest
    /// sequence. Shorter sequences are NOT automatically padded — callers
    /// can detect ragged alignments via `get_row_length`.
    ///
    /// Returns the number of sequences parsed after successful engine population.
    pub fn load_fasta(&mut self, fasta_content: &str) -> usize {
        self.sequences.clear();
        self.names.clear();
        self.alignment_width = 0;
        self.undo_stack.clear();
        self.redo_stack.clear();

        let mut current_name: Option<String> = None;
        let mut current_seq: Vec<u8> = Vec::new();

        for raw_line in fasta_content.lines() {
            let line = raw_line.trim();
            if line.is_empty() {
                continue;
            }
            if let Some(header) = line.strip_prefix('>') {
                // Flush the previous record before starting a new one.
                if let Some(n) = current_name.take() {
                    if !current_seq.is_empty() {
                        if self.alignment_width == 0 {
                            self.alignment_width = current_seq.len();
                        }
                        self.names.push(n);
                        self.sequences.push(std::mem::take(&mut current_seq));
                    }
                }
                // Header text is everything after '>'; take the first token as
                // the ID (matching common FASTA convention).
                let header_text = header.trim();
                let id = header_text
                    .split_whitespace()
                    .next()
                    .unwrap_or(header_text)
                    .to_string();
                current_name = Some(id);
            } else {
                // Sequence data: append uppercase bytes, skipping internal whitespace.
                for b in line.bytes() {
                    if !b.is_ascii_whitespace() {
                        current_seq.push(b.to_ascii_uppercase());
                    }
                }
            }
        }
        // Flush the final record.
        if let Some(n) = current_name.take() {
            if !current_seq.is_empty() {
                self.names.push(n);
                self.sequences.push(std::mem::take(&mut current_seq));
            }
        }

        // alignment_width is the length of the longest sequence (Rule 8).
        self.alignment_width = self.sequences.iter().map(|s| s.len()).max().unwrap_or(0);

        self.sequences.len()
    }

    /// Extract a windowed slice of the matrix into the reusable viewport buffer
    /// and return it as a `Uint8Array`.
    ///
    /// The slice covers rows `[start_row, end_row]` inclusive and columns
    /// `[start_col, end_col]` inclusive. Row indices are clamped to the
    /// number of loaded sequences. Every row always contributes exactly
    /// `(end_col - start_col + 1)` bytes; columns that lie beyond the end of
    /// the sequence are filled with `b' '` (space). This keeps the buffer
    /// strictly row-major with a fixed stride, so callers can index
    /// `bytes[r * cols + c]` without inspecting per-row lengths.
    #[wasm_bindgen]
    pub fn update_viewport(
        &mut self,
        start_row: usize,
        end_row: usize,
        start_col: usize,
        end_col: usize,
    ) -> js_sys::Uint8Array {
        self.viewport_buffer.clear();

        // Clamp row range to valid bounds.
        if self.sequences.is_empty() {
            return js_sys::Uint8Array::new(&wasm_bindgen::JsValue::from(0));
        }
        let row_end = end_row.min(self.sequences.len() - 1);
        if start_row > row_end {
            return js_sys::Uint8Array::new(&wasm_bindgen::JsValue::from(0));
        }
        if start_col > end_col {
            return js_sys::Uint8Array::new(&wasm_bindgen::JsValue::from(0));
        }

        // Fixed column stride: every row contributes exactly this many bytes.
        let cols = end_col - start_col + 1;

        for r in start_row..=row_end {
            if let Some(seq) = self.sequences.get(r) {
                let seq_cols = if start_col < seq.len() {
                    (end_col + 1).min(seq.len()) - start_col
                } else {
                    0
                };
                if seq_cols > 0 {
                    self.viewport_buffer
                        .extend_from_slice(&seq[start_col..start_col + seq_cols]);
                }
                // Pad the remainder of the row with spaces.
                for _ in seq_cols..cols {
                    self.viewport_buffer.push(b' ');
                }
            }
        }

        js_sys::Uint8Array::from(&self.viewport_buffer[..])
    }

    /// Extract a windowed slice and write it directly into a caller-provided
    /// buffer (e.g. a `SharedArrayBuffer` view). Returns the number of bytes
    /// written, or 0 if the slice is empty or out of range.
    ///
    /// This is the zero-copy-across-boundary path: the worker passes a
    /// `Uint8Array` view backed by a `SharedArrayBuffer` that the main thread
    /// also holds. The WASM engine writes into it via a single `memcpy` per
    /// row, and the main thread reads the same memory directly — no
    /// `postMessage` transfer of binary data, no structured clone, no extra
    /// `ArrayBuffer.slice`.
    ///
    /// `out` must be at least as large as the worst-case slice
    /// (`(end_row - start_row + 1) * (end_col - start_col + 1)` bytes).
    #[wasm_bindgen]
    pub fn update_viewport_into(
        &mut self,
        start_row: usize,
        end_row: usize,
        start_col: usize,
        end_col: usize,
        out: &mut [u8],
    ) -> usize {
        let mut written = 0;

        if self.sequences.is_empty() {
            return 0;
        }
        let row_end = end_row.min(self.sequences.len() - 1);
        if start_row > row_end {
            return 0;
        }
        if start_col > end_col {
            return 0;
        }

        // Fixed column stride: every row contributes exactly this many bytes.
        let cols = end_col - start_col + 1;

        for r in start_row..=row_end {
            if written + cols > out.len() {
                // Buffer too small to fit even one more full row — stop here.
                break;
            }
            if let Some(seq) = self.sequences.get(r) {
                let seq_cols = if start_col < seq.len() {
                    (end_col + 1).min(seq.len()) - start_col
                } else {
                    0
                };
                if seq_cols > 0 {
                    out[written..written + seq_cols]
                        .copy_from_slice(&seq[start_col..start_col + seq_cols]);
                }
                // Pad the remainder of the row with spaces.
                for b in &mut out[written + seq_cols..written + cols] {
                    *b = b' ';
                }
                written += cols;
            }
        }

        written
    }

    /// Number of bytes currently held in the viewport buffer.
    pub fn get_viewport_len(&self) -> usize {
        self.viewport_buffer.len()
    }

    /// Number of sequences currently loaded.
    pub fn get_sequence_count(&self) -> usize {
        self.sequences.len()
    }

    /// Global alignment width (columns). Zero if nothing is loaded.
    pub fn get_alignment_width(&self) -> usize {
        self.alignment_width
    }

    /// Return the name/identifier of a given row, or an empty string if the
    /// index is out of range.
    pub fn get_name(&self, row: usize) -> String {
        self.names.get(row).cloned().unwrap_or_default()
    }

    /// Return the raw byte at `(row, col)`, or `0` if out of range.
    /// Useful for the test harness to spot-check individual cells.
    pub fn get_base(&self, row: usize, col: usize) -> u8 {
        self.sequences
            .get(row)
            .and_then(|seq| seq.get(col).copied())
            .unwrap_or(0)
    }

    /// Return the length of a specific row, or `0` if the row index is invalid.
    pub fn get_row_length(&self, row: usize) -> usize {
        self.sequences.get(row).map(|seq| seq.len()).unwrap_or(0)
    }

    // mutation methods.
    // All mutation methods run synchronously on the worker thread. Each one
    // records an `UndoCommand` onto `undo_stack` *before* mutating, and clears
    // the `redo_stack` (a new edit invalidates the redo branch). The main
    // thread only sends a command and awaits an acknowledgment.

    /// Simultaneous block character change (substitution) on a subset of rows
    /// at a single column index. Rows outside `row_indices` are untouched.
    /// Out-of-range rows or columns are silently skipped.
    ///
    /// Returns an empty string on success, or an error code constant on
    /// validation failure (all-or-nothing: no rows are modified on failure).
    pub fn mutate_base_subset(&mut self, row_indices: &[usize], col_idx: usize, new_base: u8) -> String {
        // Validate the destination base: it must be an IUPAC nucleotide or '-'
        // (Rule 3). Mutating to any other character is not allowed.
        if !is_iupac(new_base) && !is_gap(new_base) {
            return String::from(ERR_MUTATE_NOT_IUPAC);
        }
        // Validate: all existing characters at the target positions must be IUPAC or '-'.
        for &r in row_indices {
            if let Some(seq) = self.sequences.get(r) {
                if col_idx < seq.len() {
                    let existing = seq[col_idx];
                    if !is_iupac(existing) && !is_gap(existing) {
                        return String::from(ERR_MUTATE_NOT_IUPAC);
                    }
                }
            }
        }
        // Capture old bases for the rows we will actually touch, for undo.
        let mut mutated_rows: Vec<usize> = Vec::new();
        let mut old_bases: Vec<u8> = Vec::new();
        for &r in row_indices {
            if let Some(seq) = self.sequences.get(r) {
                if col_idx < seq.len() {
                    mutated_rows.push(r);
                    old_bases.push(seq[col_idx]);
                }
            }
        }
        if mutated_rows.is_empty() {
            return String::new();
        }
        self.undo_stack.push(UndoCommand::Substitutions {
            col_idx,
            mutated_rows: mutated_rows.clone(),
            old_bases,
        });
        self.redo_stack.clear();

        for &r in &mutated_rows {
            if let Some(seq) = self.sequences.get_mut(r) {
                if col_idx < seq.len() {
                    seq[col_idx] = new_base;
                }
            }
        }
        String::new()
    }

    /// Simultaneous gap insertion at a single column index on a subset of
    /// rows. The inserted character is always `-` (gap). Target rows receive
    /// the gap at `col_idx`; non-target rows have a `-` appended at the end
    /// to keep matrix width consistent. `alignment_width` is incremented by 1.
    ///
    /// Returns an empty string on success (no validation needed since only
    /// `-` can be inserted).
    pub fn insert_at_subset(&mut self, row_indices: &[usize], col_idx: usize) -> String {
        self.record_structural_undo();

        let target_rows: std::collections::HashSet<usize> = row_indices.iter().copied().collect();

        for r in 0..self.sequences.len() {
            let seq = &mut self.sequences[r];
            // Pad rows that are shorter than col_idx to ensure consistent width
            while seq.len() < col_idx {
                seq.push(b'-');
            }
            if target_rows.contains(&r) {
                seq.insert(col_idx, b'-');
            } else {
                seq.push(b'-'); // Balance unselected rows by appending gap at end
            }
        }
        self.alignment_width += 1;
        String::new()
    }

    /// Simultaneous deletion at a single column index on a subset of rows.
    /// Only rows in `row_indices` are affected: the character at `col_idx`
    /// is removed and a `-` is appended at the end to keep width unchanged.
    /// Non-target rows are completely untouched.
    ///
    /// Returns an empty string on success, or `ERR_DELETE_NOT_GAP` if any
    /// target position contains a non-`-` character (all-or-nothing).
    pub fn delete_at_subset(&mut self, row_indices: &[usize], col_idx: usize) -> String {
        // Validate: all target positions must be '-'.
        for &r in row_indices {
            if let Some(seq) = self.sequences.get(r) {
                if col_idx < seq.len() && !is_gap(seq[col_idx]) {
                    return String::from(ERR_DELETE_NOT_GAP);
                }
            }
        }

        self.record_structural_undo();

        let target_rows: std::collections::HashSet<usize> = row_indices.iter().copied().collect();

        for r in 0..self.sequences.len() {
            let seq = &mut self.sequences[r];
            if col_idx < seq.len() {
                if target_rows.contains(&r) {
                    seq.remove(col_idx);
                    seq.push(b'-'); // Pad at end to keep width unchanged
                }
                // Non-target rows: completely untouched
            }
        }
        // Width unchanged
        String::new()
    }

    /// Delete a column from every row, shrinking `alignment_width` by 1.
    /// This is the width-preserving inverse of a full-column insert.
    /// Returns an empty string on success.
    pub fn delete_column(&mut self, col_idx: usize) -> String {
        // If the column is out of range for every row, nothing is removed and
        // the width must not change — otherwise `alignment_width` would
        // desynchronize from the actual row lengths.
        if col_idx >= self.alignment_width {
            return String::new();
        }
        self.record_structural_undo();
        for seq in self.sequences.iter_mut() {
            if col_idx < seq.len() {
                seq.remove(col_idx);
            }
        }
        self.alignment_width -= 1;
        String::new()
    }

    // Horizontal moves of character blocks

    /// Move a contiguous block of IUPAC characters horizontally by 1 position
    /// within a single row. Each call moves exactly 1 position; callers must
    /// issue multiple calls for multi-position moves.
    ///
    /// `col_indices` is treated as a range `[min, max]` — non-contiguous
    /// indices are clamped to their min/max.
    ///
    /// **Left move:** validates the selected chars are IUPAC and the position
    /// to the left is `-`, then rotates the block left by 1.
    ///
    /// **Right move:** validates the selected chars are IUPAC and the position
    /// to the right is `-`, then rotates the block right by 1.
    ///
    /// Returns an empty string on success, or an error code on failure
    /// (all-or-nothing).
    pub fn move_horizontal(
        &mut self,
        row: usize,
        col_indices: &[usize],
        direction: MoveDirection,
    ) -> String {
        let seq = match self.sequences.get(row) {
            Some(s) => s,
            None => return String::new(), // out-of-range row is a no-op
        };

        if col_indices.is_empty() {
            return String::new();
        }

        let start = *col_indices.iter().min().unwrap();
        let end = *col_indices.iter().max().unwrap();

        if end >= seq.len() {
            return String::new(); // out of range
        }

        // Validate: all selected characters must be IUPAC (not '-').
        for &c in &seq[start..=end] {
            if !is_iupac(c) {
                return String::from(ERR_MOVE_NOT_IUPAC);
            }
        }

        match direction {
            MoveDirection::Left => {
                if start == 0 {
                    return String::from(ERR_MOVE_NO_GAP_TARGET);
                }
                if !is_gap(seq[start - 1]) {
                    return String::from(ERR_MOVE_NO_GAP_TARGET);
                }
            }
            MoveDirection::Right => {
                if end + 1 >= seq.len() {
                    return String::from(ERR_MOVE_NO_GAP_TARGET);
                }
                if !is_gap(seq[end + 1]) {
                    return String::from(ERR_MOVE_NO_GAP_TARGET);
                }
            }
        }

        self.record_structural_undo();

        let seq = &mut self.sequences[row];
        match direction {
            MoveDirection::Left => {
                // Rotate [start-1, end] left by 1: the '-' at start-1 moves to end.
                let gap = seq[start - 1];
                seq.copy_within(start..=end, start - 1);
                seq[end] = gap;
            }
            MoveDirection::Right => {
                // Rotate [start, end+1] right by 1: the '-' at end+1 moves to start.
                let gap = seq[end + 1];
                seq.copy_within(start..=end, start + 1);
                seq[start] = gap;
            }
        }

        String::new()
    }

    // vertical moves and reordering of rows

    /// Move the specified rows up by 1 position. Each specified row swaps with
    /// the row immediately above it. Rows already at the top (index 0) are
    /// silently skipped. Multiple rows may be moved simultaneously.
    /// Returns an empty string on success.
    pub fn move_rows_up(&mut self, row_indices: &[usize]) -> String {
        if row_indices.is_empty() || self.sequences.len() < 2 {
            return String::new();
        }

        self.record_structural_undo();

        // Sort and deduplicate to process in a predictable order.
        let mut indices: Vec<usize> = row_indices.to_vec();
        indices.sort_unstable();
        indices.dedup();

        for &r in &indices {
            if r == 0 || r >= self.sequences.len() {
                continue;
            }
            self.sequences.swap(r, r - 1);
            self.names.swap(r, r - 1);
        }

        String::new()
    }

    /// Move the specified rows down by 1 position. Each specified row swaps
    /// with the row immediately below it. Rows already at the bottom are
    /// silently skipped. Multiple rows may be moved simultaneously.
    /// Returns an empty string on success.
    pub fn move_rows_down(&mut self, row_indices: &[usize]) -> String {
        if row_indices.is_empty() || self.sequences.len() < 2 {
            return String::new();
        }

        self.record_structural_undo();

        // Sort descending so swaps don't interfere with each other.
        let mut indices: Vec<usize> = row_indices.to_vec();
        indices.sort_unstable_by(|a, b| b.cmp(a));
        indices.dedup();

        for &r in &indices {
            if r + 1 >= self.sequences.len() {
                continue;
            }
            self.sequences.swap(r, r + 1);
            self.names.swap(r, r + 1);
        }

        String::new()
    }

    /// transactional history with undo/redo stacks.
    /// Snapshot the full matrix + width for structural undo. Cheap given the
    /// ~16MB max footprint.
    ///> we might need to revisit this if we want to support larger alignments in the future, but it keeps the logic simple for now and is fast enough for our expected use case.
    fn record_structural_undo(&mut self) {
        let matrix_snapshot = self.sequences.clone();
        let names_snapshot = self.names.clone();
        self.undo_stack.push(UndoCommand::StructuralSnapshot {
            matrix_snapshot,
            names_snapshot,
            width_snapshot: self.alignment_width,
        });
        self.redo_stack.clear();
    }

    /// Undo the most recent command. Returns `true` if an undo was applied,
    /// `false` if the undo stack is empty.
    ///
    /// For `Substitutions`, the old bases are restored and the command is
    /// pushed onto the redo stack. For `StructuralSnapshot`, the snapshot
    /// becomes the current state and the *current* (post-edit) state is
    /// captured as a new `StructuralSnapshot` on the redo stack so that redo
    /// can re-apply the structural change.
    pub fn undo(&mut self) -> bool {
        let cmd = match self.undo_stack.pop() {
            Some(c) => c,
            None => return false,
        };
        match cmd {
            UndoCommand::Substitutions { col_idx, mutated_rows, old_bases } => {
                // Restore old bases; capture current bases for redo.
                // Rebuild paired row/base vectors to keep them aligned even if
                // malformed history data ever appears.
                let paired_len = mutated_rows.len().min(old_bases.len());
                let mut redo_rows: Vec<usize> = Vec::with_capacity(paired_len);
                let mut redo_old_bases: Vec<u8> = Vec::with_capacity(paired_len);
                for (r, old_base) in mutated_rows.into_iter().zip(old_bases.into_iter()) {
                    if let Some(seq) = self.sequences.get_mut(r) {
                        if col_idx < seq.len() {
                            redo_rows.push(r);
                            redo_old_bases.push(seq[col_idx]);
                            seq[col_idx] = old_base;
                        }
                    }
                }
                if !redo_rows.is_empty() {
                    self.redo_stack.push(UndoCommand::Substitutions {
                        col_idx,
                        mutated_rows: redo_rows,
                        old_bases: redo_old_bases,
                    });
                }
            }
            UndoCommand::StructuralSnapshot { matrix_snapshot, names_snapshot, width_snapshot } => {
                // Capture current state for redo, then restore the snapshot.
                let redo_snapshot = UndoCommand::StructuralSnapshot {
                    matrix_snapshot: self.sequences.clone(),
                    names_snapshot: self.names.clone(),
                    width_snapshot: self.alignment_width,
                };
                self.sequences = matrix_snapshot;
                self.names = names_snapshot;
                self.alignment_width = width_snapshot;
                self.redo_stack.push(redo_snapshot);
            }
        }
        true
    }

    /// Redo the most recently undone command. Returns `true` if a redo was
    /// applied, `false` if the redo stack is empty.
    pub fn redo(&mut self) -> bool {
        let cmd = match self.redo_stack.pop() {
            Some(c) => c,
            None => return false,
        };
        match cmd {
            UndoCommand::Substitutions { col_idx, mutated_rows, old_bases } => {
                // Re-apply: old_bases here are the post-edit bases captured at
                // undo time. Capture current (pre-redo) bases for the undo stack.
                let paired_len = mutated_rows.len().min(old_bases.len());
                let mut undo_rows: Vec<usize> = Vec::with_capacity(paired_len);
                let mut undo_old_bases: Vec<u8> = Vec::with_capacity(paired_len);
                for (r, old_base) in mutated_rows.into_iter().zip(old_bases.into_iter()) {
                    if let Some(seq) = self.sequences.get_mut(r) {
                        if col_idx < seq.len() {
                            undo_rows.push(r);
                            undo_old_bases.push(seq[col_idx]);
                            seq[col_idx] = old_base;
                        }
                    }
                }
                if !undo_rows.is_empty() {
                    self.undo_stack.push(UndoCommand::Substitutions {
                        col_idx,
                        mutated_rows: undo_rows,
                        old_bases: undo_old_bases,
                    });
                }
            }
            UndoCommand::StructuralSnapshot { matrix_snapshot, names_snapshot, width_snapshot } => {
                let undo_snapshot = UndoCommand::StructuralSnapshot {
                    matrix_snapshot: self.sequences.clone(),
                    names_snapshot: self.names.clone(),
                    width_snapshot: self.alignment_width,
                };
                self.sequences = matrix_snapshot;
                self.names = names_snapshot;
                self.alignment_width = width_snapshot;
                self.undo_stack.push(undo_snapshot);
            }
        }
        true
    }

    /// Number of commands on the undo stack.
    pub fn undo_depth(&self) -> usize {
        self.undo_stack.len()
    }

    /// Number of commands on the redo stack.
    pub fn redo_depth(&self) -> usize {
        self.redo_stack.len()
    }
}

impl Default for MsaEngine {
    fn default() -> Self {
        Self::new()
    }
}

// Unit tests live in separate files to keep the implementation modules focused
// on their code. They are only compiled under `#[cfg(test)]`. Each is named
// `<module>_tests` so that `cargo test` output is clearly namespaced
// (e.g. `engine_tests::...`, `alphabets_tests::...`).
#[cfg(test)]
mod engine_tests;
#[cfg(test)]
mod alphabets_tests;

