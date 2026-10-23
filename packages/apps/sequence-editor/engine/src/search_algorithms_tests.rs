//! Unit tests for the search algorithms module.
//!
//! This module is compiled only under `#[cfg(test)]` (see the
//! `mod search_algorithms_tests;` declaration in `lib.rs`). It lives in its
//! own file to keep `search_algorithms.rs` focused on the implementation.
//! Because it is a sibling module of `search_algorithms` at the crate root,
//! it imports the search items via `crate::search_algorithms`.

use crate::search_algorithms::{MAX_SEARCH_RESULTS, MatrixType, naive_search};

// A single real-world-shaped sequence, written across multiple source lines
// for readability. The trailing `\` on each line is a Rust string-literal
// continuation: it strips the newline (and leading whitespace) so the
// resulting byte string has no embedded `\n` bytes.
const SEQ_1: &[u8] = b"tggttctcacttgaactgcaagatcataatgaaacttgtcacgcctaaacgaacatgaaa\
tttcttgttttcttaggaatcatcacaactgtagctgcatttcaccaagaatgtagttta\
cagtcatgtactcaacatcaaccatatgtagttgatgacccgtgtcctattcacttctat\
tctaaatggtatattagagtaggagctagaaaatcagcacctttaattgaattgtgcgtg\
gatgaggctggttctaaatcacccattcagtacatcgatatcggtaattatacagtttcc\
tgtttaccttttacaattaattgccaggaacctaaattgggtagtcttgtagtgcgttgt\
tcgttctatgaagactttttagagtatcatgacgttcgtgttgttttagatttcatctaa\
acgaacaaactaaaatgtctgataatggaccccaaaatcagcgaaatgcaccccgcatta\
cgtttggtggaccctcagattcaactggcagtaaccagaatggagaacgcagtggggcgc\
gatcaaaacaacgtcggccccaaggtttacccaataatactgcgtcttggttcaccgctc\
tcactcaacatggcaaggaagaccttaaattccctcgaggacaaggcgttccaattaaca\
ccaatagcagtccagatgaccaaattggctactaccgaagagctaccagacgaattcgtg\
gtggtgacggtaaaatgaaagatctcagtccaagatggtatttctactacctaggaactg\
ggccagaagctggacttccctatggtgctaacaaagacggcatcatatgggttgcaactg\
agggagccttgaatacaccaaaagatcacattggcacccgcaatcctgctaacaatgctg\
caatcgtgctacaacttcctcaaggaacaacattgccaaaaggcttctacgcagaaggga\
gcagaggcggcagtcaagcctcttctcgttcctcatcacgtagtcgcaacagttcaagaa\
attcaactccaggcagcagtaggggaacttctcctgctagaatggctggcaatggcggtg\
atgctgctcttgctttgctgctgcttgacagattgaaccagcttgagagcaaaatgtctg\
gtaaaggccaacaacaacaaggccaaactgtcactaagaaatctgctgctgaggcttcta\
agaagcctcggcaaaaacgtactgccactaaagcatacaatgtaacacaagctttcggca\
gacgtggtccagaacaaacccaaggaaattttggggaccaggaactaatcagacaaggaa\
ctgattacaaacattggccgcaaattgcacaatttgcccccagcgcttcagcgttcttcg\
gaatgtcgcgcattggcatggaagtcacaccttcgggaacgtggttgacctacacaggtg\
ccatcaaattggatgacaaagatccaaatttcaaagatcaagtcattttgctgaataagc\
atattgacgcatacaaaacattcccaccaacagagcctaaaaaggacaaaaagaagaagg\
ctgatgaaactcaagccttaccgcagagacagaagaaacagcaaactgtgactcttcttc\
ctgctgcagatttggatgatttctccaaacaattgcaacaatccatgagcagtgctgact\
caactcaggcctaaactcatgcagaccacacaaggcagatgggctatataaacgttttcg\
cttttccgtttacgatatatagtctactcttgtgcagaatgaattctcgtaactacatag\
cacaagtagatgtagttaactttaatctcacatagcaatctttaatcagtgtgtaacatt\
agggaggacttgaaagagccaccacattttcaccgaggccacgcggagtacgatcgagtg\
tacagtgaacaatgctagggagagctgcctatatggaagagccctaatgtgtaaaattaa\
ttttagtagtgctatccccatgtgattttaatagcttcttaggagaatgacaaaaaaaaa\
aaaaaaaaaaaaaaaaaaaaaaa";

/// Two identical uppercased copies of `SEQ_1`, so a matching search should
/// hit both rows.
fn make_matrix() -> Vec<Vec<u8>> {
    let upper: Vec<u8> = SEQ_1.iter().map(u8::to_ascii_uppercase).collect();
    vec![upper.clone(), upper]
}

#[test]
fn naive_search_finds_matches_in_every_row() {
    let matrix = make_matrix();
    let query = "cattggcatggaagtcacaccttcgggaacgtggttgacct";

    let result = naive_search(&matrix, query, MatrixType::Nucleotide);

    assert_eq!(result.query, query);
    assert_eq!(result.num_matches, 2);
    assert_eq!(result.positions.len(), 2);
    assert_eq!(result.positions[0].row, 0);
    assert_eq!(result.positions[1].row, 1);
}

#[test]
fn naive_search_case_insensitive_matching() {
    let matrix = vec![b"ACGTacgt".to_vec(), b"acgtACGT".to_vec()];

    // Lowercase query matches uppercase and lowercase sequence data
    let lower_result = naive_search(&matrix, "acgt", MatrixType::Nucleotide);
    assert_eq!(lower_result.num_matches, 4);
    assert_eq!(lower_result.positions.len(), 4);
    assert_eq!(
        (lower_result.positions[0].row, lower_result.positions[0].col),
        (0, 0)
    );
    assert_eq!(
        (lower_result.positions[1].row, lower_result.positions[1].col),
        (0, 4)
    );
    assert_eq!(
        (lower_result.positions[2].row, lower_result.positions[2].col),
        (1, 0)
    );
    assert_eq!(
        (lower_result.positions[3].row, lower_result.positions[3].col),
        (1, 4)
    );

    // Uppercase query matches uppercase and lowercase sequence data
    let upper_result = naive_search(&matrix, "ACGT", MatrixType::Nucleotide);
    assert_eq!(upper_result.num_matches, 4);
    assert_eq!(upper_result.positions, lower_result.positions);

    // Mixed case query matches
    let mixed_result = naive_search(&matrix, "AcGt", MatrixType::Nucleotide);
    assert_eq!(mixed_result.num_matches, 4);
    assert_eq!(mixed_result.positions, lower_result.positions);
}

#[test]
fn naive_search_empty_query_returns_empty() {
    let matrix = make_matrix();
    let result = naive_search(&matrix, "", MatrixType::Nucleotide);

    assert_eq!(result.num_matches, 0);
    assert!(!result.truncated);
    assert!(result.positions.is_empty());
}

#[test]
fn naive_search_reports_no_matches_for_missing_query() {
    let matrix = make_matrix();
    let result = naive_search(&matrix, "this-query-does-not-exist", MatrixType::Nucleotide);

    assert_eq!(result.num_matches, 0);
    assert!(result.positions.is_empty());
}

#[test]
fn search_limits_high_frequency_matches() {
    let matrix = vec![vec![b'A'; MAX_SEARCH_RESULTS + 1]];

    let naive_result = naive_search(&matrix, "A", MatrixType::Nucleotide);
    assert_eq!(naive_result.num_matches, MAX_SEARCH_RESULTS);
    assert!(naive_result.truncated);
    assert_eq!(naive_result.positions.len(), MAX_SEARCH_RESULTS);
}

#[test]
fn search_limits_high_frequency_matches_across_multiple_rows() {
    let matrix = vec![vec![b'A'; 6_000], vec![b'A'; 6_000], vec![b'A'; 1_000]];

    let result = naive_search(&matrix, "A", MatrixType::Nucleotide);
    assert_eq!(result.num_matches, MAX_SEARCH_RESULTS);
    assert!(result.truncated);
    assert_eq!(result.positions.len(), MAX_SEARCH_RESULTS);
    // All 6,000 matches from row 0 plus first 4,000 matches from row 1
    assert_eq!(result.positions[0].row, 0);
    assert_eq!(result.positions[5_999].row, 0);
    assert_eq!(result.positions[6_000].row, 1);
    assert_eq!(result.positions[9_999].row, 1);
}
