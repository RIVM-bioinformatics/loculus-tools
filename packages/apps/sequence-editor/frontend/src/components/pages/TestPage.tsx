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

import { EditorService } from '../../classes/services/EditorService/EditorService';
import type {
  EngineMeta,
  EngineViewportResult,
  PaletteModel,
} from '../../models';
import { DEFAULT_GRID_GEOMETRY } from '../../constants';
import { EditorUtil } from '../../utils/EditorUtil';
import { loadPalette } from '../../utils/palette';


export const TestPage = () => {
  const editorService = useMemo(() => EditorService.getInstance(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState<{ height: number; width: number }>({ height: 0, width: 0 });
  const [verticalScrollBarSize, setVerticalScrollBarSize] = useState(0);
  const [horizontalScrollBarSize, setHorizontalScrollBarSize] = useState(0);
  const scrollSubject = useMemo(() => new Subject<{ scrollLeft: number; scrollTop: number }>({ scrollLeft: 0, scrollTop: 0 }), []);
  const containerDimensionsRef = useRef(containerDimensions);
  const metaRef = useRef<EngineMeta | null>(null);
  const viewportRef = useRef<EngineViewportResult | null>(null);
  const [palette, setPalette] = useState<null | PaletteModel>();

  const updateScrollbars = useCallback((meta: EngineMeta) => {
    const horizontalSize = meta.alignmentWidth * DEFAULT_GRID_GEOMETRY.cellWidth;
    const verticalSize = meta.sequenceCount * DEFAULT_GRID_GEOMETRY.cellHeight;
    setHorizontalScrollBarSize(horizontalSize);
    setVerticalScrollBarSize(verticalSize);
  }, []);

  useEffect(() => {
    setPalette(loadPalette());
  }, []);

  const updateDimensionsDebounced = useDebouncedCallback((width: number, height: number) => {
    containerDimensionsRef.current = { height, width };
    setContainerDimensions({ height, width });
  }, 100, { trailing: true });

  const updateViewportBounds = useCallback(() => {
    if (!metaRef.current) {
      return;
    }
    const { scrollLeft, scrollTop } = scrollSubject.data;
    const { height, width } = containerDimensionsRef.current;
    const visibleRange = EditorUtil.getVisibleGridRange(
      scrollLeft,
      scrollTop,
      width,
      height,
      metaRef.current.sequenceCount,
      metaRef.current.alignmentWidth,
      DEFAULT_GRID_GEOMETRY,
      0,
      0,
    );
    void editorService.updateBounds(visibleRange.visible);
  }, [editorService, scrollSubject]);


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
      const fastaResult = await editorService.loadFasta(await response.text());
      console.log({ fastaResult });
    };
    perform().catch((error) => {
      console.error(error);
    });
  }, [editorService]);

  useEffect(() => {
    let animationFrame: number | undefined;

    const unsubscribeItems = [
      editorService.subscribe((data, prevData) => {
        if (data.meta && JSON.stringify(data.meta) !== JSON.stringify(prevData?.meta)) {
          updateScrollbars(data.meta);
          metaRef.current = data.meta;
          updateViewportBounds();
        }
        if (data.viewport && JSON.stringify(data.viewport) !== JSON.stringify(prevData?.viewport)) {
          viewportRef.current = data.viewport;
          if (!palette) {
            return;
          }
          animationFrame = requestAnimationFrame(() => {
            EditorUtil.drawCanvas({
              canvasElement: canvasRef.current!,
              palette,
              viewport: viewportRef.current!,
            });
          });
        }
      }),
      scrollSubject.subscribe(() => updateViewportBounds()),
    ];

    updateViewportBounds();

    return () => {
      unsubscribeItems.forEach(unsubscribe => unsubscribe());
      if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [editorService, palette, scrollSubject, updateScrollbars, updateViewportBounds]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport && palette) {
      EditorUtil.drawCanvas({
        canvasElement: canvasRef.current!,
        palette,
        viewport,
      });
    }
    updateViewportBounds();
  }, [containerDimensions, palette, updateViewportBounds]);


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
        height: '100%',
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
