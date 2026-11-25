/// Default maximum number of commands retained on the undo stack.
pub const DEFAULT_MAX_UNDO_DEPTH: usize = 2000;

/// Default maximum estimated heap byte budget for combined undo/redo history.
pub const DEFAULT_MAX_HISTORY_BYTES: usize = 256 * 1024 * 1024;
