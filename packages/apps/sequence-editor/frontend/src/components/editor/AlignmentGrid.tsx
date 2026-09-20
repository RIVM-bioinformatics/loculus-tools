import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  KeyboardEvent,
  PointerEvent,
} from 'react';
import {
  Box,
  LinearProgress,
} from '@mui/material';

import { MatrixType } from '../../engine/protocol';
import type {
  Meta,
  SearchResult,
  ViewportResult,
} from '../../engine/protocol';
import type { EngineClient } from '../../engine/useEngineWorker';
import type {
  ActiveCell,
  PaletteModel,
  SelectionBlock,
} from '../../models';
import {
  DEFAULT_GRID_GEOMETRY,
  getVisibleGridRange,
  hitTestGridPoint,
  rangeContains,
  scrollPositionForCell,
} from '../../utils/grid';
import type { GridRange } from '../../utils/grid';
import {
  isEditorKeyTarget,
  keyToEditorCommand,
} from '../../utils/keyboard';
import {
  rowSelectionForClick,
  rowsForBlock,
  selectionBlockForRange,
} from '../../utils/selection';
import { paletteEntryFor } from '../../utils/palette';

interface AlignmentGridProps {
  activeCell: ActiveCell;
  busy: boolean;
  cellFocused: boolean;
  currentHit: number;
  dataRevision: number;
  datasetRevision: number;
  eng: EngineClient;
  meta: Meta;
  onActiveCell: (cell: ActiveCell) => void;
  onCellFocused: (focused: boolean) => void;
  onExecuteCommand: (command: ReturnType<typeof keyToEditorCommand> extends infer T ? Exclude<T, null> : never) => Promise<void>;
  onSelectedRows: (rows: number[]) => void;
  onSelectionAnchorRow: (row: null | number) => void;
  onSelectionBlock: (block: null | SelectionBlock) => void;
  palette: PaletteModel;
  searchResults: null | SearchResult;
  selectedRows: number[];
  selectionAnchorRow: null | number;
  selectionBlock: null | SelectionBlock;
}

interface DragState {
  startCol: number;
  startRow: number;
}

interface GridCache extends ViewportResult {
  bytes: Uint8Array;
  endCol: number;
  endRow: number;
  revision: number;
  startCol: number;
  startRow: number;
}

interface QueuedViewport {
  range: GridRange;
  revision: number;
}

const GRID_GEOMETRY = DEFAULT_GRID_GEOMETRY;
const OVERSCAN_COLS = 128;
const OVERSCAN_ROWS = 16;

const commandFromKey = (event: KeyboardEvent<HTMLDivElement>) => keyToEditorCommand(event);

const getByte = (cache: GridCache | null, row: number, col: number): null | number => {
  if (!cache || row < cache.startRow || row >= cache.endRow || col < cache.startCol || col >= cache.endCol) {
    return null;
  }
  return cache.bytes[(row - cache.startRow) * cache.cols + col - cache.startCol] ?? null;
};

export const AlignmentGrid = ({
  activeCell,
  busy,
  cellFocused,
  currentHit,
  dataRevision,
  datasetRevision,
  eng,
  meta,
  onActiveCell,
  onCellFocused,
  onExecuteCommand,
  onSelectedRows,
  onSelectionAnchorRow,
  onSelectionBlock,
  palette,
  searchResults,
  selectedRows,
  selectionAnchorRow,
  selectionBlock,
}: AlignmentGridProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<GridCache | null>(null);
  const baseCacheRef = useRef<GridCache | null>(null);
  const basePaletteRef = useRef<null | PaletteModel>(null);
  const baseRenderKeyRef = useRef<null | string>(null);
  const namesRef = useRef<Map<number, string>>(new Map());
  const requestTokenRef = useRef(0);
  const nameTokenRef = useRef(0);
  const fetchingRef = useRef(false);
  const queuedViewportRef = useRef<null | QueuedViewport>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<{ startLabelWidth: number; startX: number } | null>(null);
  const scrollFrameRef = useRef<null | number>(null);
  const [containerSize, setContainerSize] = useState({ height: 480, width: 900 });
  const [labelWidth, setLabelWidth] = useState(DEFAULT_GRID_GEOMETRY.labelWidth);
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [scrollbarSize, setScrollbarSize] = useState(0);
  const [renderVersion, setRenderVersion] = useState(0);
  const [viewportRequestVersion, setViewportRequestVersion] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [activeBase, setActiveBase] = useState<null | number>(null);
  const gridGeometry = useMemo(() => ({ ...GRID_GEOMETRY, labelWidth }), [labelWidth]);
  const searchHitCells = useMemo(() => {
    const cells = new Map<number, number>();
    if (!searchResults) {
      return cells;
    }
    const span = Math.max(1, searchResults.query.length);
    searchResults.positions.forEach((position, index) => {
      if (position.matrix_type !== MatrixType.Nucleotide) {
        return;
      }
      for (let offset = 0; offset < span; offset += 1) {
        cells.set(position.row * meta.width + position.col + offset, index);
      }
    });
    return cells;
  }, [meta.width, searchResults]);
  const searchScrollTarget = useMemo<ActiveCell | null>(() => {
    const hit = searchResults?.positions[currentHit];
    if (hit?.matrix_type !== MatrixType.Nucleotide) {
      return null;
    }
    const lastHitColumn = hit.col + Math.max(1, searchResults?.query.length ?? 1) - 1;
    return {
      col: Math.min(Math.max(0, meta.width - 1), lastHitColumn + 10),
      row: hit.row,
    };
  }, [currentHit, meta.width, searchResults]);
  const viewport = eng.viewport;
  const fetchName = eng.name;
  const ready = eng.ready;

  const visibleRanges = useMemo(() => getVisibleGridRange(
    scroll.left,
    scroll.top,
    containerSize.width,
    containerSize.height,
    meta.sequences,
    meta.width,
    gridGeometry,
    OVERSCAN_ROWS,
    OVERSCAN_COLS,
  ), [containerSize.height, containerSize.width, gridGeometry, meta.width, meta.sequences, scroll.left, scroll.top]);

  const requestViewport = useCallback(async (range: GridRange, revision: number) => {
    if (range.startRow >= range.endRow || range.startCol >= range.endCol) {
      return;
    }
    if (fetchingRef.current) {
      queuedViewportRef.current = { range, revision };
      return;
    }
    fetchingRef.current = true;
    setFetching(true);
    const token = ++requestTokenRef.current;
    try {
      const result = await viewport({
        endCol: range.endCol - 1,
        endRow: range.endRow - 1,
        startCol: range.startCol,
        startRow: range.startRow,
      });
      if (token !== requestTokenRef.current) {
        return;
      }
      cacheRef.current = {
        ...result,
        bytes: result.bytes,
        endCol: result.startCol + result.cols,
        endRow: result.startRow + result.rows,
        revision,
        startCol: result.startCol,
        startRow: result.startRow,
      };
      setRenderVersion((version) => version + 1);
    } catch {
      if (token === requestTokenRef.current) {
        cacheRef.current = null;
        setRenderVersion((version) => version + 1);
      }
    } finally {
      fetchingRef.current = false;
      const queuedViewport = queuedViewportRef.current;
      queuedViewportRef.current = null;
      if (queuedViewport) {
        setViewportRequestVersion((version) => version + 1);
      } else {
        setFetching(false);
      }
    }
  }, [viewport]);

  useEffect(() => {
    requestTokenRef.current += 1;
  }, [dataRevision, meta.sequences, meta.width]);

  useEffect(() => {
    cacheRef.current = null;
    baseCacheRef.current = null;
    baseRenderKeyRef.current = null;
    basePaletteRef.current = null;
    namesRef.current.clear();
    requestTokenRef.current += 1;
    nameTokenRef.current += 1;
    fetchingRef.current = false;
    setFetching(false);
    setRenderVersion((version) => version + 1);
  }, [datasetRevision]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollLeft = 0;
      scroller.scrollTop = 0;
      setScroll({ left: 0, top: 0 });
    }
  }, [datasetRevision]);

  useEffect(() => {
    if (!ready || meta.sequences === 0 || meta.width === 0) {
      return;
    }
    const cache = cacheRef.current;
    if (cache?.revision === dataRevision && rangeContains(cache, visibleRanges.cache)) {
      return;
    }
    void requestViewport(visibleRanges.cache, dataRevision);
  }, [
    dataRevision,
    ready,
    meta.sequences,
    meta.width,
    renderVersion,
    viewportRequestVersion,
    requestViewport,
    visibleRanges,
  ]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      setContainerSize({
        height: Math.max(1, entry.contentRect.height),
        width: Math.max(1, entry.contentRect.width),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const measureScrollbar = () => {
      const size = Math.max(0, scroller.offsetHeight - scroller.clientHeight);
      setScrollbarSize((current) => current === size ? current : size);
    };
    measureScrollbar();
    const observer = new ResizeObserver(measureScrollbar);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready || meta.sequences === 0) {
      return;
    }
    const token = ++nameTokenRef.current;
    const rows = Array.from(
      { length: visibleRanges.cache.endRow - visibleRanges.cache.startRow },
      (_, index) => visibleRanges.cache.startRow + index,
    ).filter((row) => !namesRef.current.has(row));
    if (rows.length === 0) {
      return;
    }
    void Promise.all(rows.map(async (row) => [row, await fetchName(row)] as const)).then((names) => {
      if (token !== nameTokenRef.current) {
        return;
      }
      names.forEach(([row, recordName]) => namesRef.current.set(row, recordName));
      setRenderVersion((version) => version + 1);
    }).catch(() => undefined);
  }, [dataRevision, fetchName, meta.sequences, ready, visibleRanges.cache.endRow, visibleRanges.cache.startRow]);

  const scrollCellIntoView = useCallback((cell: ActiveCell) => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const next = scrollPositionForCell(cell, scroller.scrollLeft, scroller.scrollTop, scroller.clientWidth, scroller.clientHeight, gridGeometry);
    if (next.left !== scroller.scrollLeft || next.top !== scroller.scrollTop) {
      scroller.scrollLeft = next.left;
      scroller.scrollTop = next.top;
      setScroll(next);
    }
  }, [gridGeometry]);

  useEffect(() => {
    if (cellFocused) {
      scrollCellIntoView(activeCell);
    }
  }, [activeCell, cellFocused, scrollCellIntoView]);

  useEffect(() => {
    if (cellFocused && searchScrollTarget) {
      scrollCellIntoView(searchScrollTarget);
    }
  }, [cellFocused, scrollCellIntoView, searchScrollTarget]);

  useEffect(() => {
    setActiveBase(getByte(cacheRef.current, activeCell.row, activeCell.col));
  }, [activeCell.col, activeCell.row, renderVersion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    const overlayCanvas = overlayCanvasRef.current;
    const overlayContext = overlayCanvas?.getContext('2d');
    if (!context || !overlayCanvas || !overlayContext) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const cache = cacheRef.current;
    const visible = visibleRanges.visible;
    const baseLayoutKey = [
      containerSize.height,
      containerSize.width,
      labelWidth,
      scroll.left,
      scroll.top,
    ].join('|');

    const drawBaseCell = (row: number, col: number, byte: null | number) => {
      const x = labelWidth + col * GRID_GEOMETRY.cellWidth - scroll.left;
      const y = GRID_GEOMETRY.rulerHeight + row * GRID_GEOMETRY.cellHeight - scroll.top;
      const character = byte === null ? '' : String.fromCharCode(byte);
      const colors = paletteEntryFor(palette, character);
      let cellBackground = colors.background;
      if (byte === null) {
        cellBackground = '#e9eef2';
      } else if (character === ' ') {
        cellBackground = '#f7f8f9';
      }
      context.fillStyle = cellBackground;
      context.fillRect(x, y, GRID_GEOMETRY.cellWidth, GRID_GEOMETRY.cellHeight);
      if (character && character !== ' ') {
        context.fillStyle = colors.foreground;
        context.fillText(character, x + 3, y + GRID_GEOMETRY.cellHeight / 2);
      }
    };

    const baseLayoutChanged = baseRenderKeyRef.current !== baseLayoutKey || basePaletteRef.current !== palette;
    const baseCacheChanged = baseCacheRef.current !== cache;
    if (baseLayoutChanged) {
      canvas.width = Math.max(1, Math.floor(containerSize.width * dpr));
      canvas.height = Math.max(1, Math.floor(containerSize.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, containerSize.width, containerSize.height);

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, containerSize.width, containerSize.height);
      context.font = '14px monospace';
      context.textBaseline = 'middle';

      for (let row = visible.startRow; row < visible.endRow; row += 1) {
        for (let col = visible.startCol; col < visible.endCol; col += 1) {
          drawBaseCell(row, col, getByte(cache, row, col));
        }
      }
    } else if (baseCacheChanged) {
      context.font = '14px monospace';
      context.textBaseline = 'middle';
      for (let row = visible.startRow; row < visible.endRow; row += 1) {
        for (let col = visible.startCol; col < visible.endCol; col += 1) {
          const previousByte = getByte(baseCacheRef.current, row, col);
          const nextByte = getByte(cache, row, col);
          if (previousByte !== nextByte) {
            drawBaseCell(row, col, nextByte);
          }
        }
      }
    }

    if (baseLayoutChanged || baseCacheChanged) {
      baseRenderKeyRef.current = baseLayoutKey;
      baseCacheRef.current = cache;
      basePaletteRef.current = palette;
    }

    const selected = new Set(selectedRows);
    const blockStart = selectionBlock ? Math.min(selectionBlock.startCol, selectionBlock.endCol) : -1;
    const blockEnd = selectionBlock ? Math.max(selectionBlock.startCol, selectionBlock.endCol) : -1;
    const blockStartRow = selectionBlock?.startRow ?? activeCell.row;
    const blockEndRow = selectionBlock?.endRow ?? activeCell.row;

    overlayCanvas.width = Math.max(1, Math.floor(containerSize.width * dpr));
    overlayCanvas.height = Math.max(1, Math.floor(containerSize.height * dpr));
    overlayContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    overlayContext.clearRect(0, 0, containerSize.width, containerSize.height);

    overlayContext.fillStyle = '#edf2f6';
    overlayContext.fillRect(0, 0, containerSize.width, GRID_GEOMETRY.rulerHeight);
    overlayContext.fillStyle = '#f8fafb';
    const gutterHeight = Math.max(GRID_GEOMETRY.rulerHeight, containerSize.height - scrollbarSize);
    overlayContext.fillRect(0, GRID_GEOMETRY.rulerHeight, labelWidth, gutterHeight - GRID_GEOMETRY.rulerHeight);
    overlayContext.font = '14px monospace';
    overlayContext.textBaseline = 'middle';
    overlayContext.save();
    overlayContext.beginPath();
    overlayContext.rect(0, GRID_GEOMETRY.rulerHeight, labelWidth, gutterHeight - GRID_GEOMETRY.rulerHeight);
    overlayContext.clip();
    for (let row = visible.startRow; row < visible.endRow; row += 1) {
      const y = GRID_GEOMETRY.rulerHeight + row * GRID_GEOMETRY.cellHeight - scroll.top;
      const rowSelected = selected.has(row);
      overlayContext.fillStyle = rowSelected ? '#dceaf3' : '#f8fafb';
      overlayContext.fillRect(0, y, labelWidth, GRID_GEOMETRY.cellHeight);
      overlayContext.fillStyle = '#334e68';
      const recordName = namesRef.current.get(row) ?? 'Loading...';
      overlayContext.fillText(`${String(row + 1).padStart(4, '0')} ${recordName.slice(0, 17)}`, 8, y + GRID_GEOMETRY.cellHeight / 2);
    }
    overlayContext.restore();
    for (let col = visible.startCol; col < visible.endCol; col += 1) {
      const x = labelWidth + col * GRID_GEOMETRY.cellWidth - scroll.left;
      if (col % 10 === 0) {
        overlayContext.fillStyle = '#486581';
        overlayContext.fillText(String(col + 1), x + 2, GRID_GEOMETRY.rulerHeight / 2);
      }
    }
    overlayContext.strokeStyle = '#bcccdc';
    overlayContext.lineWidth = 1;
    overlayContext.beginPath();
    overlayContext.moveTo(labelWidth + 0.5, 0);
    overlayContext.lineTo(labelWidth + 0.5, gutterHeight);
    overlayContext.moveTo(0, GRID_GEOMETRY.rulerHeight + 0.5);
    overlayContext.lineTo(containerSize.width, GRID_GEOMETRY.rulerHeight + 0.5);
    overlayContext.stroke();

    for (let row = visible.startRow; row < visible.endRow; row += 1) {
      const y = GRID_GEOMETRY.rulerHeight + row * GRID_GEOMETRY.cellHeight - scroll.top;
      const rowSelected = selected.has(row);
      for (let col = visible.startCol; col < visible.endCol; col += 1) {
        const x = labelWidth + col * GRID_GEOMETRY.cellWidth - scroll.left;
        const hitIndex = searchHitCells.get(row * meta.width + col) ?? -1;
        const hit = hitIndex >= 0;
        const current = hit && hitIndex === currentHit;
        const inBlock = row >= blockStartRow && row <= blockEndRow && col >= blockStart && col <= blockEnd;
        if (hit) {
          overlayContext.fillStyle = current ? 'rgba(255, 152, 0, 0.62)' : 'rgba(255, 193, 7, 0.28)';
          overlayContext.fillRect(x, y, GRID_GEOMETRY.cellWidth, GRID_GEOMETRY.cellHeight);
        }
        if (rowSelected) {
          overlayContext.fillStyle = 'rgba(21, 66, 115, 0.14)';
          overlayContext.fillRect(x, y, GRID_GEOMETRY.cellWidth, GRID_GEOMETRY.cellHeight);
        }
        if (inBlock) {
          overlayContext.fillStyle = 'rgba(255, 193, 7, 0.32)';
          overlayContext.fillRect(x, y, GRID_GEOMETRY.cellWidth, GRID_GEOMETRY.cellHeight);
        }
        if (hit) {
          overlayContext.strokeStyle = '#000000';
          overlayContext.lineWidth = 1.5;
          overlayContext.strokeRect(x + 0.75, y + 0.75, GRID_GEOMETRY.cellWidth - 1.5, GRID_GEOMETRY.cellHeight - 1.5);
        }
      }
    }
    if (cellFocused) {
      const activeX = labelWidth + activeCell.col * GRID_GEOMETRY.cellWidth - scroll.left;
      const activeY = GRID_GEOMETRY.rulerHeight + activeCell.row * GRID_GEOMETRY.cellHeight - scroll.top;
      overlayContext.strokeStyle = '#154273';
      overlayContext.lineWidth = 2;
      overlayContext.strokeRect(activeX + 1, activeY + 1, GRID_GEOMETRY.cellWidth - 2, GRID_GEOMETRY.cellHeight - 2);
    }
  }, [activeCell, cellFocused, containerSize.height, containerSize.width, currentHit, dataRevision, labelWidth, meta.sequences, meta.width, palette, renderVersion, scrollbarSize, searchHitCells, scroll.left, scroll.top, selectedRows, selectionBlock, visibleRanges.visible]);

  const onScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || scrollFrameRef.current !== null) {
      return;
    }
    const scrollbar = Math.max(0, scroller.offsetHeight - scroller.clientHeight);
    setScrollbarSize((current) => current === scrollbar ? current : scrollbar);
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      setScroll({ left: scroller.scrollLeft, top: scroller.scrollTop });
    });
  }, []);

  const onResizePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { startLabelWidth: labelWidth, startX: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [labelWidth]);

  const onResizePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize) {
      return;
    }
    const nextWidth = Math.max(120, Math.min(420, resize.startLabelWidth + event.clientX - resize.startX));
    setLabelWidth(nextWidth);
  }, []);

  const onResizePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeRef.current = null;
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (isEditorKeyTarget(event.target)) {
      return;
    }
    const command = commandFromKey(event);
    if (!command || busy) {
      return;
    }
    event.preventDefault();
    void onExecuteCommand(command).catch(() => undefined);
  }, [busy, onExecuteCommand]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    rootRef.current?.focus();
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const point = hitTestGridPoint(
      event.clientX,
      event.clientY,
      scroller.getBoundingClientRect(),
      scroller.scrollLeft,
      scroller.scrollTop,
      gridGeometry,
    );
    if (point.row >= meta.sequences) {
      return;
    }
    if (point.surface === 'gutter') {
      const selection = rowSelectionForClick({
        anchorRow: selectionAnchorRow,
        currentRows: selectedRows,
        row: point.row,
        rowCount: meta.sequences,
        shiftKey: event.shiftKey,
        toggle: event.ctrlKey || event.metaKey,
      });
      onSelectedRows(selection.rows);
      onSelectionAnchorRow(selection.anchorRow);
      onSelectionBlock(null);
      onCellFocused(false);
      return;
    }
    if (point.surface !== 'cell' || point.col >= meta.width) {
      return;
    }
    if (event.shiftKey) {
      const block = selectionBlockForRange(activeCell.row, activeCell.col, point.row, point.col);
      onActiveCell({ col: point.col, row: point.row });
      onSelectedRows(rowsForBlock(activeCell.row, block, meta.sequences));
      onSelectionAnchorRow(activeCell.row);
      onSelectionBlock(block);
    } else {
      onActiveCell({ col: point.col, row: point.row });
      onSelectedRows([]);
      onSelectionAnchorRow(point.row);
      onSelectionBlock(null);
    }
    dragRef.current = { startCol: point.col, startRow: point.row };
    scroller.setPointerCapture(event.pointerId);
  }, [activeCell.col, activeCell.row, gridGeometry, meta.sequences, meta.width, onActiveCell, onCellFocused, onSelectedRows, onSelectionAnchorRow, onSelectionBlock, selectedRows, selectionAnchorRow]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const scroller = scrollerRef.current;
    if (!drag || !scroller) {
      return;
    }
    const point = hitTestGridPoint(
      event.clientX,
      event.clientY,
      scroller.getBoundingClientRect(),
      scroller.scrollLeft,
      scroller.scrollTop,
      gridGeometry,
    );
    if (point.surface === 'cell' && point.col < meta.width && point.row < meta.sequences) {
      const block = selectionBlockForRange(drag.startRow, drag.startCol, point.row, point.col);
      onActiveCell({ col: point.col, row: point.row });
      onSelectedRows(rowsForBlock(drag.startRow, block, meta.sequences));
      onSelectionAnchorRow(drag.startRow);
      onSelectionBlock(block);
    }
  }, [gridGeometry, meta.sequences, meta.width, onActiveCell, onSelectedRows, onSelectionAnchorRow, onSelectionBlock]);

  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current;
    if (scroller?.hasPointerCapture(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }, []);

  const totalWidth = labelWidth + meta.width * GRID_GEOMETRY.cellWidth;
  const totalHeight = GRID_GEOMETRY.rulerHeight + meta.sequences * GRID_GEOMETRY.cellHeight;
  const selectedCount = selectedRows.length > 0 ? selectedRows.length : 1;
  return (
    <Box
      aria-busy={busy}
      aria-colcount={meta.width}
      aria-label={'Nucleotide alignment grid'}
      aria-rowcount={meta.sequences}
      onKeyDown={onKeyDown}
      ref={rootRef}
      role={'grid'}
      sx={{
        '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: -3 },
        bgcolor: '#fff',
        height: '100%',
        minHeight: 0,
        position: 'relative',
        width: '100%',
      }}
      tabIndex={0}
    >
      {busy && (
        <Box
          sx={{ inset: 0, pointerEvents: 'auto', position: 'absolute', zIndex: 4 }}
        >
          <LinearProgress
            sx={{ left: 0, position: 'absolute', right: 0, top: 0 }}
          />
        </Box>
      )}
      <canvas
        ref={canvasRef}
        style={{ height: '100%', left: 0, position: 'absolute', top: 0, width: '100%' }}
      />
      <canvas
        aria-hidden
        ref={overlayCanvasRef}
        style={{ height: '100%', left: 0, pointerEvents: 'none', position: 'absolute', top: 0, width: '100%', zIndex: 2 }}
      />
      <Box
        aria-label={'Resize sequence name panel'}
        aria-orientation={'vertical'}
        aria-valuemax={420}
        aria-valuemin={120}
        aria-valuenow={Math.round(labelWidth)}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        role={'separator'}
        sx={{
          '&:hover': { bgcolor: 'primary.main' },
          bgcolor: '#9fb3c8',
          bottom: scrollbarSize,
          cursor: 'col-resize',
          left: labelWidth - 3,
          position: 'absolute',
          top: 0,
          touchAction: 'none',
          width: 6,
          zIndex: 3,
        }}
        tabIndex={0}
      />
      <Box
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onScroll={onScroll}
        ref={scrollerRef}
        sx={{ inset: 0, overflow: 'scroll', position: 'absolute' }}
      >
        <Box sx={{ height: totalHeight, minHeight: '100%', minWidth: totalWidth, pointerEvents: 'none', width: totalWidth }} />
      </Box>
      <Box
        aria-live={'polite'}
        sx={{
          clip: 'rect(0 0 0 0)',
          clipPath: 'inset(50%)',
          height: 1,
          left: 0,
          margin: -1,
          overflow: 'hidden',
          padding: 0,
          position: 'absolute',
          whiteSpace: 'nowrap',
          width: 1,
        }}
      >
        {`Sequence ${activeCell.row + 1}, coordinate ${activeCell.col + 1}, base ${activeBase === null || activeBase === 32 ? 'padding' : String.fromCharCode(activeBase)}, ${selectedCount} row${selectedCount === 1 ? '' : 's'} selected${fetching ? ', loading' : ''}${busy ? ', editing' : ''}.`}
      </Box>
    </Box>
  );
};
