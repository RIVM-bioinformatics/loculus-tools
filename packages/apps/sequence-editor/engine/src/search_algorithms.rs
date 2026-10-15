#[cfg(test)]
use fm_index::{FMIndexMultiPiecesWithLocate, MatchWithLocate, MatchWithPieceId, Search, Text};
use serde::Serialize;

pub const MAX_SEARCH_RESULTS: usize = 10_000;

#[derive(Serialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MatrixType {
    Nucleotide,
    AminoAcid,
    RecordName,
}

/// `Serialize` lets `serde_wasm_bindgen` turn this straight into a plain JS
/// object (`{ row, col }`) when it crosses the wasm-bindgen boundary.
/// `Clone` is needed so `[Vec<Match>; 3].concat()` can merge the per-matrix
/// search results in `MsaEngine::search`.
#[derive(Serialize, Clone)]
pub struct Match {
    /// Row (sequence) index of the match.
    pub row: usize,
    /// Column index where the match starts within the row.
    pub col: usize,
    pub matrix_type: MatrixType,
}
#[derive(Serialize)]
pub struct SearchResult {
    pub query: String,
    pub num_matches: usize,
    pub truncated: bool,
    /// Positions of all matches found in the matrix.
    pub positions: Vec<Match>,
}

impl SearchResult {
    pub fn empty(query: &str) -> Self {
        SearchResult {
            query: query.to_string(),
            num_matches: 0,
            truncated: false,
            positions: Vec::new(),
        }
    }
}

pub fn naive_search(matrix: &[Vec<u8>], query: &str, matrix_type: MatrixType) -> SearchResult {
    let query_bytes = query.as_bytes();
    let mut result = Vec::new();
    let mut truncated = false;

    for (row_idx, seq) in matrix.iter().enumerate() {
        let mut col_idx = 0;

        while col_idx + query_bytes.len() <= seq.len() {
            if &seq[col_idx..col_idx + query_bytes.len()] == query_bytes {
                if result.len() == MAX_SEARCH_RESULTS {
                    truncated = true;
                    break;
                }
                result.push(Match {
                    row: row_idx,
                    col: col_idx,
                    matrix_type: matrix_type.clone(),
                });
            }
            col_idx += 1;
        }
        if truncated {
            break;
        }
    }
    SearchResult {
        query: query.to_string(),
        num_matches: result.len(),
        truncated,
        positions: result,
    }
}

#[cfg(test)]
pub fn fm_index_search(
    matrix: &Vec<Vec<u8>>,
    query: &str,
    matrix_type: MatrixType,
) -> SearchResult {
    // We need a Text representation of the matrix for the FM-index, with '\0' as row separators.
    let mut concatenated: Vec<u8> = Vec::new();
    let mut row_offsets = Vec::new();
    for seq in matrix.iter() {
        row_offsets.push(concatenated.len());
        concatenated.extend_from_slice(seq);
        concatenated.push(b'\0'); // unique separator
    }

    let text = Text::new(&concatenated);
    let fm_index = FMIndexMultiPiecesWithLocate::new(&text, 0).unwrap();
    let uppercase_query = query.to_uppercase();
    let query_bytes = uppercase_query.as_bytes();
    let mut result = Vec::new();
    let mut truncated = false;

    let search_result = fm_index.search(query_bytes);
    for m in search_result.iter_matches() {
        if result.len() == MAX_SEARCH_RESULTS {
            truncated = true;
            break;
        }
        // Find the row corresponding to this position
        let pos = m.locate();
        let row = m.piece_id().into();
        let col = pos - row_offsets[row];
        result.push(Match {
            row,
            col,
            matrix_type: matrix_type.clone(),
        });
    }

    SearchResult {
        query: query.to_string(),
        num_matches: result.len(),
        truncated,
        positions: result,
    }
}
