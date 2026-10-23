//! Unit tests for the sequence-editor engine.
//!
//! This module is compiled only under `#[cfg(test)]` (see the
//! `mod engine_tests;` declaration in `lib.rs`). It lives in its own file to
//! keep `lib.rs` focused on the engine implementation. Because it is a child
//! module of the crate root, `use super::*;` gives it access to private items
//! such as `UndoCommand` and the `nucleotide_sequences` field.

use super::*;

fn engine_with_sample() -> MsaEngine {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1 first record\nATGCATGC\n>seq2\nATGGTG-A\n>seq3 third record\nATGCAT-C")
        .expect("valid sample FASTA");
    e
}

#[test]
fn loads_three_sequences() {
    let e = engine_with_sample();
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_alignment_width(), 8);
    assert_eq!(e.get_name(0), "seq1 first record");
    assert_eq!(e.get_name(1), "seq2");
    assert_eq!(e.get_name(2), "seq3 third record");
}

#[test]
fn load_fasta_preserves_full_header() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1 this is the description\nATGCATGCATGC")
        .expect("valid FASTA");

    assert_eq!(e.get_name(0), "seq1 this is the description");
}

#[test]
fn handles_multiline_sequences() {
    let mut e = MsaEngine::new();
    e.load_fasta(">x\nATGC\nATGC\n>y\nTTTT\nGGGG")
        .expect("valid multiline FASTA");
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
fn nucleotide_search_accepts_lowercase_queries() {
    let e = engine_with_sample();
    let result = e.search_nucleotide("atgc");

    assert_eq!(result.query, "atgc");
    assert_eq!(result.num_matches, 4);
}

#[test]
fn empty_fasta_loads_zero() {
    let mut e = MsaEngine::new();
    assert_eq!(e.load_fasta("").unwrap(), 0);
    assert_eq!(e.get_sequence_count(), 0);
    assert_eq!(e.get_alignment_width(), 0);
}

#[test]
fn load_fasta_retains_empty_records_with_zero_length() {
    let mut e = MsaEngine::new();
    assert_eq!(
        e.load_fasta(
            ">seq1 first record\nATGCATGCATGC\n>seq2\nATGGTGCAT-TC\n>seq3 third record\n>seq4"
        )
        .unwrap(),
        4
    );
    assert_eq!(e.get_sequence_count(), 4);
    assert_eq!(e.get_row_length(0), 12);
    assert_eq!(e.get_row_length(1), 12);
    assert_eq!(e.get_row_length(2), 0);
    assert_eq!(e.get_row_length(3), 0);
}

#[test]
fn exports_loaded_alignment_as_unwrapped_fasta() {
    let e = engine_with_sample();

    assert_eq!(
        e.export_fasta_bytes(true),
        b">seq1 first record\nATGCATGC\n>seq2\nATGGTG-A\n>seq3 third record\nATGCAT-C\n"
    );
}

#[test]
fn exports_loaded_alignment_as_ungapped_fasta() {
    let e = engine_with_sample();

    assert_eq!(
        e.export_fasta_bytes(false),
        b">seq1 first record\nATGCATGC\n>seq2\nATGGTGA\n>seq3 third record\nATGCATC\n"
    );
}

#[test]
fn exports_edited_alignment() {
    let mut e = engine_with_sample();
    assert_eq!(e.mutate_base(&[0], &[0], b'G'), Ok(()));

    assert_eq!(
        e.export_fasta_bytes(true),
        b">seq1 first record\nGTGCATGC\n>seq2\nATGGTG-A\n>seq3 third record\nATGCAT-C\n"
    );
    assert_eq!(
        e.export_fasta_bytes(false),
        b">seq1 first record\nGTGCATGC\n>seq2\nATGGTGA\n>seq3 third record\nATGCATC\n"
    );
}

#[test]
fn exports_current_row_order() {
    let mut e = engine_with_sample();
    assert_eq!(e.move_rows_up(&[1]), Ok(()));

    assert_eq!(
        e.export_fasta_bytes(true),
        b">seq2\nATGGTG-A\n>seq1 first record\nATGCATGC\n>seq3 third record\nATGCAT-C\n"
    );
    assert_eq!(
        e.export_fasta_bytes(false),
        b">seq2\nATGGTGA\n>seq1 first record\nATGCATGC\n>seq3 third record\nATGCATC\n"
    );
}

#[test]
fn exports_empty_engine_as_empty_buffer() {
    let e = MsaEngine::new();

    assert!(e.export_fasta_bytes(true).is_empty());
    assert!(e.export_fasta_bytes(false).is_empty());
}

#[test]
fn exports_ungapped_with_various_gap_distributions() {
    let mut e = MsaEngine::new();
    e.load_fasta(">all_gaps\n---\n>mixed\n-A-T-G-\n>no_gaps\nCGTA\n>empty\n")
        .expect("valid FASTA");

    assert_eq!(
        e.export_fasta_bytes(true),
        b">all_gaps\n---\n>mixed\n-A-T-G-\n>no_gaps\nCGTA\n>empty\n\n"
    );
    assert_eq!(
        e.export_fasta_bytes(false),
        b">all_gaps\n\n>mixed\nATG\n>no_gaps\nCGTA\n>empty\n\n"
    );
}

#[test]
fn exports_utf8_headers_correctly() {
    let mut e = MsaEngine::new();
    e.load_fasta(">sēq 1\nAT-G\n>record_čšž\nCGTA\n")
        .expect("valid FASTA");

    assert_eq!(
        e.export_fasta_bytes(true),
        ">sēq 1\nAT-G\n>record_čšž\nCGTA\n".as_bytes()
    );
    assert_eq!(
        e.export_fasta_bytes(false),
        ">sēq 1\nATG\n>record_čšž\nCGTA\n".as_bytes()
    );
}

#[test]
fn export_tracks_undo_and_redo_state() {
    let mut e = engine_with_sample();
    let original = e.export_fasta_bytes(true);
    let original_ungapped = e.export_fasta_bytes(false);

    assert_eq!(e.mutate_base(&[0], &[0], b'G'), Ok(()));
    let edited = e.export_fasta_bytes(true);
    let edited_ungapped = e.export_fasta_bytes(false);
    assert!(e.undo());
    assert_eq!(e.export_fasta_bytes(true), original);
    assert_eq!(e.export_fasta_bytes(false), original_ungapped);
    assert!(e.redo());
    assert_eq!(e.export_fasta_bytes(true), edited);
    assert_eq!(e.export_fasta_bytes(false), edited_ungapped);
}

#[test]
fn reload_clears_previous_state() {
    let mut e = engine_with_sample();
    assert_eq!(e.get_sequence_count(), 3);
    e.load_fasta(">only\nAT").expect("valid replacement FASTA");
    assert_eq!(e.get_sequence_count(), 1);
    assert_eq!(e.get_alignment_width(), 2);
    assert_eq!(e.get_name(0), "only");
}

#[test]
fn load_fasta_accepts_iupac_symbols_lowercase_and_gaps() {
    let mut e = MsaEngine::new();
    let count = e
        .load_fasta(">upper\nACGTURYSWKMBDHVN-\n>lower\nacgturyswkmbdhvn-")
        .unwrap();

    assert_eq!(count, 2);
    assert_eq!(e.get_alignment_width(), 17);
    assert_eq!(e.get_base(1, 0), b'A');
    assert_eq!(e.get_base(1, 16), b'-');
}

#[test]
fn load_fasta_rejects_invalid_alphabet_with_record_and_position_context() {
    let mut e = MsaEngine::new();
    let error = e
        .load_fasta(">first record\nACGT\n>bad record\nACZGT")
        .unwrap_err();

    assert_eq!(error.code, "InvalidAlphabet");
    assert!(error.message.contains("'Z' (0x5A)"));
    assert!(
        error
            .message
            .contains("sequence \"bad\" at position 3, line 4")
    );
    let context = error.context.unwrap();
    assert_eq!(context.sequence_id.as_deref(), Some("bad"));
    assert_eq!(context.position, Some(3));
    assert_eq!(context.line, Some(4));
    assert_eq!(context.invalid_char.as_deref(), Some("Z"));
    assert_eq!(context.byte, Some(b'Z'));
    assert_eq!(context.invalid_characters.unwrap().len(), 1);
}

#[test]
fn load_fasta_reports_invalid_characters_across_all_records() {
    let mut e = MsaEngine::new();
    let error = e
        .load_fasta(
            ">seq1 first record\nATGCATGCATGC?\n>seq2\nATGGTGCAT-TC?\n>seq3 third record\nATGCAT-CATGC?",
        )
        .unwrap_err();

    assert_eq!(error.code, "InvalidAlphabet");
    assert!(error.message.contains("Found 3 invalid FASTA character(s)"));
    let occurrences = error.context.unwrap().invalid_characters.unwrap();
    assert_eq!(occurrences.len(), 3);
    assert_eq!(occurrences[0].sequence_id, "seq1");
    assert_eq!(occurrences[0].position, 13);
    assert_eq!(occurrences[0].line, 2);
    assert_eq!(occurrences[0].invalid_char, "?");
    assert_eq!(occurrences[0].byte, Some(b'?'));
    assert_eq!(occurrences[1].sequence_id, "seq2");
    assert_eq!(occurrences[1].position, 13);
    assert_eq!(occurrences[1].line, 4);
    assert_eq!(occurrences[2].sequence_id, "seq3");
    assert_eq!(occurrences[2].position, 13);
    assert_eq!(occurrences[2].line, 6);
}

#[test]
fn load_fasta_rejects_digits_punctuation_and_non_ascii() {
    for invalid in [">seq\nAC1T", ">seq\nAC.T", ">seq\nAC?T", ">seq\nACéT"] {
        let mut e = MsaEngine::new();
        let error = e.load_fasta(invalid).unwrap_err();
        assert_eq!(error.code, "InvalidAlphabet", "input: {invalid}");
        assert!(error.context.unwrap().invalid_char.is_some());
    }
}

#[test]
fn load_fasta_allows_punctuation_and_numbers_in_headers() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq-1 description with 123 & symbols\nACGT-N")
        .unwrap();

    assert_eq!(e.get_name(0), "seq-1 description with 123 & symbols");
    assert_eq!(e.get_alignment_width(), 6);
}

#[test]
fn load_fasta_invalid_input_preserves_engine_data_and_history() {
    let mut e = engine_with_sample();
    e.mutate_base(&[0], &[0], b'T').unwrap();
    e.mutate_base(&[0], &[1], b'A').unwrap();
    assert!(e.undo());

    let error = e
        .load_fasta(">replacement\nACGT\n>invalid\nACG?T")
        .unwrap_err();

    assert_eq!(error.code, "InvalidAlphabet");
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_alignment_width(), 8);
    assert_eq!(e.get_name(0), "seq1 first record");
    assert_eq!(e.get_base(0, 0), b'T');
    assert_eq!(e.get_base(0, 1), b'T');
    assert_eq!(e.undo_depth(), 1);
    assert_eq!(e.redo_depth(), 1);

    assert!(e.redo());
    assert_eq!(e.get_base(0, 1), b'A');
    assert!(e.undo());
    assert_eq!(e.get_base(0, 1), b'T');
}

#[test]
fn load_fasta_rejects_sequence_data_before_header() {
    let mut e = MsaEngine::new();
    let error = e.load_fasta("ACGT\n>seq\nACGT").unwrap_err();

    assert_eq!(error.code, "InvalidFastaFormat");
    assert_eq!(error.context.unwrap().line, Some(1));
    assert_eq!(e.get_sequence_count(), 0);
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
fn update_viewport_into_rejects_unrepresentable_or_oversized_ranges() {
    let mut e = engine_with_sample();
    let mut out = vec![0xFFu8; 16];

    // An inclusive range ending at usize::MAX cannot add its final endpoint.
    assert_eq!(e.update_viewport_into(0, 2, 0, usize::MAX, &mut out), 0);
    assert_eq!(out, vec![0xFFu8; 16]);

    // This stride is representable, but its requested byte count is not.
    assert_eq!(e.update_viewport_into(0, 2, 1, usize::MAX, &mut out), 0);
    assert_eq!(out, vec![0xFFu8; 16]);
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
    assert_eq!(&out[0..cols], b"ATGCATGC    ");
    assert_eq!(&out[cols..2 * cols], b"ATGGTG-A    ");
    assert_eq!(&out[2 * cols..3 * cols], b"ATGCAT-C    ");
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
fn mutate_base_changes_only_target_rows() {
    let mut e = engine_with_sample();
    // seq1[3] = C -> G, seq2[3] = G -> G (no-op), seq3 untouched
    assert_eq!(e.mutate_base(&[0, 1], &[3], b'G'), Ok(()));
    assert_eq!(e.get_base(0, 3), b'G');
    assert_eq!(e.get_base(1, 3), b'G');
    assert_eq!(e.get_base(2, 3), b'C'); // unchanged
}

#[test]
fn mutate_base_changes_rectangle_atomically() {
    let mut e = engine_with_sample();
    assert_eq!(e.mutate_base(&[0, 1], &[1, 2, 3], b'N'), Ok(()));
    for row in 0..=1 {
        for col in 1..=3 {
            assert_eq!(e.get_base(row, col), b'N');
        }
    }
    assert_eq!(e.get_base(2, 1), b'T');
    assert!(e.undo());
    assert_eq!(e.get_base(0, 1), b'T');
    assert_eq!(e.get_base(1, 3), b'G');
    assert!(e.redo());
    assert_eq!(e.get_base(0, 1), b'N');
    assert_eq!(e.get_base(1, 3), b'N');
}

#[test]
fn mutate_base_rejects_before_changing_any_position() {
    let mut e = engine_with_sample();
    let cols: Vec<usize> = (0..=7).collect();
    let err = e.mutate_base(&[0], &cols, b'X').unwrap_err();
    assert_eq!(err.code, "MutateNotIupac");
    assert_eq!(e.get_base(0, 0), b'A');
    assert_eq!(e.get_base(0, 7), b'C');
    assert_eq!(e.undo_depth(), 0);
}

#[test]
fn mutate_base_rejects_atomically_when_later_target_is_invalid() {
    let mut e = engine_with_sample();
    // Early targets (row 0, cols 0 and 2) are valid IUPAC.
    // Later target (row 1, col 2) is corrupted to a non-IUPAC/non-gap byte (space).
    e.nucleotide_sequences[1][2] = b' ';

    let err = e.mutate_base(&[0, 1], &[0, 2], b'T').unwrap_err();
    assert_eq!(err.code, "MutateNotIupac");
    let context = err.context.unwrap();
    assert_eq!(context.row, Some(1));
    assert_eq!(context.col, Some(2));
    assert_eq!(context.base.as_deref(), Some(" "));

    // Early targets must remain completely untouched
    assert_eq!(e.get_base(0, 0), b'A');
    assert_eq!(e.get_base(0, 2), b'G');
    assert_eq!(e.get_base(1, 0), b'A');
    assert_eq!(e.get_base(1, 2), b' ');

    // Undo stack must remain untouched
    assert_eq!(e.undo_depth(), 0);
}

#[test]
fn mutate_base_changes_arbitrary_shape_atomically() {
    let mut e = engine_with_sample();
    // Mutate rows 0 and 2 at columns 0 and 2 to 'G'
    assert_eq!(e.mutate_base(&[0, 2], &[0, 2], b'G'), Ok(()));
    assert_eq!(e.get_base(0, 0), b'G');
    assert_eq!(e.get_base(0, 2), b'G');
    assert_eq!(e.get_base(2, 0), b'G');
    assert_eq!(e.get_base(2, 2), b'G');
    // Row 1 untouched
    assert_eq!(e.get_base(1, 0), b'A');
    assert_eq!(e.undo_depth(), 1);

    assert!(e.undo());
    assert_eq!(e.get_base(0, 0), b'A');
    assert_eq!(e.get_base(0, 2), b'G');
    assert_eq!(e.get_base(2, 0), b'A');
    assert_eq!(e.get_base(2, 2), b'G');

    assert!(e.redo());
    assert_eq!(e.get_base(0, 0), b'G');
    assert_eq!(e.get_base(0, 2), b'G');
}

#[test]
fn mutate_base_empty_inputs_is_noop() {
    let mut e = engine_with_sample();
    assert_eq!(e.mutate_base(&[], &[0, 1], b'A'), Ok(()));
    assert_eq!(e.mutate_base(&[0], &[], b'A'), Ok(()));
    assert_eq!(e.undo_depth(), 0);
}

#[test]
fn mutate_base_deduplicates_input_indices() {
    let mut e = engine_with_sample();
    assert_eq!(e.mutate_base(&[0, 0, 0], &[1, 1], b'C'), Ok(()));
    assert_eq!(e.get_base(0, 1), b'C');
    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo());
    assert_eq!(e.get_base(0, 1), b'T');
}

#[test]
fn mutate_skips_out_of_range_rows_and_cols() {
    let mut e = engine_with_sample();
    assert_eq!(e.mutate_base(&[0, 99], &[3], b'T'), Ok(()));
    assert_eq!(e.get_base(0, 3), b'T');
    // col out of range: no-op, no panic
    assert_eq!(e.mutate_base(&[0], &[999], b'T'), Ok(()));
    assert_eq!(e.get_base(0, 0), b'A');
}

#[test]
fn mutate_records_undo_and_clears_redo() {
    let mut e = engine_with_sample();
    // Seed a redo entry by doing + undoing an edit.
    assert_eq!(e.mutate_base(&[0], &[0], b'T'), Ok(()));
    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo());
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);
    // A new mutation must clear the redo stack and push onto undo.
    assert_eq!(e.mutate_base(&[1], &[1], b'G'), Ok(()));
    assert_eq!(e.redo_depth(), 0);
    assert_eq!(e.undo_depth(), 1);
}

#[test]
fn insert_at_subset_balances_with_gaps() {
    let mut e = engine_with_sample();
    // Insert '-' at col 2 on rows 0 and 1 only.
    assert_eq!(e.insert_at_subset(&[0, 1], 2), Ok(()));
    assert_eq!(e.get_alignment_width(), 9);
    // Row 0: AT - GCATGC -> "AT-GCATGC"
    assert_eq!(e.get_row_length(0), 9);
    assert_eq!(e.get_base(0, 2), b'-');
    // Row 2 (non-target): gets '-' appended at end -> "ATGCAT-C-"
    assert_eq!(e.get_base(2, 2), b'G'); // unchanged, non-target
    assert_eq!(e.get_row_length(2), 9);
}

#[test]
fn insert_at_subset_on_empty_engine_is_a_noop() {
    let mut e = MsaEngine::new();

    assert_eq!(e.insert_at_subset(&[0], 0), Ok(()));
    assert_eq!(e.get_sequence_count(), 0);
    assert_eq!(e.get_alignment_width(), 0);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 0);
}

#[test]
fn insert_at_subset_clamps_columns_beyond_alignment_width() {
    let mut e = engine_with_sample();

    assert_eq!(e.insert_at_subset(&[0], 100), Ok(()));
    assert_eq!(e.get_alignment_width(), 9);
    for row in 0..e.get_sequence_count() {
        assert_eq!(e.get_row_length(row), 9);
    }
    assert_eq!(e.get_base(0, 8), b'-');
}

#[test]
fn insert_at_subset_preserves_ragged_row_behavior() {
    let mut e = MsaEngine::new();
    e.load_fasta(">short\nATGC\n>long\nATGCATGC\n>middle\nATGCAT")
        .unwrap();

    assert_eq!(e.insert_at_subset(&[0], 6), Ok(()));
    assert_eq!(e.get_row_length(0), 7);
    assert_eq!(e.get_row_length(1), 9);
    assert_eq!(e.get_row_length(2), 7);
    assert_eq!(e.get_alignment_width(), 9);
    assert_eq!(e.get_base(0, 4), b'-');
    assert_eq!(e.get_base(0, 6), b'-');
    assert_eq!(e.get_base(2, 6), b'-');
}

#[test]
fn delete_at_subset_removes_from_targets_only() {
    let mut e = engine_with_sample();
    // Delete col 6 from rows 1 and 2 only. Both have '-' at col 6.
    // Row 0 untouched (no '-' at col 6).
    let result = e.delete_at_subset(&[1, 2], 6);
    assert_eq!(result, Ok(()));
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
    assert_eq!(e.delete_column(0), Ok(()));
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
fn delete_column_out_of_range_is_noop() {
    let mut e = engine_with_sample();
    let width_before = e.get_alignment_width();
    // Column beyond the alignment width: nothing removed, width unchanged.
    let err = e.delete_column(100);
    assert_eq!(err, Ok(()));
    assert_eq!(e.get_alignment_width(), width_before);
    assert_eq!(e.get_row_length(0), width_before);
    assert_eq!(e.get_base(0, 0), b'A');
    // No undo entry should have been recorded for a no-op.
    assert_eq!(e.undo_depth(), 0);
}

#[test]
fn undo_substitution_restores_old_base() {
    let mut e = engine_with_sample();
    assert_eq!(e.mutate_base(&[0, 1], &[3], b'G'), Ok(()));
    assert_eq!(e.get_base(0, 3), b'G');
    assert!(e.undo());
    assert_eq!(e.get_base(0, 3), b'C'); // original
    assert_eq!(e.get_base(1, 3), b'G'); // original (seq2[3] was already G)
}

#[test]
fn redo_reapplies_substitution() {
    let mut e = engine_with_sample();
    assert_eq!(e.mutate_base(&[0], &[0], b'T'), Ok(()));
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
    assert_eq!(e.insert_at_subset(&[0, 1], 2), Ok(()));
    assert_eq!(e.get_alignment_width(), width_before + 1);
    assert!(e.undo());
    assert_eq!(e.get_alignment_width(), width_before);
    assert_eq!(e.get_row_length(0), width_before);
    assert_eq!(e.get_base(0, 2), b'G'); // original seq1[2]
}

#[test]
fn redo_structural_insert_reapplies() {
    let mut e = engine_with_sample();
    assert_eq!(e.insert_at_subset(&[0, 1], 2), Ok(()));
    assert!(e.undo());
    assert!(e.redo());
    assert_eq!(e.get_alignment_width(), 9);
    assert_eq!(e.get_base(0, 2), b'-'); // gap
    assert_eq!(e.get_base(2, 2), b'G'); // unchanged, non-target
}

#[test]
fn repeated_subset_inserts_undo_and_redo_without_losing_rows() {
    let mut e = engine_with_sample();
    let original = e.export_fasta_bytes(true);

    for _ in 0..100 {
        let _ = e.insert_at_subset(&[0, 1], 2);
    }
    assert_eq!(e.get_alignment_width(), 108);
    assert_eq!(e.undo_depth(), 100);

    for _ in 0..100 {
        assert!(e.undo());
    }
    assert_eq!(e.export_fasta_bytes(true), original);

    for _ in 0..100 {
        assert!(e.redo());
    }
    assert_eq!(e.get_alignment_width(), 108);
    assert_eq!(e.get_base(0, 2), b'-');
}

#[test]
fn undo_delete_column_restores() {
    let mut e = engine_with_sample();
    assert_eq!(e.delete_column(0), Ok(()));
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
    assert_eq!(e.mutate_base(&[0], &[0], b'T'), Ok(()));
    assert_eq!(e.mutate_base(&[1], &[1], b'G'), Ok(()));
    assert!(e.undo()); // undo second
    assert!(e.undo()); // undo first
    assert_eq!(e.redo_depth(), 2);
    // New edit invalidates redo branch.
    assert_eq!(e.mutate_base(&[2], &[2], b'C'), Ok(()));
    assert_eq!(e.redo_depth(), 0);
    assert_eq!(e.undo_depth(), 1);
}

#[test]
fn multi_step_undo_redo_sequence() {
    let mut e = engine_with_sample();
    // Edit 1: substitute
    assert_eq!(e.mutate_base(&[0], &[0], b'T'), Ok(()));
    // Edit 2: insert
    assert_eq!(e.insert_at_subset(&[0, 1], 2), Ok(()));
    // Edit 3: delete column
    assert_eq!(e.delete_column(4), Ok(()));

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
fn undo_redo_substitution_handles_out_of_bounds_positions() {
    let mut e = engine_with_sample();

    // Simulate history data containing out-of-bounds positions (e.g. row 999 or col 999).
    // The engine should process only valid positions and keep stacks consistent.
    e.undo_stack.push(UndoCommand::Substitutions {
        positions: vec![(0, 0, b'G'), (999, 0, b'T'), (0, 999, b'C')],
    });

    assert!(e.undo());
    // Only valid position (0, 0) should be restored.
    assert_eq!(e.get_base(0, 0), b'G');

    assert!(e.redo());
    // Redo must only touch valid position (0, 0).
    assert_eq!(e.get_base(0, 0), b'A');
}

// ── Constraint validation tests (Rules 1-8) ──

#[test]
fn delete_non_gap_returns_error() {
    let mut e = engine_with_sample();
    // Row 0 col 0 is 'A' (IUPAC), not '-'. Delete must be rejected.
    let err = e.delete_at_subset(&[0], 0).unwrap_err();
    assert_eq!(err.code, "DeleteNotGap");
    let context = err.context.unwrap();
    assert_eq!(context.row, Some(0));
    assert_eq!(context.col, Some(0));
    assert_eq!(context.base.as_deref(), Some("A"));
    // Matrix must be completely unchanged.
    assert_eq!(e.get_base(0, 0), b'A');
    assert_eq!(e.get_row_length(0), 8);
}

#[test]
fn delete_gap_succeeds() {
    let mut e = engine_with_sample();
    // Row 1 col 6 is '-', Row 2 col 6 is '-'.
    let err = e.delete_at_subset(&[1, 2], 6);
    assert_eq!(err, Ok(()));
    // Row 1 col 6 was '-', removed, '-' appended at end
    assert_eq!(e.get_base(1, 6), b'A');
    // Row 0 completely untouched
    assert_eq!(e.get_base(0, 6), b'G');
}

#[test]
fn mutate_non_iupac_returns_error() {
    let mut e = engine_with_sample();

    // Mutating TO a non-IUPAC, non-gap character must be rejected (Rule 3).
    let err = e.mutate_base(&[0], &[6], b'X').unwrap_err();
    assert_eq!(err.code, "MutateNotIupac");
    assert_eq!(err.context.unwrap().base.as_deref(), Some("X"));
    assert_eq!(e.get_base(0, 6), b'G'); // unchanged

    // Directly corrupt a cell to a non-IUPAC, non-gap character (a space),
    // then attempt to mutate it — must be rejected (source validation).
    e.nucleotide_sequences[1][6] = b' ';
    let err = e.mutate_base(&[1], &[6], b'T').unwrap_err();
    assert_eq!(err.code, "MutateNotIupac");
    let context = err.context.unwrap();
    assert_eq!(context.row, Some(1));
    assert_eq!(context.col, Some(6));
    assert_eq!(context.base.as_deref(), Some(" "));
    assert_eq!(e.get_base(1, 6), b' '); // unchanged
}

#[test]
fn mutate_gap_is_allowed() {
    let mut e = engine_with_sample();
    // Row 1 col 6 is '-'. Mutating '-' to 'A' must succeed.
    let err = e.mutate_base(&[1], &[6], b'A');
    assert_eq!(err, Ok(()));
    assert_eq!(e.get_base(1, 6), b'A');
}

#[test]
fn mutate_iupac_to_gap_is_allowed() {
    let mut e = engine_with_sample();
    // Row 0 col 0 is 'A' (IUPAC). Mutate to '-' must succeed.
    let err = e.mutate_base(&[0], &[0], b'-');
    assert_eq!(err, Ok(()));
    assert_eq!(e.get_base(0, 0), b'-');
}

#[test]
fn delete_at_subset_non_targets_untouched() {
    let mut e = engine_with_sample();
    // Delete col 6 on rows 1 and 2 (both have '-' at col 6).
    let err = e.delete_at_subset(&[1, 2], 6);
    assert_eq!(err, Ok(()));
    // Row 0 (non-target) must be completely unchanged.
    assert_eq!(e.get_row_length(0), 8);
    assert_eq!(e.get_base(0, 0), b'A');
    assert_eq!(e.get_base(0, 1), b'T');
}

#[test]
fn alignment_width_from_longest_sequence() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nATGC\n>seq2\nATGCATGC\n>seq3\nATGCAT")
        .unwrap();
    // Longest sequence is seq2 with length 8.
    assert_eq!(e.get_alignment_width(), 8);
    assert_eq!(e.get_row_length(0), 4);
    assert_eq!(e.get_row_length(1), 8);
    assert_eq!(e.get_row_length(2), 6);
}

#[test]
fn alignment_width_uses_longest_record_flushed_at_eof() {
    let mut e = MsaEngine::new();
    e.load_fasta(">short1\nAT\n>short2\nATG\n>long_last\nATGCATGCA")
        .unwrap();

    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_alignment_width(), 9);
    assert_eq!(e.get_row_length(0), 2);
    assert_eq!(e.get_row_length(1), 3);
    assert_eq!(e.get_row_length(2), 9);
}

#[test]
fn insert_only_accepts_gap_by_default() {
    let mut e = engine_with_sample();
    // Insert at col 2 on rows 0 and 1. Only '-' is inserted.
    let err = e.insert_at_subset(&[0, 1], 2);
    assert_eq!(err, Ok(()));
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
    assert_eq!(e.insert_at_subset(&[0], 3), Ok(()));
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
    assert_eq!(e.mutate_base(&[0], &[1], b'-'), Ok(()));
    // Row 0: "A-GCATGC". Now move "GCAT" (cols 2..=5) left by 1.
    let err = e.move_horizontal(&[0], &[2, 3, 4, 5], MoveDirection::Left);
    assert_eq!(err, Ok(()));
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
    let err = e.move_horizontal(&[1], &[2, 3, 4, 5], MoveDirection::Right);
    assert_eq!(err, Ok(()));
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
    let err = e
        .move_horizontal(&[0], &[0, 1, 2, 3], MoveDirection::Left)
        .unwrap_err();
    assert_eq!(err.code, "MoveNoGapTarget");
    let context = err.context.unwrap();
    assert_eq!(context.row, Some(0));
    assert_eq!(context.col, Some(0));
    assert_eq!(context.direction.as_deref(), Some("Left"));
    // Row 0: "ATGCATGC". Try to move "CATG" (cols 4..=7) right — no space to right.
    let err = e
        .move_horizontal(&[0], &[4, 5, 6, 7], MoveDirection::Right)
        .unwrap_err();
    assert_eq!(err.code, "MoveNoGapTarget");
    assert_eq!(err.context.unwrap().direction.as_deref(), Some("Right"));
}

#[test]
fn move_horizontal_not_iupac_returns_error() {
    let mut e = engine_with_sample();
    // Row 1 col 6 is '-'. Try to move a block that includes '-'.
    let err = e
        .move_horizontal(&[1], &[5, 6], MoveDirection::Left)
        .unwrap_err();
    // col 5 is 'G' (IUPAC), col 6 is '-' (not IUPAC) — should fail.
    assert_eq!(err.code, "MoveNotIupac");
    let context = err.context.unwrap();
    assert_eq!(context.row, Some(1));
    assert_eq!(context.col, Some(6));
    assert_eq!(context.base.as_deref(), Some("-"));
}

#[test]
fn move_horizontal_multi_row_left_succeeds() {
    let mut e = engine_with_sample();
    // Row 0: "ATGCATGC", Row 2: "ATGCAT-C"
    // Mutate col 1 to '-' in both rows:
    assert_eq!(e.mutate_base(&[0, 2], &[1], b'-'), Ok(()));
    // Row 0: "A-GCATGC", Row 2: "A-GCAT-C"
    // Move cols 2..=5 left across rows 0 and 2
    let err = e.move_horizontal(&[0, 2], &[2, 3, 4, 5], MoveDirection::Left);
    assert_eq!(err, Ok(()));
    // Row 0: "AGCAT-GC"
    assert_eq!(e.get_base(0, 0), b'A');
    assert_eq!(e.get_base(0, 1), b'G');
    assert_eq!(e.get_base(0, 2), b'C');
    assert_eq!(e.get_base(0, 3), b'A');
    assert_eq!(e.get_base(0, 4), b'T');
    assert_eq!(e.get_base(0, 5), b'-');
    assert_eq!(e.get_base(0, 6), b'G');
    assert_eq!(e.get_base(0, 7), b'C');
    // Row 2: "AGCAT--C"
    assert_eq!(e.get_base(2, 0), b'A');
    assert_eq!(e.get_base(2, 1), b'G');
    assert_eq!(e.get_base(2, 2), b'C');
    assert_eq!(e.get_base(2, 3), b'A');
    assert_eq!(e.get_base(2, 4), b'T');
    assert_eq!(e.get_base(2, 5), b'-');
    assert_eq!(e.get_base(2, 6), b'-');
    assert_eq!(e.get_base(2, 7), b'C');
    // Row 1 untouched: "ATGGTG-A"
    assert_eq!(e.get_base(1, 1), b'T');
}

#[test]
fn move_horizontal_multi_row_right_succeeds() {
    let mut e = engine_with_sample();
    // Row 1: "ATGGTG-A" (col 6 is '-')
    // Row 2: "ATGCAT-C" (col 6 is '-')
    let err = e.move_horizontal(&[1, 2], &[2, 3, 4, 5], MoveDirection::Right);
    assert_eq!(err, Ok(()));
    // Row 1: "AT-GGTGA"
    assert_eq!(e.get_base(1, 2), b'-');
    assert_eq!(e.get_base(1, 3), b'G');
    assert_eq!(e.get_base(1, 4), b'G');
    assert_eq!(e.get_base(1, 5), b'T');
    assert_eq!(e.get_base(1, 6), b'G');
    assert_eq!(e.get_base(1, 7), b'A');
    // Row 2: "AT-GCATC"
    assert_eq!(e.get_base(2, 2), b'-');
    assert_eq!(e.get_base(2, 3), b'G');
    assert_eq!(e.get_base(2, 4), b'C');
    assert_eq!(e.get_base(2, 5), b'A');
    assert_eq!(e.get_base(2, 6), b'T');
    assert_eq!(e.get_base(2, 7), b'C');
    // Row 0 untouched
    assert_eq!(e.get_base(0, 2), b'G');
}

#[test]
fn move_horizontal_multi_row_atomic_on_target_not_gap() {
    let mut e = engine_with_sample();
    // Row 0 col 1 mutated to '-' -> "A-GCATGC"
    assert_eq!(e.mutate_base(&[0], &[1], b'-'), Ok(()));
    // Row 1 is "ATGGTG-A" (col 1 is 'T', not '-')
    let err = e
        .move_horizontal(&[0, 1], &[2, 3, 4, 5], MoveDirection::Left)
        .unwrap_err();
    assert_eq!(err.code, "MoveNoGapTarget");
    let context = err.context.unwrap();
    assert_eq!(context.row, Some(1));
    assert_eq!(context.col, Some(1));
    // Atomic: Row 0 MUST NOT have moved
    assert_eq!(e.get_base(0, 1), b'-');
    assert_eq!(e.get_base(0, 2), b'G');
    // And no undo command was created for the move
    assert_eq!(e.undo_depth(), 1); // only the mutate_base
}

#[test]
fn move_horizontal_multi_row_atomic_on_not_iupac() {
    let mut e = engine_with_sample();
    // Row 0: "ATGCATGC", Row 1: "ATGGTG-A" (col 6 is '-')
    let err = e
        .move_horizontal(&[0, 1], &[5, 6], MoveDirection::Left)
        .unwrap_err();
    assert_eq!(err.code, "MoveNotIupac");
    let context = err.context.unwrap();
    assert_eq!(context.row, Some(1));
    assert_eq!(context.col, Some(6));
    // Row 0 untouched
    assert_eq!(e.get_base(0, 5), b'T');
}

#[test]
fn move_horizontal_multi_row_single_undo_restores_all() {
    let mut e = engine_with_sample();
    assert_eq!(e.mutate_base(&[0, 2], &[1], b'-'), Ok(()));
    assert_eq!(
        e.move_horizontal(&[0, 2], &[2, 3, 4, 5], MoveDirection::Left),
        Ok(())
    );
    assert_eq!(e.get_base(0, 1), b'G');
    assert_eq!(e.get_base(2, 1), b'G');
    // A single undo call restores both rows
    assert!(e.undo());
    assert_eq!(e.get_base(0, 1), b'-');
    assert_eq!(e.get_base(0, 2), b'G');
    assert_eq!(e.get_base(2, 1), b'-');
    assert_eq!(e.get_base(2, 2), b'G');
    // Single redo re-applies both
    assert!(e.redo());
    assert_eq!(e.get_base(0, 1), b'G');
    assert_eq!(e.get_base(2, 1), b'G');
}

#[test]
fn move_horizontal_multi_row_deduplicates_rows() {
    let mut e = engine_with_sample();
    // Row 1: "ATGGTG-A". Pass row 1 multiple times.
    assert_eq!(
        e.move_horizontal(&[1, 1, 1], &[2, 3, 4, 5], MoveDirection::Right),
        Ok(())
    );
    // After single move: "AT-GGTGA"
    assert_eq!(e.get_base(1, 2), b'-');
    assert_eq!(e.get_base(1, 3), b'G');
}

#[test]
fn move_horizontal_empty_rows_or_cols_is_noop() {
    let mut e = engine_with_sample();
    assert_eq!(e.move_horizontal(&[], &[2, 3], MoveDirection::Left), Ok(()));
    assert_eq!(e.move_horizontal(&[0], &[], MoveDirection::Left), Ok(()));
    assert_eq!(e.undo_depth(), 0);
}

#[test]
fn move_horizontal_skips_out_of_range_rows() {
    let mut e = engine_with_sample();
    // Row 999 is out-of-range, row 1 is valid
    assert_eq!(
        e.move_horizontal(&[999, 1], &[2, 3, 4, 5], MoveDirection::Right),
        Ok(())
    );
    assert_eq!(e.get_base(1, 2), b'-');
    assert_eq!(e.get_base(1, 3), b'G');
}

#[test]
fn move_horizontal_skips_short_rows_in_ragged_alignment() {
    let mut e = MsaEngine::new();
    let fasta = ">seq0\nATGCAT-C\n>seq1\nATG\n";
    assert_eq!(e.load_fasta(fasta), Ok(2));

    // When all target rows are short rows, move is a clean no-op
    let undo_depth = e.undo_depth();
    assert_eq!(
        e.move_horizontal(&[1], &[2, 3, 4, 5], MoveDirection::Right),
        Ok(())
    );
    assert_eq!(e.undo_depth(), undo_depth);

    // Row 0 has len 8 (end < 8 -> valid target).
    // Row 1 has len 3 (end >= 3 -> short row, skipped).
    assert_eq!(
        e.move_horizontal(&[0, 1], &[2, 3, 4, 5], MoveDirection::Right),
        Ok(())
    );
    // Row 0 rotated right: "AT-GCATC"
    assert_eq!(e.get_base(0, 1), b'T');
    assert_eq!(e.get_base(0, 2), b'-');
    assert_eq!(e.get_base(0, 3), b'G');
    assert_eq!(e.get_base(0, 4), b'C');
    assert_eq!(e.get_base(0, 5), b'A');
    assert_eq!(e.get_base(0, 6), b'T');
    assert_eq!(e.get_base(0, 7), b'C');

    // Row 1 is untouched: "ATG"
    assert_eq!(e.get_base(1, 0), b'A');
    assert_eq!(e.get_base(1, 1), b'T');
    assert_eq!(e.get_base(1, 2), b'G');
}

#[test]
fn translate_rejects_invalid_reading_frame_with_context() {
    let mut e = engine_with_sample();
    let err = e.translate(0, 0, 0, 0, 5).unwrap_err();
    assert_eq!(err.code, "InvalidReadingFrame");
    assert_eq!(err.context.unwrap().frame, Some(5));
}

#[test]
fn translate_rejects_oversized_and_overflowing_viewports_with_context() {
    for (start_row, end_row, start_col, end_col) in [
        (0, 0, 0, MAX_VIEWPORT_BYTES),
        (0, 1, 0, MAX_VIEWPORT_BYTES / 2),
        (0, 0, 0, usize::MAX),
        (0, 2, 0, usize::MAX / 2),
        (1, 1, 2, MAX_VIEWPORT_BYTES + 2),
    ] {
        let mut engine = engine_with_sample();
        let error = engine
            .translate(start_row, end_row, start_col, end_col, 2)
            .unwrap_err();
        assert_eq!(error.code, "InvalidViewport");
        assert!(error.message.contains(&MAX_VIEWPORT_BYTES.to_string()));
        assert_eq!(
            error.context,
            Some(ErrorContext {
                row: Some(start_row),
                col: Some(start_col),
                frame: Some(2),
                ..ErrorContext::default()
            })
        );
    }
}

#[test]
fn structured_error_serializes_code_message_and_optional_context() {
    let error = StructuredEngineError::from(DeleteError::TargetNotGap {
        row: 2,
        col: 4,
        base: b'G',
    });
    assert_eq!(
        serde_json::to_value(&error).unwrap(),
        serde_json::json!({
            "code": "DeleteNotGap",
            "message": "Cannot delete non-gap character 'G' at row 2, column 4. Mutate it to '-' first.",
            "context": { "row": 2, "col": 4, "base": "G" },
        })
    );

    let without_context = StructuredEngineError {
        code: "UnexpectedRuntimeError".into(),
        message: "Failed".into(),
        context: None,
    };
    assert_eq!(
        serde_json::to_value(&without_context).unwrap(),
        serde_json::json!({ "code": "UnexpectedRuntimeError", "message": "Failed" })
    );
}

#[test]
fn move_horizontal_undo_restores() {
    let mut e = engine_with_sample();
    assert_eq!(e.mutate_base(&[0], &[1], b'-'), Ok(()));
    // Row 0: "A-GCATGC"
    assert_eq!(
        e.move_horizontal(&[0], &[2, 3, 4, 5], MoveDirection::Left),
        Ok(())
    );
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
    assert_eq!(err, Ok(()));
    assert_eq!(e.get_name(0), "seq2");
    assert_eq!(e.get_name(1), "seq1 first record");
    assert_eq!(e.get_name(2), "seq3 third record");
}

#[test]
fn move_rows_down_swaps_with_below() {
    let mut e = engine_with_sample();
    // Move row 1 down — swaps with row 2.
    let err = e.move_rows_down(&[1]);
    assert_eq!(err, Ok(()));
    assert_eq!(e.get_name(0), "seq1 first record");
    assert_eq!(e.get_name(1), "seq3 third record");
    assert_eq!(e.get_name(2), "seq2");
}

#[test]
fn move_rows_up_at_top_is_noop() {
    let mut e = engine_with_sample();
    let err = e.move_rows_up(&[0]);
    assert_eq!(err, Ok(()));
    assert_eq!(e.get_name(0), "seq1 first record");
}

#[test]
fn move_rows_down_at_bottom_is_noop() {
    let mut e = engine_with_sample();
    let err = e.move_rows_down(&[2]);
    assert_eq!(err, Ok(()));
    assert_eq!(e.get_name(2), "seq3 third record");
}

#[test]
fn move_rows_multiple_simultaneously() {
    let mut e = engine_with_sample();
    // Move rows 0 and 2 up. Row 0 is at top (no-op), row 2 swaps with row 1.
    let err = e.move_rows_up(&[0, 2]);
    assert_eq!(err, Ok(()));
    assert_eq!(e.get_name(0), "seq1 first record"); // unchanged (was at top)
    assert_eq!(e.get_name(1), "seq3 third record"); // row 2 moved up
    assert_eq!(e.get_name(2), "seq2"); // row 1 moved down
}

#[test]
fn move_rows_up_undo_restores() {
    let mut e = engine_with_sample();
    assert_eq!(e.move_rows_up(&[1]), Ok(()));
    assert_eq!(e.get_name(0), "seq2");
    assert!(e.undo());
    assert_eq!(e.get_name(0), "seq1 first record");
    assert_eq!(e.get_name(1), "seq2");
}

#[test]
fn move_rows_preserves_sequence_data() {
    let mut e = engine_with_sample();
    // Row 0: "ATGCATGC", Row 1: "ATGGTG-A"
    assert_eq!(e.move_rows_up(&[1]), Ok(()));
    // After swap, row 0 should have seq2's data, row 1 should have seq1's.
    assert_eq!(e.get_base(0, 0), b'A'); // seq2[0] = 'A'
    assert_eq!(e.get_base(0, 3), b'G'); // seq2[3] = 'G'
    assert_eq!(e.get_base(1, 0), b'A'); // seq1[0] = 'A'
    assert_eq!(e.get_base(1, 3), b'C'); // seq1[3] = 'C'
}

fn engine_with_n_rows(n: usize) -> MsaEngine {
    let mut e = MsaEngine::new();
    let mut fasta = String::new();
    for i in 0..n {
        fasta.push_str(&format!(">seq{}\nATGC\n", i));
    }
    e.load_fasta(&fasta).expect("valid fasta");
    e
}

#[test]
fn move_rows_relative_preserves_spacing_down() {
    let mut e = engine_with_n_rows(12);
    // Rows 1, 3, 8 moved down by 1 -> should become 2, 4, 9
    assert_eq!(e.move_rows_relative(&[1, 3, 8], 1), Ok(()));
    assert_eq!(e.get_name(2), "seq1");
    assert_eq!(e.get_name(4), "seq3");
    assert_eq!(e.get_name(9), "seq8");
    assert_eq!(e.get_name(1), "seq2"); // shifted up
    assert_eq!(e.get_name(3), "seq4"); // shifted up
    assert_eq!(e.get_name(8), "seq9"); // shifted up

    // Undo restores
    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo());
    assert_eq!(e.get_name(1), "seq1");
    assert_eq!(e.get_name(3), "seq3");
    assert_eq!(e.get_name(8), "seq8");
}

#[test]
fn move_rows_relative_preserves_spacing_up() {
    let mut e = engine_with_n_rows(12);
    // Rows 2, 4, 9 moved up by 1 -> should become 1, 3, 8
    assert_eq!(e.move_rows_relative(&[2, 4, 9], -1), Ok(()));
    assert_eq!(e.get_name(1), "seq2");
    assert_eq!(e.get_name(3), "seq4");
    assert_eq!(e.get_name(8), "seq9");
    assert_eq!(e.get_name(2), "seq1");
    assert_eq!(e.get_name(4), "seq3");
    assert_eq!(e.get_name(9), "seq8");
}

#[test]
fn move_rows_relative_joined_block_down() {
    let mut e = engine_with_n_rows(6);
    // Rows 1, 2, 3 moved down by 1 -> should become 2, 3, 4 as a solid unit
    assert_eq!(e.move_rows_relative(&[1, 2, 3], 1), Ok(()));
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(1), "seq4"); // jumped above the block
    assert_eq!(e.get_name(2), "seq1");
    assert_eq!(e.get_name(3), "seq2");
    assert_eq!(e.get_name(4), "seq3");
    assert_eq!(e.get_name(5), "seq5");

    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo());
    assert_eq!(e.get_name(1), "seq1");
    assert_eq!(e.get_name(2), "seq2");
    assert_eq!(e.get_name(3), "seq3");
    assert_eq!(e.get_name(4), "seq4");
}

#[test]
fn move_rows_relative_joined_block_up() {
    let mut e = engine_with_n_rows(6);
    // Rows 2, 3, 4 moved up by 1 -> should become 1, 2, 3 as a solid unit
    assert_eq!(e.move_rows_relative(&[2, 3, 4], -1), Ok(()));
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(1), "seq2");
    assert_eq!(e.get_name(2), "seq3");
    assert_eq!(e.get_name(3), "seq4");
    assert_eq!(e.get_name(4), "seq1"); // jumped below the block
    assert_eq!(e.get_name(5), "seq5");
}

#[test]
fn move_rows_relative_boundary_pinned_block_does_not_scramble() {
    let mut e = engine_with_n_rows(6);
    // Boundary block at top [0, 1] moving up is a complete no-op: rows 0 and 1 must NOT swap!
    assert_eq!(e.move_rows_relative(&[0, 1], -1), Ok(()));
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(1), "seq1");

    // Mixed: [0, 1] pinned at top, [3, 4] can move up to [2, 3]
    assert_eq!(e.move_rows_relative(&[0, 1, 3, 4], -1), Ok(()));
    assert_eq!(e.undo_depth(), 1);
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(1), "seq1");
    assert_eq!(e.get_name(2), "seq3");
    assert_eq!(e.get_name(3), "seq4");
    assert_eq!(e.get_name(4), "seq2"); // jumped below [3, 4]
    assert_eq!(e.get_name(5), "seq5");
}

#[test]
fn move_rows_relative_multi_step_creates_single_undo() {
    let mut e = engine_with_n_rows(12);
    // Shift rows 1, 3 down by 2 steps in one action
    assert_eq!(e.move_rows_relative(&[1, 3], 2), Ok(()));
    assert_eq!(e.get_name(3), "seq1");
    assert_eq!(e.get_name(5), "seq3");
    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo());
    assert_eq!(e.get_name(1), "seq1");
    assert_eq!(e.get_name(3), "seq3");
    assert_eq!(e.undo_depth(), 0);
}

#[test]
fn move_rows_grouped_to_target_index() {
    let mut e = engine_with_n_rows(12);
    // Rows 4, 5, 10 moved and grouped starting at target row 6 -> become rows 6, 7, 8
    assert_eq!(e.move_rows_grouped(&[4, 5, 10], 6), Ok(()));
    assert_eq!(e.get_name(6), "seq4");
    assert_eq!(e.get_name(7), "seq5");
    assert_eq!(e.get_name(8), "seq10");

    // Unselected rows around the group maintain relative order:
    // Original unselected: 0, 1, 2, 3, 6, 7, 8, 9, 11
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(1), "seq1");
    assert_eq!(e.get_name(2), "seq2");
    assert_eq!(e.get_name(3), "seq3");
    assert_eq!(e.get_name(4), "seq6");
    assert_eq!(e.get_name(5), "seq7");
    assert_eq!(e.get_name(9), "seq8");
    assert_eq!(e.get_name(10), "seq9");
    assert_eq!(e.get_name(11), "seq11");

    // 1 atomic undo restores everything
    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo());
    assert_eq!(e.get_name(4), "seq4");
    assert_eq!(e.get_name(5), "seq5");
    assert_eq!(e.get_name(10), "seq10");
}

#[test]
fn move_rows_to_top_groups_arbitrary_selection_at_top() {
    let mut e = engine_with_n_rows(6);
    // Rows 2 and 4 moved to top
    assert_eq!(e.move_rows_to_top(&[2, 4]), Ok(()));
    assert_eq!(e.get_name(0), "seq2");
    assert_eq!(e.get_name(1), "seq4");
    assert_eq!(e.get_name(2), "seq0");
    assert_eq!(e.get_name(3), "seq1");
    assert_eq!(e.get_name(4), "seq3");
    assert_eq!(e.get_name(5), "seq5");

    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo());
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(2), "seq2");
    assert_eq!(e.get_name(4), "seq4");
}

#[test]
fn move_rows_to_bottom_groups_arbitrary_selection_at_bottom() {
    let mut e = engine_with_n_rows(6);
    // Rows 1 and 3 moved to bottom
    assert_eq!(e.move_rows_to_bottom(&[1, 3]), Ok(()));
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(1), "seq2");
    assert_eq!(e.get_name(2), "seq4");
    assert_eq!(e.get_name(3), "seq5");
    assert_eq!(e.get_name(4), "seq1");
    assert_eq!(e.get_name(5), "seq3");

    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo());
    assert_eq!(e.get_name(1), "seq1");
    assert_eq!(e.get_name(3), "seq3");
}

#[test]
fn move_rows_no_op_does_not_create_undo_entry() {
    let mut e = engine_with_n_rows(6);
    assert_eq!(e.undo_depth(), 0);

    // Rows 0 and 1 are already at top
    assert_eq!(e.move_rows_to_top(&[0, 1]), Ok(()));
    assert_eq!(e.undo_depth(), 0);

    // Rows 4 and 5 are already at bottom
    assert_eq!(e.move_rows_to_bottom(&[4, 5]), Ok(()));
    assert_eq!(e.undo_depth(), 0);

    // Row 0 moving up is already at boundary
    assert_eq!(e.move_rows_up(&[0]), Ok(()));
    assert_eq!(e.undo_depth(), 0);

    // Row 5 moving down is already at boundary
    assert_eq!(e.move_rows_down(&[5]), Ok(()));
    assert_eq!(e.undo_depth(), 0);
}

#[test]
fn move_rows_relative_with_isize_min_does_not_panic_and_pins_to_top() {
    let mut e = engine_with_n_rows(6);
    // Rows 2 and 4 moved with delta = isize::MIN should shift all the way to top without panicking
    assert_eq!(e.move_rows_relative(&[2, 4], isize::MIN), Ok(()));
    assert_eq!(e.get_name(0), "seq2");
    assert_eq!(e.get_name(1), "seq4");
    assert_eq!(e.get_name(2), "seq0");
    assert_eq!(e.get_name(3), "seq1");
    assert_eq!(e.get_name(4), "seq3");
    assert_eq!(e.get_name(5), "seq5");

    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo());
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(2), "seq2");
    assert_eq!(e.get_name(4), "seq4");
}

#[test]
fn move_rows_relative_with_isize_max_does_not_hang_and_pins_to_bottom() {
    let mut e = engine_with_n_rows(6);
    // Rows 1 and 3 moved with delta = isize::MAX should shift all the way to bottom without hanging
    assert_eq!(e.move_rows_relative(&[1, 3], isize::MAX), Ok(()));
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(1), "seq2");
    assert_eq!(e.get_name(2), "seq4");
    assert_eq!(e.get_name(3), "seq5");
    assert_eq!(e.get_name(4), "seq1");
    assert_eq!(e.get_name(5), "seq3");

    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo());
    assert_eq!(e.get_name(1), "seq1");
    assert_eq!(e.get_name(3), "seq3");
}

#[test]
fn move_rows_relative_mixed_boundary_up_and_down() {
    let mut e = engine_with_n_rows(6);
    // [0, 3] moved up by 1: row 0 remains at 0, row 3 moves to 2 (swaps with 2)
    assert_eq!(e.move_rows_relative(&[0, 3], -1), Ok(()));
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(1), "seq1");
    assert_eq!(e.get_name(2), "seq3");
    assert_eq!(e.get_name(3), "seq2");
    assert_eq!(e.get_name(4), "seq4");
    assert_eq!(e.get_name(5), "seq5");

    // [1, 5] moved down by 1: row 5 remains at 5, row 1 moves to 2 (swaps with 2 which is seq3)
    assert_eq!(e.move_rows_relative(&[1, 5], 1), Ok(()));
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(1), "seq3");
    assert_eq!(e.get_name(2), "seq1");
    assert_eq!(e.get_name(3), "seq2");
    assert_eq!(e.get_name(4), "seq4");
    assert_eq!(e.get_name(5), "seq5");
}

#[test]
fn move_rows_relative_large_selection_and_delta_executes_efficiently() {
    let n = 10_000;
    let mut e = engine_with_n_rows(n);
    // Select first 5,000 rows, move down by 2,500
    let selected: Vec<usize> = (0..5000).collect();
    assert_eq!(e.move_rows_relative(&selected, 2500), Ok(()));
    // Rows 0..2500 are now unselected (originally 5000..7500)
    assert_eq!(e.get_name(0), "seq5000");
    assert_eq!(e.get_name(2499), "seq7499");
    // Rows 2500..7500 are selected (originally 0..5000)
    assert_eq!(e.get_name(2500), "seq0");
    assert_eq!(e.get_name(7499), "seq4999");
    // Rows 7500..10000 remain unselected (originally 7500..10000)
    assert_eq!(e.get_name(7500), "seq7500");
    assert_eq!(e.get_name(9999), "seq9999");

    // Move back up by 2500
    let new_selected: Vec<usize> = (2500..7500).collect();
    assert_eq!(e.move_rows_relative(&new_selected, -2500), Ok(()));
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(4999), "seq4999");
    assert_eq!(e.get_name(5000), "seq5000");
}

#[test]
fn private_edit_errors_map_to_stable_categories() {
    assert_eq!(
        EditError::from(MutateError::NewBaseNotIupac { base: b'X' }),
        EditError::MutateNotIupac
    );
    assert_eq!(
        EditError::from(MutateError::TargetNotIupac {
            row: 2,
            col: 5,
            base: b' ',
        }),
        EditError::MutateNotIupac
    );
    assert_eq!(
        EditError::from(DeleteError::TargetNotGap {
            row: 0,
            col: 3,
            base: b'A',
        }),
        EditError::DeleteNotGap
    );
    assert_eq!(
        EditError::from(MoveError::BlockNotIupac {
            row: 1,
            col: 4,
            base: b'-',
        }),
        EditError::MoveNotIupac
    );
    assert_eq!(
        EditError::from(MoveError::TargetNotGap {
            row: 1,
            col: 6,
            base: b'G',
            direction: MoveDirection::Right,
        }),
        EditError::MoveNoGapTarget
    );
    assert_eq!(
        EditError::from(MoveError::BoundaryReached {
            row: 0,
            col: 0,
            direction: MoveDirection::Left,
        }),
        EditError::MoveNoGapTarget
    );
}

// ── search_record_names ──
//
// `search_record_names` is a private `MsaEngine` method, not a free function
// — it can only be called on an `&self`/`&mut self` engine instance, and only
// from this crate (or a descendant module like this one, via `use super::*;`).

#[test]
fn search_record_names_matches_substring_in_every_name() {
    let e = engine_with_sample(); // names: "seq1", "seq2", "seq3"

    let result = e.search_record_names("seq");

    assert_eq!(result.query, "seq");
    assert_eq!(result.num_matches, 3);
    assert_eq!(result.positions.len(), 3);
    assert_eq!(result.positions[0].row, 0);
    assert_eq!(result.positions[1].row, 1);
    assert_eq!(result.positions[2].row, 2);
    assert!(
        result
            .positions
            .iter()
            .all(|m| m.matrix_type == MatrixType::RecordName)
    );
}

#[test]
fn search_record_names_matches_only_matching_rows() {
    let e = engine_with_sample(); // names: "seq1", "seq2", "seq3"

    let result = e.search_record_names("seq2");

    assert_eq!(result.num_matches, 1);
    assert_eq!(result.positions[0].row, 1);
}

#[test]
fn search_record_names_returns_empty_when_no_sequences_loaded() {
    let e = MsaEngine::new();

    let result = e.search_record_names("seq");

    assert_eq!(result.num_matches, 0);
    assert!(result.positions.is_empty());
}

// ── realign ──

#[test]
fn realign_aligns_unaligned_sequences() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nATGCGATCGATC\n>seq2\nATGCGATC\n>seq3\nATGCATCGATCGATC")
        .expect("valid FASTA");
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_alignment_width(), 15);

    // Initial seq2 has length 8, ragged relative to seq3 which is 15.
    assert_eq!(e.get_row_length(1), 8);

    e.realign().expect("realign succeeds");

    // All sequences should now be aligned and have length equal to alignment_width
    let width = e.get_alignment_width();
    assert!(width >= 15);
    for i in 0..3 {
        assert_eq!(e.get_row_length(i), width);
    }
    // seq2 must now have gaps inserted so it reaches width
    let seq2_bases: Vec<u8> = (0..width).map(|col| e.get_base(1, col)).collect();
    assert!(seq2_bases.contains(&b'-'));

    // Sequence identifiers preserved
    assert_eq!(e.get_name(0), "seq1");
    assert_eq!(e.get_name(1), "seq2");
    assert_eq!(e.get_name(2), "seq3");

    // All characters must be uppercase or gap '-'
    for r in 0..3 {
        for col in 0..width {
            let b = e.get_base(r, col);
            assert!(
                b.is_ascii_uppercase() || b == b'-',
                "base was {b} ({})",
                b as char
            );
        }
    }
}

#[test]
fn realign_fewer_than_two_sequences_is_noop() {
    // 0 sequences
    let mut e_empty = MsaEngine::new();
    e_empty.realign().expect("empty engine realign is ok");
    assert_eq!(e_empty.get_sequence_count(), 0);
    assert_eq!(e_empty.get_alignment_width(), 0);
    assert_eq!(e_empty.undo_depth(), 0);

    // 1 sequence
    let mut e_single = MsaEngine::new();
    e_single.load_fasta(">seq1\nATGCATGC").expect("valid FASTA");
    e_single.realign().expect("single sequence realign is ok");
    assert_eq!(e_single.get_sequence_count(), 1);
    assert_eq!(e_single.get_alignment_width(), 8);
    assert_eq!(e_single.get_name(0), "seq1");
    assert_eq!(e_single.undo_depth(), 0);
}

#[test]
fn realign_undo_and_redo_cycle() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nATGCGATCGATC\n>seq2\nATGCGATC\n>seq3\nATGCATCGATCGATC")
        .expect("valid FASTA");

    let orig_seq1 = e.nucleotide_sequences[0].clone();
    let orig_seq2 = e.nucleotide_sequences[1].clone();
    let orig_seq3 = e.nucleotide_sequences[2].clone();
    let orig_names = e.names.clone();
    let orig_width = e.get_alignment_width();

    e.realign().expect("realign succeeds");
    assert_eq!(e.undo_depth(), 1);
    assert_eq!(e.redo_depth(), 0);

    let aligned_seq1 = e.nucleotide_sequences[0].clone();
    let aligned_seq2 = e.nucleotide_sequences[1].clone();
    let aligned_seq3 = e.nucleotide_sequences[2].clone();
    let aligned_width = e.get_alignment_width();

    // Verify change actually took place
    assert_ne!(orig_seq2, aligned_seq2);

    // Undo restores exact original state
    assert!(e.undo());
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);
    assert_eq!(e.nucleotide_sequences[0], orig_seq1);
    assert_eq!(e.nucleotide_sequences[1], orig_seq2);
    assert_eq!(e.nucleotide_sequences[2], orig_seq3);
    assert_eq!(e.names, orig_names);
    assert_eq!(e.get_alignment_width(), orig_width);

    // Redo re-applies alignment
    assert!(e.redo());
    assert_eq!(e.undo_depth(), 1);
    assert_eq!(e.redo_depth(), 0);
    assert_eq!(e.nucleotide_sequences[0], aligned_seq1);
    assert_eq!(e.nucleotide_sequences[1], aligned_seq2);
    assert_eq!(e.nucleotide_sequences[2], aligned_seq3);
    assert_eq!(e.get_alignment_width(), aligned_width);
}

#[test]
fn realign_clears_aminoacid_cache_on_realign_and_undo() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nATGCATGC\n>seq2\nATGCATGC")
        .expect("valid FASTA");

    // Populate amino acid cache directly
    e.aminoacid_sequences
        .push(MsaEngine::translate_sequence(&e.nucleotide_sequences[0]));
    assert!(!e.aminoacid_sequences.is_empty());

    e.realign().expect("realign succeeds");
    // After realign, cache should have been cleared
    assert!(e.aminoacid_sequences.is_empty());

    // Populate again before undo
    e.aminoacid_sequences
        .push(MsaEngine::translate_sequence(&e.nucleotide_sequences[0]));
    assert!(!e.aminoacid_sequences.is_empty());

    assert!(e.undo());
    // After undo, cache should have been cleared
    assert!(e.aminoacid_sequences.is_empty());

    // Populate again before redo
    e.aminoacid_sequences
        .push(MsaEngine::translate_sequence(&e.nucleotide_sequences[0]));
    assert!(!e.aminoacid_sequences.is_empty());

    assert!(e.redo());
    // After redo, cache should have been cleared
    assert!(e.aminoacid_sequences.is_empty());
}

#[test]
fn realign_with_existing_gaps_and_ragged_sequences() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nATGC--GATC\n>seq2\nATGCGATC\n>seq3\nATGCATCGATCGATC")
        .expect("valid FASTA");
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_alignment_width(), 15);

    let res = e.realign();
    assert!(res.is_ok());

    let width = e.get_alignment_width();
    assert!(width >= 15);
    for i in 0..3 {
        assert_eq!(e.get_row_length(i), width);
    }
}

#[test]
fn realign_with_iupac_ambiguous_characters() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nATGC-RYSWKMBDHVN\n>seq2\nATGCRYSWKMBDHVN")
        .expect("valid FASTA");
    assert_eq!(e.get_sequence_count(), 2);

    let res = e.realign();
    assert!(res.is_ok());

    let width = e.get_alignment_width();
    assert!(width >= 15);
    assert_eq!(e.get_row_length(0), width);
    assert_eq!(e.get_row_length(1), width);
}

#[test]
fn realign_rejects_empty_sequence_without_corrupting_matrix_or_undo() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nATGCATGC\n>seq2\n\n>seq3\n----")
        .expect("valid FASTA");
    assert_eq!(e.get_sequence_count(), 3);

    let orig_seq1 = e.nucleotide_sequences[0].clone();
    let orig_seq2 = e.nucleotide_sequences[1].clone();
    let orig_seq3 = e.nucleotide_sequences[2].clone();
    let orig_width = e.get_alignment_width();

    let err = e
        .realign()
        .expect_err("must reject sequence with no residues");
    assert_eq!(err.code, "EmptySequence");
    assert_eq!(e.undo_depth(), 0);

    // Matrix must be completely untouched
    assert_eq!(e.nucleotide_sequences[0], orig_seq1);
    assert_eq!(e.nucleotide_sequences[1], orig_seq2);
    assert_eq!(e.nucleotide_sequences[2], orig_seq3);
    assert_eq!(e.get_alignment_width(), orig_width);
}

#[test]
fn realign_with_single_base_sequences() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nA\n>seq2\nC").expect("valid FASTA");
    assert_eq!(e.get_sequence_count(), 2);
    let res = e.realign();
    assert!(res.is_ok());
    assert_eq!(e.get_alignment_width(), 1);
    assert_eq!(e.get_base(0, 0), b'A');
    assert_eq!(e.get_base(1, 0), b'C');
}

#[test]
fn realign_with_uracil_and_full_iupac_alphabet() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nAUGC-RYSWKMBDHVN\n>seq2\nACGURYSWKMBDHVN")
        .expect("valid FASTA");
    assert_eq!(e.get_sequence_count(), 2);

    let res = e.realign();
    assert!(res.is_ok());

    let width = e.get_alignment_width();
    assert!(width >= 15);
    assert_eq!(e.get_row_length(0), width);
    assert_eq!(e.get_row_length(1), width);
    for r in 0..2 {
        for col in 0..width {
            let b = e.get_base(r, col);
            assert!(
                b.is_ascii_uppercase() || b == b'-',
                "expected uppercase IUPAC or gap, got {b}"
            );
        }
    }
}

#[test]
fn realign_with_mutated_lowercase_bases_normalizes_to_uppercase() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nATGCATGC\n>seq2\nATGCATGC")
        .expect("valid FASTA");

    // Mutate seq2 position 0 with lowercase 'a'
    e.mutate_base(&[1], &[0], b'a').expect("mutation succeeds");
    assert_eq!(e.get_base(1, 0), b'a');

    let res = e.realign();
    assert!(res.is_ok());

    // After realign, all bases must be normalized to uppercase
    let width = e.get_alignment_width();
    for r in 0..2 {
        for col in 0..width {
            let b = e.get_base(r, col);
            assert!(
                b.is_ascii_uppercase() || b == b'-',
                "expected uppercase byte, got {b}"
            );
        }
    }
    assert_eq!(e.get_base(1, 0), b'A');
}

#[test]
fn realign_successive_cycles_with_multi_step_undo() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nATGC--GATC\n>seq2\nATGCGATC\n>seq3\nATGCATCGATCGATC")
        .expect("valid FASTA");

    let orig_seq1 = e.nucleotide_sequences[0].clone();
    let orig_seq2 = e.nucleotide_sequences[1].clone();
    let orig_seq3 = e.nucleotide_sequences[2].clone();
    let orig_width = e.get_alignment_width();

    // First realign
    e.realign().expect("realign 1 succeeds");
    assert_eq!(e.undo_depth(), 1);

    // Second realign (idempotent alignment)
    e.realign().expect("realign 2 succeeds");
    assert_eq!(e.undo_depth(), 2);

    // Third realign
    e.realign().expect("realign 3 succeeds");
    assert_eq!(e.undo_depth(), 3);

    // Undo 3 times back to original
    assert!(e.undo());
    assert_eq!(e.undo_depth(), 2);
    assert!(e.undo());
    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo());
    assert_eq!(e.undo_depth(), 0);

    // Matrix matches original
    assert_eq!(e.nucleotide_sequences[0], orig_seq1);
    assert_eq!(e.nucleotide_sequences[1], orig_seq2);
    assert_eq!(e.nucleotide_sequences[2], orig_seq3);
    assert_eq!(e.get_alignment_width(), orig_width);
}

#[test]
fn realign_with_duplicate_record_names() {
    let mut e = MsaEngine::new();
    e.load_fasta(">dup_header\nATGCGATC\n>dup_header\nATGCATCGATCGATC")
        .expect("valid FASTA");
    assert_eq!(e.get_sequence_count(), 2);
    assert_eq!(e.get_name(0), "dup_header");
    assert_eq!(e.get_name(1), "dup_header");

    let res = e.realign();
    assert!(res.is_ok());
    assert_eq!(e.get_name(0), "dup_header");
    assert_eq!(e.get_name(1), "dup_header");
    assert_eq!(e.get_row_length(0), e.get_alignment_width());
    assert_eq!(e.get_row_length(1), e.get_alignment_width());
}

#[test]
fn align_fasta_aligns_unaligned_sequences() {
    let unaligned = ">seq1\nATGCGATC\n>seq2\nATGCATCGATCGATC";
    let aligned = crate::align_fasta(unaligned).expect("alignment succeeds");
    assert!(aligned.contains(">seq1\n"));
    assert!(aligned.contains(">seq2\n"));
    let lines: Vec<&str> = aligned.lines().collect();
    assert_eq!(lines.len(), 4);
    assert_eq!(lines[0], ">seq1");
    assert_eq!(lines[2], ">seq2");
    assert_eq!(lines[1].len(), lines[3].len());
    assert!(lines[1].len() >= 15);
}

#[test]
fn align_fasta_fewer_than_two_sequences_returns_input() {
    let single = ">seq1\nATGCGATC\n";
    let aligned = crate::align_fasta(single).expect("single sequence returns input");
    assert_eq!(aligned, single);
}

#[test]
fn align_fasta_rejects_empty_sequence() {
    let input = ">seq1\n----\n>seq2\nATGC";
    let res = crate::align_fasta(input);
    assert!(res.is_err());
    let err = res.unwrap_err();
    assert_eq!(err.code, "EmptySequence");
}

#[test]
fn apply_aligned_fasta_updates_matrix_and_supports_undo_redo() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nATGC\n>seq2\nATGC").expect("load ok");
    let orig_width = e.get_alignment_width();

    let aligned_fasta = ">seq1\nATG--C\n>seq2\nATGCAT\n";
    e.apply_aligned_fasta(aligned_fasta)
        .expect("apply succeeds");
    assert_eq!(e.get_alignment_width(), 6);
    assert_eq!(e.get_row_length(0), 6);
    assert_eq!(e.get_row_length(1), 6);
    assert_eq!(e.undo_depth(), 1);

    // Undo restores original matrix and width
    assert!(e.undo());
    assert_eq!(e.get_alignment_width(), orig_width);
    assert_eq!(e.get_row_length(0), 4);
    assert_eq!(e.get_row_length(1), 4);

    // Redo re-applies aligned matrix
    assert!(e.redo());
    assert_eq!(e.get_alignment_width(), 6);
    assert_eq!(e.get_row_length(0), 6);
    assert_eq!(e.get_row_length(1), 6);
}

#[test]
fn apply_aligned_fasta_mismatch_sequence_count_rejected() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nATGC\n>seq2\nATGC").expect("load ok");

    let mismatched_fasta = ">seq1\nATGC\n";
    let res = e.apply_aligned_fasta(mismatched_fasta);
    assert!(res.is_err());
    let err = res.unwrap_err();
    assert_eq!(err.code, "AlignmentMismatch");
}
