
#[derive(Debug, PartialEq, Eq)]
pub struct SubstitutionRecord {
    pub positions: Vec<(usize, usize, u8)>,
}
