pub use crate::history::structs::{
    DeleteAtSubsetRecord, DeleteColumnRecord, DeletedRowRecord, HorizontalMoveRecord,
    InsertAtSubsetRecord, PrependedSequencesRecord, ReplacedMatrixRecord, RowReorderRecord,
    SubstitutionRecord,
};

#[derive(Debug, PartialEq, Eq)]
pub enum UndoCommand {
    Substitutions(SubstitutionRecord),
    PrependedSequences(PrependedSequencesRecord),
    InsertAtSubset(InsertAtSubsetRecord),
    DeleteAtSubset(DeleteAtSubsetRecord),
    DeleteColumn(DeleteColumnRecord),
    DeletedRow(DeletedRowRecord),
    HorizontalMove(HorizontalMoveRecord),
    RowReorder(RowReorderRecord),
    ReplaceMatrix(ReplacedMatrixRecord),
}
