import { container } from 'tsyringe';
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
import type { DevicePixelRatioService } from '@gen-epix/ui-core/classes/services/DevicePixelRatioService';
import type { KeyboardShortcutService } from '@gen-epix/ui-core/classes/services/KeyboardShortcutService';
import { useStore } from 'zustand';
import {
  DEVICE_PIXEL_RATIO_SERVICE_TOKEN,
  KEYBOARD_SHORTCUT_SERVICE_TOKEN,
} from '@rivm-loculus-tools/common-frontend/constants/config.constants';
import { ExportUtil } from '@rivm-loculus-tools/common-frontend/utils/ExportUtil';

import { EditorWorkerService } from '../../../classes/services/EditorWorkerService';
import { SequenceEditorEventBusService } from '../../../classes/services/SequenceEditorEventBusService';
import type {
  EditorAssembly,
  EditorPathProperties,
  EditorSelection,
  EngineMeta,
  EngineSearchResult,
  GridGeometry,
  GridRangeWithRowNames,
  GridRangeWithViewportResults,
  VisibleGridRangeWithArguments,
} from '../../../models/editor.models';
import {
  EDITOR_DIRECTION,
  EDITOR_PATH_PROPERTIES_TYPE,
} from '../../../models/editor.models';
import {
  DEFAULT_GRID_GEOMETRY,
  IUPAC_KEYS,
  KEYBOARD_SHORTCUTS,
  MIN_LABEL_WIDTH,
} from '../../../constants';
import { EditorUtil } from '../../../utils/EditorUtil';
import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';
import { SequenceEditorSearchBar } from '../SequenceEditorSearchBar';
import { SequenceEditorRealignModal } from '../SequenceEditorRealignModal';

import { SequenceEditorStatusBar } from './SequenceEditorStatusBar';
import type { SequenceEditorGotoPositionDialogRefMethods } from './SequenceEditorGotoPositionDialog';
import { SequenceEditorGotoPositionDialog } from './SequenceEditorGotoPositionDialog';

export const SequenceEditor = () => {
  const rawFasta = useStore(sequenceEditorStore, (state) => state.rawFasta);
  const setIsRealigning = useStore(sequenceEditorStore, (state) => state.setIsRealigning);
  const setLatestMessage = useStore(sequenceEditorStore, (state) => state.setLatestMessage);
  const setMeta = useStore(sequenceEditorStore, (state) => state.setMeta);
  const setSelection = useStore(sequenceEditorStore, (state) => state.setSelection);
  const sequenceEditorGotoPositionDialogRef = useRef<null | SequenceEditorGotoPositionDialogRefMethods>(null);
  const editorService = useMemo(() => container.resolve(EditorWorkerService), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorAssemblyRef = useRef<EditorAssembly | null>(null);
  const labelResizeRef = useRef<{ startLabelWidth: number; startX: number } | null>(null);
  const selectionDragRef = useRef<EditorPathProperties | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState<{ height: number; width: number }>({ height: 0, width: 0 });
  const [devicePixelRatio, setDevicePixelRatio] = useState(() => container.resolve<DevicePixelRatioService>(DEVICE_PIXEL_RATIO_SERVICE_TOKEN).data);
  const [verticalScrollBarSize, setVerticalScrollBarSize] = useState(0);
  const [horizontalScrollBarSize, setHorizontalScrollBarSize] = useState(0);
  const scrollSubject = useMemo(() => new Subject<{ scrollLeft: number; scrollTop: number }>({ scrollLeft: 0, scrollTop: 0 }), []);
  const containerDimensionsRef = useRef(containerDimensions);
  const metaSubject = useMemo(() => new Subject<EngineMeta | null>(null), []);
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
    const meta = await container.resolve(EditorWorkerService).getMetaData();
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

  const updateDimensionsDebounced = useDebouncedCallback((width: number, height: number) => {
    setContainerDimensions({ height, width });
  }, 0, { trailing: true });

  useEffect(() => {
    containerDimensionsRef.current = containerDimensions;
    updateVisibleRange();
  }, [containerDimensions, updateVisibleRange]);

  const maxLabelWidth = containerDimensions.width > 0 ? containerDimensions.width / 2 : MIN_LABEL_WIDTH;

  useEffect(() => {
    const removers = [
      metaSubject.subscribe(data => {
        setMeta(data);
      }),
      selectionSubject.subscribe(data => {
        setSelection(data);
      }),
    ];
    return () => {
      removers.forEach(remove => remove());
      setLatestMessage(null);
      setMeta(null);
      setSelection(null);
    };
  }, [metaSubject, selectionSubject, setLatestMessage, setMeta, setSelection]);

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
    let searchResult: EngineSearchResult | null = null;
    let searchResultHighlightedIndex: null | number = null;

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
            const viewportResult = await container.resolve(EditorWorkerService).viewport({
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
            if (!canvasRef.current || !sequenceEditorStore.getState().nucleotidePalette || !cachedGridRangeWithViewPortResultRef.current || !metaSubject.data || !cachedGridRangeWithRowNamesRef.current) {
              return;
            }
            editorAssemblyRef.current = EditorUtil.drawCanvas({
              canvasElement: canvasRef.current,
              devicePixelRatio: container.resolve<DevicePixelRatioService>(DEVICE_PIXEL_RATIO_SERVICE_TOKEN).data,
              geometry: visibleGridRangeWithArguments.geometry,
              meta: metaSubject.data,
              palette: sequenceEditorStore.getState().nucleotidePalette,
              rowNames: cachedGridRangeWithRowNamesRef.current.rowNames,
              rowNamesStartRow: cachedGridRangeWithRowNamesRef.current.range.startRow,
              scrollLeft: visibleGridRangeWithArguments.scrollLeft,
              scrollTop: visibleGridRangeWithArguments.scrollTop,
              searchResult,
              searchResultHighlightedIndex,
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
      sequenceEditorStore.subscribe((state, prevState) => {
        let shouldProcess = false;
        if (state.searchResult !== prevState.searchResult) {
          searchResult = state.searchResult;
          shouldProcess = true;
        }
        if (state.searchResultHighlightedIndex !== prevState.searchResultHighlightedIndex) {
          searchResultHighlightedIndex = state.searchResultHighlightedIndex;
          EditorUtil.scrollToSearchResult({
            geometry: geometrySubject.data,
            scrollContainer: scrollContainerRef.current,
            searchResult: state.searchResult,
            searchResultHighlightedIndex: state.searchResultHighlightedIndex,
          });
          shouldProcess = true;
        }
        if (shouldProcess) {
          updateVisibleRange();
        }
      }),
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
  }, [editorService, geometrySubject, metaSubject, selectionSubject, updateVisibleRange, visibleRangeSubject]);

  useEffect(() => {
    const unsubscribeItems = [
      sequenceEditorStore.subscribe((state, prevState) => {
        if (state.nucleotidePalette?.name !== prevState.nucleotidePalette?.name) {
          updateVisibleRange();
        }
      }),
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
      container.resolve<DevicePixelRatioService>(DEVICE_PIXEL_RATIO_SERVICE_TOKEN).subscribe((nextDevicePixelRatio) => {
        setDevicePixelRatio(nextDevicePixelRatio);
        updateScrollbars();
        updateVisibleRange();
      }),
    ];
    return () => {
      unsubscribeItems.forEach(unsubscribe => unsubscribe());
    };
  }, [editorService, geometrySubject, metaSubject, scrollSubject, selectionSubject, updateScrollbars, updateVisibleRange]);

  // Captures raw keyboard shortcuts and forwards them as bus events; business logic lives in the listener effect below.
  useEffect(() => {
    const mutateSelection = (event: KeyboardEvent) => {
      const base = event.key.toUpperCase();
      if (!IUPAC_KEYS.has(base)) {
        return;
      }
      event.preventDefault();
      container.resolve(SequenceEditorEventBusService).emit('onMutateSelection', base);
    };

    const register = (shortcut: typeof KEYBOARD_SHORTCUTS[string]) => container.resolve<KeyboardShortcutService>(KEYBOARD_SHORTCUT_SERVICE_TOKEN).registerShortcut({
      callback: shortcut.callback,
      element: containerRef.current!,
      ...shortcut.shortcut,
    });

    const removers = [
      // Expand selection with shift + arrow keys
      register(KEYBOARD_SHORTCUTS.expandSelectionLeft),
      register(KEYBOARD_SHORTCUTS.expandSelectionRight),
      register(KEYBOARD_SHORTCUTS.expandSelectionUp),
      register(KEYBOARD_SHORTCUTS.expandSelectionDown),

      // Move selection box with arrow keys
      register(KEYBOARD_SHORTCUTS.moveSelectionLeft),
      register(KEYBOARD_SHORTCUTS.moveSelectionRight),
      register(KEYBOARD_SHORTCUTS.moveSelectionUp),
      register(KEYBOARD_SHORTCUTS.moveSelectionDown),

      // Move rows vertically (one step)
      register(KEYBOARD_SHORTCUTS.moveRowUp),
      register(KEYBOARD_SHORTCUTS.moveRowDown),
      // Move rows vertically (top / bottom)
      register(KEYBOARD_SHORTCUTS.moveRowToStart),
      register(KEYBOARD_SHORTCUTS.moveRowToEnd),

      // Move cells horizontally
      register(KEYBOARD_SHORTCUTS.moveCellLeft),
      register(KEYBOARD_SHORTCUTS.moveCellRight),

      register(KEYBOARD_SHORTCUTS.scrollToLineStart),
      register(KEYBOARD_SHORTCUTS.scrollToLineEnd),
      register(KEYBOARD_SHORTCUTS.scrollPageUp),
      register(KEYBOARD_SHORTCUTS.scrollPageDown),

      register(KEYBOARD_SHORTCUTS.insertGap),
      register(KEYBOARD_SHORTCUTS.deleteBackward),
      register(KEYBOARD_SHORTCUTS.deleteSelection),
      register(KEYBOARD_SHORTCUTS.deleteBase),

      // Undo (Cmd+Z / Ctrl+Z)
      register(KEYBOARD_SHORTCUTS.undo),
      // Redo (Cmd+Shift+Z / Ctrl+Shift+Z)
      register(KEYBOARD_SHORTCUTS.redo),

      // Goto Position Dialog (Cmd+G / Ctrl+G)
      register(KEYBOARD_SHORTCUTS.gotoPosition),

      container.resolve<KeyboardShortcutService>(KEYBOARD_SHORTCUT_SERVICE_TOKEN).registerShortcut({ callback: mutateSelection, element: containerRef.current! }),
      container.resolve<KeyboardShortcutService>(KEYBOARD_SHORTCUT_SERVICE_TOKEN).registerShortcut({ callback: mutateSelection, element: containerRef.current!, modifiers: [['Shift']] }),
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

    const mutate = async (base: string) => {
      if (!metaSubject.data) {
        return;
      }
      const mutateArguments = EditorUtil.getMutateArguments(selectionSubject.data, metaSubject.data);
      if (!mutateArguments) {
        return;
      }
      await execute({
        command: async () => {
          await editorService.mutate(mutateArguments.rows, mutateArguments.columns, base);
        },
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

    const moveRowsEnd = async (direction: EDITOR_DIRECTION) => {
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
            await editorService.moveRowsToTop(rows);
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = 0;
            }
          } else {
            await editorService.moveRowsToBottom(rows);
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop =
                scrollContainerRef.current.scrollHeight - scrollContainerRef.current.clientHeight;
            }
          }
        },
        getSelectionPostCommand: () =>
          EditorUtil.getMovedRowsEndSelection(selectionSubject.data, direction, metaSubject.data),
      });
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
        getSelectionPostCommand: () => EditorUtil.getMovedRowsRelativeSelection(selectionSubject.data, direction, metaSubject.data),
      });
    };

    const moveCells = async (_direction: EDITOR_DIRECTION) => {
      // TODO
    };

    const eventBusService = container.resolve(SequenceEditorEventBusService);
    const removers = [
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onSearch', async (searchQuery) => {
        if (!searchQuery) {
          return;
        }
        const result = await editorService.search(searchQuery, true);
        sequenceEditorStore.getState().setSearchResult(result);
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onExpandSelection', (direction) => expandSelection(direction)),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onGotoPosition', () => sequenceEditorGotoPositionDialogRef.current?.open({})),
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
        void mutate(base);
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onUndo', () => {
        void execute({
          command: async () => editorService.undo(),
          getSelectionPostCommand: () => null,
        });
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onCancelRealign', () => {
        editorService.cancelRealign();
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onRealign', () => {
        const store = sequenceEditorStore.getState();
        store.setIsRealigning(true);
        store.setLatestMessage('Re-aligning sequences with MAFFT (FFT-NS-1)...');
        let wasCancelled = false;
        void execute({
          command: async () => {
            try {
              await editorService.realign();
              sequenceEditorStore.getState().setLatestMessage('Re-alignment completed successfully');
            } catch (error) {
              if (error instanceof DOMException && error.name === 'AbortError') {
                wasCancelled = true;
                sequenceEditorStore.getState().setLatestMessage('Re-alignment cancelled');
              } else {
                throw error;
              }
            } finally {
              sequenceEditorStore.getState().setIsRealigning(false);
            }
          },
          getSelectionPostCommand: () => (wasCancelled ? selectionSubject.data : null),
        });
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onRedo', () => {
        void execute({
          command: async () => editorService.redo(),
          getSelectionPostCommand: () => null,
        });
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onExportGappedFasta', async () => {
        console.log('Exporting gapped fasta');
        const fasta = await editorService.exportGappedFasta();
        ExportUtil.downloadFastaFile(fasta, 'sequence.gapped.fasta');
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onExportUngappedFasta', async () => {
        console.log('Exporting ungapped fasta');
        const fasta = await editorService.exportUngappedFasta();
        ExportUtil.downloadFastaFile(fasta, 'sequence.ungapped.fasta');
      }),
    ];
    return () => {
      removers.forEach(remover => remover());
      editorService.cancelRealign();
    };
  }, [editorService, selectionSubject, updateMeta, updateVisibleRange, metaSubject, setIsRealigning, setLatestMessage]);

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
    const currentDevicePixelRatio = container.resolve<DevicePixelRatioService>(DEVICE_PIXEL_RATIO_SERVICE_TOKEN).data;
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
    const containerElement = containerRef.current;
    const currentDevicePixelRatio = container.resolve<DevicePixelRatioService>(DEVICE_PIXEL_RATIO_SERVICE_TOKEN).data;
    const resize = labelResizeRef.current;
    if (!containerElement || !canvas) {
      return;
    }

    if (resize) {
      const labelWidth = Math.min(maxLabelWidth, Math.max(MIN_LABEL_WIDTH, resize.startLabelWidth + event.clientX - resize.startX));
      geometrySubject.next({
        ...geometrySubject.data,
        labelWidth,
      });
      containerElement.style.cursor = 'col-resize';
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
      containerElement.style.cursor = 'default';
      return;
    }

    if (path.type === EDITOR_PATH_PROPERTIES_TYPE.DIVIDER) {
      containerElement.style.cursor = 'col-resize';
    } else {
      containerElement.style.cursor = 'default';
    }
  }, [geometrySubject, maxLabelWidth, selectionSubject]);

  const onContainerMouseUp = useCallback(() => {
    labelResizeRef.current = null;
    selectionDragRef.current = null;
  }, []);

  const onGotoPosition = useCallback((x: null | number, y: null | number) => {
    EditorUtil.scrollToPosition({
      geometry: geometrySubject.data,
      scrollContainer: scrollContainerRef.current,
      x,
      y,
    });
  }, [geometrySubject]);

  const canvasWidth = Math.max(1, Math.floor(containerDimensions.width * devicePixelRatio));
  const canvasHeight = Math.max(1, Math.floor(containerDimensions.height * devicePixelRatio));

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateRows: 'max-content auto',
        height: '100%',
        position: 'relative',
        width: '100%',
      }}
    >
      <SequenceEditorSearchBar />
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
      <SequenceEditorGotoPositionDialog
        onGotoPosition={onGotoPosition}
        ref={sequenceEditorGotoPositionDialogRef}
      />
      <SequenceEditorRealignModal />
    </Box>
  );
};
