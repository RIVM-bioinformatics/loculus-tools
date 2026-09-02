use serde::Serialize;

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
    pub is_nucleotide: bool,
    pub is_amino_acid: bool,
    pub is_record_name: bool,
}

pub enum MatrixType {
    Nucleotide,
    AminoAcid,
    RecordName,
}

#[derive(Serialize)]
pub struct SearchResult {
    pub query: String,
    pub num_matches: usize,
    /// Positions of all matches found in the matrix.
    pub positions: Vec<Match>,
}

pub fn naive_search(matrix: &Vec<Vec<u8>>, query: &str, matrix_type: MatrixType) -> SearchResult {
    let uppercase_query = query.to_uppercase();
    let query_bytes = uppercase_query.as_bytes();
    let mut result = Vec::new();

    for (row_idx, seq) in matrix.iter().enumerate() {
        let mut col_idx = 0;

        while col_idx + query_bytes.len() <= seq.len() {
            if &seq[col_idx..col_idx + query_bytes.len()] == query_bytes {
                result.push(Match {
                    row: row_idx,
                    col: col_idx,
                    is_nucleotide: matches!(matrix_type, MatrixType::Nucleotide),
                    is_amino_acid: matches!(matrix_type, MatrixType::AminoAcid),
                    is_record_name: matches!(matrix_type, MatrixType::RecordName),
                });
            }
            col_idx += 1;
        }
    }
    SearchResult {
        query: query.to_string(),
        num_matches: result.len(),
        positions: result,
    }
}

// pub fn fm_index_search(
//     matrix: &Vec<Vec<u8>>,
//     query: &str,
//     matrix_type: MatrixType,
// ) -> SearchResult {
//     // We need a Text representation of the matrix for the FM-index, with '\0' as row separators.
//     let mut concatenated: Vec<u8> = Vec::new();
//     let mut row_offsets = Vec::new();
//     for seq in matrix.iter() {
//         row_offsets.push(concatenated.len());
//         concatenated.extend_from_slice(seq);
//         concatenated.push(b'\0'); // unique separator
//     }

//     let text = Text::new(&concatenated);
//     let fm_index = FMIndexMultiPiecesWithLocate::new(&text, 0).unwrap();
//     let uppercase_query = query.to_uppercase();
//     let query_bytes = uppercase_query.as_bytes();
//     let mut result = Vec::new();

//     let search_result = fm_index.search(query_bytes);
//     for m in search_result.iter_matches() {
//         // Find the row corresponding to this position
//         let pos = m.locate();
//         let row = m.piece_id().into();
//         let col = pos - row_offsets[row];
//         result.push(Match {
//             row,
//             col,
//             is_nucleotide: matches!(matrix_type, MatrixType::Nucleotide),
//             is_amino_acid: matches!(matrix_type, MatrixType::AminoAcid),
//             is_record_name: matches!(matrix_type, MatrixType::RecordName),
//         });
//     }

//     SearchResult {
//         query: query.to_string(),
//         num_matches: result.len(),
//         positions: result,
//     }
// }
