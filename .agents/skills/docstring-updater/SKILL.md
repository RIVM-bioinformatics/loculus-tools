---
name: docstring-updater
description: Add or update concise documentation comments in TypeScript/React frontend packages (TSDoc) and Rust engine crates (Rustdoc). Use when documenting public APIs without changing runtime behavior.
---

# Docstring Updater

Document public modules, components, classes, interfaces, types, functions, and Rust engine symbols across `loculus-tools` packages. Read `AGENTS.md` and the nearest implementation before editing.

## Layer-Specific Conventions

### 1. TypeScript / React Frontend Packages

Use TSDoc / JSDoc formatting (`/** ... */`):

- **Components and Hooks**: Briefly describe what the component or hook provides, its key props, and state side-effects.
- **Interfaces & Types**: Document each field's purpose, expected units or formats, and optionality.
- **Services, Stores & Utils**: Document methods with a concise summary, `@param` descriptions (including expected ranges or formats), `@returns` description, and `@throws` if errors are thrown.
- **Worker Bridge Protocol**: Clearly document message types, request/response payload shapes, and transferable buffers.

Example:
```typescript
/**
 * Requests an inclusive rectangular slice of the alignment matrix.
 *
 * @param startRow - Zero-indexed start row (inclusive).
 * @param endRow - Zero-indexed end row (inclusive).
 * @param startCol - Zero-indexed start column (inclusive).
 * @param endCol - Zero-indexed end column (inclusive).
 * @returns Viewport data containing flattened byte array and dimensions.
 */
```

### 2. Rust Engine Crates

Use standard Rustdoc formatting (`///` for items, `//!` for module-level):

- Provide a concise one-line summary followed by details when necessary.
- Include `# Arguments` or `# Returns` when parameters require elaboration.
- Add `# Panics` or `# Errors` sections for functions that can panic or return `Result::Err`; document non-panicking empty or error results for invalid/out-of-bounds inputs.
- Document coordinate conventions (inclusive 0-indexed bounds) and byte packing invariants.

Example:
```rust
/// Extracts an inclusive rectangular viewport slice of the sequence matrix.
///
/// Rows are clamped to loaded sequences. Columns beyond sequence length
/// are padded with ASCII space (`0x20`).
///
/// # Invariant
/// The returned slice has length `rows * cols` bytes, maintaining a row-major stride.
///
/// # Returns
/// Returns an empty buffer (`0` bytes) if the matrix is empty, `start_row > clamped_end_row`,
/// or `start_col > end_col`.
```

## Procedure

1. Identify the requested scope and public symbols.
2. Read signatures, callers, tests, and existing documentation before describing behavior.
3. Write concise documentation reflecting intended contracts without cluttering obvious names.
4. Preserve runtime behavior, types, and public signatures exactly.
5. Run a focused lint or check command after editing (e.g. `pnpm --filter <package> lint` or `cargo clippy`) to verify formatting and syntax.
