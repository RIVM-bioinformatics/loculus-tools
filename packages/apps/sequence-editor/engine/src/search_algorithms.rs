use serde::Serialize;

pub const MAX_SEARCH_RESULTS: usize = 10_000;

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
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
#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub struct Match {
    /// Row (sequence) index of the match.
    pub row: usize,
    /// Column index where the match starts within the row.
    pub col: usize,
    pub matrix_type: MatrixType,
}
#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
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
    if query.is_empty() {
        return SearchResult::empty(query);
    }
    let query_bytes = query.as_bytes();
    let mut result = Vec::new();
    let mut truncated = false;

    for (row_idx, seq) in matrix.iter().enumerate() {
        let mut col_idx = 0;

        while col_idx + query_bytes.len() <= seq.len() {
            if seq[col_idx..col_idx + query_bytes.len()].eq_ignore_ascii_case(query_bytes) {
                if result.len() == MAX_SEARCH_RESULTS {
                    truncated = true;
                    break;
                }
                result.push(Match {
                    row: row_idx,
                    col: col_idx,
                    matrix_type,
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
