
#[derive(Debug, PartialEq, Eq)]
pub struct SubstitutionRecord {
  pub positions: Vec<(usize, usize, u8)>,
}


#[derive(Debug, PartialEq, Eq)]
pub struct PrependedSequencesRecord {
  pub count: usize,
  pub names: Vec<String>,
  pub sequences: Vec<Vec<u8>>,
  pub previous_alignment_width: usize,
}


#[derive(Debug, PartialEq, Eq)]
pub struct InsertAtSubsetRecord {
  pub target_rows: Vec<usize>,
  pub insertion_col: usize,
  pub padded_short_rows: Vec<(usize, usize)>,
  pub previous_alignment_width: usize,
}


#[derive(Debug, PartialEq, Eq)]
pub struct DeleteAtSubsetRecord {
  pub target_rows: Vec<usize>,
  pub column_index: usize,
}


#[derive(Debug, PartialEq, Eq)]
pub struct DeleteColumnRecord {
  pub column_index: usize,
  pub removed_bases: Vec<Option<u8>>,
  pub previous_alignment_width: usize,
}
