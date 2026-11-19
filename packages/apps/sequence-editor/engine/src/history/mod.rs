pub(crate) mod structs;
pub(crate) mod enums;

pub use structs::SubstitutionRecord;
pub use enums::UndoCommand;


impl UndoCommand {
    pub fn estimated_byte_size(&self) -> usize {
        let base = std::mem::size_of::<Self>();
        let heap = match self {
            Self::Substitutions(SubstitutionRecord { positions }) => {
                positions.capacity() * std::mem::size_of::<(usize, usize, u8)>()
            }
        };
        base.saturating_add(heap)
    }
}
