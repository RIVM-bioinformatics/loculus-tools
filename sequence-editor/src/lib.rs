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
        self.record_structural_undo();
        for seq in self.sequences.iter_mut() {
            if col_idx < seq.len() {
                seq.remove(col_idx);
            }
        }
        if self.alignment_width > 0 {
            self.alignment_width -= 1;
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn engine_with_sample() -> MsaEngine {
        let mut e = MsaEngine::new();
        e.load_fasta(">seq1 first\nATGCATGC\n>seq2\nATGGTG-A\n>seq3 third\nATGCAT-C");
        e
    }

    #[test]
    fn loads_three_sequences() {
        let e = engine_with_sample();
        assert_eq!(e.get_sequence_count(), 3);
        assert_eq!(e.get_alignment_width(), 8);
        assert_eq!(e.get_name(0), "seq1");
        assert_eq!(e.get_name(1), "seq2");
        assert_eq!(e.get_name(2), "seq3");
    }

    #[test]
    fn handles_multiline_sequences() {
        let mut e = MsaEngine::new();
        e.load_fasta(">x\nATGC\nATGC\n>y\nTTTT\nGGGG");
        assert_eq!(e.get_sequence_count(), 2);
        // alignment_width = longest sequence length = 8 (ATGCATGC / TTTTGGGG)
        assert_eq!(e.get_alignment_width(), 8);
        assert_eq!(e.get_base(0, 4), b'A');
        assert_eq!(e.get_base(1, 4), b'G');
    }

    #[test]
    fn spot_checks_via_get_base() {
        let e = engine_with_sample();
        assert_eq!(e.get_base(0, 0), b'A');
        assert_eq!(e.get_base(0, 7), b'C');
        assert_eq!(e.get_base(1, 6), b'-');
        assert_eq!(e.get_base(2, 7), b'C');
    }

    #[test]
    fn row_lengths_match() {
        let e = engine_with_sample();
        assert_eq!(e.get_row_length(0), 8);
        assert_eq!(e.get_row_length(1), 8);
        assert_eq!(e.get_row_length(2), 8);
        assert_eq!(e.get_row_length(99), 0);
    }

    #[test]
    fn out_of_range_base_returns_zero() {
        let e = engine_with_sample();
        assert_eq!(e.get_base(0, 100), 0);
        assert_eq!(e.get_base(100, 0), 0);
    }

    #[test]
    fn empty_fasta_loads_zero() {
        let mut e = MsaEngine::new();
        e.load_fasta("");
        assert_eq!(e.get_sequence_count(), 0);
        assert_eq!(e.get_alignment_width(), 0);
    }

    #[test]
    fn reload_clears_previous_state() {
        let mut e = engine_with_sample();
        assert_eq!(e.get_sequence_count(), 3);
        e.load_fasta(">only\nAT");
        assert_eq!(e.get_sequence_count(), 1);
        assert_eq!(e.get_alignment_width(), 2);
        assert_eq!(e.get_name(0), "only");
    }

    #[test]
    fn viewport_buffer_logic_via_get_base() {
        // Direct update_viewport calls require the wasm-bindgen runtime, so we
        // verify the underlying matrix layout that update_viewport reads from.
        let e = engine_with_sample();
        // Row 0, cols 0..=3 -> "ATGC"
        let expected: Vec<u8> = (0..=3).map(|c| e.get_base(0, c)).collect();
        assert_eq!(expected, b"ATGC");
        // Row 1, cols 4..=7 -> "TG-A"
        let expected: Vec<u8> = (4..=7).map(|c| e.get_base(1, c)).collect();
        assert_eq!(expected, b"TG-A");
    }

    #[test]
    fn update_viewport_into_writes_correct_bytes() {
        let mut e = engine_with_sample();
        // Full slice: 3 rows × 8 cols = 24 bytes.
        let mut out = vec![0u8; 24];
        let n = e.update_viewport_into(0, 2, 0, 7, &mut out);
        assert_eq!(n, 24);
        assert_eq!(&out[..8], b"ATGCATGC");
        assert_eq!(&out[8..16], b"ATGGTG-A");
        assert_eq!(&out[16..24], b"ATGCAT-C");
    }

    #[test]
    fn update_viewport_into_partial_slice() {
        let mut e = engine_with_sample();
        // Rows 1..=2, cols 2..=5 -> 2 rows × 4 cols = 8 bytes.
        let mut out = vec![0u8; 8];
        let n = e.update_viewport_into(1, 2, 2, 5, &mut out);
        assert_eq!(n, 8);
        // seq2[2..=5] = "GGTG", seq3[2..=5] = "GCAT"
        assert_eq!(&out[..4], b"GGTG");
        assert_eq!(&out[4..], b"GCAT");
    }

    #[test]
    fn update_viewport_into_out_of_range_returns_zero() {
        let mut e = engine_with_sample();
        let mut out = vec![0u8; 16];
        // Rows completely out of range.
        assert_eq!(e.update_viewport_into(100, 200, 0, 7, &mut out), 0);
        // start_col beyond all sequence lengths (all 8 chars, requesting col 100+).
        // Every row emits all-spaces for those cols, so the function still
        // returns rows * cols bytes — verify via the regression test below.
        // start_row > clamped row_end after clamp is the real "zero" trigger.
        let n = e.update_viewport_into(5, 2, 0, 7, &mut out); // start > end → 0
        assert_eq!(n, 0);
    }

    #[test]
    fn update_viewport_into_invalid_column_range_returns_zero() {
        let mut e = engine_with_sample();
        let mut out = vec![0u8; 16];
        assert_eq!(e.update_viewport_into(0, 2, 8, 7, &mut out), 0);
    }

    #[test]
    fn update_viewport_into_small_buffer_truncates() {
        let mut e = engine_with_sample();
        // stride = 8 cols per row; a 5-byte buffer can't fit even one full row,
        // so the function writes 0 complete rows and returns 0.
        let mut out = vec![0u8; 5];
        let n = e.update_viewport_into(0, 2, 0, 7, &mut out);
        assert_eq!(n, 0);
        // A buffer exactly one row wide gets the first row.
        let mut out = vec![0u8; 8];
        let n = e.update_viewport_into(0, 2, 0, 7, &mut out);
        assert_eq!(n, 8);
        assert_eq!(&out, b"ATGCATGC");
    }

    #[test]
    fn update_viewport_into_empty_engine() {
        let mut e = MsaEngine::new();
        let mut out = vec![0u8; 16];
        assert_eq!(e.update_viewport_into(0, 5, 0, 5, &mut out), 0);
    }

    /// Regression test for the "bleeding row" bug: requesting columns beyond
    /// the end of a sequence must pad with spaces rather than letting the next
    /// row's bytes shift into the current row's slot.
    #[test]
    fn viewport_pads_short_rows_with_spaces() {
        let mut e = engine_with_sample();
        // Sequences are all 8 chars wide; request cols 0..=11 (4 beyond end).
        // Each row must be exactly 12 bytes: real data + space padding.
        let cols = 12usize;
        let rows = 3usize;
        let mut out = vec![0u8; rows * cols];
        let n = e.update_viewport_into(0, 2, 0, 11, &mut out);
        assert_eq!(n, rows * cols);
        assert_eq!(&out[0..cols],        b"ATGCATGC    ");
        assert_eq!(&out[cols..2*cols],   b"ATGGTG-A    ");
        assert_eq!(&out[2*cols..3*cols], b"ATGCAT-C    ");
    }

    /// When start_col is beyond the end of every sequence every row is
    /// all-spaces, but the stride is still maintained.
    #[test]
    fn viewport_pads_entirely_out_of_range_cols() {
        let mut e = engine_with_sample();
        let cols = 4usize;
        let rows = 3usize;
        let mut out = vec![0xFFu8; rows * cols];
        let n = e.update_viewport_into(0, 2, 100, 103, &mut out);
        assert_eq!(n, rows * cols);
        assert_eq!(&out, b"            "); // 12 spaces
    }


    #[test]
    fn mutate_base_subset_changes_only_target_rows() {
        let mut e = engine_with_sample();
        // seq1[3] = C -> G, seq2[3] = G -> G (no-op), seq3 untouched
        e.mutate_base_subset(&[0, 1], 3, b'G');
        assert_eq!(e.get_base(0, 3), b'G');
        assert_eq!(e.get_base(1, 3), b'G');
        assert_eq!(e.get_base(2, 3), b'C'); // unchanged
    }

    #[test]
    fn mutate_skips_out_of_range_rows_and_cols() {
        let mut e = engine_with_sample();
        e.mutate_base_subset(&[0, 99], 3, b'T');
        assert_eq!(e.get_base(0, 3), b'T');
        // col out of range: no-op, no panic
        e.mutate_base_subset(&[0], 999, b'T');
        assert_eq!(e.get_base(0, 0), b'A');
    }

    #[test]
    fn mutate_records_undo_and_clears_redo() {
        let mut e = engine_with_sample();
        // Seed a redo entry by doing + undoing an edit.
        e.mutate_base_subset(&[0], 0, b'T');
        assert_eq!(e.undo_depth(), 1);
        assert!(e.undo());
        assert_eq!(e.undo_depth(), 0);
        assert_eq!(e.redo_depth(), 1);
        // A new mutation must clear the redo stack and push onto undo.
        e.mutate_base_subset(&[1], 1, b'G');
        assert_eq!(e.redo_depth(), 0);
        assert_eq!(e.undo_depth(), 1);
    }

    #[test]
    fn insert_at_subset_balances_with_gaps() {
        let mut e = engine_with_sample();
        // Insert '-' at col 2 on rows 0 and 1 only.
        e.insert_at_subset(&[0, 1], 2);
        assert_eq!(e.get_alignment_width(), 9);
        // Row 0: AT - GCATGC -> "AT-GCATGC"
        assert_eq!(e.get_row_length(0), 9);
        assert_eq!(e.get_base(0, 2), b'-');
        // Row 2 (non-target): gets '-' appended at end -> "ATGCAT-C-"
        assert_eq!(e.get_base(2, 2), b'G'); // unchanged, non-target
        assert_eq!(e.get_row_length(2), 9);
    }

    #[test]
    fn delete_at_subset_removes_from_targets_only() {
        let mut e = engine_with_sample();
        // Delete col 6 from rows 1 and 2 only. Both have '-' at col 6.
        // Row 0 untouched (no '-' at col 6).
        let result = e.delete_at_subset(&[1, 2], 6);
        assert_eq!(result, ""); // success
        // Row 0: completely untouched -> "ATGCATGC" (len 8)
        assert_eq!(e.get_row_length(0), 8);
        assert_eq!(e.get_base(0, 0), b'A');
        assert_eq!(e.get_base(0, 6), b'G');
        // Row 1 was "ATGGTG-A" -> remove col 6 ('-'), append '-' -> "ATGGTGA-" (len 8)
        assert_eq!(e.get_row_length(1), 8);
        assert_eq!(e.get_base(1, 6), b'A');
        assert_eq!(e.get_base(1, 7), b'-');
        // Row 2 was "ATGCAT-C" -> remove col 6 ('-'), append '-' -> "ATGCATC-" (len 8)
        assert_eq!(e.get_row_length(2), 8);
        assert_eq!(e.get_base(2, 6), b'C');
        assert_eq!(e.get_base(2, 7), b'-');
    }

    #[test]
    fn delete_column_shrinks_all_rows_and_width() {
        let mut e = engine_with_sample();
        e.delete_column(0);
        assert_eq!(e.get_alignment_width(), 7);
        assert_eq!(e.get_row_length(0), 7);
        assert_eq!(e.get_row_length(1), 7);
        assert_eq!(e.get_row_length(2), 7);
        // First base of each row is now the old second base.
        assert_eq!(e.get_base(0, 0), b'T');
        assert_eq!(e.get_base(1, 0), b'T');
        assert_eq!(e.get_base(2, 0), b'T');
    }


    #[test]
    fn undo_substitution_restores_old_base() {
        let mut e = engine_with_sample();
        e.mutate_base_subset(&[0, 1], 3, b'G');
        assert_eq!(e.get_base(0, 3), b'G');
        assert!(e.undo());
        assert_eq!(e.get_base(0, 3), b'C'); // original
        assert_eq!(e.get_base(1, 3), b'G'); // original (seq2[3] was already G)
    }

    #[test]
    fn redo_reapplies_substitution() {
        let mut e = engine_with_sample();
        e.mutate_base_subset(&[0], 0, b'T');
        assert!(e.undo());
        assert_eq!(e.get_base(0, 0), b'A');
        assert!(e.redo());
        assert_eq!(e.get_base(0, 0), b'T');
        // Redo stack should now be empty.
        assert!(!e.redo());
    }

    #[test]
    fn undo_structural_insert_restores_width_and_matrix() {
        let mut e = engine_with_sample();
        let width_before = e.get_alignment_width();
        e.insert_at_subset(&[0, 1], 2);
        assert_eq!(e.get_alignment_width(), width_before + 1);
        assert!(e.undo());
        assert_eq!(e.get_alignment_width(), width_before);
        assert_eq!(e.get_row_length(0), width_before);
        assert_eq!(e.get_base(0, 2), b'G'); // original seq1[2]
    }

    #[test]
    fn redo_structural_insert_reapplies() {
        let mut e = engine_with_sample();
        e.insert_at_subset(&[0, 1], 2);
        assert!(e.undo());
        assert!(e.redo());
        assert_eq!(e.get_alignment_width(), 9);
        assert_eq!(e.get_base(0, 2), b'-'); // gap
        assert_eq!(e.get_base(2, 2), b'G'); // unchanged, non-target
    }

    #[test]
    fn undo_delete_column_restores() {
        let mut e = engine_with_sample();
        e.delete_column(0);
        assert_eq!(e.get_alignment_width(), 7);
        assert!(e.undo());
        assert_eq!(e.get_alignment_width(), 8);
        assert_eq!(e.get_base(0, 0), b'A');
    }

    #[test]
    fn undo_on_empty_stack_returns_false() {
        let mut e = engine_with_sample();
        assert!(!e.undo());
        assert!(!e.redo());
    }

    #[test]
    fn new_edit_after_undo_clears_redo_stack() {
        let mut e = engine_with_sample();
        e.mutate_base_subset(&[0], 0, b'T');
        e.mutate_base_subset(&[1], 1, b'G');
        assert!(e.undo()); // undo second
        assert!(e.undo()); // undo first
        assert_eq!(e.redo_depth(), 2);
        // New edit invalidates redo branch.
        e.mutate_base_subset(&[2], 2, b'C');
        assert_eq!(e.redo_depth(), 0);
        assert_eq!(e.undo_depth(), 1);
    }

    #[test]
    fn multi_step_undo_redo_sequence() {
        let mut e = engine_with_sample();
        // Edit 1: substitute
        e.mutate_base_subset(&[0], 0, b'T');
        // Edit 2: insert
        e.insert_at_subset(&[0, 1], 2);
        // Edit 3: delete column
        e.delete_column(4);

        assert_eq!(e.undo_depth(), 3);
        // Undo all three in reverse order.
        assert!(e.undo()); // undo delete
        assert_eq!(e.get_alignment_width(), 9);
        assert!(e.undo()); // undo insert
        assert_eq!(e.get_alignment_width(), 8);
        assert!(e.undo()); // undo substitute
        assert_eq!(e.get_base(0, 0), b'A');
        assert!(!e.undo()); // stack empty
        // Redo all three.
        assert!(e.redo());
        assert_eq!(e.get_base(0, 0), b'T');
        assert!(e.redo());
        assert_eq!(e.get_alignment_width(), 9);
        assert!(e.redo());
        assert_eq!(e.get_alignment_width(), 8);
        assert!(!e.redo());
    }

    #[test]
    fn undo_redo_substitution_handles_mismatched_history_vectors() {
        let mut e = engine_with_sample();

        // Simulate malformed history data where mutated_rows.len() > old_bases.len().
        // The engine should process only valid row/base pairs and keep stacks consistent.
        e.undo_stack.push(UndoCommand::Substitutions {
            col_idx: 0,
            mutated_rows: vec![0, 1],
            old_bases: vec![b'G'],
        });

        assert!(e.undo());
        // Only row 0 should be restored from the single available old base.
        assert_eq!(e.get_base(0, 0), b'G');
        assert_eq!(e.get_base(1, 0), b'A');

        assert!(e.redo());
        // Redo must only touch row 0 and restore its previous value.
        assert_eq!(e.get_base(0, 0), b'A');
        assert_eq!(e.get_base(1, 0), b'A');
    }

    // ── Constraint validation tests (Rules 1-8) ──

    #[test]
    fn delete_non_gap_returns_error() {
        let mut e = engine_with_sample();
        // Row 0 col 0 is 'A' (IUPAC), not '-'. Delete must be rejected.
        let err = e.delete_at_subset(&[0], 0);
        assert_eq!(err, ERR_DELETE_NOT_GAP);
        // Matrix must be completely unchanged.
        assert_eq!(e.get_base(0, 0), b'A');
        assert_eq!(e.get_row_length(0), 8);
    }

    #[test]
    fn delete_gap_succeeds() {
        let mut e = engine_with_sample();
        // Row 1 col 6 is '-', Row 2 col 6 is '-'.
        let err = e.delete_at_subset(&[1, 2], 6);
        assert_eq!(err, ""); // success
        // Row 1 col 6 was '-', removed, '-' appended at end
        assert_eq!(e.get_base(1, 6), b'A');
        // Row 0 completely untouched
        assert_eq!(e.get_base(0, 6), b'G');
    }

    #[test]
    fn mutate_non_iupac_returns_error() {
        let mut e = engine_with_sample();
        // Mutate col 6 on row 0 where char is 'G' (IUPAC) — should succeed.
        let err = e.mutate_base_subset(&[0], 6, b'X');
        assert_eq!(err, "");
        assert_eq!(e.get_base(0, 6), b'X');

        // Directly corrupt a cell to a non-IUPAC, non-gap character (a space),
        // then attempt to mutate it — must be rejected.
        e.sequences[1][6] = b' ';
        let err = e.mutate_base_subset(&[1], 6, b'T');
        assert_eq!(err, ERR_MUTATE_NOT_IUPAC);
        assert_eq!(e.get_base(1, 6), b' '); // unchanged
    }

    #[test]
    fn mutate_gap_is_allowed() {
        let mut e = engine_with_sample();
        // Row 1 col 6 is '-'. Mutating '-' to 'A' must succeed.
        let err = e.mutate_base_subset(&[1], 6, b'A');
        assert_eq!(err, "");
        assert_eq!(e.get_base(1, 6), b'A');
    }

    #[test]
    fn mutate_iupac_to_gap_is_allowed() {
        let mut e = engine_with_sample();
        // Row 0 col 0 is 'A' (IUPAC). Mutate to '-' must succeed.
        let err = e.mutate_base_subset(&[0], 0, b'-');
        assert_eq!(err, "");
        assert_eq!(e.get_base(0, 0), b'-');
    }

    #[test]
    fn delete_at_subset_non_targets_untouched() {
        let mut e = engine_with_sample();
        // Delete col 6 on rows 1 and 2 (both have '-' at col 6).
        let err = e.delete_at_subset(&[1, 2], 6);
        assert_eq!(err, "");
        // Row 0 (non-target) must be completely unchanged.
        assert_eq!(e.get_row_length(0), 8);
        assert_eq!(e.get_base(0, 0), b'A');
        assert_eq!(e.get_base(0, 1), b'T');
    }

    #[test]
    fn alignment_width_from_longest_sequence() {
        let mut e = MsaEngine::new();
        e.load_fasta(">seq1\nATGC\n>seq2\nATGCATGC\n>seq3\nATGCAT");
        // Longest sequence is seq2 with length 8.
        assert_eq!(e.get_alignment_width(), 8);
        assert_eq!(e.get_row_length(0), 4);
        assert_eq!(e.get_row_length(1), 8);
        assert_eq!(e.get_row_length(2), 6);
    }

    #[test]
    fn insert_only_accepts_gap_by_default() {
        let mut e = engine_with_sample();
        // Insert at col 2 on rows 0 and 1. Only '-' is inserted.
        let err = e.insert_at_subset(&[0, 1], 2);
        assert_eq!(err, "");
        assert_eq!(e.get_alignment_width(), 9);
        // Target rows get '-' at col 2
        assert_eq!(e.get_base(0, 2), b'-');
        assert_eq!(e.get_base(1, 2), b'-');
        // Non-target rows get '-' appended at end
        assert_eq!(e.get_row_length(2), 9);
        assert_eq!(e.get_base(2, 8), b'-');
    }

    #[test]
    fn insert_non_target_appends_gap() {
        let mut e = engine_with_sample();
        let orig_len = e.get_row_length(0);
        // Insert on row 0 only.
        e.insert_at_subset(&[0], 3);
        assert_eq!(e.get_row_length(0), orig_len + 1);
        assert_eq!(e.get_row_length(1), orig_len + 1);
        assert_eq!(e.get_row_length(2), orig_len + 1);
        // Non-target rows (1, 2) have '-' appended at end
        assert_eq!(e.get_base(1, orig_len), b'-');
        assert_eq!(e.get_base(2, orig_len), b'-');
        // Target row (0) has '-' inserted at col 3
        assert_eq!(e.get_base(0, 3), b'-');
    }

    // ── Horizontal move tests (Rule 4) ──

    #[test]
    fn move_horizontal_left_succeeds() {
        let mut e = engine_with_sample();
        // Row 0: "ATGCATGC". Move "CATG" (cols 2..=5) left into col 1 which is 'T'.
        // But col 1 is 'T' (IUPAC), not '-'. So first mutate col 1 to '-'.
        e.mutate_base_subset(&[0], 1, b'-');
        // Row 0: "A-GCATGC". Now move "GCAT" (cols 2..=5) left by 1.
        let err = e.move_horizontal(0, &[2, 3, 4, 5], MoveDirection::Left);
        assert_eq!(err, "");
        // After left move: "AGCAT-GC"
        assert_eq!(e.get_base(0, 0), b'A');
        assert_eq!(e.get_base(0, 1), b'G');
        assert_eq!(e.get_base(0, 2), b'C');
        assert_eq!(e.get_base(0, 3), b'A');
        assert_eq!(e.get_base(0, 4), b'T');
        assert_eq!(e.get_base(0, 5), b'-');
        assert_eq!(e.get_base(0, 6), b'G');
        assert_eq!(e.get_base(0, 7), b'C');
    }

    #[test]
    fn move_horizontal_right_succeeds() {
        let mut e = engine_with_sample();
        // Row 1: "ATGGTG-A". Move "GGTG" (cols 2..=5) right into col 6 which is '-'.
        let err = e.move_horizontal(1, &[2, 3, 4, 5], MoveDirection::Right);
        assert_eq!(err, "");
        // After right move: "AT-GGTGA"
        assert_eq!(e.get_base(1, 0), b'A');
        assert_eq!(e.get_base(1, 1), b'T');
        assert_eq!(e.get_base(1, 2), b'-');
        assert_eq!(e.get_base(1, 3), b'G');
        assert_eq!(e.get_base(1, 4), b'G');
        assert_eq!(e.get_base(1, 5), b'T');
        assert_eq!(e.get_base(1, 6), b'G');
        assert_eq!(e.get_base(1, 7), b'A');
    }

    #[test]
    fn move_horizontal_no_gap_target_returns_error() {
        let mut e = engine_with_sample();
        // Row 0: "ATGCATGC". Try to move "ATGC" (cols 0..=3) left — no space to left.
        let err = e.move_horizontal(0, &[0, 1, 2, 3], MoveDirection::Left);
        assert_eq!(err, ERR_MOVE_NO_GAP_TARGET);
        // Row 0: "ATGCATGC". Try to move "CATG" (cols 4..=7) right — no space to right.
        let err = e.move_horizontal(0, &[4, 5, 6, 7], MoveDirection::Right);
        assert_eq!(err, ERR_MOVE_NO_GAP_TARGET);
    }

    #[test]
    fn move_horizontal_not_iupac_returns_error() {
        let mut e = engine_with_sample();
        // Row 1 col 6 is '-'. Try to move a block that includes '-'.
        let err = e.move_horizontal(1, &[5, 6], MoveDirection::Left);
        // col 5 is 'G' (IUPAC), col 6 is '-' (not IUPAC) — should fail.
        assert_eq!(err, ERR_MOVE_NOT_IUPAC);
    }

    #[test]
    fn move_horizontal_undo_restores() {
        let mut e = engine_with_sample();
        e.mutate_base_subset(&[0], 1, b'-');
        // Row 0: "A-GCATGC"
        e.move_horizontal(0, &[2, 3, 4, 5], MoveDirection::Left);
        assert_eq!(e.get_base(0, 1), b'G');
        assert!(e.undo());
        // After undo: back to "A-GCATGC"
        assert_eq!(e.get_base(0, 1), b'-');
        assert_eq!(e.get_base(0, 2), b'G');
    }

    // ── Row reorder tests (Rule 5) ──

    #[test]
    fn move_rows_up_swaps_with_above() {
        let mut e = engine_with_sample();
        // Move row 1 up — swaps with row 0.
        let err = e.move_rows_up(&[1]);
        assert_eq!(err, "");
        assert_eq!(e.get_name(0), "seq2");
        assert_eq!(e.get_name(1), "seq1");
        assert_eq!(e.get_name(2), "seq3");
    }

    #[test]
    fn move_rows_down_swaps_with_below() {
        let mut e = engine_with_sample();
        // Move row 1 down — swaps with row 2.
        let err = e.move_rows_down(&[1]);
        assert_eq!(err, "");
        assert_eq!(e.get_name(0), "seq1");
        assert_eq!(e.get_name(1), "seq3");
        assert_eq!(e.get_name(2), "seq2");
    }

    #[test]
    fn move_rows_up_at_top_is_noop() {
        let mut e = engine_with_sample();
        let err = e.move_rows_up(&[0]);
        assert_eq!(err, "");
        assert_eq!(e.get_name(0), "seq1");
    }

    #[test]
    fn move_rows_down_at_bottom_is_noop() {
        let mut e = engine_with_sample();
        let err = e.move_rows_down(&[2]);
        assert_eq!(err, "");
        assert_eq!(e.get_name(2), "seq3");
    }

    #[test]
    fn move_rows_multiple_simultaneously() {
        let mut e = engine_with_sample();
        // Move rows 0 and 2 up. Row 0 is at top (no-op), row 2 swaps with row 1.
        let err = e.move_rows_up(&[0, 2]);
        assert_eq!(err, "");
        assert_eq!(e.get_name(0), "seq1"); // unchanged (was at top)
        assert_eq!(e.get_name(1), "seq3"); // row 2 moved up
        assert_eq!(e.get_name(2), "seq2"); // row 1 moved down
    }

    #[test]
    fn move_rows_up_undo_restores() {
        let mut e = engine_with_sample();
        e.move_rows_up(&[1]);
        assert_eq!(e.get_name(0), "seq2");
        assert!(e.undo());
        assert_eq!(e.get_name(0), "seq1");
        assert_eq!(e.get_name(1), "seq2");
    }

    #[test]
    fn move_rows_preserves_sequence_data() {
        let mut e = engine_with_sample();
        // Row 0: "ATGCATGC", Row 1: "ATGGTG-A"
        e.move_rows_up(&[1]);
        // After swap, row 0 should have seq2's data, row 1 should have seq1's.
        assert_eq!(e.get_base(0, 0), b'A'); // seq2[0] = 'A'
        assert_eq!(e.get_base(0, 3), b'G'); // seq2[3] = 'G'
        assert_eq!(e.get_base(1, 0), b'A'); // seq1[0] = 'A'
        assert_eq!(e.get_base(1, 3), b'C'); // seq1[3] = 'C'
    }
}

