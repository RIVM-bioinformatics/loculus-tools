import { useState, useCallback, useRef, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  AppBar,
  Toolbar,
  Typography,
  Alert,
  Paper,
  Stack,
  Divider,
  Chip,
} from "@mui/material";
import { useEngineWorker } from "./engine/useEngineWorker";
import type { ViewportResult, Meta } from "./engine/protocol";
import BenchmarkPanel from "./BenchmarkPanel";
import { ScrollingViewport } from "./ScrollingViewport";

const SAMPLE_FASTA = `>seq1 first record
ATGCATGCATGC
>seq2
ATGGTGCAT-TC
>seq3 third record
ATGCAT-CATGC`;

const BASE_COLORS: Record<string, string> = {
  A: "#2e7d32",
  T: "#c62828",
  G: "#ef6c00",
  C: "#1565c0",
  "-": "#9e9e9e",
  "*": "#6a1b9a",
  X: "#6a1b9a",
};

function colorFor(ch: string): string {
  return BASE_COLORS[ch] ?? "#000";
}

/**
 * Canvas-based slice viewer.
 *
 * Renders the alignment slice to a <canvas> element instead of 20K+ individual
 * <span> nodes. This keeps the DOM at O(1) nodes regardless of slice size,
 * which is critical for benchmark accuracy — a span-based viewer with 40×500
 * = 20K nodes inflates the browser's composite time to ~100ms per frame,
 * contaminating the benchmark's double-rAF "renderMs" measurement.
 */
const CELL_W = 10;
const CELL_H = 18;
const LABEL_W = 160;

function SliceCanvas({
  slice,
  names,
}: {
  slice: ViewportResult & { bytes: Uint8Array };
  names: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { rows, cols, bytes, startRow } = slice;
    const w = LABEL_W + cols * CELL_W;
    const h = rows * CELL_H;
    canvas.width = w;
    canvas.height = h;

    ctx.font = "14px monospace";
    ctx.textBaseline = "top";

    for (let r = 0; r < rows; r++) {
      const name = names[r] ?? `seq${startRow + r}`;
      // Row label
      ctx.fillStyle = "#888";
      ctx.fillText(
        `${String(startRow + r).padStart(3, "0")} ${name.slice(0, 14).padEnd(14)} |`,
        0,
        r * CELL_H + 2,
      );
      // Bases
      const off = r * cols;
      for (let c = 0; c < cols; c++) {
        const ch = String.fromCharCode(bytes[off + c]);
        ctx.fillStyle = colorFor(ch);
        ctx.fillText(ch, LABEL_W + c * CELL_W, r * CELL_H + 2);
      }
    }
  }, [slice, names]);

  return (
    <Box sx={{ overflowX: "auto" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", fontFamily: "monospace" }}
      />
    </Box>
  );
}

function parseRows(csv: string): number[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 0);
}

export default function TestHarness() {
  const eng = useEngineWorker();

  const [fasta, setFasta] = useState(SAMPLE_FASTA);
  const [status, setStatus] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [slice, setSlice] = useState<(ViewportResult & { bytes: Uint8Array }) | null>(null);
  const [sliceRows, setSliceRows] = useState<{ row: number; name: string; text: string }[]>([]);

  // Slice inputs
  const [r0, setR0] = useState("0");
  const [r1, setR1] = useState("2");
  const [c0, setC0] = useState("0");
  const [c1, setC1] = useState("11");

  // Edit inputs
  const [rowsCsv, setRowsCsv] = useState("0,1");
  const [col, setCol] = useState("3");
  const [base, setBase] = useState("G");

  const refreshMeta = useCallback(async () => {
    try {
      const m = await eng.meta();
      setMeta(m);
    } catch (e) {
      setErr(String(e));
    }
  }, [eng]);

  const load = useCallback(async () => {
    setErr("");
    try {
      const n = await eng.load(fasta);
      setStatus(`Loaded ${n} sequences`);
      await refreshMeta();
      setSlice(null);
      setSliceRows([]);
    } catch (e) {
      setErr(String(e));
    }
  }, [eng, fasta, refreshMeta]);

  const fetchSlice = useCallback(async () => {
    setErr("");
    try {
      const res = await eng.viewport({
        startRow: Number(r0),
        endRow: Number(r1),
        startCol: Number(c0),
        endCol: Number(c1),
      });
      setSlice(res);
      // Decode rows for display.
      const out: { row: number; name: string; text: string }[] = [];
      for (let r = 0; r < res.rows; r++) {
        const absRow = res.startRow + r;
        const off = r * res.cols;
        const text = new TextDecoder().decode(res.bytes.subarray(off, off + res.cols));
        const name = await eng.name(absRow);
        out.push({ row: absRow, name, text });
      }
      setSliceRows(out);
      setStatus(`Fetched ${res.bytes.length} bytes (${res.rows}×${res.cols})`);
    } catch (e) {
      setErr(String(e));
    }
  }, [eng, r0, r1, c0, c1]);

  const applyEdit = useCallback(
    async (op: "mutate" | "insert" | "delete" | "deleteColumn") => {
      setErr("");
      try {
        const colNum = Number(col);
        const rows = parseRows(rowsCsv);
        if (op === "mutate") {
          await eng.mutate(rows, colNum, base);
        } else if (op === "insert") {
          await eng.insert(rows, colNum);
        } else if (op === "delete") {
          await eng.delete(rows, colNum);
        } else {
          await eng.deleteColumn(colNum);
        }
        setStatus(`${op} applied — refetch slice to verify`);
        await refreshMeta();
      } catch (e: any) {
        const msg = e.code ? `${e.code}: ${e.message}` : String(e);
        setErr(msg);
      }
    },
    [eng, rowsCsv, col, base, refreshMeta]
  );

  const doUndo = useCallback(async () => {
    setErr("");
    try {
      const ok = await eng.undo();
      setStatus(ok ? "Undone" : "Undo stack empty");
      await refreshMeta();
    } catch (e) {
      setErr(String(e));
    }
  }, [eng, refreshMeta]);

  const doRedo = useCallback(async () => {
    setErr("");
    try {
      const ok = await eng.redo();
      setStatus(ok ? "Redone" : "Redo stack empty");
      await refreshMeta();
    } catch (e) {
      setErr(String(e));
    }
  }, [eng, refreshMeta]);

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            MSA Engine — Test Harness
          </Typography>
          <Chip
            label={eng.ready ? "engine ready" : "loading wasm…"}
            color={eng.ready ? "success" : "warning"}
            size="small"
          />
        </Toolbar>
      </AppBar>

      <Stack direction="row" spacing={2} sx={{ p: 2 }}>
        {/* ----------------------------- Controls ----------------------------- */}
        <Paper sx={{ p: 2, width: 380 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle2">Load FASTA</Typography>
            <TextField
              label="FASTA"
              multiline
              minRows={5}
              value={fasta}
              onChange={(e) => setFasta(e.target.value)}
              sx={{ fontFamily: "monospace" }}
            />
            <Button variant="contained" onClick={load} disabled={!eng.ready}>
              Load
            </Button>

            <Divider />
            <Typography variant="subtitle2">Fetch slice</Typography>
            <Stack direction="row" spacing={1}>
              <TextField label="r0" value={r0} onChange={(e) => setR0(e.target.value)} size="small" />
              <TextField label="r1" value={r1} onChange={(e) => setR1(e.target.value)} size="small" />
              <TextField label="c0" value={c0} onChange={(e) => setC0(e.target.value)} size="small" />
              <TextField label="c1" value={c1} onChange={(e) => setC1(e.target.value)} size="small" />
            </Stack>
            <Button variant="outlined" onClick={fetchSlice} disabled={!eng.ready}>
              Fetch slice
            </Button>

            <Divider />
            <Typography variant="subtitle2">Edit</Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                label="rows (csv)"
                value={rowsCsv}
                onChange={(e) => setRowsCsv(e.target.value)}
                size="small"
                sx={{ flex: 2 }}
              />
              <TextField
                label="col"
                value={col}
                onChange={(e) => setCol(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="base (mutate only)"
                value={base}
                onChange={(e) => setBase(e.target.value.slice(0, 1).toUpperCase())}
                size="small"
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" color="primary" onClick={() => applyEdit("mutate")}>
                Mutate
              </Button>
              <Button variant="contained" color="secondary" onClick={() => applyEdit("insert")}>
                Insert '-'
              </Button>
              <Button variant="contained" color="error" onClick={() => applyEdit("delete")}>
                Delete
              </Button>
            </Stack>
            <Button variant="outlined" color="error" onClick={() => applyEdit("deleteColumn")}>
              Delete column (all rows)
            </Button>

            <Divider />
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={doUndo} disabled={!eng.ready}>
                Undo
              </Button>
              <Button variant="outlined" onClick={doRedo} disabled={!eng.ready}>
                Redo
              </Button>
              <Button variant="text" onClick={refreshMeta} disabled={!eng.ready}>
                Refresh meta
              </Button>
            </Stack>

            {meta && (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" label={`seqs: ${meta.sequences}`} />
                <Chip size="small" label={`width: ${meta.width}`} />
                <Chip size="small" label={`undo: ${meta.undoDepth}`} />
                <Chip size="small" label={`redo: ${meta.redoDepth}`} />
              </Stack>
            )}

            {err && <Alert severity="error">{err}</Alert>}
            {status && !err && <Alert severity="info">{status}</Alert>}
          </Stack>
        </Paper>

        {/* ----------------------------- Slice viewer ----------------------------- */}
        <Paper sx={{ p: 2, flex: 1, minHeight: 400 }}>
          <Typography variant="subtitle2" gutterBottom>
            Slice viewer
          </Typography>
          {slice ? (
            <SliceCanvas slice={slice} names={sliceRows.map((r) => r.name)} />
          ) : (
            <Alert severity="info">Load FASTA and fetch a slice to see results.</Alert>
          )}
        </Paper>
      </Stack>

      {/* ----------------------------- Scrolling viewport ----------------------------- */}
      <Box sx={{ p: 2, pt: 0 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Scrolling viewport (sliding window · overscan ±100 cols · trigger at 30 cols)
          </Typography>
          {meta ? (
            <ScrollingViewport eng={eng} meta={meta} />
          ) : (
            <Alert severity="info">Load a FASTA to enable the scrolling viewport.</Alert>
          )}
        </Paper>
      </Box>

      {/* ----------------------------- Benchmark ----------------------------- */}
      <Box sx={{ p: 2, pt: 0 }}>
        <BenchmarkPanel eng={eng} />
      </Box>
    </Box>
  );
}
