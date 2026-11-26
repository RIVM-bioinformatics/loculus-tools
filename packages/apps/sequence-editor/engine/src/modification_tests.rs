//! Tests for the `DataModificationResult` contract returned by data-modifying engine calls.

use crate::{DataModificationResult, MsaEngine};

fn loaded_engine() -> MsaEngine {
    let mut e = MsaEngine::new();
    e.load_fasta(">seq1\nATGC\n>seq2\nATGC").unwrap();
    e
}

#[test]
fn applied_mutation_reports_changed_and_current_revision() {
    let mut e = loaded_engine();
    let before = e.get_revision();

    let result = e.mutate_base(&[0], &[0], b'T').unwrap();

    assert!(result.changed);
    assert_eq!(result.revision, e.get_revision());
    assert_ne!(result.revision, before);
}

#[test]
fn noop_mutation_reports_unchanged_and_keeps_revision() {
    let mut e = loaded_engine();
    let before = e.get_revision();

    let result = e.mutate_base(&[0], &[0], b'A').unwrap();

    assert_eq!(
        result,
        DataModificationResult {
            changed: false,
            revision: before,
        }
    );
}

#[test]
fn undo_and_redo_on_empty_stacks_report_unchanged() {
    let mut e = loaded_engine();
    let before = e.get_revision();

    assert!(!e.undo().unwrap().changed);
    assert!(!e.redo().unwrap().changed);
    assert_eq!(e.get_revision(), before);
}

#[test]
fn reset_always_reports_changed() {
    let mut e = MsaEngine::new();
    let result = e.reset().unwrap();

    assert!(result.changed);
    assert_eq!(result.revision, e.get_revision());
}

#[test]
fn serializes_with_camel_case_wire_fields() {
    let result = DataModificationResult {
        changed: true,
        revision: 7,
    };

    assert_eq!(
        serde_json::to_value(result).unwrap(),
        serde_json::json!({ "changed": true, "revision": 7 })
    );
}
