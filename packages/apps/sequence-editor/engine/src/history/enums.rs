pub use super::structs::{
  SubstitutionRecord, 
  PrependedSequencesRecord, 
  InsertAtSubsetRecord, 
  DeleteAtSubsetRecord,
  DeleteColumnRecord,
  DeletedRowRecord
  
};

#[derive(Debug, PartialEq, Eq)]
pub enum UndoCommand {
  Substitutions(SubstitutionRecord),
  PrependedSequences(PrependedSequencesRecord),
  InsertAtSubset(InsertAtSubsetRecord),
  DeleteAtSubset(DeleteAtSubsetRecord),
  DeleteColumn(DeleteColumnRecord),
  DeletedRow(DeletedRowRecord)
}
