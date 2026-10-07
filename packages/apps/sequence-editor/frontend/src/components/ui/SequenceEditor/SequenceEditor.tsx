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
import {
  Box,
  useTheme,
} from '@mui/material';
import { Subject } from '@gen-epix/ui-core/classes/Subject';
import { useDebouncedCallback } from 'use-debounce';
import { DevicePixelRatioService } from '@gen-epix/ui-core/classes/services/DevicePixelRatioService';
import { KeyboardShortcutService } from '@gen-epix/ui-core/classes/services/KeyboardShortcutService';
import { useStore } from 'zustand';

import { EditorWorkerService } from '../../../classes/services/EditorWorkerService/EditorWorkerService';
import { SequenceEditorEventBusService } from '../../../classes/services/SequenceEditorEventBus';
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
} from '../../../models';
import { EDITOR_PATH_PROPERTIES_TYPE } from '../../../models';
import {
  DEFAULT_GRID_GEOMETRY,
  IUPAC_KEYS,
  MIN_LABEL_WIDTH,
} from '../../../constants';
import { EditorUtil } from '../../../utils/EditorUtil';
import { loadPalette } from '../../../utils/palette';
import { EDITOR_DIRECTION } from '../../../models/editor';
import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';
import { SequenceEditorStatsSubscribable } from '../../../classes/services/SequenceEditorStatsSubscribable';

import { SequenceEditorStatusBar } from './SequenceEditorStatusBar';


export const SequenceEditor = () => {
  const rawFasta = useStore(sequenceEditorStore, (state) => state.rawFasta);

  const editorService = useMemo(() => EditorWorkerService.getInstance(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorAssemblyRef = useRef<EditorAssembly | null>(null);
  const labelResizeRef = useRef<{ startLabelWidth: number; startX: number } | null>(null);
  const selectionDragRef = useRef<EditorPathProperties | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState<{ height: number; width: number }>({ height: 0, width: 0 });
  const [devicePixelRatio, setDevicePixelRatio] = useState(() => DevicePixelRatioService.getInstance().data);
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
  const initialSelectionRef = useRef<EditorSelection | null>(null);
  const visibleRangeRequestRef = useRef(0);
  const pendingVisibleRangeRef = useRef<null | VisibleGridRangeWithArguments>(null);
  const processingVisibleRangeRef = useRef(false);
  const theme = useTheme();

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
    const sequenceEditorStatsSubscribable = SequenceEditorStatsSubscribable.getInstance();
    const removers = [
      metaSubject.subscribe(data => {
        sequenceEditorStatsSubscribable.next({
          ...sequenceEditorStatsSubscribable.data,
          meta: data,
        });
      }),
      selectionSubject.subscribe(data => {
        sequenceEditorStatsSubscribable.next({
          ...sequenceEditorStatsSubscribable.data,
          selection: data,
        });
      }),
    ];
    return () => {
      removers.forEach(remove => remove());
      sequenceEditorStatsSubscribable.next({
        meta: null,
        selection: null,
      });
    };
  }, [metaSubject, selectionSubject]);

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


  // Observe the scroll container itself (not its outer wrapper) so contentRect
  // reflects the area actually visible past the always-on scrollbar gutter.
  useEffect(() => {
    const element = scrollContainerRef.current;
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

  useEffect(() => {
    const perform = async () => {
      cachedGridRangeWithViewPortResultRef.current = null;
      cachedGridRangeWithRowNamesRef.current = null;
      scrollSubject.next({ scrollLeft: 0, scrollTop: 0 });
      selectionSubject.next(null);
      await editorService.initialize();
      await editorService.loadFasta(rawFasta);
      await updateMeta();
      updateVisibleRange();
    };
    perform().catch((error) => {
      console.error(error);
    });
  }, [editorService, rawFasta, scrollSubject, selectionSubject, updateMeta, updateVisibleRange]);

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
              devicePixelRatio: DevicePixelRatioService.getInstance().data,
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
      DevicePixelRatioService.getInstance().subscribe((nextDevicePixelRatio) => {
        setDevicePixelRatio(nextDevicePixelRatio);
        updateScrollbars();
        updateVisibleRange();
      }),
    ];
    return () => {
      unsubscribeItems.forEach(unsubscribe => unsubscribe());
    };
  }, [editorService, geometrySubject, metaSubject, palette, scrollSubject, selectionSubject, updateScrollbars, updateVisibleRange]);

  // Captures raw keyboard shortcuts and forwards them as bus events; business logic lives in the listener effect below.
  useEffect(() => {
    const emitDirection = (eventName: 'onExpandSelection' | 'onMoveCells' | 'onMoveRows' | 'onMoveRowsEnd' | 'onMoveSelection', direction: EDITOR_DIRECTION) => (event: KeyboardEvent) => {
      event.preventDefault();
      SequenceEditorEventBusService.getInstance().emit(eventName, direction);
    };

    const emitVoid = (eventName: 'onDeleteBackward' | 'onInsert' | 'onRedo' | 'onScrollPageDown' | 'onScrollPageUp' | 'onScrollToLineEnd' | 'onScrollToLineStart' | 'onUndo') => (event: KeyboardEvent) => {
      event.preventDefault();
      SequenceEditorEventBusService.getInstance().emit(eventName);
    };

    const emitMutateSelection = (base: string) => (event: KeyboardEvent) => {
      event.preventDefault();
      SequenceEditorEventBusService.getInstance().emit('onMutateSelection', base);
    };

    const removers = [
      // Expand selection with shift + arrow keys
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onExpandSelection', EDITOR_DIRECTION.LEFT), code: 'ArrowLeft', element: containerRef.current!, modifiers: [['Shift']] }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onExpandSelection', EDITOR_DIRECTION.RIGHT), code: 'ArrowRight', element: containerRef.current!, modifiers: [['Shift']] }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onExpandSelection', EDITOR_DIRECTION.UP), code: 'ArrowUp', element: containerRef.current!, modifiers: [['Shift']] }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onExpandSelection', EDITOR_DIRECTION.DOWN), code: 'ArrowDown', element: containerRef.current!, modifiers: [['Shift']] }),

      // Move selection box with arrow keys
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onMoveSelection', EDITOR_DIRECTION.LEFT), code: 'ArrowLeft', element: containerRef.current! }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onMoveSelection', EDITOR_DIRECTION.RIGHT), code: 'ArrowRight', element: containerRef.current! }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onMoveSelection', EDITOR_DIRECTION.UP), code: 'ArrowUp', element: containerRef.current! }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onMoveSelection', EDITOR_DIRECTION.DOWN), code: 'ArrowDown', element: containerRef.current! }),

      // Move rows vertically (one step)
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onMoveRows', EDITOR_DIRECTION.UP), code: 'ArrowUp', element: containerRef.current!, modifiers: [['Control'], ['Meta']] }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onMoveRows', EDITOR_DIRECTION.DOWN), code: 'ArrowDown', element: containerRef.current!, modifiers: [['Control'], ['Meta']] }),
      // Move rows vertically (top / bottom)
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onMoveRowsEnd', EDITOR_DIRECTION.UP), code: 'ArrowUp', element: containerRef.current!, modifiers: [['Alt']] }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onMoveRowsEnd', EDITOR_DIRECTION.DOWN), code: 'ArrowDown', element: containerRef.current!, modifiers: [['Alt']] }),

      // Move cells horizontally
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onMoveCells', EDITOR_DIRECTION.LEFT), code: 'ArrowLeft', element: containerRef.current!, modifiers: [['Alt']] }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitDirection('onMoveCells', EDITOR_DIRECTION.RIGHT), code: 'ArrowRight', element: containerRef.current!, modifiers: [['Alt']] }),

      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitVoid('onScrollToLineStart'), code: 'Home', element: containerRef.current! }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitVoid('onScrollToLineEnd'), code: 'End', element: containerRef.current! }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitVoid('onScrollPageUp'), code: 'PageUp', element: containerRef.current! }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitVoid('onScrollPageDown'), code: 'PageDown', element: containerRef.current! }),

      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitVoid('onInsert'), code: 'Space', element: containerRef.current! }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitVoid('onDeleteBackward'), code: 'Backspace', element: containerRef.current! }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitMutateSelection('-'), code: 'Delete', element: containerRef.current! }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitMutateSelection('-'), element: containerRef.current!, key: '-' }),

      // Undo (Cmd+Z / Ctrl+Z)
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitVoid('onUndo'), element: containerRef.current!, key: 'z', modifiers: [['Meta'], ['Control']] }),
      // Redo (Cmd+Shift+Z / Ctrl+Shift+Z)
      KeyboardShortcutService.getInstance().registerShortcut({ callback: emitVoid('onRedo'), element: containerRef.current!, key: 'z', modifiers: [['Meta', 'Shift'], ['Control', 'Shift']] }),

      // All other keys (without modifiers)
      KeyboardShortcutService.getInstance().registerShortcut({ callback: (event) => {
        const base = event.key.toUpperCase();
        if (!IUPAC_KEYS.has(base)) {
          return;
        }
        emitMutateSelection(base)(event);
      }, element: containerRef.current! }),
      KeyboardShortcutService.getInstance().registerShortcut({ callback: (event) => {
        const base = event.key.toUpperCase();
        if (!IUPAC_KEYS.has(base)) {
          return;
        }
        emitMutateSelection(base)(event);
      }, element: containerRef.current!, modifiers: [['Shift']] }),
    ];
    return () => {
      removers.forEach(callbackfn => callbackfn());
    };
  }, []);

  // Executes the editor actions for the keyboard shortcuts emitted via the event bus.
  useEffect(() => {
    const execute = async (args: { command: () => Promise<void>; getSelectionPostCommand?: () => EditorSelection | null }) => {
      const { command, getSelectionPostCommand } = args;
      try {
        await command();
        cachedGridRangeWithViewPortResultRef.current = null;
        cachedGridRangeWithRowNamesRef.current = null;
        await updateMeta();
        updateVisibleRange();
        if (getSelectionPostCommand) {
          const selection = getSelectionPostCommand();
          selectionSubject.next(selection);
          initialSelectionRef.current = selection;
        }
      } catch (error) {
        console.error('Failed to post command:', error);
      }
    };

    const mutateRange = async (base: string) => {
      if (!metaSubject.data) {
        return;
      }
      const mutateRangeArguments = EditorUtil.getMutateRangeArguments(selectionSubject.data, metaSubject.data);
      if (!mutateRangeArguments) {
        return;
      }
      await execute({
        command: async () => editorService.mutateRange(mutateRangeArguments.rows, mutateRangeArguments.startCol, mutateRangeArguments.endCol, base),
      });
    };

    const moveSelection = (direction: EDITOR_DIRECTION) => {
      if (!metaSubject.data) {
        return;
      }
      const newSelection = EditorUtil.getMovedSelection(selectionSubject.data, direction, metaSubject.data);
      if (newSelection) {
        selectionSubject.next(newSelection);
        if (initialSelectionRef.current) {
          const newInitialSelection = EditorUtil.getMovedSelection(initialSelectionRef.current, direction, metaSubject.data);
          initialSelectionRef.current = newInitialSelection;
        } else {
          initialSelectionRef.current = newSelection;
        }
      }
    };

    const expandSelection = (direction: EDITOR_DIRECTION) => {
      if (!metaSubject.data || !initialSelectionRef.current || !selectionSubject.data) {
        return;
      }
      const newSelection = EditorUtil.getExpandedSelection(selectionSubject.data, initialSelectionRef.current, direction, metaSubject.data);
      if (newSelection) {
        selectionSubject.next(newSelection);
      }
    };

    const moveRowsEnd = async (_direction: EDITOR_DIRECTION) => {
      // TODO
    };

    const moveRows = async (direction: EDITOR_DIRECTION) => {
      if (!metaSubject.data) {
        return;
      }
      const rows = EditorUtil.getRowsToMove(selectionSubject.data, direction, metaSubject.data);
      if (!rows) {
        return;
      }
      await execute({
        command: async () => {
          if (direction === EDITOR_DIRECTION.UP) {
            await editorService.moveRowsUp(rows);
          } else {
            await editorService.moveRowsDown(rows);
          }
        },
        getSelectionPostCommand: () => EditorUtil.getMovedSelection(selectionSubject.data, direction, metaSubject.data!),
      });
    };

    const moveCells = async (_direction: EDITOR_DIRECTION) => {
      // TODO
    };

    const eventBusService = SequenceEditorEventBusService.getInstance();
    const removers = [
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onExpandSelection', (direction) => expandSelection(direction)),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onMoveSelection', (direction) => moveSelection(direction)),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onMoveRows', (direction) => {
        void moveRows(direction);
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onMoveRowsEnd', (direction) => {
        void moveRowsEnd(direction);
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onMoveCells', (direction) => {
        void moveCells(direction);
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onScrollToLineStart', () => {
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
          scrollContainer.scrollLeft = 0;
        }
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onScrollToLineEnd', () => {
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
          scrollContainer.scrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        }
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onScrollPageUp', () => {
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
          scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop - scrollContainer.clientHeight);
        }
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onScrollPageDown', () => {
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
          scrollContainer.scrollTop = Math.min(
            scrollContainer.scrollHeight - scrollContainer.clientHeight,
            scrollContainer.scrollTop + scrollContainer.clientHeight,
          );
        }
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onInsert', () => {
        void (async () => {
          if (!metaSubject.data) {
            return;
          }
          const upsertArguments = EditorUtil.getUpsertArguments(selectionSubject.data, metaSubject.data);
          if (!upsertArguments) {
            return;
          }
          await execute({
            command: async () => editorService.insert(upsertArguments.rows, upsertArguments.col),
            getSelectionPostCommand: () => EditorUtil.getPostUpsertSelection(selectionSubject.data, EDITOR_DIRECTION.RIGHT),
          });
        })();
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onDeleteBackward', () => {
        void (async () => {
          if (!metaSubject.data) {
            return;
          }
          const upsertArguments = EditorUtil.getUpsertArguments(selectionSubject.data, metaSubject.data, -1);
          if (!upsertArguments) {
            return;
          }
          await execute({
            command: async () => editorService.delete(upsertArguments.rows, upsertArguments.col),
            getSelectionPostCommand: () => EditorUtil.getPostUpsertSelection(selectionSubject.data, EDITOR_DIRECTION.LEFT),
          });
        })();
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onMutateSelection', (base) => {
        void mutateRange(base);
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onUndo', () => {
        void execute({
          command: async () => editorService.undo(),
          getSelectionPostCommand: () => null,
        });
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onRedo', () => {
        void execute({
          command: async () => editorService.redo(),
          getSelectionPostCommand: () => null,
        });
      }),
    ];
    return () => {
      removers.forEach(remover => remover());
    };
  }, [editorService, selectionSubject, updateMeta, updateVisibleRange, metaSubject]);

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
    containerRef.current?.focus();
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
    const currentDevicePixelRatio = DevicePixelRatioService.getInstance().data;
    if (!canvas || !editorAssembly) {
      return;
    }

    const path = EditorUtil.getPathPropertiesFromCanvas({
      canvas,
      devicePixelRatio: currentDevicePixelRatio,
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
          initialSelectionRef.current = null;
          return;
        }
        selectionSubject.next({
          rows: nextSelectedRows,
        });
        initialSelectionRef.current = {
          rows: nextSelectedRows,
        };
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
      initialSelectionRef.current = selection;
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
    const currentDevicePixelRatio = DevicePixelRatioService.getInstance().data;
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
        devicePixelRatio: currentDevicePixelRatio,
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
        initialSelectionRef.current = selection;
      }
      return;
    }

    const editorAssembly = editorAssemblyRef.current;
    if (!editorAssembly) {
      return;
    }

    const path = EditorUtil.getPathPropertiesFromCanvas({
      canvas,
      devicePixelRatio: currentDevicePixelRatio,
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
        height: `calc(100% - ${theme.spacing(3)})`,
        marginBottom: theme.spacing(3),
        position: 'relative',
        width: '100%',
      }}
      tabIndex={0}
    >
      <Box
        onMouseDown={onScrollContainerMouseDown}
        onMouseMove={onScrollContainerMouseMove}
        onScroll={onScrollContainerScroll}
        ref={scrollContainerRef}
        sx={{
          height: '100%',
          overflowX: 'scroll',
          overflowY: 'scroll',
          position: 'absolute',
          width: '100%',
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
      <Box
        sx={{
          bottom: theme.spacing(-3),
          height: theme.spacing(3),
          left: 0,
          position: 'absolute',
          width: '100%',
          zIndex: 2,
        }}
      >
        <SequenceEditorStatusBar />
      </Box>
    </Box>
  );
};
