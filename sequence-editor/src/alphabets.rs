//! Sequence alphabets for the sequence-editor engine.
//!
//! Provides a bitset-based [`Alphabet`] type and pre-built constants for
//! IUPAC nucleotide codes, gap characters, and a stub for amino acids.

// Alphabet type

/// A set of valid ASCII byte characters for a sequence alphabet.
///
/// Uses a fixed-size 256-bit bitset so [`contains`](Alphabet::contains) is a
/// single array lookup without dependencies.
#[derive(Clone, Debug)]
pub struct Alphabet {
    /// Bit `i` is set if byte value `i` is a member of this alphabet.
    /// `pub(crate)` so the crate's test module can inspect it directly.
    pub(crate) table: [u64; 4],
}

impl Alphabet {
    /// Create an alphabet from a byte slice of valid characters.
    ///
    /// Upper/lower case variants must be listed/built explicitly if both are valid.
    /// This is a `const fn`, so the bitset is built at compile time.
    pub const fn new(symbols: &[u8]) -> Self {
        let mut table = [0u64; 4];
        let mut i = 0;
        while i < symbols.len() {
            let symbol = symbols[i];
            table[(symbol as usize) >> 6] |= 1u64 << (symbol as u32 & 63);
            i += 1;
        }
        Self { table }
    }

    /// Returns `true` if `c` is a member of this alphabet.
    #[inline]
    pub fn contains(&self, c: u8) -> bool {
        (self.table[(c as usize) >> 6] & (1u64 << (c as u32 & 63))) != 0
    }
}

// Pre-built alphabets

/// IUPAC nucleotide alphabet (DNA). Includes both upper and lower case.
///
/// Symbols: A, C, G, T, U, R, Y, S, W, K, M, B, D, H, V, N
/// (and their lower-case equivalents).
pub const IUPAC: &Alphabet = {
    const UPPER: &[u8] = b"ACGTURYSWKMBDHVN";

    const fn build_iupac() -> Alphabet {
        let mut table = [0u64; 4];
        let mut i = 0;
        while i < UPPER.len() {
            let upper_char = UPPER[i];
            table[(upper_char as usize) >> 6] |= 1u64 << (upper_char as u32 & 63);
            // Also insert lower-case variant
            let lower_char = upper_char.to_ascii_lowercase();
            table[(lower_char as usize) >> 6] |= 1u64 << (lower_char as u32 & 63);
            i += 1;
        }
        Alphabet { table }
    }

    const ALPH: &Alphabet = &build_iupac();
    ALPH
};

/// Gap character alphabet -> only `-`.
pub const GAP: &Alphabet = &Alphabet::new(b"-");

/// Amino acid alphabet stub
///! Not yet implemented. Will be expanded when protein translations are added.
pub const AMINO: &Alphabet = &Alphabet::new(b"");

// Convenience helpers & validators

/// Returns `true` if `c` is a valid IUPAC nucleotide character.
#[inline]
pub fn is_iupac(c: u8) -> bool {
    IUPAC.contains(c)
}

/// Returns `true` if `c` is a gap character (`-`).
#[inline]
pub fn is_gap(c: u8) -> bool {
    GAP.contains(c)
}