//! Unit tests for the sequence alphabets module.
//!
//! This module is compiled only under `#[cfg(test)]` (see the
//! `mod alphabets_tests;` declaration in `lib.rs`). It lives in its own file
//! to keep `alphabets.rs` focused on the alphabet implementation. Because it
//! is a sibling module of `alphabets` at the crate root, it imports the
//! alphabet items via `crate::alphabets`.

use crate::alphabets::*;

#[test]
fn iupac_contains_upper_and_lower() {
    assert!(IUPAC.contains(b'A'));
    assert!(IUPAC.contains(b'a'));
    assert!(IUPAC.contains(b'G'));
    assert!(IUPAC.contains(b'g'));
    assert!(IUPAC.contains(b'N'));
    assert!(IUPAC.contains(b'n'));
    assert!(!IUPAC.contains(b'-')); // gap is not IUPAC
    assert!(!IUPAC.contains(b' '));
    assert!(!IUPAC.contains(b'1'));
}

#[test]
fn gap_contains_only_dash() {
    assert!(GAP.contains(b'-'));
    assert!(!GAP.contains(b'A'));
    assert!(!GAP.contains(b' '));
}

#[test]
fn amino_contains_upper_and_lower() {
    assert!(AMINO.contains(b'A'));
    assert!(AMINO.contains(b'a'));
    assert!(AMINO.contains(b'B'));
    assert!(AMINO.contains(b'b'));
    assert!(AMINO.contains(b'*'));
    assert!(!AMINO.contains(b' '));
    assert!(!AMINO.contains(b'1'));
    assert!(!AMINO.contains(b'-'));
}

#[test]
fn is_iupac_is_gap_and_is_amino_helpers() {
    assert!(is_iupac(b'A'));
    assert!(is_iupac(b'n'));
    assert!(!is_iupac(b'-'));
    assert!(!is_iupac(b' '));
    assert!(is_gap(b'-'));
    assert!(!is_gap(b'A'));
    assert!(is_amino(b'A'));
    assert!(!is_amino(b'-'));
}
