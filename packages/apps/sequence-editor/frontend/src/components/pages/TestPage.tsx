import type {
  MouseEvent as ReactMouseEvent,
  UIEvent,
} from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box } from '@mui/material';
import { Subject } from '@gen-epix/ui-core/classes/Subject';
import { useDebouncedCallback } from 'use-debounce';
import { DevicePixelRatioService } from '@gen-epix/ui-core/classes/services/DevicePixelRatioService';

import { EditorWorkerService } from '../../classes/services/EditorWorkerService/EditorWorkerService';
import type {
  EditorAssembly,
  EditorPathProperties,
  EditorSelection,
  EngineMeta,
  GridGeometry,
  GridRangeWithRowNames,
  GridRangeWithViewportResults,
  PaletteModel,
  VisibleGridRangeWithArguments,
} from '../../models';
import { EDITOR_PATH_PROPERTIES_TYPE } from '../../models';
import {
  DEFAULT_GRID_GEOMETRY,
  MIN_LABEL_WIDTH,
} from '../../constants';
import { EditorUtil } from '../../utils/EditorUtil';
import { loadPalette } from '../../utils/palette';


export const TestPage = () => {
  const editorService = useMemo(() => EditorWorkerService.getInstance(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorAssemblyRef = useRef<EditorAssembly | null>(null);
  const labelResizeRef = useRef<{ startLabelWidth: number; startX: number } | null>(null);
  const selectionDragRef = useRef<EditorPathProperties | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState<{ height: number; width: number }>({ height: 0, width: 0 });
  const [verticalScrollBarSize, setVerticalScrollBarSize] = useState(0);
  const [horizontalScrollBarSize, setHorizontalScrollBarSize] = useState(0);
  const scrollSubject = useMemo(() => new Subject<{ scrollLeft: number; scrollTop: number }>({ scrollLeft: 0, scrollTop: 0 }), []);
  const containerDimensionsRef = useRef(containerDimensions);
  const metaSubject = useMemo(() => new Subject<EngineMeta | null>(null), []);
  const [palette, setPalette] = useState<null | PaletteModel>();
  const visibleRangeSubject = useMemo(() => new Subject<null | VisibleGridRangeWithArguments>(null), []);
  const cachedGridRangeWithViewPortResultRef = useRef<GridRangeWithViewportResults | null>(null);
  const cachedGridRangeWithRowNamesRef = useRef<GridRangeWithRowNames | null>(null);
  const geometrySubject = useMemo(() => new Subject<GridGeometry>(DEFAULT_GRID_GEOMETRY), []);
  const selectionSubject = useMemo(() => new Subject<EditorSelection | null>(null), []);
  const visibleRangeRequestRef = useRef(0);
  const pendingVisibleRangeRef = useRef<null | VisibleGridRangeWithArguments>(null);
  const processingVisibleRangeRef = useRef(false);

  const updateScrollbars = useCallback(() => {
    const geometry = geometrySubject.data;
    const meta = metaSubject.data;
    if (!geometry || !meta) {
      return;
    }
    const horizontalSize = geometry.labelWidth + geometry.cellWidth + meta.alignmentWidth * geometry.cellWidth;
    const verticalSize = geometry.rulerHeight + meta.sequenceCount * geometry.cellHeight;
    setHorizontalScrollBarSize(horizontalSize);
    setVerticalScrollBarSize(verticalSize);
  }, [geometrySubject, metaSubject]);

  const updateMeta = useCallback(async () => {
    const meta = await EditorWorkerService.getInstance().getMetaData();
    metaSubject.next(meta);
  }, [metaSubject]);

  const updateVisibleRange = useCallback(() => {
    const geometry = geometrySubject.data;
    const meta = metaSubject.data;
    if (!meta || !geometry) {
      return;
    }
    const { scrollLeft, scrollTop } = scrollSubject.data;
    const { height, width } = containerDimensionsRef.current;
    const visibleRange = EditorUtil.getVisibleGridRange({
      geometry,
      numCols: meta.alignmentWidth,
      numRows: meta.sequenceCount,
      scrollLeft,
      scrollTop,
      viewportHeight: height,
      viewportWidth: width,
    });
    visibleRangeSubject.next({
      geometry,
      scrollLeft,
      scrollTop,
      viewportHeight: height,
      viewportWidth: width,
      visibleGridRange: visibleRange,
    });
  }, [geometrySubject, metaSubject, scrollSubject, visibleRangeSubject]);

  useEffect(() => {
    setPalette(loadPalette());
  }, []);

  const updateDimensionsDebounced = useDebouncedCallback((width: number, height: number) => {
    setContainerDimensions({ height, width });
  }, 0, { trailing: true });

  useEffect(() => {
    containerDimensionsRef.current = containerDimensions;
    updateVisibleRange();
  }, [containerDimensions, updateVisibleRange]);

  const maxLabelWidth = containerDimensions.width > 0 ? containerDimensions.width / 2 : MIN_LABEL_WIDTH;

  useEffect(() => {
    if (containerDimensions.width <= 0) {
      return;
    }
    const geometry = geometrySubject.data;
    if (geometry.labelWidth > maxLabelWidth) {
      geometrySubject.next({
        ...geometry,
        labelWidth: maxLabelWidth,
      });
    }
  }, [containerDimensions.width, geometrySubject, maxLabelWidth]);


  // Setup container resize observer
  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      const height = Math.max(1, entry.contentRect.height);
      const width = Math.max(1, entry.contentRect.width);
      updateDimensionsDebounced(width, height);

    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [editorService, updateDimensionsDebounced]);

  // Load demo data
  useEffect(() => {
    const perform = async () => {
      // Example command using editorService
      await editorService.initialize();
      const response = await fetch('/sample-data/sarscov2_demo.fasta');
      if (!response.ok) {
        throw new Error(`Demo alignment failed to load (${response.status}).`);
      }
      await editorService.loadFasta(await response.text());
      await updateMeta();
    };
    perform().catch((error) => {
      console.error(error);
    });
  }, [editorService, updateMeta]);

  useEffect(() => {
    let animationFrame: null | number = null;
    let isActive = true;

    const processVisibleRange = async (): Promise<void> => {
      if (!isActive || processingVisibleRangeRef.current) {
        return;
      }
      processingVisibleRangeRef.current = true;

      try {
        while (isActive && pendingVisibleRangeRef.current) {
          const visibleGridRangeWithArguments = pendingVisibleRangeRef.current;
          pendingVisibleRangeRef.current = null;
          const requestId = visibleRangeRequestRef.current;

          if (!cachedGridRangeWithRowNamesRef.current || !EditorUtil.isWithinGridRange({
            cachedGridRange: cachedGridRangeWithRowNamesRef.current.range,
            visibleGridRange: visibleGridRangeWithArguments.visibleGridRange.visible,
          })) {
            const rowNames: string[] = [];
            for (let i = visibleGridRangeWithArguments.visibleGridRange.cache.startRow; i <= visibleGridRangeWithArguments.visibleGridRange.cache.endRow; i++) {
              rowNames.push(await editorService.name(i));
            }

            if (!isActive) {
              return;
            }
            cachedGridRangeWithRowNamesRef.current = {
              range: visibleGridRangeWithArguments.visibleGridRange.cache,
              rowNames,
            };
          }

          if (!cachedGridRangeWithViewPortResultRef.current || !EditorUtil.isWithinGridRange({
            cachedGridRange: cachedGridRangeWithViewPortResultRef.current.range,
            visibleGridRange: visibleGridRangeWithArguments.visibleGridRange.visible,
          })) {
            const viewportResult = await EditorWorkerService.getInstance().viewport({
              endCol: visibleGridRangeWithArguments.visibleGridRange.cache.endCol,
              endRow: visibleGridRangeWithArguments.visibleGridRange.cache.endRow,
              startCol: visibleGridRangeWithArguments.visibleGridRange.cache.startCol,
              startRow: visibleGridRangeWithArguments.visibleGridRange.cache.startRow,
            });
            if (!isActive) {
              return;
            }
            cachedGridRangeWithViewPortResultRef.current = {
              range: visibleGridRangeWithArguments.visibleGridRange.cache,
              viewportResult,
            };
          }

          if (requestId !== visibleRangeRequestRef.current) {
            continue;
          }
          if (animationFrame !== null) {
            cancelAnimationFrame(animationFrame);
          }
          animationFrame = requestAnimationFrame(() => {
            if (!isActive || requestId !== visibleRangeRequestRef.current) {
              return;
            }
            if (!canvasRef.current || !palette || !cachedGridRangeWithViewPortResultRef.current || !metaSubject.data || !cachedGridRangeWithRowNamesRef.current) {
              return;
            }
            editorAssemblyRef.current = EditorUtil.drawCanvas({
              canvasElement: canvasRef.current,
              devicePixelRatio,
              geometry: visibleGridRangeWithArguments.geometry,
              meta: metaSubject.data,
              palette,
              rowNames: cachedGridRangeWithRowNamesRef.current.rowNames,
              rowNamesStartRow: cachedGridRangeWithRowNamesRef.current.range.startRow,
              scrollLeft: visibleGridRangeWithArguments.scrollLeft,
              scrollTop: visibleGridRangeWithArguments.scrollTop,
              selection: selectionSubject.data,
              viewport: cachedGridRangeWithViewPortResultRef.current.viewportResult,
              viewportHeight: visibleGridRangeWithArguments.viewportHeight,
              viewportWidth: visibleGridRangeWithArguments.viewportWidth,
            });
          });
        }
      } finally {
        processingVisibleRangeRef.current = false;
        if (isActive && pendingVisibleRangeRef.current) {
          void processVisibleRange();
        }
      }
    };

    const unsubscribeItems = [
      visibleRangeSubject.subscribe((visibleGridRangeWithArguments) => {
        if (!visibleGridRangeWithArguments) {
          return;
        }
        pendingVisibleRangeRef.current = visibleGridRangeWithArguments;
        visibleRangeRequestRef.current += 1;
        void processVisibleRange();
      }),
    ];
    return () => {
      isActive = false;
      pendingVisibleRangeRef.current = null;
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
      visibleRangeRequestRef.current += 1;
      unsubscribeItems.forEach(unsubscribe => unsubscribe());
    };
  }, [editorService, metaSubject, palette, selectionSubject, visibleRangeSubject]);

  useEffect(() => {
    const unsubscribeItems = [
      geometrySubject.subscribe(() => {
        updateScrollbars();
        updateVisibleRange();
      }),
      scrollSubject.subscribe(() => updateVisibleRange()),
      metaSubject.subscribe((data) => {
        if (data) {
          updateScrollbars();
          updateVisibleRange();
        }
      }),
      selectionSubject.subscribe(() => updateVisibleRange()),
      DevicePixelRatioService.getInstance().subscribe(() => {
        updateScrollbars();
        updateVisibleRange();
      }),
    ];
    return () => {
      unsubscribeItems.forEach(unsubscribe => unsubscribe());
    };
  }, [editorService, geometrySubject, metaSubject, palette, scrollSubject, selectionSubject, updateScrollbars, updateVisibleRange]);

  useEffect(() => {
    updateVisibleRange();
  }, [updateVisibleRange]);

  const onScrollContainerScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    scrollSubject.next({
      scrollLeft: target.scrollLeft,
      scrollTop: target.scrollTop,
    });
  }, [scrollSubject]);

  const onScrollContainerMouseDown = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const scrollContainer = event.currentTarget;

    // Determine if the mouse event occurred on the scrollbars (allow the user to maintain the selection while interacting with the scrollbars)
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const isVerticalScrollbar = event.clientX >= scrollContainerRect.left + scrollContainer.clientWidth;
    const isHorizontalScrollbar = event.clientY >= scrollContainerRect.top + scrollContainer.clientHeight;
    if (isVerticalScrollbar || isHorizontalScrollbar) {
      return;
    }

    const canvas = canvasRef.current;
    const editorAssembly = editorAssemblyRef.current;
    const devicePixelRatio = DevicePixelRatioService.getInstance().data;
    if (!canvas || !editorAssembly) {
      return;
    }

    const path = EditorUtil.getPathPropertiesFromCanvas({
      canvas,
      devicePixelRatio,
      editorAssembly,
      event: event.nativeEvent,
    });
    if (!path) {
      return;
    }
    if (path.type !== EDITOR_PATH_PROPERTIES_TYPE.DIVIDER) {
      if (path.type === EDITOR_PATH_PROPERTIES_TYPE.LABEL && (event.metaKey || event.ctrlKey)) {
        const selectedRows = selectionSubject.data?.rows ?? [];
        const nextSelectedRows = selectedRows.includes(path.row)
          ? selectedRows.filter(row => row !== path.row)
          : [...selectedRows, path.row].sort((firstRow, secondRow) => firstRow - secondRow);

        event.preventDefault();
        selectionDragRef.current = null;
        if (nextSelectedRows.length === 0) {
          selectionSubject.next(null);
          return;
        }
        selectionSubject.next({
          rows: nextSelectedRows,
        } as EditorSelection);
        return;
      }

      const selection = EditorUtil.getSelectionFromPathProperties({
        endPath: path,
        startPath: path,
      });
      if (!selection) {
        return;
      }
      event.preventDefault();
      selectionDragRef.current = path;
      selectionSubject.next(selection);
      return;
    }

    event.preventDefault();
    selectionDragRef.current = null;
    labelResizeRef.current = {
      startLabelWidth: geometrySubject.data.labelWidth,
      startX: event.clientX,
    };
  }, [geometrySubject, selectionSubject]);

  const onScrollContainerMouseMove = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const devicePixelRatio = DevicePixelRatioService.getInstance().data;
    const resize = labelResizeRef.current;
    if (!container || !canvas) {
      return;
    }

    if (resize) {
      const labelWidth = Math.min(maxLabelWidth, Math.max(MIN_LABEL_WIDTH, resize.startLabelWidth + event.clientX - resize.startX));
      geometrySubject.next({
        ...geometrySubject.data,
        labelWidth,
      });
      container.style.cursor = 'col-resize';
      return;
    }

    const selectionStart = selectionDragRef.current;
    if (selectionStart) {
      const editorAssembly = editorAssemblyRef.current;
      if (!editorAssembly) {
        return;
      }

      const path = EditorUtil.getPathPropertiesFromCanvas({
        canvas,
        devicePixelRatio,
        editorAssembly,
        event: event.nativeEvent,
      });
      if (!path) {
        return;
      }

      const selection = EditorUtil.getSelectionFromPathProperties({
        endPath: path,
        startPath: selectionStart,
      });
      if (selection) {
        selectionSubject.next(selection);
      }
      return;
    }

    const editorAssembly = editorAssemblyRef.current;
    if (!editorAssembly) {
      return;
    }

    const path = EditorUtil.getPathPropertiesFromCanvas({
      canvas,
      devicePixelRatio,
      editorAssembly,
      event: event.nativeEvent,
    });
    if (!path) {
      container.style.cursor = 'default';
      return;
    }

    if (path.type === EDITOR_PATH_PROPERTIES_TYPE.DIVIDER) {
      container.style.cursor = 'col-resize';
    } else {
      container.style.cursor = 'default';
    }
  }, [geometrySubject, maxLabelWidth, selectionSubject]);

  const onContainerMouseUp = useCallback(() => {
    labelResizeRef.current = null;
    selectionDragRef.current = null;
  }, []);

  const canvasWidth = Math.max(1, Math.floor(containerDimensions.width * devicePixelRatio));
  const canvasHeight = Math.max(1, Math.floor(containerDimensions.height * devicePixelRatio));

  return (
    <Box
      onMouseUp={onContainerMouseUp}
      ref={containerRef}
      sx={{
        height: 'calc(100% - 32px)',
        marginBottom: '32px',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <Box
        onMouseDown={onScrollContainerMouseDown}
        onMouseMove={onScrollContainerMouseMove}
        onScroll={onScrollContainerScroll}
        sx={{
          height: `${containerDimensions.height}px`,
          overflowX: 'scroll',
          overflowY: 'scroll',
          position: 'absolute',
          width: `${containerDimensions.width}px`,
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            height: `${Math.max(verticalScrollBarSize, containerDimensions.height)}px`,
            pointerEvents: 'none',
            width: `${Math.max(horizontalScrollBarSize, containerDimensions.width)}px`,
          }}
        />
      </Box>
      <canvas
        height={canvasHeight}
        ref={canvasRef}
        style={{
          display: 'block',
          height: `${containerDimensions.height}px`,
          imageRendering: 'pixelated',
          left: 0,
          pointerEvents: 'auto',
          position: 'absolute',
          top: 0,
          width: `${containerDimensions.width}px`,
          zIndex: 0,
        }}
        width={canvasWidth}
      />
    </Box>
  );
};
