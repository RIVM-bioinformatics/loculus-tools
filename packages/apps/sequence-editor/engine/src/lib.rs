//! Sequence-editor rust based wasm engine.
//!
//! The engine stores the alignment matrix as `Vec<Vec<u8>>` of ASCII bytes
//! (e.g. `b'A'`, `b'-'`). All public methods are exposed to JavaScript via
//! `wasm-bindgen`. Viewport extraction returns a `js_sys::Uint8Array` so the
//! owning Web Worker can transfer the buffer across `postMessage` without
//! handing out raw pointers into WASM linear memory.

mod alphabets;
mod search_algorithms;

use alphabets::{is_amino, is_gap, is_iupac, translate_codon};
use search_algorithms::{Match, MatrixType, SearchAlgorithm, SearchResult, run_search};
use serde::Serialize;
use wasm_bindgen::prelude::*;

// Bound to the JS `console.log`, so this works in both the main thread and
// Web Worker (the engine's actual home) — both expose a global `console`.
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

/// `println!`-style logging that shows up in the browser/worker devtools
/// console. Use like `console_log!("query={:?} rows={}", query, n);`.
macro_rules! console_log {
    ($($arg:tt)*) => { log(&format!($($arg)*)) };
}

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EditError {
    DeleteNotGap,
    MutateNotIupac,
    MoveNoGapTarget,
    MoveNotIupac,
}

impl EditError {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::DeleteNotGap => "DeleteNotGap",
            Self::MutateNotIupac => "MutateNotIupac",
            Self::MoveNoGapTarget => "MoveNoGapTarget",
            Self::MoveNotIupac => "MoveNotIupac",
        }
    }
}

impl std::fmt::Display for EditError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl std::error::Error for EditError {}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct ErrorContext {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub col: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frame: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct StructuredEngineError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<ErrorContext>,
}

impl std::fmt::Display for StructuredEngineError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for StructuredEngineError {}

impl From<StructuredEngineError> for JsValue {
    fn from(error: StructuredEngineError) -> Self {
        serde_wasm_bindgen::to_value(&error)
            .unwrap_or_else(|_| JsValue::from_str(&error.to_string()))
    }
}

impl StructuredEngineError {
    fn new(code: EditError, message: String, context: Option<ErrorContext>) -> Self {
        Self {
            code: code.as_str().to_owned(),
            message,
            context,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum MutateError {
    NewBaseNotIupac { base: u8 },
    TargetNotIupac { row: usize, col: usize, base: u8 },
}

impl From<MutateError> for EditError {
    fn from(_: MutateError) -> Self {
        Self::MutateNotIupac
    }
}

impl From<MutateError> for StructuredEngineError {
    fn from(error: MutateError) -> Self {
        match error {
            MutateError::NewBaseNotIupac { base } => Self::new(
                error.into(),
                format!(
                    "Invalid replacement character '{}' (0x{base:02X}); must be an IUPAC nucleotide or '-'",
                    base as char
                ),
                Some(ErrorContext {
                    base: Some((base as char).to_string()),
                    ..ErrorContext::default()
                }),
            ),
            MutateError::TargetNotIupac { row, col, base } => Self::new(
                error.into(),
                format!(
                    "Target base '{}' at row {row}, column {col} is not an IUPAC nucleotide or '-'",
                    base as char
                ),
                Some(ErrorContext {
                    row: Some(row),
                    col: Some(col),
                    base: Some((base as char).to_string()),
                    ..ErrorContext::default()
                }),
            ),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum DeleteError {
    TargetNotGap { row: usize, col: usize, base: u8 },
}

impl From<DeleteError> for EditError {
    fn from(_: DeleteError) -> Self {
        Self::DeleteNotGap
    }
}

impl From<DeleteError> for StructuredEngineError {
    fn from(error: DeleteError) -> Self {
        match error {
            DeleteError::TargetNotGap { row, col, base } => Self::new(
                error.into(),
                format!(
                    "Cannot delete non-gap character '{}' at row {row}, column {col}. Mutate it to '-' first.",
                    base as char
                ),
                Some(ErrorContext {
                    row: Some(row),
                    col: Some(col),
                    base: Some((base as char).to_string()),
                    ..ErrorContext::default()
                }),
            ),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum MoveError {
    BlockNotIupac {
        row: usize,
        col: usize,
        base: u8,
    },
    TargetNotGap {
        row: usize,
        col: usize,
        base: u8,
        direction: MoveDirection,
    },
    BoundaryReached {
        row: usize,
        col: usize,
        direction: MoveDirection,
    },
}

impl From<MoveError> for EditError {
    fn from(error: MoveError) -> Self {
        match error {
            MoveError::BlockNotIupac { .. } => Self::MoveNotIupac,
            MoveError::TargetNotGap { .. } | MoveError::BoundaryReached { .. } => {
                Self::MoveNoGapTarget
            }
        }
    }
}

impl From<MoveError> for StructuredEngineError {
    fn from(error: MoveError) -> Self {
        match error {
            MoveError::BlockNotIupac { row, col, base } => Self::new(
                EditError::MoveNotIupac,
                format!(
                    "Selected block contains non-IUPAC character '{}' at row {row}, column {col}",
                    base as char
                ),
                Some(ErrorContext {
                    row: Some(row),
                    col: Some(col),
                    base: Some((base as char).to_string()),
                    ..ErrorContext::default()
                }),
            ),
            MoveError::TargetNotGap {
                row,
                col,
                base,
                direction,
            } => Self::new(
                EditError::MoveNoGapTarget,
                format!(
                    "Destination column {col} in row {row} is occupied by '{}'; moving {direction:?} requires an adjacent '-' gap",
                    base as char
                ),
                Some(ErrorContext {
                    row: Some(row),
                    col: Some(col),
                    base: Some((base as char).to_string()),
                    direction: Some(format!("{direction:?}")),
                    ..ErrorContext::default()
                }),
            ),
            MoveError::BoundaryReached {
                row,
                col,
                direction,
            } => Self::new(
                EditError::MoveNoGapTarget,
                format!("Cannot move {direction:?} from row {row}, column {col}; alignment boundary reached"),
                Some(ErrorContext {
                    row: Some(row),
                    col: Some(col),
                    direction: Some(format!("{direction:?}")),
                    ..ErrorContext::default()
                }),
            ),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TranslateError {
    InvalidReadingFrame { frame: u8 },
}

impl From<TranslateError> for StructuredEngineError {
    fn from(error: TranslateError) -> Self {
        match error {
            TranslateError::InvalidReadingFrame { frame } => Self {
                code: "InvalidReadingFrame".to_owned(),
                message: format!("Invalid reading frame {frame}; expected frame 0, 1, or 2"),
                context: Some(ErrorContext {
                    frame: Some(frame),
                    ..ErrorContext::default()
                }),
            },
        }
    }
}

/// Matches the worker's SharedArrayBuffer capacity and bounds direct WASM calls.
/// TODO: we may need to revisit this later for a more logical max size of a viewport. i.e. Do we even want to support 200K columns in the viewport if a modern display can only show a few thousand (pixels) at a time? For now, this is a safe upper bound that matches the worker's buffer size.
const MAX_VIEWPORT_BYTES: usize = 80 * 200_000;

/// Return the length of an inclusive range `[start, end]`, or `None` if the
/// range is invalid or would overflow `usize`.
fn inclusive_range_len(start: usize, end: usize) -> Option<usize> {
    end.checked_sub(start)?.checked_add(1)
}

/// Direction for horizontal character movement.
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
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

/// Struct that stores 3 amino acid sequences, one for each reading frame.
struct AminoacidSequence {
    frame_1: Vec<u8>,
    frame_2: Vec<u8>,
    frame_3: Vec<u8>,
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
    nucleotide_sequences: Vec<Vec<u8>>,
    aminoacid_sequences: Vec<AminoacidSequence>,
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
            nucleotide_sequences: Vec::new(),
            aminoacid_sequences: Vec::new(),
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
    /// sequence. Shorter sequences are NOT automatically padded.
    /// Callers can detect ragged alignments via `get_row_length`.
    ///
    /// Returns the number of sequences parsed after successful engine population.
    pub fn load_fasta(&mut self, fasta_content: &str) -> usize {
        self.nucleotide_sequences.clear();
        self.aminoacid_sequences.clear();
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
                        self.nucleotide_sequences
                            .push(std::mem::take(&mut current_seq));
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
                self.nucleotide_sequences
                    .push(std::mem::take(&mut current_seq));
            }
        }

        // alignment_width is the length of the longest sequence (Rule 8).
        self.alignment_width = self
            .nucleotide_sequences
            .iter()
            .map(|s| s.len())
            .max()
            .unwrap_or(0);

        self.nucleotide_sequences.len()
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
        if self.nucleotide_sequences.is_empty() {
            return js_sys::Uint8Array::new(&wasm_bindgen::JsValue::from(0));
        }
        let row_end = end_row.min(self.nucleotide_sequences.len() - 1);
        if start_row > row_end {
            return js_sys::Uint8Array::new(&wasm_bindgen::JsValue::from(0));
        }
        // If the start column is greater than the end column, return an empty slice.
        if start_col > end_col {
            return js_sys::Uint8Array::new(&wasm_bindgen::JsValue::from(0));
        }

        // Compute the number of rows and columns in the requested slice, checking for overflow.
        let rows = match inclusive_range_len(start_row, row_end) {
            Some(rows) => rows,
            None => return js_sys::Uint8Array::new(&wasm_bindgen::JsValue::from(0)),
        };

        // Fixed column stride: every row contributes exactly this many bytes.
        let cols = match inclusive_range_len(start_col, end_col) {
            Some(cols) => cols,
            None => return js_sys::Uint8Array::new(&wasm_bindgen::JsValue::from(0)),
        };

        // Check that the total byte length does not exceed the maximum allowed for the viewport buffer.
        let byte_len = match rows.checked_mul(cols) {
            Some(byte_len) if byte_len <= MAX_VIEWPORT_BYTES => byte_len,
            _ => return js_sys::Uint8Array::new(&wasm_bindgen::JsValue::from(0)),
        };

        // Reserve the necessary capacity in the viewport buffer. If it fails, return an empty Uint8Array.
        if self.viewport_buffer.try_reserve_exact(byte_len).is_err() {
            return js_sys::Uint8Array::new(&wasm_bindgen::JsValue::from(0));
        }

        // Actual viewport extraction logic
        for r in start_row..=row_end {
            if let Some(seq) = self.nucleotide_sequences.get(r) {
                let seq_cols = if start_col < seq.len() {
                    (seq.len() - start_col).min(cols)
                } else {
                    0
                };
                if seq_cols > 0 {
                    self.viewport_buffer
                        .extend_from_slice(&seq[start_col..][..seq_cols]);
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
    /// row, and the main thread reads the same memory directly. There is no
    /// `postMessage` transfer of binary data, structured clone, or `ArrayBuffer.slice`.
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

        if self.nucleotide_sequences.is_empty() {
            return 0;
        }
        let row_end = end_row.min(self.nucleotide_sequences.len() - 1);
        if start_row > row_end {
            return 0;
        }
        // If the start column is greater than the end column, return 0.
        if start_col > end_col {
            return 0;
        }

        // Compute the number of rows and columns in the requested slice, checking for overflow.
        let rows = match inclusive_range_len(start_row, row_end) {
            Some(rows) => rows,
            None => return 0,
        };

        // Fixed column stride: every row contributes exactly this many bytes.
        let cols = match inclusive_range_len(start_col, end_col) {
            Some(cols) => cols,
            None => return 0,
        };

        // Check that the total byte length does not exceed the maximum allowed for the viewport buffer.
        match rows.checked_mul(cols) {
            Some(byte_len) if byte_len <= MAX_VIEWPORT_BYTES => {}
            _ => return 0,
        }

        // Actual viewport extraction logic
        for r in start_row..=row_end {
            let remaining = match out.len().checked_sub(written) {
                Some(remaining) => remaining,
                None => return 0,
            };
            if remaining < cols {
                // Buffer too small to fit even one more full row -> stop here.
                break;
            }
            if let Some(seq) = self.nucleotide_sequences.get(r) {
                let seq_cols = if start_col < seq.len() {
                    (seq.len() - start_col).min(cols)
                } else {
                    0
                };
                let row_out = &mut out[written..][..cols];
                if seq_cols > 0 {
                    row_out[..seq_cols].copy_from_slice(&seq[start_col..][..seq_cols]);
                }
                // Pad the remainder of the row with spaces.
                for b in &mut row_out[seq_cols..] {
                    *b = b' ';
                }
                written += cols;
            }
        }

        written
    }

    /// create a function for checking the query input
    /// It should be in the alphabet of the sequences, otherwise return an error message
    fn is_valid_nucleotide_query(&self, query: &str) -> bool {
        for b in query.bytes() {
            if !is_iupac(b) && !is_gap(b) {
                return false;
            }
        }
        true
    }

    fn is_valid_amino_acid_query(&self, query: &str) -> bool {
        for b in query.bytes() {
            if !is_amino(b) && !is_gap(b) {
                return false;
            }
        }
        true
    }

    fn is_valid_record_name_query(&self, query: &str) -> bool {
        for b in query.bytes() {
            // Allow all ASCII characters for record names
            if b > 127 {
                return false;
            }
        }
        true
    }

    fn search_nucleotide(&self, query: &str) -> SearchResult {
        if self.nucleotide_sequences.is_empty() || !self.is_valid_nucleotide_query(query) {
            SearchResult::empty(query)
        } else {
            run_search(
                &SearchAlgorithm::FmIndex,
                &self.nucleotide_sequences,
                query,
                MatrixType::Nucleotide,
            )
        }
    }

    fn search_amino_acid(&self, query: &str) -> SearchResult {
        if self.aminoacid_sequences.is_empty() || !self.is_valid_amino_acid_query(query) {
            return SearchResult::empty(query);
        }
        let amino_acid_bytes: Vec<Vec<u8>> = self
            .aminoacid_sequences
            .iter()
            .map(|s| {
                let mut combined = s.frame_1.clone();
                combined.extend_from_slice(&s.frame_2);
                combined.extend_from_slice(&s.frame_3);
                combined
            })
            .collect();

        run_search(
            &SearchAlgorithm::FmIndex,
            &amino_acid_bytes,
            query,
            MatrixType::AminoAcid,
        )
    }

    fn search_record_names(&self, query: &str) -> SearchResult {
        if self.names.is_empty() || !self.is_valid_record_name_query(query) {
            SearchResult::empty(query)
        } else {
            let positions: Vec<Match> = self
                .names
                .iter()
                .enumerate()
                .filter_map(|(row, name)| {
                    if name.contains(query) {
                        Some(Match {
                            row,
                            col: 0,
                            matrix_type: MatrixType::RecordName,
                        })
                    } else {
                        None
                    }
                })
                .collect();
            SearchResult {
                query: query.to_string(),
                num_matches: positions.len(),
                positions,
            }
        }
    }

    #[wasm_bindgen]
    pub fn search(&self, query: String, check_record_names: bool) -> Result<JsValue, JsValue> {
        console_log!(
            "Starting search with query: {}\nRecord names check: {}",
            query,
            check_record_names
        );

        let nucleotide_result = self.search_nucleotide(&query);
        let amino_acid_result = self.search_amino_acid(&query);
        let record_names_result = if check_record_names {
            self.search_record_names(&query)
        } else {
            SearchResult::empty(&query)
        };

        let mut all_positions = nucleotide_result.positions;
        all_positions.extend(amino_acid_result.positions);
        all_positions.extend(record_names_result.positions);

        let combined_result = SearchResult {
            query: query.to_string(),
            num_matches: all_positions.len(),
            positions: all_positions,
        };

        console_log!("Number of matches: {}", combined_result.num_matches);

        serde_wasm_bindgen::to_value(&combined_result)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Translate one nucleotide row into all three reading frames.
    ///
    /// TODO: CHECK THIS
    /// Gap codons (any of the 3 bytes is `-`) translate to a gap amino acid
    /// (`-`) rather than being treated as an error — gaps are a normal part of
    /// an aligned sequence. Non-gap codons that aren't valid IUPAC/standard
    /// codons fall through `translate_codon`'s own `X` (unknown) fallback.
    /// This must never panic: a panic inside a `#[wasm_bindgen]` method
    /// permanently poisons the engine object (every later call then fails
    /// with "recursive use of an object detected").
    fn translate_sequence(seq: &[u8]) -> AminoacidSequence {
        let mut frames: [Vec<u8>; 3] = [Vec::new(), Vec::new(), Vec::new()];

        for (offset, frame) in frames.iter_mut().enumerate() {
            for codon_bytes in seq[offset.min(seq.len())..].chunks(3) {
                if codon_bytes.len() < 3 {
                    break;
                }
                let codon = [codon_bytes[0], codon_bytes[1], codon_bytes[2]];
                let amino_acid = if codon.iter().any(|&b| is_gap(b)) {
                    b'-'
                } else {
                    translate_codon(codon)
                };
                frame.push(amino_acid);
            }
        }

        let [frame_1, frame_2, frame_3] = frames;
        AminoacidSequence {
            frame_1,
            frame_2,
            frame_3,
        }
    }

    /// When the translate function is called, it will check if there are any untranslated sequences and then translate all rows of nucleotide sequences for all reading frames.
    /// Afterwards it will select the viewport of the translated amino acid sequences for the specified range and reading frame.
    ///
    /// Mirrors `update_viewport`'s conventions exactly: rows and columns are
    /// inclusive (`[start, end]`), and every row contributes exactly
    /// `(end_col - start_col + 1)` bytes, padding short rows with `b' '`.
    /// Without this fixed stride, the worker's `bytes / cols` row count would
    /// be wrong whenever a translated row is shorter than the requested
    /// column range (which it almost always is, since amino acid frames are
    /// ~1/3 the length of the nucleotide sequence).
    pub fn translate(
        &mut self,
        start_row: usize,
        end_row: usize,
        start_col: usize,
        end_col: usize,
        reading_frame: u8,
    ) -> Result<js_sys::Uint8Array, StructuredEngineError> {
        if reading_frame > 2 {
            return Err(TranslateError::InvalidReadingFrame {
                frame: reading_frame,
            }
            .into());
        }

        if self.aminoacid_sequences.is_empty() {
            for seq in &self.nucleotide_sequences {
                self.aminoacid_sequences.push(Self::translate_sequence(seq));
            }
        }

        if self.aminoacid_sequences.is_empty() {
            return Ok(js_sys::Uint8Array::new(&wasm_bindgen::JsValue::from(0)));
        }
        let row_end = end_row.min(self.aminoacid_sequences.len() - 1);
        if start_row > row_end || start_col > end_col {
            return Ok(js_sys::Uint8Array::new(&wasm_bindgen::JsValue::from(0)));
        }

        let invalid_viewport = || StructuredEngineError {
            code: "InvalidViewport".to_owned(),
            message: format!(
                "Translate bounds must fit within {MAX_VIEWPORT_BYTES} bytes and memory must be available"
            ),
            context: Some(ErrorContext {
                row: Some(start_row),
                col: Some(start_col),
                frame: Some(reading_frame),
                ..ErrorContext::default()
            }),
        };
        let rows = inclusive_range_len(start_row, row_end).ok_or_else(invalid_viewport)?;
        let cols = inclusive_range_len(start_col, end_col).ok_or_else(invalid_viewport)?;
        let byte_len = rows
            .checked_mul(cols)
            .filter(|&byte_len| byte_len <= MAX_VIEWPORT_BYTES)
            .ok_or_else(invalid_viewport)?;
        let mut viewport = Vec::new();
        viewport
            .try_reserve_exact(byte_len)
            .map_err(|_| invalid_viewport())?;

        for row in start_row..=row_end {
            let seq = &self.aminoacid_sequences[row];
            let frame = match reading_frame {
                0 => &seq.frame_1,
                1 => &seq.frame_2,
                2 => &seq.frame_3,
                _ => unreachable!("reading frame validated before translation"),
            };
            let frame_cols = if start_col < frame.len() {
                (frame.len() - start_col).min(cols)
            } else {
                0
            };
            if frame_cols > 0 {
                viewport.extend_from_slice(&frame[start_col..start_col + frame_cols]);
            }
            // Pad the remainder of the row with spaces, same as `update_viewport`.
            for _ in frame_cols..cols {
                viewport.push(b' ');
            }
        }

        Ok(js_sys::Uint8Array::from(&viewport[..]))
    }

    pub fn get_aminoacid_view(&self, row: usize) -> js_sys::Uint8Array {
        if let Some(seq) = self.aminoacid_sequences.get(row) {
            let mut combined = Vec::new();
            combined.extend_from_slice(&seq.frame_1);
            combined.extend_from_slice(&seq.frame_2);
            combined.extend_from_slice(&seq.frame_3);
            js_sys::Uint8Array::from(&combined[..])
        } else {
            js_sys::Uint8Array::new(&js_sys::ArrayBuffer::new(0))
        }
    }

    /// Number of bytes currently held in the viewport buffer.
    pub fn get_viewport_len(&self) -> usize {
        self.viewport_buffer.len()
    }

    /// Number of sequences currently loaded.
    pub fn get_sequence_count(&self) -> usize {
        self.nucleotide_sequences.len()
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
        self.nucleotide_sequences
            .get(row)
            .and_then(|seq| seq.get(col).copied())
            .unwrap_or(0)
    }

    /// Return the length of a specific row, or `0` if the row index is invalid.
    pub fn get_row_length(&self, row: usize) -> usize {
        self.nucleotide_sequences
            .get(row)
            .map(|seq| seq.len())
            .unwrap_or(0)
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
    /// Returns a typed error on validation failure; no rows are modified.
    pub fn mutate_base_subset(
        &mut self,
        row_indices: &[usize],
        col_idx: usize,
        new_base: u8,
    ) -> Result<(), StructuredEngineError> {
        // Validate the destination base: it must be an IUPAC nucleotide or '-'
        // (Rule 3). Mutating to any other character is not allowed.
        if !is_iupac(new_base) && !is_gap(new_base) {
            return Err(MutateError::NewBaseNotIupac { base: new_base }.into());
        }
        // Validate: all existing characters at the target positions must be IUPAC or '-'.
        for &r in row_indices {
            if let Some(seq) = self.nucleotide_sequences.get(r) {
                if col_idx < seq.len() {
                    let existing = seq[col_idx];
                    if !is_iupac(existing) && !is_gap(existing) {
                        return Err(MutateError::TargetNotIupac {
                            row: r,
                            col: col_idx,
                            base: existing,
                        }
                        .into());
                    }
                }
            }
        }
        // Capture old bases for the rows we will actually touch, for undo.
        let mut mutated_rows: Vec<usize> = Vec::new();
        let mut old_bases: Vec<u8> = Vec::new();
        for &r in row_indices {
            if let Some(seq) = self.nucleotide_sequences.get(r) {
                if col_idx < seq.len() {
                    mutated_rows.push(r);
                    old_bases.push(seq[col_idx]);
                }
            }
        }
        if mutated_rows.is_empty() {
            return Ok(());
        }
        self.undo_stack.push(UndoCommand::Substitutions {
            col_idx,
            mutated_rows: mutated_rows.clone(),
            old_bases,
        });
        self.redo_stack.clear();

        for &r in &mutated_rows {
            if let Some(seq) = self.nucleotide_sequences.get_mut(r) {
                if col_idx < seq.len() {
                    seq[col_idx] = new_base;
                }
            }
        }
        Ok(())
    }

    /// Simultaneous gap insertion at a single column index on a subset of
    /// rows. The inserted character is always `-` (gap). Target rows receive
    /// the gap at the clamped insertion column; non-target rows have a `-`
    /// appended at the end to keep matrix width consistent.
    ///
    /// Returns success; no validation is needed since only `-` can be inserted.
    pub fn insert_at_subset(
        &mut self,
        row_indices: &[usize],
        col_idx: usize,
    ) -> Result<(), StructuredEngineError> {
        if self.nucleotide_sequences.is_empty() {
            return Ok(());
        }

        // Clamp the insertion column to the current alignment width. If `col_idx` is greater than the current width, the gap will be appended to all rows.
        let insertion_col = col_idx.min(self.alignment_width);
        self.record_structural_undo();

        // Use a HashSet for O(1) lookups of target rows.
        let target_rows: std::collections::HashSet<usize> = row_indices.iter().copied().collect();

        for r in 0..self.nucleotide_sequences.len() {
            let seq = &mut self.nucleotide_sequences[r];
            // Pad rows that are shorter than the insertion column before inserting.
            while seq.len() < insertion_col {
                seq.push(b'-');
            }
            if target_rows.contains(&r) {
                seq.insert(insertion_col, b'-');
            } else {
                seq.push(b'-'); // Balance unselected rows by appending gap at end
            }
        }
        self.alignment_width = self
            .nucleotide_sequences
            .iter()
            .map(Vec::len)
            .max()
            .unwrap_or(0);
        Ok(())
    }

    /// Simultaneous deletion at a single column index on a subset of rows.
    /// Only rows in `row_indices` are affected: the character at `col_idx`
    /// is removed and a `-` is appended at the end to keep width unchanged.
    /// Non-target rows are completely untouched.
    ///
    /// Returns `DeleteNotGap` if any target position contains a non-`-`
    /// character; the operation is all-or-nothing.
    pub fn delete_at_subset(
        &mut self,
        row_indices: &[usize],
        col_idx: usize,
    ) -> Result<(), StructuredEngineError> {
        // Validate: all target positions must be '-'.
        for &r in row_indices {
            if let Some(seq) = self.nucleotide_sequences.get(r) {
                if col_idx < seq.len() && !is_gap(seq[col_idx]) {
                    return Err(DeleteError::TargetNotGap {
                        row: r,
                        col: col_idx,
                        base: seq[col_idx],
                    }
                    .into());
                }
            }
        }

        self.record_structural_undo();

        let target_rows: std::collections::HashSet<usize> = row_indices.iter().copied().collect();

        for r in 0..self.nucleotide_sequences.len() {
            let seq = &mut self.nucleotide_sequences[r];
            if col_idx < seq.len() {
                if target_rows.contains(&r) {
                    seq.remove(col_idx);
                    seq.push(b'-'); // Pad at end to keep width unchanged
                }
                // Non-target rows: completely untouched
            }
        }
        // Width unchanged
        Ok(())
    }

    /// Delete a column from every row, shrinking `alignment_width` by 1.
    /// This is the width-preserving inverse of a full-column insert.
    /// Returns success.
    pub fn delete_column(&mut self, col_idx: usize) -> Result<(), StructuredEngineError> {
        // If the column is out of range for every row, nothing is removed and
        // the width must not change, otherwise `alignment_width` would
        // desynchronize from the actual row lengths.
        if col_idx >= self.alignment_width {
            return Ok(());
        }
        self.record_structural_undo();
        for seq in self.nucleotide_sequences.iter_mut() {
            if col_idx < seq.len() {
                seq.remove(col_idx);
            }
        }
        self.alignment_width -= 1;
        Ok(())
    }

    // Horizontal moves of character blocks

    /// Move a contiguous block of IUPAC characters horizontally by 1 position
    /// within a single row. Each call moves exactly 1 position; callers must
    /// issue multiple calls for multi-position moves.
    ///
    /// `col_indices` is treated as a range `[min, max]`, non-contiguous
    /// indices are clamped to their min/max.
    ///
    /// **Left move:** validates the selected chars are IUPAC and the position
    /// to the left is `-`, then rotates the block left by 1.
    ///
    /// **Right move:** validates the selected chars are IUPAC and the position
    /// to the right is `-`, then rotates the block right by 1.
    ///
    /// Returns a typed error on failure; the operation is all-or-nothing.
    pub fn move_horizontal(
        &mut self,
        row: usize,
        col_indices: &[usize],
        direction: MoveDirection,
    ) -> Result<(), StructuredEngineError> {
        let seq = match self.nucleotide_sequences.get(row) {
            Some(s) => s,
            None => return Ok(()), // out-of-range row is a no-op
        };

        if col_indices.is_empty() {
            return Ok(());
        }

        let start = *col_indices.iter().min().unwrap();
        let end = *col_indices.iter().max().unwrap();

        if end >= seq.len() {
            return Ok(()); // out of range
        }

        // Validate: all selected characters must be IUPAC (not '-').
        for (offset, &base) in seq[start..=end].iter().enumerate() {
            if !is_iupac(base) {
                return Err(MoveError::BlockNotIupac {
                    row,
                    col: start + offset,
                    base,
                }
                .into());
            }
        }

        match direction {
            MoveDirection::Left => {
                if start == 0 {
                    return Err(MoveError::BoundaryReached {
                        row,
                        col: 0,
                        direction: MoveDirection::Left,
                    }
                    .into());
                }
                if !is_gap(seq[start - 1]) {
                    return Err(MoveError::TargetNotGap {
                        row,
                        col: start - 1,
                        base: seq[start - 1],
                        direction: MoveDirection::Left,
                    }
                    .into());
                }
            }
            MoveDirection::Right => {
                if end + 1 >= seq.len() {
                    return Err(MoveError::BoundaryReached {
                        row,
                        col: seq.len(),
                        direction: MoveDirection::Right,
                    }
                    .into());
                }
                if !is_gap(seq[end + 1]) {
                    return Err(MoveError::TargetNotGap {
                        row,
                        col: end + 1,
                        base: seq[end + 1],
                        direction: MoveDirection::Right,
                    }
                    .into());
                }
            }
        }

        self.record_structural_undo();

        let seq = &mut self.nucleotide_sequences[row];
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

        Ok(())
    }

    // vertical moves and reordering of rows

    /// Move the specified rows up by 1 position. Each specified row swaps with
    /// the row immediately above it. Rows already at the top (index 0) are
    /// silently skipped. Multiple rows may be moved simultaneously.
    /// Returns success.
    pub fn move_rows_up(
        &mut self,
        row_indices: &[usize],
    ) -> Result<(), StructuredEngineError> {
        if row_indices.is_empty() || self.nucleotide_sequences.len() < 2 {
            return Ok(());
        }

        self.record_structural_undo();

        // Sort and deduplicate to process in a predictable order.
        let mut indices: Vec<usize> = row_indices.to_vec();
        indices.sort_unstable();
        indices.dedup();

        for &r in &indices {
            if r == 0 || r >= self.nucleotide_sequences.len() {
                continue;
            }
            self.nucleotide_sequences.swap(r, r - 1);
            self.names.swap(r, r - 1);
        }

        Ok(())
    }

    /// Move the specified rows down by 1 position. Each specified row swaps
    /// with the row immediately below it. Rows already at the bottom are
    /// silently skipped. Multiple rows may be moved simultaneously.
    /// Returns success.
    pub fn move_rows_down(
        &mut self,
        row_indices: &[usize],
    ) -> Result<(), StructuredEngineError> {
        if row_indices.is_empty() || self.nucleotide_sequences.len() < 2 {
            return Ok(());
        }

        self.record_structural_undo();

        // Sort descending so swaps don't interfere with each other.
        let mut indices: Vec<usize> = row_indices.to_vec();
        indices.sort_unstable_by(|a, b| b.cmp(a));
        indices.dedup();

        for &r in &indices {
            if r + 1 >= self.nucleotide_sequences.len() {
                continue;
            }
            self.nucleotide_sequences.swap(r, r + 1);
            self.names.swap(r, r + 1);
        }

        Ok(())
    }

    /// transactional history with undo/redo stacks.
    /// Snapshot the full matrix + width for structural undo. Cheap given the
    /// ~16MB max footprint.
    ///> we might need to revisit this if we want to support larger alignments in the future, but it keeps the logic simple for now and is fast enough for our expected use case.
    fn record_structural_undo(&mut self) {
        let matrix_snapshot = self.nucleotide_sequences.clone();
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
            UndoCommand::Substitutions {
                col_idx,
                mutated_rows,
                old_bases,
            } => {
                // Restore old bases; capture current bases for redo.
                // Rebuild paired row/base vectors to keep them aligned even if
                // malformed history data ever appears.
                let paired_len = mutated_rows.len().min(old_bases.len());
                let mut redo_rows: Vec<usize> = Vec::with_capacity(paired_len);
                let mut redo_old_bases: Vec<u8> = Vec::with_capacity(paired_len);
                for (r, old_base) in mutated_rows.into_iter().zip(old_bases.into_iter()) {
                    if let Some(seq) = self.nucleotide_sequences.get_mut(r) {
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
            UndoCommand::StructuralSnapshot {
                matrix_snapshot,
                names_snapshot,
                width_snapshot,
            } => {
                // Capture current state for redo, then restore the snapshot.
                let redo_snapshot = UndoCommand::StructuralSnapshot {
                    matrix_snapshot: self.nucleotide_sequences.clone(),
                    names_snapshot: self.names.clone(),
                    width_snapshot: self.alignment_width,
                };
                self.nucleotide_sequences = matrix_snapshot;
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
            UndoCommand::Substitutions {
                col_idx,
                mutated_rows,
                old_bases,
            } => {
                // Re-apply: old_bases here are the post-edit bases captured at
                // undo time. Capture current (pre-redo) bases for the undo stack.
                let paired_len = mutated_rows.len().min(old_bases.len());
                let mut undo_rows: Vec<usize> = Vec::with_capacity(paired_len);
                let mut undo_old_bases: Vec<u8> = Vec::with_capacity(paired_len);
                for (r, old_base) in mutated_rows.into_iter().zip(old_bases.into_iter()) {
                    if let Some(seq) = self.nucleotide_sequences.get_mut(r) {
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
            UndoCommand::StructuralSnapshot {
                matrix_snapshot,
                names_snapshot,
                width_snapshot,
            } => {
                let undo_snapshot = UndoCommand::StructuralSnapshot {
                    matrix_snapshot: self.nucleotide_sequences.clone(),
                    names_snapshot: self.names.clone(),
                    width_snapshot: self.alignment_width,
                };
                self.nucleotide_sequences = matrix_snapshot;
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
mod alphabets_tests;
#[cfg(test)]
mod engine_tests;
#[cfg(test)]
mod search_algorithms_tests;
