pub use super::structs::{
  SubstitutionRecord, 
  PrependedSequencesRecord, 
  InsertAtSubsetRecord, 
  DeleteAtSubsetRecord
};

#[derive(Debug, PartialEq, Eq)]
pub enum UndoCommand {
  Substitutions(SubstitutionRecord),
  PrependedSequences(PrependedSequencesRecord),
  InsertAtSubset(InsertAtSubsetRecord),
  DeleteAtSubset(DeleteAtSubsetRecord)
}
