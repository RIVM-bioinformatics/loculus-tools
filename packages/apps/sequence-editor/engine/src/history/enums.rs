pub use super::structs::{SubstitutionRecord, PrependedSequencesRecord};

#[derive(Debug, PartialEq, Eq)]
pub enum UndoCommand {
  Substitutions(SubstitutionRecord),
  PrependedSequences(PrependedSequencesRecord),
}
