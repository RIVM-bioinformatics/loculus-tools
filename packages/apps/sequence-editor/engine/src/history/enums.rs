pub use super::structs::SubstitutionRecord;

#[derive(Debug, PartialEq, Eq)]
pub enum UndoCommand {
  Substitutions(SubstitutionRecord),
}
