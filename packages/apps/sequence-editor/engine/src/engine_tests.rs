//! Unit tests for the sequence-editor engine.
//!
//! This module is compiled only under `#[cfg(test)]` (see the
//! `mod engine_tests;` declaration in `lib.rs`). It lives in its own file to
//! keep `lib.rs` focused on the engine implementation. Because it is a child
//! module of the crate root, `use super::*;` gives it access to private items
//! such as `UndoCommand`, the `ERR_*` constants, and the `sequences` field.

use super::*;

fn engine_with_sample() -> MsaEngine {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1 first record\nATGCATGC\n>seq2\nATGGTG-A\n>seq3 third record\nATGCAT-C");
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
fn exports_loaded_alignment_as_unwrapped_fasta() {
    let e = engine_with_sample();

    assert_eq!(
        e.export_fasta(),
        ">seq1\nATGCATGC\n>seq2\nATGGTG-A\n>seq3\nATGCAT-C\n"
    );
}

#[test]
fn exports_edited_alignment() {
    let mut e = engine_with_sample();
    assert_eq!(e.mutate_base_subset(&[0], 0, b'G'), "");

    assert_eq!(
        e.export_fasta(),
        ">seq1\nGTGCATGC\n>seq2\nATGGTG-A\n>seq3\nATGCAT-C\n"
    );
}

#[test]
fn exports_current_row_order() {
    let mut e = engine_with_sample();
    assert_eq!(e.move_rows_up(&[1]), "");

    assert_eq!(
        e.export_fasta(),
        ">seq2\nATGGTG-A\n>seq1\nATGCATGC\n>seq3\nATGCAT-C\n"
    );
}

#[test]
fn exports_empty_engine_as_empty_string() {
    let e = MsaEngine::new();

    assert_eq!(e.export_fasta(), "");
}

#[test]
fn export_tracks_undo_and_redo_state() {
    let mut e = engine_with_sample();
    let original = e.export_fasta();

    assert_eq!(e.mutate_base_subset(&[0], 0, b'G'), "");
    let edited = e.export_fasta();
    assert!(e.undo());
    assert_eq!(e.export_fasta(), original);
    assert!(e.redo());
    assert_eq!(e.export_fasta(), edited);
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
fn mutate_base_subset_changes_only_target_rows() {
    let mut e = engine_with_sample();
    // seq1[3] = C -> G, seq2[3] = G -> G (no-op), seq3 untouched
    e.mutate_base_subset(&[0, 1], 3, b'G');
    assert_eq!(e.get_base(0, 3), b'G');
    assert_eq!(e.get_base(1, 3), b'G');
    assert_eq!(e.get_base(2, 3), b'C'); // unchanged
}

#[test]
fn mutate_base_range_changes_one_rectangle_atomically() {
    let mut e = engine_with_sample();
    assert_eq!(e.mutate_base_range(&[0, 1], 1, 3, b'N'), "");
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
fn mutate_base_range_rejects_before_changing_any_position() {
    let mut e = engine_with_sample();
    assert_eq!(e.mutate_base_range(&[0], 0, 7, b'X'), ERR_MUTATE_NOT_IUPAC);
    assert_eq!(e.get_base(0, 0), b'A');
    assert_eq!(e.get_base(0, 7), b'C');
    assert_eq!(e.undo_depth(), 0);
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
fn insert_at_subset_on_empty_engine_is_a_noop() {
    let mut e = MsaEngine::new();

    assert_eq!(e.insert_at_subset(&[0], 0), "");
    assert_eq!(e.get_sequence_count(), 0);
    assert_eq!(e.get_alignment_width(), 0);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 0);
}

#[test]
fn insert_at_subset_clamps_columns_beyond_alignment_width() {
    let mut e = engine_with_sample();

    assert_eq!(e.insert_at_subset(&[0], 100), "");
    assert_eq!(e.get_alignment_width(), 9);
    for row in 0..e.get_sequence_count() {
        assert_eq!(e.get_row_length(row), 9);
    }
    assert_eq!(e.get_base(0, 8), b'-');
}

#[test]
fn insert_at_subset_preserves_ragged_row_behavior() {
    let mut e = MsaEngine::new();
    e.load_fasta(">short\nATGC\n>long\nATGCATGC\n>middle\nATGCAT");

    assert_eq!(e.insert_at_subset(&[0], 6), "");
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
fn delete_column_out_of_range_is_noop() {
    let mut e = engine_with_sample();
    let width_before = e.get_alignment_width();
    // Column beyond the alignment width: nothing removed, width unchanged.
    let err = e.delete_column(100);
    assert_eq!(err, "");
    assert_eq!(e.get_alignment_width(), width_before);
    assert_eq!(e.get_row_length(0), width_before);
    assert_eq!(e.get_base(0, 0), b'A');
    // No undo entry should have been recorded for a no-op.
    assert_eq!(e.undo_depth(), 0);
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

    // Mutating TO a non-IUPAC, non-gap character must be rejected (Rule 3).
    let err = e.mutate_base_subset(&[0], 6, b'X');
    assert_eq!(err, ERR_MUTATE_NOT_IUPAC);
    assert_eq!(e.get_base(0, 6), b'G'); // unchanged

    // Directly corrupt a cell to a non-IUPAC, non-gap character (a space),
    // then attempt to mutate it — must be rejected (source validation).
    e.nucleotide_sequences[1][6] = b' ';
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
    assert!(result
        .positions
        .iter()
        .all(|m| m.matrix_type == MatrixType::RecordName));
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
