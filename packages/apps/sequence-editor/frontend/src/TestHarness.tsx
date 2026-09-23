import {
  useCallback,
  useState,
} from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';

import { EngineStructuredError, useEngineWorker } from './engine/useEngineWorker';
import type {
  Meta,
  SearchResult,
  ViewportResult,
} from './engine/protocol';
import { BenchmarkPanel } from './BenchmarkPanel';
import { ScrollingViewport } from './ScrollingViewport';
import { SliceCanvas } from './SliceCanvas';
import { SAMPLE_FASTA } from './constants';
import { SeqEditorUtil } from './utils/SeqEditorUtil';


/**
 * Canvas-based slice viewer.
 *
 * Renders the alignment slice to a <canvas> element instead of 20K+ individual
 * <span> nodes. This keeps the DOM at O(1) nodes regardless of slice size,
 * which is critical for benchmark accuracy — a span-based viewer with 40×500
 * = 20K nodes inflates the browser's composite time to ~100ms per frame,
 * contaminating the benchmark's double-rAF "renderMs" measurement.
 */


export const TestHarness = () => {
  const eng = useEngineWorker();

  const [fasta, setFasta] = useState(SAMPLE_FASTA);
  const [searchQuery, setSearchQuery] = useState<string>('ATG');
  const [status, setStatus] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [meta, setMeta] = useState<Meta | null>(null);
  const [slice, setSlice] = useState<({ bytes: Uint8Array } & ViewportResult) | null>(null);
  const [sliceRows, setSliceRows] = useState<{ name: string; row: number; text: string }[]>([]);
  const [searchResult, setSearchResult] = useState<null | SearchResult>(null);
  const [includeRecordNames, setIncludeRecordNames] = useState(false);
  const [readingFrame, setReadingFrame] = useState<1 | 2 | 3>(1);
  const [aminoAcidRows, setAminoAcidRows] = useState<{ name: string; row: number; text: string }[]>([]);
  const [aminoAcidSlice, setAminoAcidSlice] = useState<({ bytes: Uint8Array } & ViewportResult) | null>(null);

  // Slice inputs
  const [r0, setR0] = useState('0');
  const [r1, setR1] = useState('2');
  const [c0, setC0] = useState('0');
  const [c1, setC1] = useState('11');

  // Edit inputs
  const [rowsCsv, setRowsCsv] = useState('0,1');
  const [col, setCol] = useState('3');
  const [base, setBase] = useState('G');
  // Move inputs
  const [moveRow, setMoveRow] = useState('0');
  const [moveColsCsv, setMoveColsCsv] = useState('2,3,4,5');

  const refreshMeta = useCallback(async () => {
    try {
      const m = await eng.meta();
      setMeta(m);
    } catch (e) {
      setErr(String(e));
    }
  }, [eng]);

  const load = useCallback(async () => {
    setErr('');
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

  const search = useCallback(async () => {
    setErr('');
    try {
      // One SearchResult per matrix (nucleotide, amino acid, record names) —
      // merge them into a single flat list for display. Each `Match` already
      // carries `is_nucleotide`/`is_amino_acid`/`is_record_name` flags so the
      // render below can still label which matrix each match came from.
      const results = await eng.search(searchQuery, includeRecordNames);
      setSearchResult(results);
      setStatus(`Found ${results.num_matches} match(es) for "${searchQuery}"`);
    } catch (e) {
      setErr(String(e));
    }
  }, [eng, searchQuery, includeRecordNames]);

  const fetchSlice = useCallback(async () => {
    setErr('');
    try {
      const res = await eng.viewport({
        endCol: Number(c1),
        endRow: Number(r1),
        startCol: Number(c0),
        startRow: Number(r0),
      });
      setSlice(res);
      // Decode rows for display.
      const out: { name: string; row: number; text: string }[] = [];
      for (let r = 0; r < res.rows; r++) {
        const absRow = res.startRow + r;
        const off = r * res.cols;
        const text = new TextDecoder().decode(res.bytes.subarray(off, off + res.cols));
        const name = await eng.name(absRow);
        out.push({ name, row: absRow, text });
      }
      setSliceRows(out);
      setStatus(`Fetched ${res.bytes.length} bytes (${res.rows}×${res.cols})`);
    } catch (e) {
      setErr(String(e));
    }
  }, [eng, r0, r1, c0, c1]);

  const translateToAminoAcids = useCallback(async () => {
    setErr('');
    try {
      const res = await eng.translate({
        endCol: Number(c1),
        endRow: Number(r1),
        readingFrame: readingFrame - 1, // UI is 1/2/3, engine expects 0/1/2
        startCol: Number(c0),
        startRow: Number(r0),
      });
      setAminoAcidSlice(res);
      const out: { name: string; row: number; text: string }[] = [];
      for (let r = 0; r < res.rows; r++) {
        const absRow = res.startRow + r;
        const off = r * res.cols;
        const text = new TextDecoder().decode(res.bytes.subarray(off, off + res.cols));
        const name = await eng.name(absRow);
        out.push({ name, row: absRow, text });
      }
      setAminoAcidRows(out);
      setStatus(`Translated ${out.length} row(s) using reading frame ${readingFrame}`);
    } catch (e) {
      setErr(e instanceof EngineStructuredError
        ? `${e.code}: ${e.message}${e.context ? ` (${JSON.stringify(e.context)})` : ''}`
        : String(e));
    }
  }, [eng, r0, r1, c0, c1, readingFrame]);

  const applyEdit = useCallback(
    async (op: 'delete' | 'deleteColumn' | 'insert' | 'mutate') => {
      setErr('');
      try {
        const colNum = Number(col);
        const rows = SeqEditorUtil.parseRows(rowsCsv);
        if (op === 'mutate') {
          await eng.mutate(rows, colNum, base);
        } else if (op === 'insert') {
          await eng.insert(rows, colNum);
        } else if (op === 'delete') {
          await eng.delete(rows, colNum);
        } else {
          await eng.deleteColumn(colNum);
        }
        setStatus(`${op} applied — refetch slice to verify`);
        await refreshMeta();
      } catch (e: unknown) {
        const msg = e instanceof EngineStructuredError
          ? `${e.message}${e.context ? ` (${JSON.stringify(e.context)})` : ''}`
          : String(e);
        setErr(msg);
      }
    },
    [eng, rowsCsv, col, base, refreshMeta],
  );

  const applyMove = useCallback(
    async (direction: 'Left' | 'Right') => {
      setErr('');
      try {
        const rowNum = Number(moveRow);
        const cols = SeqEditorUtil.parseRows(moveColsCsv);
        await eng.moveHorizontal(rowNum, cols, direction);
        setStatus(`Moved ${direction} — refetch slice to verify`);
        await refreshMeta();
      } catch (e: unknown) {
        const msg = e instanceof EngineStructuredError
          ? `${e.message}${e.context ? ` (${JSON.stringify(e.context)})` : ''}`
          : String(e);
        setErr(msg);
      }
    },
    [eng, moveRow, moveColsCsv, refreshMeta],
  );

  const applyReorder = useCallback(
    async (dir: 'down' | 'up') => {
      setErr('');
      try {
        const rows = SeqEditorUtil.parseRows(rowsCsv);
        if (dir === 'up') {
          await eng.moveRowsUp(rows);
        } else {
          await eng.moveRowsDown(rows);
        }
        setStatus(`Rows moved ${dir} — refetch slice to verify`);
        await refreshMeta();
      } catch (e: unknown) {
        const msg = e instanceof EngineStructuredError
          ? `${e.message}${e.context ? ` (${JSON.stringify(e.context)})` : ''}`
          : String(e);
        setErr(msg);
      }
    },
    [eng, rowsCsv, refreshMeta],
  );

  const doUndo = useCallback(async () => {
    setErr('');
    try {
      const ok = await eng.undo();
      setStatus(ok ? 'Undone' : 'Undo stack empty');
      await refreshMeta();
    } catch (e) {
      setErr(String(e));
    }
  }, [eng, refreshMeta]);

  const doRedo = useCallback(async () => {
    setErr('');
    try {
      const ok = await eng.redo();
      setStatus(ok ? 'Redone' : 'Redo stack empty');
      await refreshMeta();
    } catch (e) {
      setErr(String(e));
    }
  }, [eng, refreshMeta]);


  return (
    <Box>
      <AppBar position={'static'}>
        <Toolbar>
          <Typography
            sx={{ flexGrow: 1 }}
            variant={'h6'}
          >
            {'MSA Engine — Test Harness'}
          </Typography>
          <Chip
            color={eng.ready ? 'success' : 'warning'}
            label={eng.ready ? 'engine ready' : 'loading wasm…'}
            size={'small'}
          />
        </Toolbar>
      </AppBar>
      <Stack
        direction={'row'}
        spacing={2}
        sx={{ p: 2 }}
      >
        {/* ----------------------------- Controls ----------------------------- */}
        <Paper sx={{ p: 2, width: 380 }}>
          <Stack spacing={2}>
            <Typography variant={'subtitle2'}>
              {'Load FASTA'}
            </Typography>
            <TextField
              label={'FASTA'}
              minRows={5}
              multiline
              onChange={(e) => setFasta(e.target.value)}
              sx={{ fontFamily: 'monospace' }}
              value={fasta}
            />
            <Button
              disabled={!eng.ready}
              onClick={load}
              variant={'contained'}
            >
              {'Load'}
            </Button>
            <Divider />
            <Typography variant={'subtitle2'}>
              {'Search'}
            </Typography>
            <TextField
              label={'query'}
              onChange={(e) => setSearchQuery(e.target.value)}
              size={'small'}
              sx={{ flex: 1 }}
              value={searchQuery}
            />
            <FormControlLabel
              control={(
                <Checkbox
                  checked={includeRecordNames}
                  onChange={(e) => setIncludeRecordNames(e.target.checked)}
                />
              )}
              label={'Include record names in search'}
            />
            <Button
              disabled={!eng.ready}
              onClick={search}
              variant={'outlined'}
            >
              {'search'}
            </Button>
            {searchResult && (
              <Alert severity={searchResult.num_matches > 0 ? 'success' : 'info'}>
                {searchResult.num_matches}
                {' '}
                {'match(es) for "'}
                {searchResult.query}
                {'"'}
                {searchResult.num_matches > 0 && (
                  <Box
                    component={'ul'}
                    sx={{ m: 0, pl: 2 }}
                  >
                    {searchResult.positions.map((m, i) => (
                      <li key={i}>
                        {'['}
                        {m.matrix_type}
                        {'] row'}
                        {m.row}
                        {', col'}
                        {m.col}
                      </li>
                    ))}
                  </Box>
                )}
              </Alert>
            )}
            <Divider />
            <Typography variant={'subtitle2'}>
              {'Fetch slice'}
            </Typography>
            <Stack
              direction={'row'}
              spacing={1}
            >
              <TextField
                label={'r0'}
                onChange={(e) => setR0(e.target.value)}
                size={'small'}
                value={r0}
              />
              <TextField
                label={'r1'}
                onChange={(e) => setR1(e.target.value)}
                size={'small'}
                value={r1}
              />
              <TextField
                label={'c0'}
                onChange={(e) => setC0(e.target.value)}
                size={'small'}
                value={c0}
              />
              <TextField
                label={'c1'}
                onChange={(e) => setC1(e.target.value)}
                size={'small'}
                value={c1}
              />
            </Stack>
            <Button
              disabled={!eng.ready}
              onClick={fetchSlice}
              variant={'outlined'}
            >
              {'Fetch slice'}
            </Button>
            <Divider />
            <Typography variant={'subtitle2'}>
              {'Translate to Amino Acids'}
            </Typography>
            <TextField
              label={'reading frame'}
              onChange={(e) => setReadingFrame(Number(e.target.value) as 1 | 2 | 3)}
              select
              size={'small'}
              sx={{ flex: 1 }}
              value={readingFrame}
            >
              <MenuItem value={1}>
                {'1'}
              </MenuItem>
              <MenuItem value={2}>
                {'2'}
              </MenuItem>
              <MenuItem value={3}>
                {'3'}
              </MenuItem>
            </TextField>
            <Button
              disabled={!eng.ready}
              onClick={translateToAminoAcids}
              variant={'outlined'}
            >
              {'Translate to Amino Acids'}
            </Button>
            {aminoAcidRows.length > 0 && (
              <Box sx={{ fontFamily: 'monospace', fontSize: 13, overflowX: 'auto' }}>
                {aminoAcidRows.map((r) => (
                  <div key={r.row}>
                    {String(r.row).padStart(3, '0')}
                    {' '}
                    {r.name}
                    {': '}
                    {' '}
                    {r.text}
                  </div>
                ))}
              </Box>
            )}
            <Divider />
            <Typography variant={'subtitle2'}>
              {'Edit'}
            </Typography>
            <Stack
              direction={'row'}
              spacing={1}
            >
              <TextField
                label={'rows (csv)'}
                onChange={(e) => setRowsCsv(e.target.value)}
                size={'small'}
                sx={{ flex: 2 }}
                value={rowsCsv}
              />
              <TextField
                label={'col'}
                onChange={(e) => setCol(e.target.value)}
                size={'small'}
                sx={{ flex: 1 }}
                value={col}
              />
              <TextField
                label={'base (mutate only)'}
                onChange={(e) => setBase(e.target.value.slice(0, 1).toUpperCase())}
                size={'small'}
                sx={{ flex: 1 }}
                value={base}
              />
            </Stack>
            <Stack
              direction={'row'}
              spacing={1}
            >
              <Button
                color={'primary'}
                onClick={async () => applyEdit('mutate')}
                variant={'contained'}
              >
                {'Mutate'}
              </Button>
              <Button
                color={'secondary'}
                onClick={async () => applyEdit('insert')}
                variant={'contained'}
              >
                {"Insert '-'"}
              </Button>
              <Button
                color={'error'}
                onClick={async () => applyEdit('delete')}
                variant={'contained'}
              >
                {'Delete'}
              </Button>
            </Stack>
            <Button
              color={'error'}
              onClick={async () => applyEdit('deleteColumn')}
              variant={'outlined'}
            >
              {'Delete column (all rows)'}
            </Button>
            <Divider />
            <Typography variant={'subtitle2'}>
              {'Move horizontally (Rule 4)'}
            </Typography>
            <Stack
              direction={'row'}
              spacing={1}
            >
              <TextField
                label={'row'}
                onChange={(e) => setMoveRow(e.target.value)}
                size={'small'}
                sx={{ flex: 1 }}
                value={moveRow}
              />
              <TextField
                label={'cols (csv)'}
                onChange={(e) => setMoveColsCsv(e.target.value)}
                size={'small'}
                sx={{ flex: 2 }}
                value={moveColsCsv}
              />
            </Stack>
            <Stack
              direction={'row'}
              spacing={1}
            >
              <Button
                disabled={!eng.ready}
                onClick={async () => applyMove('Left')}
                variant={'outlined'}
              >
                {'← Move left'}
              </Button>
              <Button
                disabled={!eng.ready}
                onClick={async () => applyMove('Right')}
                variant={'outlined'}
              >
                {'Move right →'}
              </Button>
            </Stack>
            <Divider />
            <Typography variant={'subtitle2'}>
              {'Reorder rows (Rule 5)'}
            </Typography>
            <Stack
              direction={'row'}
              spacing={1}
            >
              <TextField
                label={'rows (csv)'}
                onChange={(e) => setRowsCsv(e.target.value)}
                size={'small'}
                sx={{ flex: 1 }}
                value={rowsCsv}
              />
            </Stack>
            <Stack
              direction={'row'}
              spacing={1}
            >
              <Button
                disabled={!eng.ready}
                onClick={async () => applyReorder('up')}
                variant={'outlined'}
              >
                {'↑ Move row(s) up'}
              </Button>
              <Button
                disabled={!eng.ready}
                onClick={async () => applyReorder('down')}
                variant={'outlined'}
              >
                {'Move row(s) down ↓'}
              </Button>
            </Stack>
            <Divider />
            <Stack
              direction={'row'}
              spacing={1}
            >
              <Button
                disabled={!eng.ready}
                onClick={doUndo}
                variant={'outlined'}
              >
                {'Undo'}
              </Button>
              <Button
                disabled={!eng.ready}
                onClick={doRedo}
                variant={'outlined'}
              >
                {'Redo'}
              </Button>
              <Button
                disabled={!eng.ready}
                onClick={refreshMeta}
                variant={'text'}
              >
                {'Refresh meta'}
              </Button>
            </Stack>
            {meta && (
              <Stack
                direction={'row'}
                spacing={1}
                sx={{
                  flexWrap: 'wrap',
                }}
              >
                <Chip
                  label={`seqs: ${meta.sequences}`}
                  size={'small'}
                />
                <Chip
                  label={`width: ${meta.width}`}
                  size={'small'}
                />
                <Chip
                  label={`undo: ${meta.undoDepth}`}
                  size={'small'}
                />
                <Chip
                  label={`redo: ${meta.redoDepth}`}
                  size={'small'}
                />
              </Stack>
            )}
            {err && (
              <Alert severity={'error'}>
                {err}
              </Alert>
            )}
            {status && !err && (
              <Alert severity={'info'}>
                {status}
              </Alert>
            )}
          </Stack>
        </Paper>
        {/* ----------------------------- Slice viewer ----------------------------- */}
        <Paper sx={{ flex: 1, minHeight: 400, p: 2 }}>
          <Typography
            gutterBottom
            variant={'subtitle2'}
          >
            {'Slice viewer'}
          </Typography>
          {slice ? (
            <SliceCanvas
              names={sliceRows.map((r) => r.name)}
              slice={slice}
            />
          ) : (
            <Alert severity={'info'}>
              {'Load FASTA and fetch a slice to see results.'}
            </Alert>
          )}
          {aminoAcidSlice && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography
                gutterBottom
                variant={'subtitle2'}
              >
                {'Amino acid translation (reading frame '}
                {readingFrame}
                {')'}
              </Typography>
              <SliceCanvas
                names={aminoAcidRows.map((r) => r.name)}
                slice={aminoAcidSlice}
              />
            </>
          )}
        </Paper>
      </Stack>
      {/* ----------------------------- Scrolling viewport ----------------------------- */}
      <Box sx={{ p: 2, pt: 0 }}>
        <Paper sx={{ p: 2 }}>
          <Typography
            gutterBottom
            variant={'subtitle2'}
          >
            {'Scrolling viewport (sliding window · overscan ±100 cols · trigger at 30 cols)'}
          </Typography>
          {meta ? (
            <ScrollingViewport
              eng={eng}
              meta={meta}
            />
          ) : (
            <Alert severity={'info'}>
              {'Load a FASTA to enable the scrolling viewport.'}
            </Alert>
          )}
        </Paper>
      </Box>
      {/* ----------------------------- Benchmark ----------------------------- */}
      <Box sx={{ p: 2, pt: 0 }}>
        <BenchmarkPanel eng={eng} />
      </Box>
    </Box>
  );
};
