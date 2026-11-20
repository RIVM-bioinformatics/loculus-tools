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


pub(crate) fn apply_undo_action(engine: &mut MsaEngine) -> bool {
  let cmd = match engine.undo_stack.pop_back() {
      Some(c) => c,
      None => return false,
  };
  // Here you would typically handle the command, e.g., apply it and push to redo stack
  // For now, let's just return true to indicate a command was popped
  let redo_cmd = match cmd {
    UndoCommand::Substitutions(SubstitutionRecord { mut positions }) => {
        let mut write_idx = 0;
        for read_idx in 0..positions.len() {
            let (row, col, target_base) = positions[read_idx];
            if let Some(seq) = engine.nucleotide_sequences.get_mut(row)
                && let Some(base) = seq.get_mut(col)
            {
                let prev_base = *base;
                *base = target_base;
                positions[write_idx] = (row, col, prev_base);
                write_idx += 1;
            }
        }
        positions.truncate(write_idx);
        if positions.is_empty() {
            return false;
        }
        UndoCommand::Substitutions(SubstitutionRecord { positions })
      }
    };
  engine.push_to_redo_bounded(redo_cmd);
  true
}


pub(crate) fn apply_redo_action(engine: &mut MsaEngine) -> bool {
  let cmd = match engine.redo_stack.pop_back() {
      Some(c) => c,
      None => return false,
  };
  // Here you would typically handle the command, e.g., apply it and push to undo stack
  // For now, let's just return true to indicate a command was popped
  let cmd = match cmd {
    UndoCommand::Substitutions(SubstitutionRecord { mut positions }) => {
        let mut write_idx = 0;
        for read_idx in 0..positions.len() {
            let (row, col, target_base) = positions[read_idx];
            if let Some(seq) = engine.nucleotide_sequences.get_mut(row)
                && let Some(base) = seq.get_mut(col)
            {
                let prev_base = *base;
                *base = target_base;
                positions[write_idx] = (row, col, prev_base);
                write_idx += 1;
            }
        }
        positions.truncate(write_idx);
        if positions.is_empty() {
            return false;
        }
        UndoCommand::Substitutions(SubstitutionRecord { positions })
      }
    };
  engine.push_to_undo_bounded(cmd);
  true
}
