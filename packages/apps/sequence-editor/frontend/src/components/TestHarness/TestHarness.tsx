import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ChangeEvent } from 'react';
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

import { ScrollingViewport } from '../ScrollingViewport';
import { SliceCanvas } from '../SliceCanvas';
import { SAMPLE_FASTA } from '../../constants';
import { SeqEditorUtil } from '../../utils/SeqEditorUtil';
import { createEngineWorker } from '../../workers';
import type {
  EngineMeta,
  EngineSearchResult,
  EngineViewportResult,
} from '../../models';

const formatError = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    const code = 'code' in error ? error.code : undefined;
    const message = 'message' in error ? error.message : undefined;
    if (typeof code === 'string' && typeof message === 'string') {
      return `${code}: ${message}`;
    }
  }
  return String(error);
};


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
  const engine = useMemo(() => createEngineWorker(), []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void engine
      .initialize()
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReady(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [engine]);

  const [fasta, setFasta] = useState(SAMPLE_FASTA);
  const [searchQuery, setSearchQuery] = useState<string>('ATG');
  const [status, setStatus] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [meta, setMeta] = useState<EngineMeta | null>(null);
  const [slice, setSlice] = useState<({ bytes: Uint8Array } & EngineViewportResult) | null>(null);
  const [sliceRows, setSliceRows] = useState<{ name: string; row: number; text: string }[]>([]);
  const [searchResult, setSearchResult] = useState<EngineSearchResult | null>(null);
  const [includeRecordNames, setIncludeRecordNames] = useState(false);
  const [readingFrame, setReadingFrame] = useState<1 | 2 | 3>(1);
  const [aminoAcidRows, setAminoAcidRows] = useState<{ name: string; row: number; text: string }[]>([]);
  const [aminoAcidSlice, setAminoAcidSlice] = useState<({ bytes: Uint8Array } & EngineViewportResult) | null>(null);

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
      const m = await engine.meta();
      setMeta(m);
    } catch (e) {
      setErr(String(e));
    }
  }, [engine]);

  const onClickLoad = useCallback(async () => {
    setErr('');
    try {
      const n = await engine.load(fasta);
      setStatus(`Loaded ${n} sequences`);
      await refreshMeta();
      setSlice(null);
      setSliceRows([]);
    } catch (e) {
      setErr(String(e));
    }
  }, [engine, fasta, refreshMeta]);

  const onClickSearch = useCallback(async () => {
    setErr('');
    try {
      // One SearchResult per matrix (nucleotide, amino acid, record names) —
      // merge them into a single flat list for display. Each `Match` already
      // carries `is_nucleotide`/`is_amino_acid`/`is_record_name` flags so the
      // render below can still label which matrix each match came from.
      const results = await engine.search(searchQuery, includeRecordNames);
      setSearchResult(results);
      setStatus(`Found ${results.num_matches} match(es) for "${searchQuery}"`);
    } catch (e) {
      setErr(String(e));
    }
  }, [engine, searchQuery, includeRecordNames]);

  const onClickFetchSlice = useCallback(async () => {
    setErr('');
    try {
      const res = await engine.viewport({
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
        const name = await engine.name(absRow);
        out.push({ name, row: absRow, text });
      }
      setSliceRows(out);
      setStatus(`Fetched ${res.bytes.length} bytes (${res.rows}×${res.cols})`);
    } catch (e) {
      setErr(String(e));
    }
  }, [engine, r0, r1, c0, c1]);

  const onClickTranslateToAminoAcids = useCallback(async () => {
    setErr('');
    try {
      const res = await engine.translate({
        endCol: Number(c1),
        endRow: Number(r1),
        startCol: Number(c0),
        startRow: Number(r0),
      }, readingFrame - 1); // UI is 1/2/3, engine expects 0/1/2
      setAminoAcidSlice(res);
      const out: { name: string; row: number; text: string }[] = [];
      for (let r = 0; r < res.rows; r++) {
        const absRow = res.startRow + r;
        const off = r * res.cols;
        const text = new TextDecoder().decode(res.bytes.subarray(off, off + res.cols));
        const name = await engine.name(absRow);
        out.push({ name, row: absRow, text });
      }
      setAminoAcidRows(out);
      setStatus(`Translated ${out.length} row(s) using reading frame ${readingFrame}`);
    } catch (e) {
      setErr(String(e));
    }
  }, [engine, r0, r1, c0, c1, readingFrame]);

  const applyEdit = useCallback(
    async (op: 'delete' | 'deleteColumn' | 'insert' | 'mutate') => {
      setErr('');
      try {
        const colNum = Number(col);
        const rows = SeqEditorUtil.parseRows(rowsCsv);
        if (op === 'mutate') {
          await engine.mutate(rows, colNum, base);
        } else if (op === 'insert') {
          await engine.insert(rows, colNum);
        } else if (op === 'delete') {
          await engine.delete(rows, colNum);
        } else {
          await engine.deleteColumn(colNum);
        }
        setStatus(`${op} applied — refetch slice to verify`);
        await refreshMeta();
      } catch (e) {
        setErr(formatError(e));
      }
    },
    [engine, rowsCsv, col, base, refreshMeta],
  );

  const applyMove = useCallback(
    async (direction: 'Left' | 'Right') => {
      setErr('');
      try {
        const rowNum = Number(moveRow);
        const cols = SeqEditorUtil.parseRows(moveColsCsv);
        await engine.moveHorizontal(rowNum, cols, direction);
        setStatus(`Moved ${direction} — refetch slice to verify`);
        await refreshMeta();
      } catch (e) {
        setErr(formatError(e));
      }
    },
    [engine, moveRow, moveColsCsv, refreshMeta],
  );

  const applyReorder = useCallback(
    async (dir: 'down' | 'up') => {
      setErr('');
      try {
        const rows = SeqEditorUtil.parseRows(rowsCsv);
        if (dir === 'up') {
          await engine.moveRowsUp(rows);
        } else {
          await engine.moveRowsDown(rows);
        }
        setStatus(`Rows moved ${dir} — refetch slice to verify`);
        await refreshMeta();
      } catch (e) {
        setErr(formatError(e));
      }
    },
    [engine, rowsCsv, refreshMeta],
  );

  const onClickUndo = useCallback(async () => {
    setErr('');
    try {
      const ok = await engine.undo();
      setStatus(ok ? 'Undone' : 'Undo stack empty');
      await refreshMeta();
    } catch (e) {
      setErr(String(e));
    }
  }, [engine, refreshMeta]);

  const onClickRedo = useCallback(async () => {
    setErr('');
    try {
      const ok = await engine.redo();
      setStatus(ok ? 'Redone' : 'Redo stack empty');
      await refreshMeta();
    } catch (e) {
      setErr(String(e));
    }
  }, [engine, refreshMeta]);

  const onChangeFasta = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFasta(event.target.value);
  }, []);
  const onChangeSearchQuery = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);
  const onChangeIncludeRecordNames = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setIncludeRecordNames(event.target.checked);
  }, []);
  const onChangeR0 = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setR0(event.target.value);
  }, []);
  const onChangeR1 = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setR1(event.target.value);
  }, []);
  const onChangeC0 = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setC0(event.target.value);
  }, []);
  const onChangeC1 = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setC1(event.target.value);
  }, []);
  const onChangeReadingFrame = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setReadingFrame(Number(event.target.value) as 1 | 2 | 3);
  }, []);
  const onChangeRowsCsv = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setRowsCsv(event.target.value);
  }, []);
  const onChangeCol = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setCol(event.target.value);
  }, []);
  const onChangeBase = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setBase(event.target.value.slice(0, 1).toUpperCase());
  }, []);
  const onChangeMoveRow = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setMoveRow(event.target.value);
  }, []);
  const onChangeMoveColsCsv = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setMoveColsCsv(event.target.value);
  }, []);
  const onClickApplyMutate = useCallback(() => {
    void applyEdit('mutate');
  }, [applyEdit]);
  const onClickApplyInsert = useCallback(() => {
    void applyEdit('insert');
  }, [applyEdit]);
  const onClickApplyDelete = useCallback(() => {
    void applyEdit('delete');
  }, [applyEdit]);
  const onClickApplyDeleteColumn = useCallback(() => {
    void applyEdit('deleteColumn');
  }, [applyEdit]);
  const onClickMoveLeft = useCallback(() => {
    void applyMove('Left');
  }, [applyMove]);
  const onClickMoveRight = useCallback(() => {
    void applyMove('Right');
  }, [applyMove]);
  const onClickMoveUp = useCallback(() => {
    void applyReorder('up');
  }, [applyReorder]);
  const onClickMoveDown = useCallback(() => {
    void applyReorder('down');
  }, [applyReorder]);
  const onClickRefreshMeta = useCallback(() => {
    void refreshMeta();
  }, [refreshMeta]);


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
            color={ready ? 'success' : 'warning'}
            label={ready ? 'engine ready' : 'loading wasm…'}
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
              onChange={onChangeFasta}
              sx={{ fontFamily: 'monospace' }}
              value={fasta}
            />
            <Button
              disabled={!ready}
              onClick={onClickLoad}
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
              onChange={onChangeSearchQuery}
              size={'small'}
              sx={{ flex: 1 }}
              value={searchQuery}
            />
            <FormControlLabel
              control={(
                <Checkbox
                  checked={includeRecordNames}
                  onChange={onChangeIncludeRecordNames}
                />
              )}
              label={'Include record names in search'}
            />
            <Button
              disabled={!ready}
              onClick={onClickSearch}
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
                    {searchResult.positions.map((m) => (
                      <li key={`${m.matrix_type}-${m.row}-${m.col}`}>
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
                onChange={onChangeR0}
                size={'small'}
                value={r0}
              />
              <TextField
                label={'r1'}
                onChange={onChangeR1}
                size={'small'}
                value={r1}
              />
              <TextField
                label={'c0'}
                onChange={onChangeC0}
                size={'small'}
                value={c0}
              />
              <TextField
                label={'c1'}
                onChange={onChangeC1}
                size={'small'}
                value={c1}
              />
            </Stack>
            <Button
              disabled={!ready}
              onClick={onClickFetchSlice}
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
              onChange={onChangeReadingFrame}
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
              disabled={!ready}
              onClick={onClickTranslateToAminoAcids}
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
                onChange={onChangeRowsCsv}
                size={'small'}
                sx={{ flex: 2 }}
                value={rowsCsv}
              />
              <TextField
                label={'col'}
                onChange={onChangeCol}
                size={'small'}
                sx={{ flex: 1 }}
                value={col}
              />
              <TextField
                label={'base (mutate only)'}
                onChange={onChangeBase}
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
                onClick={onClickApplyMutate}
                variant={'contained'}
              >
                {'Mutate'}
              </Button>
              <Button
                color={'secondary'}
                onClick={onClickApplyInsert}
                variant={'contained'}
              >
                {"Insert '-'"}
              </Button>
              <Button
                color={'error'}
                onClick={onClickApplyDelete}
                variant={'contained'}
              >
                {'Delete'}
              </Button>
            </Stack>
            <Button
              color={'error'}
              onClick={onClickApplyDeleteColumn}
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
                onChange={onChangeMoveRow}
                size={'small'}
                sx={{ flex: 1 }}
                value={moveRow}
              />
              <TextField
                label={'cols (csv)'}
                onChange={onChangeMoveColsCsv}
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
                disabled={!ready}
                onClick={onClickMoveLeft}
                variant={'outlined'}
              >
                {'← Move left'}
              </Button>
              <Button
                disabled={!ready}
                onClick={onClickMoveRight}
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
                onChange={onChangeRowsCsv}
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
                disabled={!ready}
                onClick={onClickMoveUp}
                variant={'outlined'}
              >
                {'↑ Move row(s) up'}
              </Button>
              <Button
                disabled={!ready}
                onClick={onClickMoveDown}
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
                disabled={!ready}
                onClick={onClickUndo}
                variant={'outlined'}
              >
                {'Undo'}
              </Button>
              <Button
                disabled={!ready}
                onClick={onClickRedo}
                variant={'outlined'}
              >
                {'Redo'}
              </Button>
              <Button
                disabled={!ready}
                onClick={onClickRefreshMeta}
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
              engine={engine}
              meta={meta}
              ready={ready}
            />
          ) : (
            <Alert severity={'info'}>
              {'Load a FASTA to enable the scrolling viewport.'}
            </Alert>
          )}
        </Paper>
      </Box>
    </Box>
  );
};
