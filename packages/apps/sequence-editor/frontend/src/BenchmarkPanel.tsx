import {
  useCallback,
  useState,
} from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import type {
  BenchmarkPanelProps,
  Sample,
  Stats,
} from './models';
import { SeqEditorUtil } from './utils/SeqEditorUtil';


/**
 * Benchmark panel.
 *
 * Measures the full call→paint latency for viewport fetches:
 *   1. `eng.viewport(...)` is called; the hook records `sentTs`.
 *   2. The worker processes and responds; the hook records `receivedTs` and
 *      reports `engineMs` / `workerMs`.
 *   3. After the promise resolves, we wait for the next `requestAnimationFrame`
 *      to measure when the browser actually paints — this is the `renderMs`.
 *
 * The "total to paint" = totalMs (call→response) + renderMs (response→paint).
 *
 * Running N iterations gives a statistical distribution so you can see whether
 * the latency is dominated by the Rust engine, the postMessage bridge, or the
 * React render.
 */
export const BenchmarkPanel = ({ eng }: BenchmarkPanelProps) => {
  const [iterations, setIterations] = useState('100');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [lastSingle, setLastSingle] = useState<null | Sample>(null);

  // Slice to benchmark — defaults to the full sample alignment.
  const [r0, setR0] = useState('0');
  const [r1, setR1] = useState('2');
  const [c0, setC0] = useState('0');
  const [c1, setC1] = useState('11');

  /**
   * Fetch a viewport slice and measure the full call→paint latency.
   * Returns a Sample, or null if the fetch failed.
   *
   * `renderMs` is measured by awaiting a `requestAnimationFrame` callback
   * *after* the promise resolves. This captures the time from "data ready" to
   * "browser painted", which includes React's commit phase and the compositor.
   */
  const measureOnce = useCallback(async (): Promise<null | Sample> => {
    const sentTs = performance.now();
    let res;
    try {
      res = await eng.viewport({
        endCol: Number(c1),
        endRow: Number(r1),
        startCol: Number(c0),
        startRow: Number(r0),
      });
    } catch {
      return null;
    }
    const receivedTs = performance.now();
    const totalMs = receivedTs - sentTs;

    // Wait for the browser to paint. The double-rAF ensures we measure the
    // frame *after* the state update commits, not the current one.
    const renderMs = await new Promise<number>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve(performance.now() - receivedTs);
        });
      });
    });

    // Read the worker-reported sub-timings from the synchronous ref (state
    // may not have flushed within the same microtask).
    const t = eng.lastTimingRef.current;
    const engineMs = t?.engineMs ?? 0;
    const workerMs = t?.workerMs ?? 0;
    const bridgeOutMs = t?.bridgeOutMs ?? 0;
    const bridgeBackMs = Math.max(0, totalMs - workerMs);

    // Touch the bytes so V8 can't optimize away the transfer.
    let _ = 0;
    const byteLen = res.bytes ? res.bytes.length : 0;
    for (let i = 0; i < byteLen; i++) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _ += res.bytes[i];
    }

    return {
      bridgeBackMs,
      bridgeOutMs,
      bytes: byteLen,
      engineMs,
      renderMs,
      totalMs,
    };
  }, [eng, r0, r1, c0, c1]);

  const runBenchmark = useCallback(async () => {
    setRunning(true);
    setProgress(0);
    setSamples([]);
    setLastSingle(null);

    const n = Math.max(1, Math.min(10000, Number(iterations) || 100));
    const collected: Sample[] = [];

    // Warmup: one untimed fetch to prime JIT and caches.
    await measureOnce();

    // Throttle progress updates: updating React state on every iteration
    // causes 500 re-renders, and if the slice viewer has a large DOM (e.g.
    // 40×500 = 20K spans), each re-render forces the compositor to repaint,
    // inflating the double-rAF "renderMs" measurement to 100ms+. Updating
    // every ~50ms keeps the progress bar responsive without distorting timing.
    const PROGRESS_INTERVAL_MS = 50;
    let lastProgressTs = performance.now();

    for (let i = 0; i < n; i++) {
      const s = await measureOnce();
      if (s) {
        collected.push(s);
      }
      const now = performance.now();
      if (now - lastProgressTs >= PROGRESS_INTERVAL_MS || i === n - 1) {
        setProgress(((i + 1) / n) * 100);
        if (s) {
          setLastSingle(s);
        }
        lastProgressTs = now;
        // Yield to the event loop so the UI stays responsive and the progress
        // bar can repaint.
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    setSamples(collected);
    setRunning(false);
  }, [iterations, measureOnce]);

  // Compute stats for each phase.
  const stats = {
    bridgeBack: SeqEditorUtil.computeStats(samples.map((s) => s.bridgeBackMs)),
    bridgeOut: SeqEditorUtil.computeStats(samples.map((s) => s.bridgeOutMs)),
    engine: SeqEditorUtil.computeStats(samples.map((s) => s.engineMs)),
    render: SeqEditorUtil.computeStats(samples.map((s) => s.renderMs)),
    toPaint: SeqEditorUtil.computeStats(samples.map((s) => s.totalMs + s.renderMs)),
    total: SeqEditorUtil.computeStats(samples.map((s) => s.totalMs)),
  };

  const rows: { color: string; label: string; stats: Stats }[] = [
    { color: '#1565c0', label: 'Bridge out (main→worker)', stats: stats.bridgeOut },
    { color: '#2e7d32', label: 'Engine (Rust update_viewport)', stats: stats.engine },
    { color: '#ef6c00', label: 'Bridge back (worker→main)', stats: stats.bridgeBack },
    { color: '#6a1b9a', label: 'Render (response→paint)', stats: stats.render },
    { color: '#000', label: 'Total call→response', stats: stats.total },
    { color: '#c62828', label: 'Total call→paint', stats: stats.toPaint },
  ];

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant={'subtitle2'}>
          {'Benchmark — call→paint latency breakdown'}
        </Typography>
        <Typography
          color={'text.secondary'}
          variant={'body2'}
        >
          {'Measures the full round-trip of a viewport fetch: postMessage to the'}
          {'worker, the Rust '}
          <code>
            {'update_viewport'}
          </code>
          {' '}
          {'call, the transfer back,'}
          {'and the time until the browser paints. Run N iterations for a'}
          {'statistical distribution.'}
        </Typography>
        <Stack
          direction={'row'}
          spacing={1}
          sx={{ alignItems: 'center' }}
        >
          <TextField
            label={'iterations'}
            onChange={(e) => setIterations(e.target.value)}
            size={'small'}
            sx={{ width: 120 }}
            value={iterations}
          />
          <TextField
            label={'r0'}
            onChange={(e) => setR0(e.target.value)}
            size={'small'}
            sx={{ width: 70 }}
            value={r0}
          />
          <TextField
            label={'r1'}
            onChange={(e) => setR1(e.target.value)}
            size={'small'}
            sx={{ width: 70 }}
            value={r1}
          />
          <TextField
            label={'c0'}
            onChange={(e) => setC0(e.target.value)}
            size={'small'}
            sx={{ width: 70 }}
            value={c0}
          />
          <TextField
            label={'c1'}
            onChange={(e) => setC1(e.target.value)}
            size={'small'}
            sx={{ width: 70 }}
            value={c1}
          />
          <Button
            disabled={running || !eng.ready}
            onClick={runBenchmark}
            variant={'contained'}
          >
            {running ? 'Running…' : 'Run benchmark'}
          </Button>
        </Stack>
        {running && (
          <Box>
            <LinearProgress
              value={progress}
              variant={'determinate'}
            />
            <Typography
              color={'text.secondary'}
              variant={'caption'}
            >
              {Math.round(progress)}
              {'% — last sample:'}
              {lastSingle ? `${SeqEditorUtil.fmt(lastSingle.totalMs)} ms total, ${SeqEditorUtil.fmt(lastSingle.engineMs)} ms engine` : '…'}
            </Typography>
          </Box>
        )}
        {lastSingle && !running && samples.length === 0 && (
          <Alert severity={'info'}>
            {'Last single fetch: '}
            {SeqEditorUtil.fmt(lastSingle.totalMs)}
            {' '}
            {'ms call→response,'}
            {' '}
            {SeqEditorUtil.fmt(lastSingle.engineMs)}
            {' '}
            {'ms engine,'}
            {SeqEditorUtil.fmt(lastSingle.renderMs)}
            {' '}
            {'ms render,'}
            {' '}
            {lastSingle.bytes}
            {' '}
            {'bytes'}
          </Alert>
        )}
        {samples.length > 0 && (
          <>
            <Stack
              direction={'row'}
              spacing={1}
              sx={{ flexWrap: 'wrap' }}
            >
              <Chip
                label={`samples: ${samples.length}`}
                size={'small'}
              />
              <Chip
                label={`bytes/slice: ${samples[0].bytes}`}
                size={'small'}
              />
            </Stack>
            <TableContainer component={Box}>
              <Table size={'small'}>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      {'Phase'}
                    </TableCell>
                    <TableCell align={'right'}>
                      {'min'}
                    </TableCell>
                    <TableCell align={'right'}>
                      {'median'}
                    </TableCell>
                    <TableCell align={'right'}>
                      {'mean'}
                    </TableCell>
                    <TableCell align={'right'}>
                      {'p95'}
                    </TableCell>
                    <TableCell align={'right'}>
                      {'max'}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.label}>
                      <TableCell sx={{ color: r.color, fontWeight: r.label.startsWith('Total') ? 'bold' : 'normal' }}>
                        {r.label}
                      </TableCell>
                      <TableCell align={'right'}>
                        {SeqEditorUtil.fmt(r.stats.min)}
                      </TableCell>
                      <TableCell align={'right'}>
                        {SeqEditorUtil.fmt(r.stats.median)}
                      </TableCell>
                      <TableCell align={'right'}>
                        {SeqEditorUtil.fmt(r.stats.mean)}
                      </TableCell>
                      <TableCell align={'right'}>
                        {SeqEditorUtil.fmt(r.stats.p95)}
                      </TableCell>
                      <TableCell align={'right'}>
                        {SeqEditorUtil.fmt(r.stats.max)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography
              color={'text.secondary'}
              variant={'caption'}
            >
              {'All values in milliseconds. "Bridge out/back" are approximated:'}
              {'bridge out ≈ workerMs − engineMs; bridge back ≈ totalMs − workerMs.'}
              {'Render is measured via double-rAF after the promise resolves.'}
            </Typography>
          </>
        )}
      </Stack>
    </Paper>
  );
};
