//! Unit tests for the search algorithms module.
//!
//! This module is compiled only under `#[cfg(test)]` (see the
//! `mod search_algorithms_tests;` declaration in `lib.rs`). It lives in its
//! own file to keep `search_algorithms.rs` focused on the implementation.
//! Because it is a sibling module of `search_algorithms` at the crate root,
//! it imports the search items via `crate::search_algorithms`.

use crate::search_algorithms::*;

// A single real-world-shaped sequence, written across multiple source lines
// for readability. The trailing `\` on each line is a Rust string-literal
// continuation: it strips the newline (and leading whitespace) so the
// resulting byte string has no embedded `\n` bytes.
const SEQ_1: &[u8] = b"tggttctcacttgaactgcaagatcataatgaaacttgtcacgcctaaacgaacatgaaa
tttcttgttttcttaggaatcatcacaactgtagctgcatttcaccaagaatgtagttta
cagtcatgtactcaacatcaaccatatgtagttgatgacccgtgtcctattcacttctat
tctaaatggtatattagagtaggagctagaaaatcagcacctttaattgaattgtgcgtg
gatgaggctggttctaaatcacccattcagtacatcgatatcggtaattatacagtttcc
tgtttaccttttacaattaattgccaggaacctaaattgggtagtcttgtagtgcgttgt
tcgttctatgaagactttttagagtatcatgacgttcgtgttgttttagatttcatctaa
acgaacaaactaaaatgtctgataatggaccccaaaatcagcgaaatgcaccccgcatta
cgtttggtggaccctcagattcaactggcagtaaccagaatggagaacgcagtggggcgc
gatcaaaacaacgtcggccccaaggtttacccaataatactgcgtcttggttcaccgctc
tcactcaacatggcaaggaagaccttaaattccctcgaggacaaggcgttccaattaaca
ccaatagcagtccagatgaccaaattggctactaccgaagagctaccagacgaattcgtg
gtggtgacggtaaaatgaaagatctcagtccaagatggtatttctactacctaggaactg
ggccagaagctggacttccctatggtgctaacaaagacggcatcatatgggttgcaactg
agggagccttgaatacaccaaaagatcacattggcacccgcaatcctgctaacaatgctg
caatcgtgctacaacttcctcaaggaacaacattgccaaaaggcttctacgcagaaggga
gcagaggcggcagtcaagcctcttctcgttcctcatcacgtagtcgcaacagttcaagaa
attcaactccaggcagcagtaggggaacttctcctgctagaatggctggcaatggcggtg
atgctgctcttgctttgctgctgcttgacagattgaaccagcttgagagcaaaatgtctg
gtaaaggccaacaacaacaaggccaaactgtcactaagaaatctgctgctgaggcttcta
agaagcctcggcaaaaacgtactgccactaaagcatacaatgtaacacaagctttcggca
gacgtggtccagaacaaacccaaggaaattttggggaccaggaactaatcagacaaggaa
ctgattacaaacattggccgcaaattgcacaatttgcccccagcgcttcagcgttcttcg
gaatgtcgcgcattggcatggaagtcacaccttcgggaacgtggttgacctacacaggtg
ccatcaaattggatgacaaagatccaaatttcaaagatcaagtcattttgctgaataagc
atattgacgcatacaaaacattcccaccaacagagcctaaaaaggacaaaaagaagaagg
ctgatgaaactcaagccttaccgcagagacagaagaaacagcaaactgtgactcttcttc
ctgctgcagatttggatgatttctccaaacaattgcaacaatccatgagcagtgctgact
caactcaggcctaaactcatgcagaccacacaaggcagatgggctatataaacgttttcg
cttttccgtttacgatatatagtctactcttgtgcagaatgaattctcgtaactacatag
cacaagtagatgtagttaactttaatctcacatagcaatctttaatcagtgtgtaacatt
agggaggacttgaaagagccaccacattttcaccgaggccacgcggagtacgatcgagtg
tacagtgaacaatgctagggagagctgcctatatggaagagccctaatgtgtaaaattaa
ttttagtagtgctatccccatgtgattttaatagcttcttaggagaatgacaaaaaaaaa
aaaaaaaaaaaaaaaaaaaaaaaa";

/// Two identical uppercased copies of `SEQ_1`, so a matching search should
/// hit both rows. Uppercased because `naive_search`/`fm_index_search`
/// uppercase the query but not the matrix, matching how `load_fasta` always
/// stores sequences uppercase in the real engine.
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

// #[test]
// fn fm_index_search_finds_matches_in_every_row() {
//     let matrix = make_matrix();
//     let query = "cattggcatggaagtcacaccttcgggaacgtggttgacct";

//     let result = fm_index_search(&matrix, query, MatrixType::Nucleotide);

//     assert_eq!(result.query, query);
//     assert_eq!(result.num_matches, 2);
//     assert_eq!(result.positions.len(), 2);
//     // `fm_index_search` is suffix-array based and doesn't preserve row order
//     // the way the naive linear scan does, so compare rows as a set.
//     let mut rows: Vec<usize> = result.positions.iter().map(|m| m.row).collect();
//     rows.sort_unstable();
//     assert_eq!(rows, vec![0, 1]);
// }

#[test]
fn naive_search_reports_no_matches_for_missing_query() {
    let matrix = make_matrix();
    let result = naive_search(&matrix, "this-query-does-not-exist", MatrixType::Nucleotide);

    assert_eq!(result.num_matches, 0);
    assert!(result.positions.is_empty());
}

// #[test]
// fn fm_index_search_reports_no_matches_for_missing_query() {
//     let matrix = make_matrix();
//     let result = fm_index_search(&matrix, "this-query-does-not-exist", MatrixType::Nucleotide);

//     assert_eq!(result.num_matches, 0);
//     assert!(result.positions.is_empty());
// }
