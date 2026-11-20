
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
