pub use crate::history::structs::{
  SubstitutionRecord, 
  PrependedSequencesRecord, 
  InsertAtSubsetRecord, 
  DeleteAtSubsetRecord,
  DeleteColumnRecord,
  DeletedRowRecord,
  HorizontalMoveRecord
};

#[derive(Debug, PartialEq, Eq)]
pub enum UndoCommand {
  Substitutions(SubstitutionRecord),
  PrependedSequences(PrependedSequencesRecord),
  InsertAtSubset(InsertAtSubsetRecord),
  DeleteAtSubset(DeleteAtSubsetRecord),
  DeleteColumn(DeleteColumnRecord),
  DeletedRow(DeletedRowRecord),
  HorizontalMove(HorizontalMoveRecord)
}
