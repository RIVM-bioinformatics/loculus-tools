import type { UIEvent } from 'react';
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

import { EditorWorkerService } from '../../classes/services/EditorWorkerService/EditorWorkerService';
import type {
  EngineMeta,
  GridGeometry,
  GridRangeWithViewportResults,
  PaletteModel,
  VisibleGridRangeWithArguments,
} from '../../models';
import { DEFAULT_GRID_GEOMETRY } from '../../constants';
import { EditorUtil } from '../../utils/EditorUtil';
import { loadPalette } from '../../utils/palette';


export const TestPage = () => {
  const editorService = useMemo(() => EditorWorkerService.getInstance(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  const [geometry, setGeometry] = useState<GridGeometry>(null);

  const updateScrollbars = useCallback(() => {
    const horizontalSize = geometry.labelWidth + geometry.cellWidth + metaSubject.data!.alignmentWidth * geometry.cellWidth;
    const verticalSize = geometry.rulerHeight + metaSubject.data!.sequenceCount * geometry.cellHeight;
    setHorizontalScrollBarSize(horizontalSize);
    setVerticalScrollBarSize(verticalSize);
  }, [geometry, metaSubject]);

  const updateMeta = useCallback(async () => {
    const meta = await EditorWorkerService.getInstance().getMetaData();
    console.log({ meta });
    metaSubject.next(meta);
  }, [metaSubject]);

  const updateVisibleRange = useCallback(() => {
    if (!metaSubject.data) {
      return;
    }
    const { scrollLeft, scrollTop } = scrollSubject.data;
    const { height, width } = containerDimensionsRef.current;
    const visibleRange = EditorUtil.getVisibleGridRange({
      geometry,
      numCols: metaSubject.data.alignmentWidth,
      numOverscanCols: 20,
      numOverscanRows: 10,
      numRows: metaSubject.data.sequenceCount,
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
  }, [geometry, metaSubject.data, scrollSubject.data, visibleRangeSubject]);

  useEffect(() => {
    setPalette(loadPalette());
  }, []);

  useEffect(() => {
    setGeometry(DEFAULT_GRID_GEOMETRY);
  }, []);

  const updateDimensionsDebounced = useDebouncedCallback((width: number, height: number) => {
    setContainerDimensions({ height, width });
  }, 0, { trailing: true });

  useEffect(() => {
    containerDimensionsRef.current = containerDimensions;
    updateVisibleRange();
  }, [containerDimensions, updateVisibleRange]);


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
    const unsubscribeItems = [
      visibleRangeSubject.subscribe(async (visibleRangeSubjectData) => {
        if (!visibleRangeSubjectData?.visibleGridRange?.visible || !visibleRangeSubjectData?.visibleGridRange?.cache) {
          return;
        }

        if (!cachedGridRangeWithViewPortResultRef.current || !EditorUtil.isWithinGridRange({ cachedGridRange: cachedGridRangeWithViewPortResultRef.current.range, visibleGridRange: visibleRangeSubjectData?.visibleGridRange?.visible })) {
          console.log('Loading new viewport');
          const viewportResult = await EditorWorkerService.getInstance().viewport({
            endCol: visibleRangeSubjectData.visibleGridRange.cache.endCol,
            endRow: visibleRangeSubjectData.visibleGridRange.cache.endRow,
            startCol: visibleRangeSubjectData.visibleGridRange.cache.startCol,
            startRow: visibleRangeSubjectData.visibleGridRange.cache.startRow,
          });
          cachedGridRangeWithViewPortResultRef.current = {
            range: visibleRangeSubjectData.visibleGridRange.cache,
            viewportResult,
          };
        }

        animationFrame = requestAnimationFrame(() => {
          if (!canvasRef.current || !palette || !cachedGridRangeWithViewPortResultRef.current || !metaSubject.data) {
            return;
          }

          EditorUtil.drawCanvas({
            canvasElement: canvasRef.current,
            geometry: visibleRangeSubjectData.geometry,
            meta: metaSubject.data,
            palette,
            scrollLeft: visibleRangeSubjectData.scrollLeft,
            scrollTop: visibleRangeSubjectData.scrollTop,
            viewport: cachedGridRangeWithViewPortResultRef.current.viewportResult,
            viewportHeight: visibleRangeSubjectData.viewportHeight,
            viewportWidth: visibleRangeSubjectData.viewportWidth,
          });
        });
      }),
    ];
    return () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
      unsubscribeItems.forEach(unsubscribe => unsubscribe());
    };
  }, [metaSubject, palette, visibleRangeSubject]);

  useEffect(() => {
    const unsubscribeItems = [
      scrollSubject.subscribe(() => updateVisibleRange()),
      metaSubject.subscribe((data) => {
        if (data) {
          updateScrollbars();
          updateVisibleRange();
        }
      }),
    ];
    return () => {
      unsubscribeItems.forEach(unsubscribe => unsubscribe());
    };
  }, [editorService, metaSubject, palette, scrollSubject, updateScrollbars, updateVisibleRange]);

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

  return (
    <Box
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
            width: `${Math.max(horizontalScrollBarSize, containerDimensions.width)}px`,
          }}
        />
      </Box>
      <Box
        component={'canvas'}
        height={containerDimensions.height}
        ref={canvasRef}
        sx={{
          display: 'block',
          height: `${containerDimensions.height}px`,
          left: 0,
          pointerEvents: 'none',
          position: 'absolute',
          top: 0,
          width: `${containerDimensions.width}px`,
          zIndex: 0,
        }}
        width={containerDimensions.width}
      />
    </Box>
  );
};
