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
import { Box } from '@mui/material';

import { BASE_COLORS } from '../../constants';
import { MatrixType } from '../../engine/protocol';
import type {
  Meta,
  SearchResult,
  ViewportResult,
} from '../../engine/protocol';
import type { EngineClient } from '../../engine/useEngineWorker';
import type {
  ActiveCell,
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

interface AlignmentGridProps {
  activeCell: ActiveCell;
  busy: boolean;
  currentHit: number;
  dataRevision: number;
  datasetRevision: number;
  eng: EngineClient;
  meta: Meta;
  onActiveCell: (cell: ActiveCell) => void;
  onExecuteCommand: (command: ReturnType<typeof keyToEditorCommand> extends infer T ? Exclude<T, null> : never) => Promise<void>;
  onSelectedRows: (rows: number[]) => void;
  onSelectionAnchorRow: (row: null | number) => void;
  onSelectionBlock: (block: null | SelectionBlock) => void;
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

const isNucleotideHit = (result: SearchResult, row: number, col: number): boolean => (
  result.positions.some((position) => (
    position.matrix_type === MatrixType.Nucleotide
    && position.row === row
    && position.col === col
  ))
);

export const AlignmentGrid = ({
  activeCell,
  busy,
  currentHit,
  dataRevision,
  datasetRevision,
  eng,
  meta,
  onActiveCell,
  onExecuteCommand,
  onSelectedRows,
  onSelectionAnchorRow,
  onSelectionBlock,
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
  const namesRef = useRef<Map<number, string>>(new Map());
  const requestTokenRef = useRef(0);
  const nameTokenRef = useRef(0);
  const fetchingRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<{ startLabelWidth: number; startX: number } | null>(null);
  const scrollFrameRef = useRef<null | number>(null);
  const [containerSize, setContainerSize] = useState({ height: 480, width: 900 });
  const [labelWidth, setLabelWidth] = useState(DEFAULT_GRID_GEOMETRY.labelWidth);
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [scrollbarSize, setScrollbarSize] = useState(0);
  const [renderVersion, setRenderVersion] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [activeBase, setActiveBase] = useState<null | number>(null);
  const gridGeometry = useMemo(() => ({ ...GRID_GEOMETRY, labelWidth }), [labelWidth]);
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
    if (range.startRow >= range.endRow || range.startCol >= range.endCol || fetchingRef.current) {
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
      if (token !== requestTokenRef.current || revision !== dataRevision) {
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
      if (token === requestTokenRef.current) {
        fetchingRef.current = false;
        setFetching(false);
      }
    }
  }, [dataRevision, viewport]);

  useEffect(() => {
    cacheRef.current = null;
    namesRef.current.clear();
    requestTokenRef.current += 1;
    nameTokenRef.current += 1;
    fetchingRef.current = false;
    setFetching(false);
    setRenderVersion((version) => version + 1);
  }, [dataRevision, meta.sequences, meta.width]);

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

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const next = scrollPositionForCell(
      activeCell,
      scroller.scrollLeft,
      scroller.scrollTop,
      containerSize.width,
      containerSize.height,
      gridGeometry,
    );
    if (next.left !== scroller.scrollLeft || next.top !== scroller.scrollTop) {
      scroller.scrollLeft = next.left;
      scroller.scrollTop = next.top;
      setScroll(next);
    }
  }, [activeCell, containerSize.height, containerSize.width, gridGeometry]);

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
    canvas.width = Math.max(1, Math.floor(containerSize.width * dpr));
    canvas.height = Math.max(1, Math.floor(containerSize.height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, containerSize.width, containerSize.height);

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, containerSize.width, containerSize.height);

    const cache = cacheRef.current;
    const visible = visibleRanges.visible;
    const selected = new Set(selectedRows);
    const blockStart = selectionBlock ? Math.min(selectionBlock.startCol, selectionBlock.endCol) : -1;
    const blockEnd = selectionBlock ? Math.max(selectionBlock.startCol, selectionBlock.endCol) : -1;
    const blockStartRow = selectionBlock?.startRow ?? activeCell.row;
    const blockEndRow = selectionBlock?.endRow ?? activeCell.row;
    context.font = '14px monospace';
    context.textBaseline = 'middle';

    for (let row = visible.startRow; row < visible.endRow; row += 1) {
      const y = GRID_GEOMETRY.rulerHeight + row * GRID_GEOMETRY.cellHeight - scroll.top;
      const rowSelected = selected.has(row);

      for (let col = visible.startCol; col < visible.endCol; col += 1) {
        const x = labelWidth + col * GRID_GEOMETRY.cellWidth - scroll.left;
        const byte = getByte(cache, row, col);
        const character = byte === null ? '' : String.fromCharCode(byte);
        const inBlock = row >= blockStartRow && row <= blockEndRow && col >= blockStart && col <= blockEnd;
        const hit = searchResults && isNucleotideHit(searchResults, row, col);
        const current = hit && searchResults.positions[currentHit]?.row === row && searchResults.positions[currentHit]?.col === col;

        let cellBackground = '#ffffff';
        if (byte === null) {
          cellBackground = '#e9eef2';
        } else if (character === ' ') {
          cellBackground = '#f7f8f9';
        }
        context.fillStyle = cellBackground;
        context.fillRect(x, y, GRID_GEOMETRY.cellWidth, GRID_GEOMETRY.cellHeight);
        if (rowSelected) {
          context.fillStyle = 'rgba(21, 66, 115, 0.14)';
          context.fillRect(x, y, GRID_GEOMETRY.cellWidth, GRID_GEOMETRY.cellHeight);
        }
        if (inBlock) {
          context.fillStyle = 'rgba(255, 193, 7, 0.32)';
          context.fillRect(x, y, GRID_GEOMETRY.cellWidth, GRID_GEOMETRY.cellHeight);
        }
        if (hit) {
          context.fillStyle = current ? 'rgba(255, 152, 0, 0.62)' : 'rgba(255, 193, 7, 0.28)';
          context.fillRect(x, y, GRID_GEOMETRY.cellWidth, GRID_GEOMETRY.cellHeight);
        }
        if (character && character !== ' ') {
          context.fillStyle = BASE_COLORS[character] ?? '#1f2933';
          context.fillText(character, x + 3, y + GRID_GEOMETRY.cellHeight / 2);
        }
      }
    }

    const activeX = labelWidth + activeCell.col * GRID_GEOMETRY.cellWidth - scroll.left;
    const activeY = GRID_GEOMETRY.rulerHeight + activeCell.row * GRID_GEOMETRY.cellHeight - scroll.top;
    context.strokeStyle = '#154273';
    context.lineWidth = 2;
    context.strokeRect(activeX + 1, activeY + 1, GRID_GEOMETRY.cellWidth - 2, GRID_GEOMETRY.cellHeight - 2);

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
  }, [activeCell, containerSize.height, containerSize.width, currentHit, labelWidth, renderVersion, scrollbarSize, searchResults, scroll.left, scroll.top, selectedRows, selectionBlock, visibleRanges.visible]);

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
    void onExecuteCommand(command);
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
      onActiveCell({ col: activeCell.col, row: point.row });
      onSelectionBlock(null);
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
  }, [activeCell.col, activeCell.row, gridGeometry, meta.sequences, meta.width, onActiveCell, onSelectedRows, onSelectionAnchorRow, onSelectionBlock, selectedRows, selectionAnchorRow]);

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
