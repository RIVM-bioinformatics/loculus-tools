pub(crate) mod structs;
pub(crate) mod enums;

pub use structs::{SubstitutionRecord, PrependedSequencesRecord, InsertAtSubsetRecord};
pub use enums::UndoCommand;

pub use crate::MsaEngine;


impl UndoCommand {
    pub fn estimated_byte_size(&self) -> usize {
        let base = std::mem::size_of::<Self>();
        let heap = match self {
            Self::Substitutions(SubstitutionRecord { 
              positions 
            }) => {
                positions.capacity() * std::mem::size_of::<(usize, usize, u8)>()
            }
            Self::PrependedSequences(PrependedSequencesRecord { 
              count, 
              names, 
              sequences, 
              previous_alignment_width 
            }) => {
                count * std::mem::size_of::<usize>()
                + names.capacity() * std::mem::size_of::<String>()
                + sequences.capacity() * std::mem::size_of::<Vec<u8>>()
                + previous_alignment_width * std::mem::size_of::<usize>()
              }
            Self::InsertAtSubset(InsertAtSubsetRecord { 
              target_rows,
              padded_short_rows,
              ..
            }) => {
                target_rows.capacity() * std::mem::size_of::<usize>()
                + padded_short_rows.capacity() * std::mem::size_of::<usize>()
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

pub(crate) fn push_to_redo_bounded(engine: &mut MsaEngine, cmd: UndoCommand) {
  let cmd_bytes = cmd.estimated_byte_size();
  if cmd_bytes > engine.max_history_bytes {
      engine.redo_stack.clear();
      UndoCommand::recompute_history_bytes(engine);
      return;
  }
  engine.redo_stack.push_back(cmd);
  UndoCommand::recompute_history_bytes(engine);
  while engine.history_bytes > engine.max_history_bytes {
    if let Some(evicted) = engine.undo_stack.pop_front() {
      engine.history_bytes = engine.history_bytes.saturating_sub(evicted.estimated_byte_size());
    }
    else if !engine.redo_stack.is_empty() {
      let evicted = engine.redo_stack.pop_front().unwrap();
      engine.history_bytes = engine.history_bytes.saturating_sub(evicted.estimated_byte_size());
    }
    else {
      break;
    }
  }
  UndoCommand::recompute_history_bytes(engine);
}

// Record a new undoable command, clearing the redo stack/branch 
pub(crate) fn push_to_undo_stack(engine: &mut MsaEngine, cmd: UndoCommand) {
    engine.redo_stack.clear();
    push_to_undo_bounded(engine, cmd);
    engine.revision = engine.revision.wrapping_add(1);
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
    UndoCommand::Substitutions(SubstitutionRecord { 
      mut positions 
    }) => {
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
    UndoCommand::PrependedSequences(PrependedSequencesRecord { 
      count, 
      previous_alignment_width, .. 
    }) => {
      let actual_count = count.min(engine.nucleotide_sequences.len());
      if actual_count == 0 {
          UndoCommand::recompute_history_bytes(engine);
          return false;
        }
      let drained_sequences = engine.nucleotide_sequences.drain(..actual_count).collect();
      let drained_names = engine.names.drain(..actual_count).collect();
      let redo_prev_width = engine.alignment_width;
      engine.alignment_width = previous_alignment_width;
      engine.viewport_buffer.clear();
      UndoCommand::PrependedSequences(PrependedSequencesRecord { count: actual_count, names: drained_names, sequences: drained_sequences, previous_alignment_width: redo_prev_width })
      }
    UndoCommand::InsertAtSubset(InsertAtSubsetRecord {
      target_rows, 
      insertion_col, 
      padded_short_rows, 
      previous_alignment_width 
    }) => {
      let mut target_cursor = 0;
      for (r, seq) in engine.nucleotide_sequences.iter_mut().enumerate() {
          if target_rows.get(target_cursor) == Some(&r) {
              if insertion_col < seq.len() {
                  seq.remove(insertion_col);
              } 
              target_cursor += 1;
          } else {
            seq.pop();
          }
      }
      for &(r, original_len) in &padded_short_rows {
        if let Some(seq) = engine.nucleotide_sequences.get_mut(r) {
          seq.truncate(original_len);
        }
      }
      UndoCommand::InsertAtSubset(InsertAtSubsetRecord { target_rows, insertion_col, padded_short_rows, previous_alignment_width })
      }
    UndoCommand::DeleteAtSubset(DeleteAtSubsetRecord { 
      target_rows, 
      column_index 
    }) => {
      for &r in &target_rows {
        if let Some(seq) = engine.nucleotide_sequences.get_mut(r)
          && column_index < seq.len()
          {
            seq.pop();
            seq.insert(column_index, b'-')
          }
      }
      UndoCommand::DeleteAtSubset(DeleteAtSubsetRecord { target_rows, column_index })
      }
    UndoCommand::DeleteColumn(DeleteColumnRecord { 
      column_index, 
      removed_bases, 
      previous_alignment_width 
    }) => {
      for (seq, &base) in engine.nucleotide_sequences.iter_mut().zip(&removed_bases) {
        if let Some(base) = base {
          let insert_at = column_index.min(seq.len());
          seq.insert(insert_at, base);
        }
      }
      engine.alignment_width = previous_alignment_width;
      UndoCommand::DeleteColumn(DeleteColumnRecord { column_index, removed_bases, previous_alignment_width })
      }
  };
  push_to_redo_bounded(engine, redo_cmd);
  engine.revision = engine.revision.wrapping_add(1);
  true
}


pub(crate) fn apply_redo_action(engine: &mut MsaEngine) -> bool {
  let cmd = match engine.redo_stack.pop_back() {
      Some(c) => c,
      None => return false,
  };
  // Here you would typically handle the command, e.g., apply it and push to undo stack
  // For now, let's just return true to indicate a command was popped
  match cmd {
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
        push_to_undo_bounded(engine, UndoCommand::Substitutions(SubstitutionRecord { positions }));
    }
    UndoCommand::PrependedSequences(PrependedSequencesRecord { count, mut names, mut sequences, .. }) => {
      let prev_alignment_width = engine.alignment_width;
      let batch_width = sequences.iter().map(|seq| seq.len()).max().unwrap_or(0);
      sequences.append(&mut engine.nucleotide_sequences);
      names.append(&mut engine.names);
      engine.nucleotide_sequences = sequences;
      engine.names = names;
      engine.alignment_width = engine.alignment_width.max(batch_width);
      engine.viewport_buffer.clear();
      push_to_undo_bounded(engine, UndoCommand::PrependedSequences(
        PrependedSequencesRecord { 
          count, 
          names: Vec::new(), 
          sequences: Vec::new(), 
          previous_alignment_width: prev_alignment_width }));
    }
    UndoCommand::InsertAtSubset(InsertAtSubsetRecord {
      target_rows,
      insertion_col,
      padded_short_rows,
      previous_alignment_width
    } ) => {
      let mut target_cursor = 0;
      for (r, seq) in engine.nucleotide_sequences.iter_mut().enumerate() {
        if seq.len() < insertion_col {
          seq.resize(insertion_col, b'-');
        }
        if target_rows.get(target_cursor) == Some(&r) {
          seq.insert(insertion_col, b'-');
          target_cursor += 1;
        } else {
          seq.push(b'-');
        }
      }
      engine.alignment_width = engine.nucleotide_sequences.iter().map(|seq| seq.len()).max().unwrap_or(0);
      push_to_undo_bounded(engine, UndoCommand::InsertAtSubset(
        InsertAtSubsetRecord { 
          target_rows, 
          insertion_col, 
          padded_short_rows, 
          previous_alignment_width 
        }
      ));
      }
    UndoCommand::DeleteAtSubset(DeleteAtSubsetRecord { 
      target_rows, 
      column_index
    }) => {
      for &row in &target_rows {
        if let Some(seq) = engine.nucleotide_sequences.get_mut(row) {
          if column_index < seq.len() {
            seq.remove(column_index);
            seq.push(b'-');
          }
        }
      }
      push_to_undo_bounded(engine, UndoCommand::DeleteAtSubset(
        DeleteAtSubsetRecord { 
          target_rows, 
          column_index 
        }
      ));
      }
    UndoCommand::DeleteColumn(DeleteColumnRecord { 
      column_index, 
      removed_bases, 
      previous_alignment_width 
    }) => {
      for seq in engine.nucleotide_sequences.iter_mut() {
        if column_index < seq.len() {
          seq.remove(column_index);
        }
      }
      engine.alignment_width = engine.nucleotide_sequences.iter().map(Vec::len).max().unwrap_or(0);
      push_to_undo_bounded(engine, UndoCommand::DeleteColumn(
        DeleteColumnRecord { 
          column_index, 
          removed_bases, 
          previous_alignment_width 
        }
      ));
      }
    };

  engine.revision = engine.revision.wrapping_add(1);
  true
}
