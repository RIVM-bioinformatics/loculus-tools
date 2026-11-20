pub(crate) mod structs;
pub(crate) mod enums;

pub use structs::SubstitutionRecord;
pub use enums::UndoCommand;

pub use crate::MsaEngine;


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
    
    // Recompute the total history bytes for the given engine by summing the estimated byte sizes of all undo and redo commands.
    pub fn recompute_history_bytes(engine: &mut MsaEngine) {
        engine.history_bytes = engine
            .undo_stack
            .iter()
            .chain(engine.redo_stack.iter())
            .map(UndoCommand::estimated_byte_size)
            .sum();
    }
}

// Push an undo command to the bounded undo stack, evicting old commands if necessary.
pub(crate) fn push_to_undo_bounded(engine: &mut MsaEngine, cmd: UndoCommand) {
  let cmd_bytes = cmd.estimated_byte_size();
  if engine.max_undo_depth == 0 || cmd_bytes > engine.max_history_bytes {
      engine.undo_stack.clear();
      UndoCommand::recompute_history_bytes(engine);
      return;
  }
  while !engine.undo_stack.is_empty()
      && (engine.undo_stack.len() >= engine.max_undo_depth
          || engine.history_bytes.saturating_add(cmd_bytes) > engine.max_history_bytes)
  {
      if let Some(evicted) = engine.undo_stack.pop_front() {
          engine.history_bytes = engine.history_bytes.saturating_sub(evicted.estimated_byte_size());
      }
  }

  engine.undo_stack.push_back(cmd);
  UndoCommand::recompute_history_bytes(engine);
}

// Record a new undoable command, clearing the redo stack/branch 
pub(crate) fn push_to_undo_stack(engine: &mut MsaEngine, cmd: UndoCommand) {
    engine.redo_stack.clear();
    push_to_undo_bounded(engine, cmd);
    engine.aminoacid_sequences.clear();
}
