/* @ts-self-types="./sequence_editor.d.ts" */

/**
 * Direction for horizontal character movement.
 * @enum {0 | 1}
 */
export const MoveDirection = Object.freeze({
    Left: 0, "0": "Left",
    Right: 1, "1": "Right",
});

/**
 * The core MSA engine. Owns the alignment matrix, row names, the reusable
 * viewport buffer, and the undo/redo stacks.
 */
export class MsaEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MsaEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_msaengine_free(ptr, 0);
    }
    /**
     * Simultaneous deletion at a single column index on a subset of rows.
     * Only rows in `row_indices` are affected: the character at `col_idx`
     * is removed and a `-` is appended at the end to keep width unchanged.
     * Non-target rows are completely untouched.
     *
     * Returns an empty string on success, or `ERR_DELETE_NOT_GAP` if any
     * target position contains a non-`-` character (all-or-nothing).
     * @param {Uint32Array} row_indices
     * @param {number} col_idx
     * @returns {string}
     */
    delete_at_subset(row_indices, col_idx) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passArray32ToWasm0(row_indices, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.msaengine_delete_at_subset(this.__wbg_ptr, ptr0, len0, col_idx);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Delete a column from every row, shrinking `alignment_width` by 1.
     * This is the width-preserving inverse of a full-column insert.
     * Returns an empty string on success.
     * @param {number} col_idx
     * @returns {string}
     */
    delete_column(col_idx) {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.msaengine_delete_column(this.__wbg_ptr, col_idx);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Global alignment width (columns). Zero if nothing is loaded.
     * @returns {number}
     */
    get_alignment_width() {
        const ret = wasm.msaengine_get_alignment_width(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} row
     * @returns {Uint8Array}
     */
    get_aminoacid_view(row) {
        const ret = wasm.msaengine_get_aminoacid_view(this.__wbg_ptr, row);
        return ret;
    }
    /**
     * Return the raw byte at `(row, col)`, or `0` if out of range.
     * Useful for the test harness to spot-check individual cells.
     * @param {number} row
     * @param {number} col
     * @returns {number}
     */
    get_base(row, col) {
        const ret = wasm.msaengine_get_base(this.__wbg_ptr, row, col);
        return ret;
    }
    /**
     * Return the name/identifier of a given row, or an empty string if the
     * index is out of range.
     * @param {number} row
     * @returns {string}
     */
    get_name(row) {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.msaengine_get_name(this.__wbg_ptr, row);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Return the length of a specific row, or `0` if the row index is invalid.
     * @param {number} row
     * @returns {number}
     */
    get_row_length(row) {
        const ret = wasm.msaengine_get_row_length(this.__wbg_ptr, row);
        return ret >>> 0;
    }
    /**
     * Number of sequences currently loaded.
     * @returns {number}
     */
    get_sequence_count() {
        const ret = wasm.msaengine_get_sequence_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Number of bytes currently held in the viewport buffer.
     * @returns {number}
     */
    get_viewport_len() {
        const ret = wasm.msaengine_get_viewport_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Simultaneous gap insertion at a single column index on a subset of
     * rows. The inserted character is always `-` (gap). Target rows receive
     * the gap at the clamped insertion column; non-target rows have a `-`
     * appended at the end to keep matrix width consistent.
     *
     * Returns an empty string on success (no validation needed since only
     * `-` can be inserted).
     * @param {Uint32Array} row_indices
     * @param {number} col_idx
     * @returns {string}
     */
    insert_at_subset(row_indices, col_idx) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passArray32ToWasm0(row_indices, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.msaengine_insert_at_subset(this.__wbg_ptr, ptr0, len0, col_idx);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Parse FASTA content and populate the engine.
     *
     * Performs a line-by-line scan. Sequences may span multiple lines;
     * a new sequence begins at any line starting with `>`. Whitespace and
     * blank lines are ignored. All sequence bytes are uppercased.
     *
     * The sequences are assumed to be pre-aligned as this is given from
     * loculus as a provider of the sequence data. After all sequences are
     * parsed, `alignment_width` is set to the length of the longest
     * sequence. Shorter sequences are NOT automatically padded.
     * Callers can detect ragged alignments via `get_row_length`.
     *
     * Returns the number of sequences parsed after successful engine population.
     * @param {string} fasta_content
     * @returns {number}
     */
    load_fasta(fasta_content) {
        const ptr0 = passStringToWasm0(fasta_content, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.msaengine_load_fasta(this.__wbg_ptr, ptr0, len0);
        return ret >>> 0;
    }
    /**
     * Move a contiguous block of IUPAC characters horizontally by 1 position
     * within a single row. Each call moves exactly 1 position; callers must
     * issue multiple calls for multi-position moves.
     *
     * `col_indices` is treated as a range `[min, max]`, non-contiguous
     * indices are clamped to their min/max.
     *
     * **Left move:** validates the selected chars are IUPAC and the position
     * to the left is `-`, then rotates the block left by 1.
     *
     * **Right move:** validates the selected chars are IUPAC and the position
     * to the right is `-`, then rotates the block right by 1.
     *
     * Returns an empty string on success, or an error code on failure
     * (all-or-nothing).
     * @param {number} row
     * @param {Uint32Array} col_indices
     * @param {MoveDirection} direction
     * @returns {string}
     */
    move_horizontal(row, col_indices, direction) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passArray32ToWasm0(col_indices, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.msaengine_move_horizontal(this.__wbg_ptr, row, ptr0, len0, direction);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Move the specified rows down by 1 position. Each specified row swaps
     * with the row immediately below it. Rows already at the bottom are
     * silently skipped. Multiple rows may be moved simultaneously.
     * Returns an empty string on success.
     * @param {Uint32Array} row_indices
     * @returns {string}
     */
    move_rows_down(row_indices) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passArray32ToWasm0(row_indices, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.msaengine_move_rows_down(this.__wbg_ptr, ptr0, len0);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Move the specified rows up by 1 position. Each specified row swaps with
     * the row immediately above it. Rows already at the top (index 0) are
     * silently skipped. Multiple rows may be moved simultaneously.
     * Returns an empty string on success.
     * @param {Uint32Array} row_indices
     * @returns {string}
     */
    move_rows_up(row_indices) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passArray32ToWasm0(row_indices, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.msaengine_move_rows_up(this.__wbg_ptr, ptr0, len0);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Simultaneous block character change (substitution) on a subset of rows
     * at a single column index. Rows outside `row_indices` are untouched.
     * Out-of-range rows or columns are silently skipped.
     *
     * Returns an empty string on success, or an error code constant on
     * validation failure (all-or-nothing: no rows are modified on failure).
     * @param {Uint32Array} row_indices
     * @param {number} col_idx
     * @param {number} new_base
     * @returns {string}
     */
    mutate_base_subset(row_indices, col_idx, new_base) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passArray32ToWasm0(row_indices, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.msaengine_mutate_base_subset(this.__wbg_ptr, ptr0, len0, col_idx, new_base);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Construct an empty engine.
     */
    constructor() {
        const ret = wasm.msaengine_new();
        this.__wbg_ptr = ret;
        MsaEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Redo the most recently undone command. Returns `true` if a redo was
     * applied, `false` if the redo stack is empty.
     * @returns {boolean}
     */
    redo() {
        const ret = wasm.msaengine_redo(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Number of commands on the redo stack.
     * @returns {number}
     */
    redo_depth() {
        const ret = wasm.msaengine_redo_depth(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {string} query
     * @param {boolean} check_record_names
     * @returns {any}
     */
    search(query, check_record_names) {
        const ptr0 = passStringToWasm0(query, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.msaengine_search(this.__wbg_ptr, ptr0, len0, check_record_names);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * When the translate function is called, it will check if there are any untranslated sequences and then translate all rows of nucleotide sequences for all reading frames.
     * Afterwards it will select the viewport of the translated amino acid sequences for the specified range and reading frame.
     *
     * Mirrors `update_viewport`'s conventions exactly: rows and columns are
     * inclusive (`[start, end]`), and every row contributes exactly
     * `(end_col - start_col + 1)` bytes, padding short rows with `b' '`.
     * Without this fixed stride, the worker's `bytes / cols` row count would
     * be wrong whenever a translated row is shorter than the requested
     * column range (which it almost always is, since amino acid frames are
     * ~1/3 the length of the nucleotide sequence).
     * @param {number} start_row
     * @param {number} end_row
     * @param {number} start_col
     * @param {number} end_col
     * @param {number} reading_frame
     * @returns {Uint8Array}
     */
    translate(start_row, end_row, start_col, end_col, reading_frame) {
        const ret = wasm.msaengine_translate(this.__wbg_ptr, start_row, end_row, start_col, end_col, reading_frame);
        return ret;
    }
    /**
     * Undo the most recent command. Returns `true` if an undo was applied,
     * `false` if the undo stack is empty.
     *
     * For `Substitutions`, the old bases are restored and the command is
     * pushed onto the redo stack. For `StructuralSnapshot`, the snapshot
     * becomes the current state and the *current* (post-edit) state is
     * captured as a new `StructuralSnapshot` on the redo stack so that redo
     * can re-apply the structural change.
     * @returns {boolean}
     */
    undo() {
        const ret = wasm.msaengine_undo(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Number of commands on the undo stack.
     * @returns {number}
     */
    undo_depth() {
        const ret = wasm.msaengine_undo_depth(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Extract a windowed slice of the matrix into the reusable viewport buffer
     * and return it as a `Uint8Array`.
     *
     * The slice covers rows `[start_row, end_row]` inclusive and columns
     * `[start_col, end_col]` inclusive. Row indices are clamped to the
     * number of loaded sequences. Every row always contributes exactly
     * `(end_col - start_col + 1)` bytes; columns that lie beyond the end of
     * the sequence are filled with `b' '` (space). This keeps the buffer
     * strictly row-major with a fixed stride, so callers can index
     * `bytes[r * cols + c]` without inspecting per-row lengths.
     * @param {number} start_row
     * @param {number} end_row
     * @param {number} start_col
     * @param {number} end_col
     * @returns {Uint8Array}
     */
    update_viewport(start_row, end_row, start_col, end_col) {
        const ret = wasm.msaengine_update_viewport(this.__wbg_ptr, start_row, end_row, start_col, end_col);
        return ret;
    }
    /**
     * Extract a windowed slice and write it directly into a caller-provided
     * buffer (e.g. a `SharedArrayBuffer` view). Returns the number of bytes
     * written, or 0 if the slice is empty or out of range.
     *
     * This is the zero-copy-across-boundary path: the worker passes a
     * `Uint8Array` view backed by a `SharedArrayBuffer` that the main thread
     * also holds. The WASM engine writes into it via a single `memcpy` per
     * row, and the main thread reads the same memory directly. There is no
     * `postMessage` transfer of binary data, structured clone, or `ArrayBuffer.slice`.
     *
     * `out` must be at least as large as the worst-case slice
     * (`(end_row - start_row + 1) * (end_col - start_col + 1)` bytes).
     * @param {number} start_row
     * @param {number} end_row
     * @param {number} start_col
     * @param {number} end_col
     * @param {Uint8Array} out
     * @returns {number}
     */
    update_viewport_into(start_row, end_row, start_col, end_col, out) {
        var ptr0 = passArray8ToWasm0(out, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.msaengine_update_viewport_into(this.__wbg_ptr, start_row, end_row, start_col, end_col, ptr0, len0, out);
        return ret >>> 0;
    }
}
if (Symbol.dispose) MsaEngine.prototype[Symbol.dispose] = MsaEngine.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_67e7344beaa85059: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_copy_to_typed_array_cccd104be8cf0b8d: function(arg0, arg1, arg2) {
            new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(getArrayU8FromWasm0(arg0, arg1));
        },
        __wbg___wbindgen_throw_5d9e815e6fdf150f: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_log_2778eeb36efc90b4: function(arg0, arg1) {
            console.log(getStringFromWasm0(arg0, arg1));
        },
        __wbg_new_1da3429bc3c4541c: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_new_6d48f1eaea5b883e: function(arg0) {
            const ret = new ArrayBuffer(arg0 >>> 0);
            return ret;
        },
        __wbg_new_bebc3f4757acf305: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_ffa92086ea89f79c: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_from_slice_4ee02165f9de919e: function(arg0, arg1) {
            const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_set_13d25b81ab403f5e: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbindgen_generic_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_generic_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_generic_0000000000000003: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./sequence_editor_bg.js": import0,
    };
}

const MsaEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_msaengine_free(ptr, 1));

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('sequence_editor_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
