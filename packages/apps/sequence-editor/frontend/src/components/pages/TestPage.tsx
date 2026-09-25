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
  PaletteModel,
  VisibleGridRangeWithArguments,
} from '../../models';
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
  const geometrySubject = useMemo(() => new Subject<GridGeometry>(DEFAULT_GRID_GEOMETRY), []);
  const selectionSubject = useMemo(() => new Subject<EditorSelection | null>(null), []);

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
    const visibleRangeProcessor = EditorUtil.createVisibleRangeProcessor({
      canvas: () => canvasRef.current,
      devicePixelRatio,
      editorService,
      getMeta: () => metaSubject.data,
      getSelection: () => selectionSubject.data,
      onEditorAssembly: (editorAssembly) => {
        editorAssemblyRef.current = editorAssembly;
      },
      palette,
    });
    const unsubscribeItems = [
      visibleRangeSubject.subscribe((visibleGridRangeWithArguments) => {
        if (!visibleGridRangeWithArguments) {
          return;
        }
        visibleRangeProcessor.enqueue(visibleGridRangeWithArguments);
      }),
    ];
    return () => {
      visibleRangeProcessor.dispose();
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
    const canvas = canvasRef.current;
    const editorAssembly = editorAssemblyRef.current;
    if (!canvas || !editorAssembly) {
      return;
    }

    const action = EditorUtil.getScrollContainerMouseDownAction({
      canvas,
      editorAssembly,
      event: event.nativeEvent,
      geometry: geometrySubject.data,
      scrollContainer: event.currentTarget,
      selection: selectionSubject.data,
    });
    if (action.type === 'none') {
      return;
    }
    event.preventDefault();
    if (action.type === 'toggle-row') {
      selectionDragRef.current = null;
      selectionSubject.next(action.selection);
      return;
    }
    if (action.type === 'select') {
      selectionDragRef.current = action.selectionDrag;
      selectionSubject.next(action.selection);
      return;
    }

    selectionDragRef.current = null;
    labelResizeRef.current = {
      startLabelWidth: action.startLabelWidth,
      startX: action.startX,
    };
  }, [geometrySubject, selectionSubject]);

  const onScrollContainerMouseMove = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!container || !canvas) {
      return;
    }

    const action = EditorUtil.getScrollContainerMouseMoveAction({
      canvas,
      editorAssembly: editorAssemblyRef.current,
      event: event.nativeEvent,
      maxLabelWidth,
      resize: labelResizeRef.current,
      selectionStart: selectionDragRef.current,
    });
    if (action.type === 'resize') {
      geometrySubject.next({
        ...geometrySubject.data,
        labelWidth: action.labelWidth,
      });
      container.style.cursor = action.cursor;
      return;
    }
    if (action.type === 'select') {
      selectionSubject.next(action.selection);
      return;
    }
    if (action.type === 'none') {
      return;
    }
    container.style.cursor = action.cursor;
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
