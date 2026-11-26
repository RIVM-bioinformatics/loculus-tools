//! Unit tests for undo/redo history tracking, compact `UndoCommand` deltas,
//! bounded stack eviction, monotonic revisions, and translation cache invalidation.
//!
//! Declared via `#[cfg(test)] mod tests;` in `history/mod.rs` so `cargo test`
//! runs the entire suite under the `history::tests::...` namespace.

use super::*;
use crate::constants::{DEFAULT_MAX_HISTORY_BYTES, DEFAULT_MAX_UNDO_DEPTH};

fn engine_with_sample() -> MsaEngine {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1 first record\nATGCATGC\n>seq2\nATGGTG-A\n>seq3 third record\nATGCAT-C")
        .expect("valid sample FASTA");
    e
}

fn engine_with_n_rows(n: usize) -> MsaEngine {
    let mut e = MsaEngine::new();
    let mut fasta = String::new();
    for i in 0..n {
        fasta.push_str(&format!(">seq{i}\nATGC\n"));
    }
    e.load_fasta(&fasta).expect("valid fasta");
    e
}

// ── Core Undo / Redo Stack Lifecycle & Command Reversal ──

#[test]
fn export_tracks_undo_and_redo_state() {
    let mut e = engine_with_sample();
    let original = e.export_fasta_bytes(true);
    let original_ungapped = e.export_fasta_bytes(false);

    assert!(e.mutate_base(&[0], &[0], b'G').is_ok());
    let edited = e.export_fasta_bytes(true);
    let edited_ungapped = e.export_fasta_bytes(false);
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.export_fasta_bytes(true), original);
    assert_eq!(e.export_fasta_bytes(false), original_ungapped);
    assert!(e.redo().unwrap().changed);
    assert_eq!(e.export_fasta_bytes(true), edited);
    assert_eq!(e.export_fasta_bytes(false), edited_ungapped);
}

#[test]
fn mutate_records_undo_and_clears_redo() {
    let mut e = engine_with_sample();
    // Seed a redo entry by doing + undoing an edit.
    assert!(e.mutate_base(&[0], &[0], b'T').is_ok());
    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);
    // A new mutation must clear the redo stack and push onto undo.
    assert!(e.mutate_base(&[1], &[1], b'G').is_ok());
    assert_eq!(e.redo_depth(), 0);
    assert_eq!(e.undo_depth(), 1);
}

#[test]
fn undo_substitution_restores_old_base() {
    let mut e = engine_with_sample();
    assert!(e.mutate_base(&[0, 1], &[3], b'G').is_ok());
    assert_eq!(e.get_base(0, 3), b'G');
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_base(0, 3), b'C'); // original
    assert_eq!(e.get_base(1, 3), b'G'); // original (seq2[3] was already G)
}

#[test]
fn redo_reapplies_substitution() {
    let mut e = engine_with_sample();
    assert!(e.mutate_base(&[0], &[0], b'T').is_ok());
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_base(0, 0), b'A');
    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_base(0, 0), b'T');
    // Redo stack should now be empty.
    assert!(!e.redo().unwrap().changed);
}

#[test]
fn undo_structural_insert_restores_width_and_matrix() {
    let mut e = engine_with_sample();
    let width_before = e.get_alignment_width();
    assert!(e.insert_at_subset(&[0, 1], 2).is_ok());
    assert_eq!(e.get_alignment_width(), width_before + 1);
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_alignment_width(), width_before);
    assert_eq!(e.get_row_length(0), width_before);
    assert_eq!(e.get_base(0, 2), b'G'); // original seq1[2]
}

#[test]
fn redo_structural_insert_reapplies() {
    let mut e = engine_with_sample();
    assert!(e.insert_at_subset(&[0, 1], 2).is_ok());
    assert!(e.undo().unwrap().changed);
    assert!(e.redo().unwrap().changed);
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
        assert!(e.undo().unwrap().changed);
    }
    assert_eq!(e.export_fasta_bytes(true), original);

    for _ in 0..100 {
        assert!(e.redo().unwrap().changed);
    }
    assert_eq!(e.get_alignment_width(), 108);
    assert_eq!(e.get_base(0, 2), b'-');
}

#[test]
fn undo_delete_column_restores() {
    let mut e = engine_with_sample();
    assert!(e.delete_column(0).is_ok());
    assert_eq!(e.get_alignment_width(), 7);
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_alignment_width(), 8);
    assert_eq!(e.get_base(0, 0), b'A');
}

#[test]
fn undo_on_empty_stack_returns_false() {
    let mut e = engine_with_sample();
    assert!(!e.undo().unwrap().changed);
    assert!(!e.redo().unwrap().changed);
}

#[test]
fn new_edit_after_undo_clears_redo_stack() {
    let mut e = engine_with_sample();
    assert!(e.mutate_base(&[0], &[0], b'T').is_ok());
    assert!(e.mutate_base(&[1], &[1], b'G').is_ok());
    assert!(e.undo().unwrap().changed); // undo second
    assert!(e.undo().unwrap().changed); // undo first
    assert_eq!(e.redo_depth(), 2);
    // New edit invalidates redo branch.
    assert!(e.mutate_base(&[2], &[2], b'C').is_ok());
    assert_eq!(e.redo_depth(), 0);
    assert_eq!(e.undo_depth(), 1);
}

#[test]
fn multi_step_undo_redo_sequence() {
    let mut e = engine_with_sample();
    // Edit 1: substitute
    assert!(e.mutate_base(&[0], &[0], b'T').is_ok());
    // Edit 2: insert
    assert!(e.insert_at_subset(&[0, 1], 2).is_ok());
    // Edit 3: delete column
    assert!(e.delete_column(4).is_ok());

    assert_eq!(e.undo_depth(), 3);
    // Undo all three in reverse order.
    assert!(e.undo().unwrap().changed); // undo delete
    assert_eq!(e.get_alignment_width(), 9);
    assert!(e.undo().unwrap().changed); // undo insert
    assert_eq!(e.get_alignment_width(), 8);
    assert!(e.undo().unwrap().changed); // undo substitute
    assert_eq!(e.get_base(0, 0), b'A');
    assert!(!e.undo().unwrap().changed); // stack empty
    // Redo all three.
    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_base(0, 0), b'T');
    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_alignment_width(), 9);
    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_alignment_width(), 8);
    assert!(!e.redo().unwrap().changed);
}

#[test]
fn undo_redo_substitution_handles_out_of_bounds_positions() {
    let mut e = engine_with_sample();

    // Simulate history data containing out-of-bounds positions (e.g. row 999 or col 999).
    // The engine should process only valid positions and keep stacks consistent.
    e.undo_stack
        .push_back(UndoCommand::Substitutions(SubstitutionRecord {
            positions: vec![(0, 0, b'G'), (999, 0, b'T'), (0, 999, b'C')],
        }));

    assert!(e.undo().unwrap().changed);
    // Only valid position (0, 0) should be restored.
    assert_eq!(e.get_base(0, 0), b'G');

    assert!(e.redo().unwrap().changed);
    // Redo must only touch valid position (0, 0).
    assert_eq!(e.get_base(0, 0), b'A');
}

#[test]
fn move_horizontal_undo_restores() {
    let mut e = engine_with_sample();
    assert!(e.mutate_base(&[0], &[1], b'-').is_ok());
    // Row 0: "A-GCATGC"
    assert!(
        e.move_horizontal(&[0], &[2, 3, 4, 5], MoveDirection::Left)
            .is_ok()
    );
    assert_eq!(e.get_base(0, 1), b'G');
    assert!(e.undo().unwrap().changed);
    // After undo: back to "A-GCATGC"
    assert_eq!(e.get_base(0, 1), b'-');
    assert_eq!(e.get_base(0, 2), b'G');
}

#[test]
fn move_horizontal_multi_row_single_undo_restores_all() {
    let mut e = engine_with_sample();
    assert!(e.mutate_base(&[0, 2], &[1], b'-').is_ok());
    assert!(
        e.move_horizontal(&[0, 2], &[2, 3, 4, 5], MoveDirection::Left)
            .is_ok()
    );
    assert_eq!(e.get_base(0, 1), b'G');
    assert_eq!(e.get_base(2, 1), b'G');
    // A single undo call restores both rows
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_base(0, 1), b'-');
    assert_eq!(e.get_base(0, 2), b'G');
    assert_eq!(e.get_base(2, 1), b'-');
    assert_eq!(e.get_base(2, 2), b'G');
    // Single redo re-applies both
    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_base(0, 1), b'G');
    assert_eq!(e.get_base(2, 1), b'G');
}

#[test]
fn move_horizontal_at_col_zero_right_undo_and_redo() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nAT-GC").expect("load ok");
    e.move_horizontal(&[0], &[0, 1], MoveDirection::Right)
        .expect("move right from col 0 ok");
    assert_eq!(e.nucleotide_sequences[0], b"-ATGC");

    assert!(e.undo().unwrap().changed);
    assert_eq!(e.nucleotide_sequences[0], b"AT-GC");

    assert!(e.redo().unwrap().changed);
    assert_eq!(e.nucleotide_sequences[0], b"-ATGC");
}

#[test]
fn move_rows_up_undo_restores() {
    let mut e = engine_with_sample();
    assert!(e.move_rows_up(&[1]).is_ok());
    assert_eq!(e.get_name(0), "seq2");
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_name(0), "seq1 first record");
    assert_eq!(e.get_name(1), "seq2");
}

#[test]
fn move_rows_relative_multi_step_creates_single_undo() {
    let mut e = engine_with_n_rows(12);
    // Shift rows 1, 3 down by 2 steps in one action
    assert!(e.move_rows_relative(&[1, 3], 2).is_ok());
    assert_eq!(e.get_name(3), "seq1");
    assert_eq!(e.get_name(5), "seq3");
    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_name(1), "seq1");
    assert_eq!(e.get_name(3), "seq3");
    assert_eq!(e.undo_depth(), 0);
}

#[test]
fn move_rows_no_op_does_not_create_undo_entry() {
    let mut e = engine_with_n_rows(6);
    assert_eq!(e.undo_depth(), 0);

    // Rows 0 and 1 are already at top
    assert!(e.move_rows_to_top(&[0, 1]).is_ok());
    assert_eq!(e.undo_depth(), 0);

    // Rows 4 and 5 are already at bottom
    assert!(e.move_rows_to_bottom(&[4, 5]).is_ok());
    assert_eq!(e.undo_depth(), 0);

    // Row 0 moving up is already at boundary
    assert!(e.move_rows_up(&[0]).is_ok());
    assert_eq!(e.undo_depth(), 0);

    // Row 5 moving down is already at boundary
    assert!(e.move_rows_down(&[5]).is_ok());
    assert_eq!(e.undo_depth(), 0);
}

// ── Prepend, DeleteRows & Realign History Integration ──

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
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);
    assert_eq!(e.nucleotide_sequences[0], orig_seq1);
    assert_eq!(e.nucleotide_sequences[1], orig_seq2);
    assert_eq!(e.nucleotide_sequences[2], orig_seq3);
    assert_eq!(e.names, orig_names);
    assert_eq!(e.get_alignment_width(), orig_width);

    // Redo re-applies alignment
    assert!(e.redo().unwrap().changed);
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
    e.load_fasta(">seq1\nATGCGATCGATC\n>seq2\nATGCGATC\n>seq3\nATGCATCGATCGATC")
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

    assert!(e.undo().unwrap().changed);
    // After undo, cache should have been cleared
    assert!(e.aminoacid_sequences.is_empty());

    // Populate again before redo
    e.aminoacid_sequences
        .push(MsaEngine::translate_sequence(&e.nucleotide_sequences[0]));
    assert!(!e.aminoacid_sequences.is_empty());

    assert!(e.redo().unwrap().changed);
    // After redo, cache should have been cleared
    assert!(e.aminoacid_sequences.is_empty());
}

#[test]
fn realign_and_apply_aligned_fasta_identical_matrix_are_noops() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nATGCATGC\n>seq2\nATGCATGC")
        .expect("valid FASTA");

    // Seed redo_stack so we also verify no-op does not clear redo history.
    e.mutate_base(&[0], &[0], b'T').expect("mutate ok");
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);

    let rev_before = e.get_revision();
    let bytes_before = e.get_history_bytes();
    e.aminoacid_sequences
        .push(MsaEngine::translate_sequence(&e.nucleotide_sequences[0]));

    // Idempotent realign must be a strict no-op.
    e.realign().expect("realign succeeds");
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);
    assert_eq!(e.get_revision(), rev_before);
    assert_eq!(e.get_history_bytes(), bytes_before);
    assert!(!e.aminoacid_sequences.is_empty());

    // Applying an identical FASTA must also be a strict no-op.
    let identical_fasta = String::from_utf8(e.export_fasta_bytes(true)).expect("valid utf8");
    e.apply_aligned_fasta(&identical_fasta, Some(rev_before))
        .expect("apply identical fasta succeeds");
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);
    assert_eq!(e.get_revision(), rev_before);
    assert_eq!(e.get_history_bytes(), bytes_before);
    assert!(!e.aminoacid_sequences.is_empty());
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

    // First realign changes the matrix
    e.realign().expect("realign 1 succeeds");
    assert_eq!(e.undo_depth(), 1);
    let rev_after_first = e.get_revision();

    // Second realign (idempotent alignment) is a no-op
    e.realign().expect("realign 2 succeeds");
    assert_eq!(e.undo_depth(), 1);
    assert_eq!(e.get_revision(), rev_after_first);

    // Perform an edit that unaligns/changes the matrix, then realign again
    e.insert_at_subset(&[0], 0).expect("insert succeeds");
    assert_eq!(e.undo_depth(), 2);

    e.realign().expect("realign 3 succeeds");
    assert_eq!(e.undo_depth(), 3);

    // Undo 3 times back to original
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.undo_depth(), 2);
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.undo_depth(), 1);
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.undo_depth(), 0);

    // Matrix matches original
    assert_eq!(e.nucleotide_sequences[0], orig_seq1);
    assert_eq!(e.nucleotide_sequences[1], orig_seq2);
    assert_eq!(e.nucleotide_sequences[2], orig_seq3);
    assert_eq!(e.get_alignment_width(), orig_width);
}

#[test]
fn load_fasta_undo_redo_prepends() {
    let mut e = engine_with_sample();
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_alignment_width(), 8);
    assert_eq!(e.undo_depth(), 0);

    // Prepend wider sequence
    e.load_fasta(">prepended\nATGCATGCATGC").unwrap();
    assert_eq!(e.get_sequence_count(), 4);
    assert_eq!(e.get_alignment_width(), 12);
    assert_eq!(e.get_name(0), "prepended");
    assert_eq!(e.undo_depth(), 1);

    // Undo restores original 3 sequences and width 8
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_alignment_width(), 8);
    assert_eq!(e.get_name(0), "seq1 first record");
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);

    // Redo restores prepended sequence and width 12
    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_sequence_count(), 4);
    assert_eq!(e.get_alignment_width(), 12);
    assert_eq!(e.get_name(0), "prepended");
    assert_eq!(e.undo_depth(), 1);
    assert_eq!(e.redo_depth(), 0);
}

#[test]
fn load_fasta_conditional_snapshot_fresh_vs_prior_history() {
    // 1. Fresh engine: no undo snapshot created
    let mut e = MsaEngine::new();
    assert_eq!(e.undo_depth(), 0);
    e.load_fasta(">s1\nATGC").unwrap();
    assert_eq!(e.undo_depth(), 0);

    // 2. Prepend onto existing sequences: creates undo snapshot
    e.load_fasta(">s2\nCGTA").unwrap();
    assert_eq!(e.undo_depth(), 1);

    // 3. Reset engine: clears undo depth to 0
    e.reset().unwrap();
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 0);
    assert_eq!(e.get_sequence_count(), 0);

    // 4. Loading onto reset engine: stays at undo_depth == 0
    e.load_fasta(">s3\nGGCC").unwrap();
    assert_eq!(e.undo_depth(), 0);
}

#[test]
fn load_fasta_preserves_prior_substitutions_across_prepend_undo() {
    let mut e = engine_with_sample();
    assert_eq!(e.get_base(0, 0), b'A');

    // Mutate base at (0, 0) from A to C
    e.mutate_base(&[0], &[0], b'C').unwrap();
    assert_eq!(e.get_base(0, 0), b'C');
    assert_eq!(e.undo_depth(), 1);

    // Prepend a sequence -> new row 0 is prepended, old row 0 becomes row 1
    e.load_fasta(">new_top\nTTTT").unwrap();
    assert_eq!(e.get_sequence_count(), 4);
    assert_eq!(e.get_name(0), "new_top");
    assert_eq!(e.get_base(1, 0), b'C');
    assert_eq!(e.undo_depth(), 2);

    // Undo prepend -> restores old row 0 with mutated base 'C'
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_name(0), "seq1 first record");
    assert_eq!(e.get_base(0, 0), b'C');
    assert_eq!(e.undo_depth(), 1);

    // Undo mutation -> restores original base 'A'
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_base(0, 0), b'A');
    assert_eq!(e.undo_depth(), 0);
}

#[test]
fn delete_rows_is_undoable_and_redoable() {
    let mut e = engine_with_sample();
    e.delete_rows(&[1]).unwrap();
    assert_eq!(e.get_sequence_count(), 2);
    assert_eq!(e.undo_depth(), 1);

    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.undo_depth(), 0);

    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_sequence_count(), 2);
    assert_eq!(e.undo_depth(), 1);
}

#[test]
fn delete_rows_interleaved_with_mutations_and_prepends() {
    let mut e = MsaEngine::new();
    e.load_fasta(">s1\nAAAA\n>s2\nCCCC").unwrap();
    assert_eq!(e.undo_depth(), 0);

    // 1. Mutate base at (0, 0)
    e.mutate_base(&[0], &[0], b'G').unwrap();
    assert_eq!(e.get_base(0, 0), b'G');
    assert_eq!(e.undo_depth(), 1);

    // 2. Prepend a new sequence -> new row 0 is prepended, mutated row becomes row 1
    e.load_fasta(">top\nTTTT").unwrap();
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_name(0), "top");
    assert_eq!(e.get_base(1, 0), b'G');
    assert_eq!(e.undo_depth(), 2);

    // 3. Delete row 2 ("s2")
    e.delete_rows(&[2]).unwrap();
    assert_eq!(e.get_sequence_count(), 2);
    assert_eq!(e.get_name(0), "top");
    assert_eq!(e.get_name(1), "s1");
    assert_eq!(e.get_base(1, 0), b'G');
    assert_eq!(e.undo_depth(), 3);

    // 4. Undo delete -> restores row 2
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_name(2), "s2");
    assert_eq!(e.undo_depth(), 2);

    // 5. Undo prepend -> restores original 2 rows with mutated base
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_sequence_count(), 2);
    assert_eq!(e.get_name(0), "s1");
    assert_eq!(e.get_base(0, 0), b'G');
    assert_eq!(e.undo_depth(), 1);

    // 6. Undo mutation -> restores original base
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_base(0, 0), b'A');
    assert_eq!(e.undo_depth(), 0);
}

// ── Strict No-Op Guards (History, Revision & Cache Preservation) ──

#[test]
fn mutate_base_same_base_is_noop_and_preserves_history_and_revision() {
    let mut e = engine_with_sample();
    // Create one redo entry so we verify no-op does not clear redo_stack.
    e.mutate_base(&[0], &[1], b'C').expect("mutate ok");
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);

    // Populate aminoacid cache after undo().
    e.aminoacid_sequences
        .push(MsaEngine::translate_sequence(&e.nucleotide_sequences[0]));
    assert!(!e.aminoacid_sequences.is_empty());

    let rev_before = e.get_revision();
    let history_before = e.get_history_bytes();

    // seq1[0] and seq2[0] are already b'A'.
    e.mutate_base(&[0, 1], &[0], b'A').expect("no-op succeeds");
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);
    assert_eq!(e.get_revision(), rev_before);
    assert_eq!(e.get_history_bytes(), history_before);
    assert!(!e.aminoacid_sequences.is_empty());
}

#[test]
fn mutate_base_partial_same_base_records_only_changed_cells() {
    let mut e = engine_with_sample();
    // seq1[3] = 'C', seq2[3] = 'G'
    e.mutate_base(&[0, 1], &[3], b'G').expect("mutate ok");
    assert_eq!(e.undo_depth(), 1);
    assert_eq!(
        e.undo_stack.back(),
        Some(&UndoCommand::Substitutions(SubstitutionRecord {
            positions: vec![(0, 3, b'C')],
        }))
    );
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_base(0, 3), b'C');
    assert_eq!(e.get_base(1, 3), b'G');
    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_base(0, 3), b'G');
    assert_eq!(e.get_base(1, 3), b'G');
}

#[test]
fn insert_at_subset_empty_or_oob_rows_on_non_empty_engine_is_noop() {
    let mut e = engine_with_sample();
    e.mutate_base(&[0], &[0], b'T').expect("mutate ok");
    assert!(e.undo().unwrap().changed);
    e.aminoacid_sequences
        .push(MsaEngine::translate_sequence(&e.nucleotide_sequences[0]));

    let rev_before = e.get_revision();
    let width_before = e.get_alignment_width();
    let history_before = e.get_history_bytes();

    e.insert_at_subset(&[], 2).expect("empty rows noop");
    e.insert_at_subset(&[99, 100], 2).expect("oob rows noop");

    assert_eq!(e.get_alignment_width(), width_before);
    assert_eq!(e.get_row_length(0), 8);
    assert_eq!(e.get_row_length(1), 8);
    assert_eq!(e.get_row_length(2), 8);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);
    assert_eq!(e.get_revision(), rev_before);
    assert_eq!(e.get_history_bytes(), history_before);
    assert!(!e.aminoacid_sequences.is_empty());
}

#[test]
fn delete_at_subset_empty_oob_rows_or_oob_col_is_noop() {
    let mut e = engine_with_sample();
    e.mutate_base(&[0], &[0], b'T').expect("mutate ok");
    assert!(e.undo().unwrap().changed);
    e.aminoacid_sequences
        .push(MsaEngine::translate_sequence(&e.nucleotide_sequences[0]));

    let rev_before = e.get_revision();
    let history_before = e.get_history_bytes();
    let before_fasta = e.export_fasta_bytes(true);

    e.delete_at_subset(&[], 6).expect("empty rows noop");
    e.delete_at_subset(&[99], 6).expect("oob rows noop");
    e.delete_at_subset(&[0, 1], 99).expect("oob col noop");

    assert_eq!(e.export_fasta_bytes(true), before_fasta);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);
    assert_eq!(e.get_revision(), rev_before);
    assert_eq!(e.get_history_bytes(), history_before);
    assert!(!e.aminoacid_sequences.is_empty());
}

#[test]
fn delete_column_empty_engine_is_noop() {
    let mut e = MsaEngine::new();
    e.delete_column(0).expect("empty engine delete_column ok");
    assert_eq!(e.get_revision(), 0);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.get_history_bytes(), 0);
}

#[test]
fn load_fasta_empty_or_whitespace_preserves_revision_and_caches() {
    let mut e = engine_with_sample();
    e.mutate_base(&[0], &[0], b'T').expect("mutate ok");
    assert!(e.undo().unwrap().changed);
    e.aminoacid_sequences
        .push(MsaEngine::translate_sequence(&e.nucleotide_sequences[0]));

    let rev_before = e.get_revision();
    let result = e.load_fasta("  \n\t\n").expect("empty load ok");
    assert!(!result.changed);
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_revision(), rev_before);
    assert_eq!(e.redo_depth(), 1);
    assert!(!e.aminoacid_sequences.is_empty());
}

// ── Compact UndoCommand Variants & Ragged Edges ──

#[test]
fn insert_at_subset_ragged_padded_short_rows_undo_redo_exact() {
    let mut e = MsaEngine::new();
    e.load_fasta(">short\nATGC\n>long\nATGCATGC")
        .expect("load ok");

    e.insert_at_subset(&[0], 6).expect("insert ok");
    assert_eq!(e.get_row_length(0), 7);
    assert_eq!(e.get_row_length(1), 9);
    assert_eq!(e.get_alignment_width(), 9);
    assert_eq!(e.nucleotide_sequences[0], b"ATGC---");
    assert_eq!(e.nucleotide_sequences[1], b"ATGCATGC-");

    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_row_length(0), 4);
    assert_eq!(e.get_row_length(1), 8);
    assert_eq!(e.get_alignment_width(), 8);
    assert_eq!(e.nucleotide_sequences[0], b"ATGC");
    assert_eq!(e.nucleotide_sequences[1], b"ATGCATGC");

    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_row_length(0), 7);
    assert_eq!(e.get_row_length(1), 9);
    assert_eq!(e.get_alignment_width(), 9);
    assert_eq!(e.nucleotide_sequences[0], b"ATGC---");
    assert_eq!(e.nucleotide_sequences[1], b"ATGCATGC-");
}

#[test]
fn delete_at_subset_undo_redo_restores_non_trailing_gap_and_ragged_lengths() {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nA-GCAT-C\n>short\nAT")
        .expect("load ok");

    e.delete_at_subset(&[0], 1).expect("delete ok");
    assert_eq!(e.nucleotide_sequences[0], b"AGCAT-C-");
    assert_eq!(e.nucleotide_sequences[1], b"AT");

    assert!(e.undo().unwrap().changed);
    assert_eq!(e.nucleotide_sequences[0], b"A-GCAT-C");
    assert_eq!(e.nucleotide_sequences[1], b"AT");

    assert!(e.redo().unwrap().changed);
    assert_eq!(e.nucleotide_sequences[0], b"AGCAT-C-");
    assert_eq!(e.nucleotide_sequences[1], b"AT");
}

#[test]
fn delete_column_ragged_undo_redo_preserves_short_rows() {
    let mut e = MsaEngine::new();
    e.load_fasta(">short\nAT\n>long\nATGCAT").expect("load ok");

    e.delete_column(4).expect("delete column ok");
    assert_eq!(e.get_row_length(0), 2);
    assert_eq!(e.get_row_length(1), 5);
    assert_eq!(e.get_alignment_width(), 5);
    assert_eq!(e.nucleotide_sequences[1], b"ATGCT");

    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_row_length(0), 2);
    assert_eq!(e.get_row_length(1), 6);
    assert_eq!(e.get_alignment_width(), 6);
    assert_eq!(e.nucleotide_sequences[0], b"AT");
    assert_eq!(e.nucleotide_sequences[1], b"ATGCAT");

    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_row_length(0), 2);
    assert_eq!(e.get_row_length(1), 5);
    assert_eq!(e.get_alignment_width(), 5);
}

#[test]
fn delete_rows_unsorted_duplicate_indices_undo_redo_and_history_bytes_drop() {
    let mut e = engine_with_n_rows(5);
    let rev_before = e.get_revision();
    e.delete_rows(&[3, 1, 3]).expect("delete ok");
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.undo_depth(), 1);
    assert_eq!(e.get_revision(), rev_before + 1);
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(1), "seq2");
    assert_eq!(e.get_name(2), "seq4");

    match e.undo_stack.back() {
        Some(UndoCommand::DeletedRow(DeletedRowRecord {
            row_indices,
            names,
            sequences,
            ..
        })) => {
            assert_eq!(row_indices, &vec![1, 3]);
            assert_eq!(names, &vec!["seq1".to_string(), "seq3".to_string()]);
            assert_eq!(sequences.len(), 2);
        }
        other => panic!("expected DeletedRow command, got {other:?}"),
    }

    let bytes_with_deleted_rows = e.get_history_bytes();
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_sequence_count(), 5);
    for i in 0..5 {
        assert_eq!(e.get_name(i), format!("seq{i}"));
    }
    let bytes_on_redo_stack = e.get_history_bytes();
    assert!(
        bytes_on_redo_stack < bytes_with_deleted_rows,
        "redo DeletedRow should drop owned row buffers: {bytes_on_redo_stack} vs {bytes_with_deleted_rows}"
    );

    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_name(0), "seq0");
    assert_eq!(e.get_name(1), "seq2");
    assert_eq!(e.get_name(2), "seq4");
    assert_eq!(e.get_history_bytes(), bytes_with_deleted_rows);
}

#[test]
fn row_reorder_undo_redo_cycle_restores_arbitrary_permutation() {
    let mut e = engine_with_n_rows(6);
    let rev_initial = e.get_revision();
    e.move_rows_grouped(&[1, 4], 0).expect("grouped move ok");
    assert_eq!(e.undo_depth(), 1);
    assert_eq!(e.redo_depth(), 0);
    assert_eq!(e.get_revision(), rev_initial + 1);
    let reordered: Vec<String> = (0..6).map(|i| e.get_name(i)).collect();
    assert_eq!(
        reordered,
        vec!["seq1", "seq4", "seq0", "seq2", "seq3", "seq5"]
    );

    assert!(e.undo().unwrap().changed);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);
    assert_eq!(e.get_revision(), rev_initial + 2);
    let restored: Vec<String> = (0..6).map(|i| e.get_name(i)).collect();
    assert_eq!(
        restored,
        vec!["seq0", "seq1", "seq2", "seq3", "seq4", "seq5"]
    );

    assert!(e.redo().unwrap().changed);
    assert_eq!(e.undo_depth(), 1);
    assert_eq!(e.redo_depth(), 0);
    assert_eq!(e.get_revision(), rev_initial + 3);
    let reapplied: Vec<String> = (0..6).map(|i| e.get_name(i)).collect();
    assert_eq!(reapplied, reordered);

    assert!(e.undo().unwrap().changed);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);
    assert_eq!(e.get_revision(), rev_initial + 4);
    let restored_again: Vec<String> = (0..6).map(|i| e.get_name(i)).collect();
    assert_eq!(
        restored_again,
        vec!["seq0", "seq1", "seq2", "seq3", "seq4", "seq5"]
    );
}

#[test]
fn row_reorder_all_entry_points_support_undo_and_redo() {
    let mut e = MsaEngine::new();
    e.load_fasta(">r0\nAAAA\n>r1\nCCCC\n>r2\nGGGG\n>r3\nTTTT\n")
        .expect("load ok");

    e.move_rows_down(&[0]).expect("move_rows_down ok");
    e.move_rows_to_bottom(&[0]).expect("move_rows_to_bottom ok");
    e.move_rows_to_top(&[2]).expect("move_rows_to_top ok");
    e.move_rows_up(&[3]).expect("move_rows_up ok");
    assert_eq!(e.undo_depth(), 4);

    let after_moves: Vec<(String, u8)> =
        (0..4).map(|r| (e.get_name(r), e.get_base(r, 0))).collect();

    for _ in 0..4 {
        assert!(e.undo().unwrap().changed);
    }
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 4);
    assert_eq!(
        (0..4)
            .map(|r| (e.get_name(r), e.get_base(r, 0)))
            .collect::<Vec<_>>(),
        vec![
            ("r0".to_string(), b'A'),
            ("r1".to_string(), b'C'),
            ("r2".to_string(), b'G'),
            ("r3".to_string(), b'T'),
        ]
    );

    for _ in 0..4 {
        assert!(e.redo().unwrap().changed);
    }
    assert_eq!(e.undo_depth(), 4);
    assert_eq!(e.redo_depth(), 0);
    assert_eq!(
        (0..4)
            .map(|r| (e.get_name(r), e.get_base(r, 0)))
            .collect::<Vec<_>>(),
        after_moves
    );
}

#[test]
fn row_reorder_mismatched_or_out_of_bounds_inverse_order_returns_false_safely() {
    let mut e = engine_with_n_rows(3);
    let rev_before = e.get_revision();

    push_to_undo_bounded(
        &mut e,
        UndoCommand::RowReorder(RowReorderRecord {
            inverse_order: vec![1, 0],
        }),
    );
    assert!(!e.undo().unwrap().changed);
    assert_eq!(e.get_history_bytes(), 0);
    assert_eq!(e.get_revision(), rev_before);

    push_to_redo_bounded(
        &mut e,
        UndoCommand::RowReorder(RowReorderRecord {
            inverse_order: vec![0, 1, 99],
        }),
    );
    assert!(!e.redo().unwrap().changed);
    assert_eq!(e.get_history_bytes(), 0);
    assert_eq!(e.get_revision(), rev_before);
}

#[test]
fn prepend_sequences_undo_redo_moves_rows_without_cloning() {
    let mut e = MsaEngine::new();
    e.load_fasta(">orig\nATGC").expect("initial load ok");
    e.load_fasta(">new1\nGGGGAA\n>new2\nTTTTCC")
        .expect("prepend ok");
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_alignment_width(), 6);

    match e.undo_stack.back() {
        Some(UndoCommand::PrependedSequences(PrependedSequencesRecord {
            count,
            names,
            sequences,
            previous_alignment_width,
        })) => {
            assert_eq!(*count, 2);
            assert!(names.is_empty());
            assert!(sequences.is_empty());
            assert_eq!(*previous_alignment_width, 4);
        }
        other => panic!("expected PrependedSequences, got {other:?}"),
    }

    let bytes_on_undo = e.get_history_bytes();
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_sequence_count(), 1);
    assert_eq!(e.get_name(0), "orig");
    assert_eq!(e.get_alignment_width(), 4);
    let bytes_on_redo = e.get_history_bytes();
    assert!(bytes_on_redo > bytes_on_undo);

    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_sequence_count(), 3);
    assert_eq!(e.get_name(0), "new1");
    assert_eq!(e.get_name(1), "new2");
    assert_eq!(e.get_name(2), "orig");
    assert_eq!(e.get_alignment_width(), 6);
    assert_eq!(e.get_history_bytes(), bytes_on_undo);
}

// ── Memory Footprint & Bounded History Stack (Depth & Byte Budget) ──

#[test]
fn structural_edits_record_compact_history_bytes_far_below_matrix_size() {
    let row_len = 10_000;
    let num_rows = 50;
    let mut fasta = String::with_capacity(num_rows * (row_len + 16));
    for r in 0..num_rows {
        fasta.push_str(&format!(">seq{r}\n"));
        fasta.push_str("AT-G");
        for _ in 4..row_len {
            fasta.push('A');
        }
        fasta.push('\n');
    }

    let mut e = MsaEngine::new();
    e.load_fasta(&fasta).expect("large load ok");

    e.mutate_base(&[0], &[0], b'C').expect("mutate ok");
    e.insert_at_subset(&[0], 1).expect("insert ok");
    e.delete_at_subset(&[0], 1).expect("delete ok");
    e.delete_column(3).expect("delete_column ok");
    e.move_horizontal(&[0], &[0, 1], MoveDirection::Right)
        .expect("move_horizontal ok");
    e.move_rows_up(&[1]).expect("move_rows_up ok");

    assert_eq!(e.undo_depth(), 6);
    let history_bytes = e.get_history_bytes();
    assert!(
        history_bytes < 25_000,
        "expected compact history (< 25 KB vs ~500 KB per snapshot), got {history_bytes}"
    );
}

#[test]
fn default_max_undo_depth_evicts_oldest_entries_in_fifo_order() {
    let mut e = MsaEngine::new();
    assert_eq!(e.get_max_undo_depth(), DEFAULT_MAX_UNDO_DEPTH);
    assert_eq!(e.get_max_history_bytes(), DEFAULT_MAX_HISTORY_BYTES);

    let total_mutations = DEFAULT_MAX_UNDO_DEPTH + 44;
    let seq = "A".repeat(total_mutations);
    e.load_fasta(&format!(">s0\n{seq}")).expect("load ok");

    for col in 0..total_mutations {
        e.mutate_base(&[0], &[col], b'C').expect("mutate ok");
    }

    assert_eq!(e.undo_depth(), DEFAULT_MAX_UNDO_DEPTH);
    let mut undone = 0;
    while e.undo().unwrap().changed {
        undone += 1;
    }
    assert_eq!(undone, DEFAULT_MAX_UNDO_DEPTH);

    // Oldest 44 mutations were evicted and remain permanently applied; newest DEFAULT_MAX_UNDO_DEPTH were undone.
    for col in 0..44 {
        assert_eq!(e.get_base(0, col), b'C', "col {col} should remain C");
    }
    for col in 44..total_mutations {
        assert_eq!(e.get_base(0, col), b'A', "col {col} should be undone to A");
    }
}

#[test]
fn max_history_bytes_evicts_oldest_entries_and_handles_oversized_command() {
    let mut e = engine_with_n_rows(10);
    e.set_max_history_bytes(512);
    assert_eq!(e.get_max_history_bytes(), 512);

    for col in 0..4 {
        e.mutate_base(&[0, 1, 2, 3, 4], &[col], b'T')
            .expect("mutate ok");
        assert!(e.get_history_bytes() <= 512);
    }
    assert!(e.undo_depth() < 4);

    // A single command whose byte footprint exceeds max_history_bytes evicts older entries and is not retained.
    e.set_max_history_bytes(64);
    assert!(e.get_history_bytes() <= 64);
    let rev_before = e.get_revision();
    e.mutate_base(&[0, 1, 2, 3, 4, 5, 6, 7], &[0, 1, 2, 3], b'G')
        .expect("oversized mutate succeeds");
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.get_history_bytes(), 0);
    assert_eq!(e.get_revision(), rev_before + 1);
    assert_eq!(e.get_base(0, 0), b'G');

    // Dynamic shrinking via set_max_undo_depth and zero depth cap.
    e.set_max_history_bytes(DEFAULT_MAX_HISTORY_BYTES);
    e.mutate_base(&[0], &[0], b'A').unwrap();
    e.mutate_base(&[0], &[1], b'A').unwrap();
    e.mutate_base(&[0], &[2], b'A').unwrap();
    assert_eq!(e.undo_depth(), 3);
    e.set_max_undo_depth(1);
    assert_eq!(e.undo_depth(), 1);
    e.set_max_undo_depth(0);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.get_history_bytes(), 0);

    let rev_at_zero_cap = e.get_revision();
    e.mutate_base(&[0], &[0], b'T').unwrap();
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.get_revision(), rev_at_zero_cap + 1);
}

#[test]
fn history_bytes_stays_exact_across_mixed_undo_redo_and_reset() {
    let exact_bytes = |engine: &MsaEngine| -> usize {
        engine
            .undo_stack
            .iter()
            .chain(engine.redo_stack.iter())
            .map(UndoCommand::estimated_byte_size)
            .sum()
    };

    let mut e = engine_with_sample();
    assert_eq!(e.get_history_bytes(), 0);

    e.mutate_base(&[0], &[0], b'T').unwrap();
    assert_eq!(e.get_history_bytes(), exact_bytes(&e));

    e.insert_at_subset(&[0, 1], 2).unwrap();
    assert_eq!(e.get_history_bytes(), exact_bytes(&e));

    e.delete_rows(&[2]).unwrap();
    assert_eq!(e.get_history_bytes(), exact_bytes(&e));

    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_history_bytes(), exact_bytes(&e));

    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_history_bytes(), exact_bytes(&e));

    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_history_bytes(), exact_bytes(&e));

    // New edit clears redo stack.
    e.delete_column(0).unwrap();
    assert_eq!(e.redo_depth(), 0);
    assert_eq!(e.get_history_bytes(), exact_bytes(&e));

    e.reset().unwrap();
    assert_eq!(e.get_history_bytes(), 0);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 0);
}

#[test]
fn undo_prepend_sequences_oversized_redo_preserves_prior_undo_and_clears_redo() {
    let mut e = MsaEngine::new();
    e.load_fasta(">a\nACGT\n").expect("load ok");
    e.set_max_history_bytes(512);

    // Record a prior small undo entry and an older redo entry that should be cleared
    // when the un-recordable undone PrependSequences is dropped.
    e.mutate_base(&[0], &[0], b'T').expect("mutate 1 ok");
    e.mutate_base(&[0], &[1], b'G').expect("mutate 2 ok");
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.undo_depth(), 1);
    assert_eq!(e.redo_depth(), 1);

    // Prepend a large sequence; on undo_stack it stores only count=1 (no sequence payload),
    // which fits in 512 bytes alongside the prior mutation, clearing redo_stack on push_undo.
    e.mutate_base(&[0], &[1], b'G').expect("mutate 2 again ok");
    e.load_fasta(&format!(">big\n{}\n", "A".repeat(1000)))
        .expect("prepend ok");
    assert_eq!(e.undo_depth(), 3);
    assert!(e.get_history_bytes() <= 512);

    // Undo the prepend: drained sequences exceed max_history_bytes (512),
    // so redo_stack must be cleared without evicting prior undo_stack entries.
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_sequence_count(), 1);
    assert_eq!(e.get_name(0), "a");
    assert!(e.get_history_bytes() <= e.get_max_history_bytes());
    assert_eq!(e.undo_depth(), 2);
    assert_eq!(e.redo_depth(), 0);

    // Prior undo entries remain intact and undoable.
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_base(0, 1), b'C');
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_base(0, 0), b'A');
}

#[test]
fn undo_replace_matrix_oversized_redo_preserves_prior_undo_and_clears_redo() {
    let mut e = MsaEngine::new();
    e.load_fasta(">a\nACGT\n>b\nACGT\n").expect("load ok");
    e.set_max_history_bytes(512);

    // Prior small undo entry (row 0 becomes TCGT).
    e.mutate_base(&[0], &[0], b'T').expect("mutate ok");
    assert_eq!(e.undo_depth(), 1);

    // Expand matrix massively via apply_aligned_fasta; ReplaceMatrix on undo_stack holds
    // only the small previous 4-column sequences, fitting well within 512 bytes.
    let expanded_a = format!("TCGT{}", "-".repeat(4000));
    let expanded_b = format!("ACGT{}", "-".repeat(4000));
    let expanded_fasta = format!(">a\n{expanded_a}\n>b\n{expanded_b}\n");
    e.apply_aligned_fasta(&expanded_fasta, Some(e.get_revision()))
        .expect("apply_aligned_fasta ok");
    assert_eq!(e.get_alignment_width(), 4004);
    assert_eq!(e.undo_depth(), 2);
    assert!(e.get_history_bytes() <= 512);

    // Undoing ReplaceMatrix swaps the 4004-column matrix into redo_cmd (> 512 bytes).
    // Must succeed, keep history_bytes <= 512, preserve prior undo entry, and clear redo_stack.
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_alignment_width(), 4);
    assert!(e.get_history_bytes() <= e.get_max_history_bytes());
    assert_eq!(e.undo_depth(), 1);
    assert_eq!(e.redo_depth(), 0);

    // Prior mutation undo still works cleanly.
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_base(0, 0), b'A');
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);
}

#[test]
fn undo_evicts_oldest_undo_then_oldest_redo_when_combined_stacks_exceed_budget() {
    let mut e = MsaEngine::new();
    e.load_fasta(">a\nACGT\n").expect("load ok");

    // Measure exact footprint of a small PrependSequences on undo_stack vs redo_stack.
    e.load_fasta(&format!(">p1\n{}\n", "A".repeat(200)))
        .expect("prepend 1 ok");
    let undo_prepend_bytes = e.get_history_bytes();
    assert!(e.undo().unwrap().changed);
    let redo_prepend_bytes = e.get_history_bytes();
    assert!(redo_prepend_bytes > undo_prepend_bytes);
    e.reset().unwrap();

    // Budget fits 1 full redo entry + 1 undo entry, but NOT 1 redo + 2 undos and NOT 2 redos.
    let budget = redo_prepend_bytes + undo_prepend_bytes + 16;
    e.load_fasta(">a\nACGT\n").expect("reload ok");
    e.set_max_history_bytes(budget);

    // Push a small mutation plus two prepends; all three fit on undo_stack under budget.
    e.mutate_base(&[0], &[0], b'T').expect("mutate ok");
    e.load_fasta(&format!(">p1\n{}\n", "A".repeat(200)))
        .expect("prepend 1 ok");
    e.load_fasta(&format!(">p2\n{}\n", "C".repeat(200)))
        .expect("prepend 2 ok");
    assert_eq!(e.undo_depth(), 3);
    assert!(e.get_history_bytes() <= budget);

    // First undo: moves p2 (~redo_prepend_bytes) onto redo_stack; combined exceeds budget,
    // so the oldest undo entry (mutate_base) is evicted while p1 remains on undo_stack.
    assert!(e.undo().unwrap().changed);
    assert!(e.get_history_bytes() <= budget);
    assert_eq!(e.undo_depth(), 1);
    assert_eq!(e.redo_depth(), 1);
    assert_eq!(e.get_name(0), "p1");

    // Second undo: moves p1 (~redo_prepend_bytes) onto redo_stack; undo_stack is now empty
    // and combined redo_stack (p2 + p1) exceeds budget, so oldest redo_stack entry (p2)
    // is evicted, keeping p1 on redo_stack and history_bytes <= budget.
    assert!(e.undo().unwrap().changed);
    assert!(e.get_history_bytes() <= budget);
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 1);
    assert_eq!(e.get_name(0), "a");

    // Redoing restores p1 (the most recently undone step).
    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_name(0), "p1");
    assert!(e.get_history_bytes() <= budget);
}

#[test]
fn redo_bounds_combined_stacks_and_handles_oversized_restored_command() {
    let mut e = MsaEngine::new();
    e.load_fasta(&format!(">big\n{}\n>keep\nACGT\n", "A".repeat(400)))
        .expect("load ok");
    e.mutate_base(&[1], &[0], b'T').expect("mutate ok");
    e.delete_rows(&[0]).expect("delete big row ok");

    // Undo DeleteRows -> on redo_stack it stores only row_indices (~120 bytes).
    assert!(e.undo().unwrap().changed);
    // Tighten max_history_bytes below the size of DeleteRows with deleted_rows (>400 bytes),
    // while still keeping the compact DeleteRows redo entry (and prior mutate_base) within budget.
    let redo_cmd_bytes = e.redo_stack.back().unwrap().estimated_byte_size();
    let tight_budget = redo_cmd_bytes + 128;
    e.set_max_history_bytes(tight_budget);
    assert!(e.get_history_bytes() <= tight_budget);
    assert_eq!(e.redo_depth(), 1);

    // Redo re-deletes row 0 and produces an oversized DeleteRows undo entry (> tight_budget).
    // Invariant history_bytes <= max_history_bytes must hold and prior undo_stack is cleared
    // so undo() cannot skip the un-recorded redo.
    assert!(e.redo().unwrap().changed);
    assert!(e.get_history_bytes() <= e.get_max_history_bytes());
    assert_eq!(e.undo_depth(), 0);
    assert_eq!(e.redo_depth(), 0);
}

// ── Revision & Translation Cache Invalidation on History Transitions ──

#[test]
fn revision_increments_on_mutations_undo_redo_and_fresh_load_only() {
    let mut e = MsaEngine::new();
    assert_eq!(e.get_revision(), 0);

    e.load_fasta(">s1\nATGC\n>s2\nATGC").unwrap();
    assert_eq!(e.get_revision(), 1);

    // Empty load and no-op edits leave revision untouched.
    e.load_fasta("  \n").unwrap();
    assert_eq!(e.get_revision(), 1);
    e.mutate_base(&[0], &[0], b'A').unwrap();
    assert_eq!(e.get_revision(), 1);

    // Real mutation increments revision.
    e.mutate_base(&[0], &[0], b'T').unwrap();
    assert_eq!(e.get_revision(), 2);

    // Failed edit leaves revision untouched.
    assert!(e.delete_at_subset(&[0], 0).is_err());
    assert_eq!(e.get_revision(), 2);

    // Undo increments; empty undo does not.
    assert!(e.undo().unwrap().changed);
    assert_eq!(e.get_revision(), 3);
    assert!(!e.undo().unwrap().changed);
    assert_eq!(e.get_revision(), 3);

    // Redo increments; empty redo does not.
    assert!(e.redo().unwrap().changed);
    assert_eq!(e.get_revision(), 4);
    assert!(!e.redo().unwrap().changed);
    assert_eq!(e.get_revision(), 4);

    // Reset advances revision monotonically.
    e.reset().unwrap();
    assert_eq!(e.get_revision(), 5);
}

#[test]
fn all_mutations_undo_and_redo_clear_aminoacid_sequences_cache() {
    let populate_cache = |engine: &mut MsaEngine| {
        engine
            .aminoacid_sequences
            .push(MsaEngine::translate_sequence(
                &engine.nucleotide_sequences[0],
            ));
        assert!(!engine.aminoacid_sequences.is_empty());
    };

    let mut e = MsaEngine::new();
    e.load_fasta(">s1\nA-TGCATGC\n>s2\nATGCATGCA\n>s3\nTTTTTTTTT")
        .unwrap();

    // No-op & failed edits preserve cache.
    populate_cache(&mut e);
    e.mutate_base(&[0], &[0], b'A').unwrap();
    assert!(!e.aminoacid_sequences.is_empty());
    assert!(e.delete_at_subset(&[0], 0).is_err());
    assert!(!e.aminoacid_sequences.is_empty());

    // 1. mutate_base
    populate_cache(&mut e);
    e.mutate_base(&[0], &[0], b'C').unwrap();
    assert!(e.aminoacid_sequences.is_empty());

    // 2. insert_at_subset
    populate_cache(&mut e);
    e.insert_at_subset(&[0], 2).unwrap();
    assert!(e.aminoacid_sequences.is_empty());

    // 3. delete_at_subset
    populate_cache(&mut e);
    e.delete_at_subset(&[0], 2).unwrap();
    assert!(e.aminoacid_sequences.is_empty());

    // 4. delete_column
    populate_cache(&mut e);
    e.delete_column(9).unwrap();
    assert!(e.aminoacid_sequences.is_empty());

    // 5. move_horizontal
    populate_cache(&mut e);
    e.move_horizontal(&[0], &[2], MoveDirection::Left).unwrap();
    assert!(e.aminoacid_sequences.is_empty());

    // 6. move_rows_up
    populate_cache(&mut e);
    e.move_rows_up(&[1]).unwrap();
    assert!(e.aminoacid_sequences.is_empty());

    // 7. load_fasta (prepend)
    populate_cache(&mut e);
    e.load_fasta(">s0\nACGTACGT").unwrap();
    assert!(e.aminoacid_sequences.is_empty());

    // 8. delete_rows
    populate_cache(&mut e);
    e.delete_rows(&[0]).unwrap();
    assert!(e.aminoacid_sequences.is_empty());

    // 9. apply_aligned_fasta (no-op when identical, clears cache when changed)
    let identical_aligned = String::from_utf8(e.export_fasta_bytes(true)).unwrap();
    let rev = e.get_revision();
    populate_cache(&mut e);
    e.apply_aligned_fasta(&identical_aligned, Some(rev))
        .unwrap();
    assert!(!e.aminoacid_sequences.is_empty());
    assert_eq!(e.get_revision(), rev);

    let changed_aligned = e
        .names
        .iter()
        .zip(&e.nucleotide_sequences)
        .map(|(name, seq)| format!(">{name}\n-{}\n", std::str::from_utf8(seq).unwrap()))
        .collect::<String>();
    e.apply_aligned_fasta(&changed_aligned, Some(rev)).unwrap();
    assert!(e.aminoacid_sequences.is_empty());

    // Every undo() and redo() clears cache.
    let mut undo_count = 0;
    loop {
        populate_cache(&mut e);
        if !e.undo().unwrap().changed {
            assert!(!e.aminoacid_sequences.is_empty());
            break;
        }
        assert!(e.aminoacid_sequences.is_empty());
        undo_count += 1;
    }
    assert_eq!(undo_count, 9);

    let mut redo_count = 0;
    loop {
        populate_cache(&mut e);
        if !e.redo().unwrap().changed {
            assert!(!e.aminoacid_sequences.is_empty());
            break;
        }
        assert!(e.aminoacid_sequences.is_empty());
        redo_count += 1;
    }
    assert_eq!(redo_count, 9);
}
