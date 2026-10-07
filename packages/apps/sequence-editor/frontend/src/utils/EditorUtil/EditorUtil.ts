import padStart from 'lodash/padStart';

import type {
  AminoAcidPalette,
  EditorAssembly,
  EditorPathProperties,
  EditorSelection,
  EngineMeta,
  EngineViewportResult,
  GridGeometry,
  GridRange,
  NucleotidePalette,
  StatusBarSelectionStats,
  VisibleGridRange,
} from '../../models';
import { EDITOR_PATH_PROPERTIES_TYPE } from '../../models';
import { PaletteUtil } from '../PaletteUtil';
import { DEFAULT_GRID_GEOMETRY } from '../../constants';
import { EDITOR_DIRECTION } from '../../models/editor';

export class EditorUtil {
  public static drawCanvas({
    canvasElement,
    devicePixelRatio,
    geometry,
    meta,
    palette,
    rowNames,
    rowNamesStartRow,
    scrollLeft,
    scrollTop,
    selection,
    viewport,
    viewportHeight,
    viewportWidth,
  }: {
    canvasElement: HTMLCanvasElement;
    devicePixelRatio: number;
    geometry: GridGeometry;
    meta: EngineMeta;
    palette: AminoAcidPalette | NucleotidePalette;
    rowNames: string[];
    rowNamesStartRow: number;
    scrollLeft: number;
    scrollTop: number;
    selection: EditorSelection | null;
    viewport: EngineViewportResult;
    viewportHeight: number;
    viewportWidth: number;
  }): EditorAssembly {
    const editorAssembly: EditorAssembly = {
      cells: {
        pathPropertiesMap: new Map(),
      },
      divider: {
        pathPropertiesMap: new Map(),
      },
      labels: {
        pathPropertiesMap: new Map(),
      },
      ruler: {
        pathPropertiesMap: new Map(),
      },
    };

    if (!canvasElement) {
      return editorAssembly;
    }
    const context = canvasElement.getContext('2d');
    if (!context) {
      return editorAssembly;
    }

    const labelStringLength = meta.sequenceCount.toString().length;
    const isRowSelected = (row: number): boolean => {
      return selection?.rows?.includes(row) ?? false;
    };
    const isCellSelected = (row: number, col: number): boolean => Boolean(
      selection?.cells &&
      col >= selection.cells.startCol &&
      col <= selection.cells.endCol &&
      row >= selection.cells.startRow &&
      row <= selection.cells.endRow,
    ) || Boolean(
      selection?.cols?.includes(col),
    ) || Boolean(
      isRowSelected(row),
    );

    EditorUtil.draw(canvasElement, devicePixelRatio, () => {
      context.clearRect(0, 0, canvasElement.width, canvasElement.height);

      const { cellHeight, cellWidth, dividerWidth, labelWidth, rulerHeight } = geometry;
      const gridStart = labelWidth + dividerWidth;

      const { bytes, cols, rows, startCol, startRow } = viewport;

      // Render cells
      context.font = '12px monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      for (let row = 0; row < rows; row++) {
        // cell position on screen, offset by the viewport's grid origin and current scroll
        const y = (startRow + row) * cellHeight + rulerHeight - scrollTop;
        if (y + cellHeight < rulerHeight || y > viewportHeight) {
          continue;
        }
        for (let col = 0; col < cols; col++) {
          const x = (startCol + col) * cellWidth + gridStart - scrollLeft;
          if (x + cellWidth < gridStart || x > viewportWidth) {
            continue;
          }
          const byte = bytes[row * cols + col];
          const cellCol = startCol + col;
          const cellRow = startRow + row;
          const charCode = byte ?? '';
          const label = String.fromCharCode(charCode);
          const colors = PaletteUtil.paletteEntryFor(palette, label);
          let cellBackground = colors.background;
          if (byte === null) {
            cellBackground = '#e9eef2';
          } else if (label === ' ') {
            cellBackground = '#f7f8f9';
          }
          let cellForeground = colors.foreground;
          const isSelected = isCellSelected(cellRow, cellCol);
          if (isSelected) {
            cellBackground = colors.backgroundSelected;
            cellForeground = colors.foregroundSelected;
          }
          const rectanglePath = new Path2D();
          rectanglePath.rect(x, y, cellWidth, cellHeight);
          rectanglePath.closePath();
          editorAssembly.cells.pathPropertiesMap.set(rectanglePath, {
            col: cellCol,
            row: cellRow,
            type: EDITOR_PATH_PROPERTIES_TYPE.CELL,
          });
          // draw path on canvas
          context.fillStyle = cellBackground;
          context.fill(rectanglePath);
          context.fillStyle = cellForeground;
          context.fillText(label, x + cellWidth / 2, y + cellHeight / 2);
        }
      }

      // Render ruler
      context.fillStyle = '#edf2f6';
      context.fillRect(0, 0, viewportWidth, rulerHeight);
      context.font = '12px monospace';
      context.textBaseline = 'middle';

      const tickCols: number[] = [];
      context.strokeStyle = '#9fb3c8';
      context.lineWidth = 1;
      context.beginPath();
      for (let col = 0; col < cols; col++) {
        const isMajorTick = (startCol + col + 1) % 10 === 0;
        if (isMajorTick) {
          tickCols.push(col);
        }
        const rulerX = (startCol + col) * cellWidth + gridStart - scrollLeft;
        const rulerPath = new Path2D();
        rulerPath.rect(rulerX, 0, cellWidth, rulerHeight);
        rulerPath.closePath();
        editorAssembly.ruler.pathPropertiesMap.set(rulerPath, {
          col: startCol + col,
          type: EDITOR_PATH_PROPERTIES_TYPE.RULER,
        });
        const x = rulerX + 0.5;
        const tickHeight = isMajorTick ? 8 : 4;
        context.moveTo(x, rulerHeight);
        context.lineTo(x, rulerHeight - tickHeight);
      }
      context.stroke();

      context.fillStyle = '#486581';
      context.textAlign = 'center';
      tickCols.forEach((col) => {
        const x = (startCol + col) * cellWidth + gridStart - scrollLeft;
        const label = String(startCol + col + 1);
        const textWidth = context.measureText(label).width;
        // skip labels that would be clipped by the gutter or the canvas edge
        if (x - textWidth / 2 < gridStart || x + textWidth / 2 > viewportWidth) {
          return;
        }
        context.fillText(label, x, rulerHeight / 2);
      });
      context.textAlign = 'start';

      context.strokeStyle = '#bcccdc';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(gridStart + 0.5, 0);
      context.lineTo(gridStart + 0.5, viewportHeight);
      context.moveTo(0, rulerHeight + 0.5);
      context.lineTo(viewportWidth, rulerHeight + 0.5);
      context.stroke();

      // Corner stays fixed above the label gutter; ruler marks scroll underneath it
      context.fillStyle = '#edf2f6';
      context.fillRect(0, 0, gridStart, rulerHeight);
      context.fillStyle = '#d9e2ec';
      context.fillRect(labelWidth, 0, dividerWidth, viewportHeight);
      const dividerPath = new Path2D();
      dividerPath.rect(labelWidth, 0, dividerWidth, viewportHeight);
      dividerPath.closePath();
      editorAssembly.divider.pathPropertiesMap.set(dividerPath, {
        type: EDITOR_PATH_PROPERTIES_TYPE.DIVIDER,
      });

      // Render labels
      context.fillStyle = '#f8fafb';
      context.fillRect(0, rulerHeight, labelWidth, viewportHeight - rulerHeight);
      context.font = '12px monospace';
      context.textBaseline = 'middle';
      context.save();
      context.beginPath();
      context.rect(0, rulerHeight, labelWidth, viewportHeight - rulerHeight);
      context.clip();
      for (let row = 0; row < rows; row++) {
        const y = (startRow + row) * cellHeight + rulerHeight - scrollTop;
        if (y + cellHeight < rulerHeight || y > viewportHeight) {
          continue;
        }
        const labelPath = new Path2D();
        labelPath.rect(0, y, labelWidth, cellHeight);
        labelPath.closePath();
        editorAssembly.labels.pathPropertiesMap.set(labelPath, {
          row: startRow + row,
          type: EDITOR_PATH_PROPERTIES_TYPE.LABEL,
        });
        const rowNameIndex = startRow + row - rowNamesStartRow;
        const labelRow = startRow + row;
        const isLabelSelected = Boolean(selection?.cols) || Boolean(
          selection?.cells &&
          labelRow >= selection.cells.startRow &&
          labelRow <= selection.cells.endRow,
        ) || isRowSelected(labelRow);
        context.fillStyle = isLabelSelected ? '#1565c0' : '#f8fafb';
        context.fillRect(0, y, labelWidth, cellHeight);
        context.fillStyle = isLabelSelected ? '#ffffff' : '#334e68';
        context.fillText(`${padStart(String(startRow + row + 1), labelStringLength, '0')}: ${rowNames[rowNameIndex] ?? ''}`, 8, y + cellHeight / 2);
      }
      context.restore();
    });

    return editorAssembly;
  }

  public static getExpandedSelection(currentSelection: EditorSelection, initialSelection: EditorSelection, direction: EDITOR_DIRECTION, metaData: EngineMeta): EditorSelection | null {
    const cells = currentSelection.cells;
    if (cells) {
      if (direction === EDITOR_DIRECTION.LEFT) {
        const initialCells = initialSelection.cells;
        if (!initialCells) {
          return null;
        }
        const expandsLeft = cells.startCol < initialCells.startCol || cells.endCol <= initialCells.startCol;
        const nextStartCol = expandsLeft ? cells.startCol - 1 : cells.startCol;
        const endCol = expandsLeft ? cells.endCol : cells.endCol - 1;
        if (nextStartCol < 0) {
          return null;
        }
        return {
          cells: {
            ...cells,
            endCol,
            startCol: nextStartCol,
          },
        };
      }
      if (direction === EDITOR_DIRECTION.RIGHT) {
        const initialCells = initialSelection.cells;
        if (!initialCells) {
          return null;
        }
        const startCol = cells.startCol < initialCells.startCol ? cells.startCol + 1 : cells.startCol;
        const endCol = cells.startCol < initialCells.startCol ? cells.endCol : cells.endCol + 1;
        if (endCol >= metaData.alignmentWidth) {
          return null;
        }
        return {
          cells: {
            ...cells,
            endCol,
            startCol,
          },
        };
      }
      if (direction === EDITOR_DIRECTION.UP) {
        const initialCells = initialSelection.cells;
        if (!initialCells) {
          return null;
        }
        const expandsUp = cells.startRow < initialCells.startRow || cells.endRow <= initialCells.startRow;
        const nextStartRow = expandsUp ? cells.startRow - 1 : cells.startRow;
        const endRow = expandsUp ? cells.endRow : cells.endRow - 1;
        if (nextStartRow < 0) {
          return null;
        }
        return {
          cells: {
            ...cells,
            endRow,
            startRow: nextStartRow,
          },
        };
      }
      const initialCells = initialSelection.cells;
      if (!initialCells) {
        return null;
      }
      const startRow = cells.startRow < initialCells.startRow ? cells.startRow + 1 : cells.startRow;
      const endRow = cells.startRow < initialCells.startRow ? cells.endRow : cells.endRow + 1;
      if (endRow >= metaData.sequenceCount) {
        return null;
      }
      return {
        cells: {
          ...cells,
          endRow,
          startRow,
        },
      };
    }

    const cols = currentSelection.cols;
    if (cols) {
      if (cols.length === 0 || (direction !== EDITOR_DIRECTION.LEFT && direction !== EDITOR_DIRECTION.RIGHT)) {
        return null;
      }
      const min = Math.min(...cols);
      const max = Math.max(...cols);
      const initialCols = initialSelection.cols;
      if (!initialCols || initialCols.length === 0) {
        return null;
      }
      const initialMin = Math.min(...initialCols);
      if (direction === EDITOR_DIRECTION.LEFT) {
        if (max > initialMin) {
          return { cols: cols.slice(0, -1) };
        }
        return min > 0 ? { cols: [min - 1, ...cols] } : null;
      }
      if (min < initialMin) {
        return { cols: cols.slice(1) };
      }
      return max < metaData.alignmentWidth - 1 ? { cols: [...cols, max + 1] } : null;
    }

    const rows = currentSelection.rows;
    if (rows) {
      return currentSelection;
    }

    return null;
  }

  public static getMovedSelection(selection: EditorSelection | null, direction: EDITOR_DIRECTION, metaData: EngineMeta): EditorSelection | null {
    if (!selection) {
      return null;
    }

    const offset = direction === EDITOR_DIRECTION.LEFT || direction === EDITOR_DIRECTION.UP ? -1 : 1;
    const canMove = (min: number, max: number, limit: number): boolean => (
      offset < 0 ? min > 0 : max < limit - 1
    );

    const cells = selection.cells;
    if (cells) {
      if (direction === EDITOR_DIRECTION.LEFT || direction === EDITOR_DIRECTION.RIGHT) {
        if (!canMove(cells.startCol, cells.endCol, metaData.alignmentWidth)) {
          return null;
        }
        return {
          cells: {
            endCol: cells.endCol + offset,
            endRow: cells.endRow,
            startCol: cells.startCol + offset,
            startRow: cells.startRow,
          },
        };
      }

      if (!canMove(cells.startRow, cells.endRow, metaData.sequenceCount)) {
        return null;
      }
      return {
        cells: {
          endCol: cells.endCol,
          endRow: cells.endRow + offset,
          startCol: cells.startCol,
          startRow: cells.startRow + offset,
        },
      };
    }

    const cols = selection.cols;
    if (cols) {
      if ((direction !== EDITOR_DIRECTION.LEFT && direction !== EDITOR_DIRECTION.RIGHT) || cols.length === 0) {
        return null;
      }
      const min = Math.min(...cols);
      const max = Math.max(...cols);
      if (!canMove(min, max, metaData.alignmentWidth)) {
        return null;
      }
      return { cols: cols.map(col => col + offset) };
    }

    const rows = selection.rows;
    if (rows) {
      if ((direction !== EDITOR_DIRECTION.UP && direction !== EDITOR_DIRECTION.DOWN) || rows.length === 0) {
        return null;
      }
      const min = Math.min(...rows);
      const max = Math.max(...rows);
      if (!canMove(min, max, metaData.sequenceCount)) {
        return null;
      }
      return { rows: rows.map(row => row + offset) };
    }

    return null;
  }

  public static getMutateRangeArguments(selection: EditorSelection | null, metaData: EngineMeta, offset: number = 0): { endCol: number; rows: number[]; startCol: number } | undefined {
    const cells = selection?.cells;
    if (cells) {
      return {
        endCol: cells.endCol + offset,
        rows: Array.from({ length: cells.endRow - cells.startRow + 1 }, (_, index) => cells.startRow + index),
        startCol: cells.startCol + offset,
      };
    }

    const cols = selection?.cols;
    if (cols) {
      return {
        endCol: cols[cols.length - 1] + offset,
        rows: Array.from({ length: metaData.sequenceCount }, (_, index) => index),
        startCol: cols[0] + offset,
      };
    }

    const rows = selection?.rows;
    if (rows) {
      return {
        endCol: metaData.alignmentWidth - 1 + offset,
        rows,
        startCol: 0 + offset,
      };
    }

    return undefined;
  }

  /**
   * Performs a hit-test against the tree assembly's path maps to find the
   * tree node or line segment under the mouse cursor.
   *
   * Checks in priority order: node dots (via `isPointInPath`) -> horizontal
   * branch lines (with ±1 px vertical tolerance) -> vertical connector lines
   * (with ±1 px horizontal tolerance).
   *
   * @param params.canvas - The canvas element that received the mouse event.
   * @param params.event - The mouse event providing cursor coordinates.
   * @param params.treeAssembly - The assembly containing path maps to hit-test against.
  * @param params.devicePixelRatio - Screen DPR used when the canvas backing store is scaled.
   * @returns The {@link EditorPathProperties} of the hit cell, or `undefined` if nothing was hit.
   */
  public static getPathPropertiesFromCanvas(params: { canvas: HTMLCanvasElement; devicePixelRatio: number; editorAssembly: EditorAssembly; event: MouseEvent }): EditorPathProperties | undefined {
    const { canvas, devicePixelRatio, editorAssembly, event } = params;

    const ctx = EditorUtil.getCanvasContext(canvas);
    const rect = canvas.getBoundingClientRect();
    const canvasScaleX = canvas.width / rect.width;
    const canvasScaleY = canvas.height / rect.height;
    const canvasX = (event.clientX - rect.left) * canvasScaleX / devicePixelRatio;
    const canvasY = (event.clientY - rect.top) * canvasScaleY / devicePixelRatio;

    for (const [path, pathProperties] of editorAssembly.cells.pathPropertiesMap) {
      if (ctx.isPointInPath(path, canvasX, canvasY)) {
        return pathProperties;
      }
    }

    for (const [path, pathProperties] of editorAssembly.ruler.pathPropertiesMap) {
      if (ctx.isPointInPath(path, canvasX, canvasY)) {
        return pathProperties;
      }
    }

    for (const [path, pathProperties] of editorAssembly.labels.pathPropertiesMap) {
      if (ctx.isPointInPath(path, canvasX, canvasY)) {
        return pathProperties;
      }
    }

    for (const [path, pathProperties] of editorAssembly.divider.pathPropertiesMap) {
      if (ctx.isPointInPath(path, canvasX, canvasY)) {
        return pathProperties;
      }
    }

    return undefined;
  }

  public static getPostUpsertSelection(selection: EditorSelection | null, direction: EDITOR_DIRECTION): EditorSelection | null {
    if (!selection) {
      return null;
    }

    const offset = direction === EDITOR_DIRECTION.LEFT ? -1 : 1;

    const cells = selection.cells;
    if (cells) {
      return {
        cells: {
          endCol: cells.endCol + offset,
          endRow: cells.endRow,
          startCol: cells.startCol + offset,
          startRow: cells.startRow,
        },
      };
    }

    const cols = selection.cols;
    if (cols) {
      return {
        cols: cols.map(col => col + offset),
      };
    }

    const rows = selection.rows;
    if (rows) {
      return {
        rows,
      };
    }

    return null;
  }

  public static getRowsToMove(selection: EditorSelection | null, direction: EDITOR_DIRECTION, metaData: EngineMeta): number[] | undefined {
    const cells = selection?.cells;
    const rows = selection?.rows ?? (cells
      ? Array.from({ length: cells.endRow - cells.startRow + 1 }, (_, index) => cells.startRow + index)
      : undefined);
    if (!rows || rows.length === 0) {
      return undefined;
    }

    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    if (direction === EDITOR_DIRECTION.UP && minRow === 0) {
      return undefined;
    }
    if (direction === EDITOR_DIRECTION.DOWN && maxRow === metaData.sequenceCount - 1) {
      return undefined;
    }
    return rows;
  }

  public static getSelectionFromPathProperties(params: { endPath: EditorPathProperties; startPath: EditorPathProperties }): EditorSelection | undefined {
    const { endPath, startPath } = params;

    if (startPath.type === EDITOR_PATH_PROPERTIES_TYPE.RULER && (
      endPath.type === EDITOR_PATH_PROPERTIES_TYPE.RULER ||
      endPath.type === EDITOR_PATH_PROPERTIES_TYPE.CELL
    )) {
      const startCol = Math.min(startPath.col, endPath.col);
      const endCol = Math.max(startPath.col, endPath.col);
      return {
        cols: Array.from({ length: endCol - startCol + 1 }, (_, index) => startCol + index),
      };
    }

    if (startPath.type === EDITOR_PATH_PROPERTIES_TYPE.CELL && endPath.type === EDITOR_PATH_PROPERTIES_TYPE.CELL) {
      return {
        cells: {
          endCol: Math.max(startPath.col, endPath.col),
          endRow: Math.max(startPath.row, endPath.row),
          startCol: Math.min(startPath.col, endPath.col),
          startRow: Math.min(startPath.row, endPath.row),
        },
      };
    }

    if (startPath.type === EDITOR_PATH_PROPERTIES_TYPE.LABEL && endPath.type === EDITOR_PATH_PROPERTIES_TYPE.LABEL) {
      const startRow = Math.min(startPath.row, endPath.row);
      const endRow = Math.max(startPath.row, endPath.row);
      return {
        rows: Array.from({ length: endRow - startRow + 1 }, (_, index) => startRow + index),
      };
    }

    return undefined;
  }

  public static getStatusBarSelectionStats(selection: EditorSelection | null, meta: EngineMeta | null = null): StatusBarSelectionStats {
    if (!selection) {
      return {
        cols: 0,
        pos: 0,
        selectedSeqs: 0,
        totalSelectedChars: 0,
      };
    }

    if (selection.cells) {
      const cols = selection.cells.endCol - selection.cells.startCol + 1;
      const selectedSeqs = selection.cells.endRow - selection.cells.startRow + 1;
      return {
        cols,
        pos: selection.cells.startCol + 1,
        selectedSeqs,
        totalSelectedChars: cols * selectedSeqs,
      };
    }

    if (selection.cols) {
      const cols = selection.cols.length;
      const selectedSeqs = meta?.sequenceCount ?? 0;
      return {
        cols,
        pos: selection.cols[0] === undefined ? 0 : selection.cols[0] + 1,
        selectedSeqs,
        totalSelectedChars: cols * selectedSeqs,
      };
    }

    const selectedSeqs = selection.rows?.length ?? 0;
    const cols = meta?.alignmentWidth ?? 0;
    return {
      cols,
      pos: 0,
      selectedSeqs,
      totalSelectedChars: cols * selectedSeqs,
    };
  }

  public static getUpsertArguments(selection: EditorSelection | null, metaData: EngineMeta, offset: number = 0): { col: number; rows: number[] } | undefined {
    const cells = selection?.cells;
    if (cells) {
      return {
        col: cells.startCol + offset,
        rows: Array.from({ length: cells.endRow - cells.startRow + 1 }, (_, index) => cells.startRow + index),
      };
    }

    const cols = selection?.cols;
    if (cols) {
      return {
        col: cols[0] + offset,
        rows: Array.from({ length: metaData.sequenceCount }, (_, index) => index),
      };
    }

    const rows = selection?.rows;
    if (rows) {
      return {
        col: 0 + offset,
        rows,
      };
    }

    return undefined;
  }

  public static getVisibleGridRange(params: {
    geometry?: GridGeometry;
    numCols: number;
    numRows: number;
    scrollLeft: number;
    scrollTop: number;
    viewportHeight: number;
    viewportWidth: number;
  }): VisibleGridRange {
    const {
      geometry = DEFAULT_GRID_GEOMETRY,
      numCols,
      numRows,
      scrollLeft,
      scrollTop,
      viewportHeight,
      viewportWidth,
    } = params;
    const gridStart = geometry.labelWidth + geometry.dividerWidth;
    const visibleStartCol = Math.max(0, Math.floor(scrollLeft / geometry.cellWidth));
    const visibleEndCol = Math.min(
      numCols,
      visibleStartCol + Math.max(1, Math.ceil((viewportWidth - gridStart) / geometry.cellWidth) + 1),
    );
    const visibleStartRow = Math.max(0, Math.floor(Math.max(0, scrollTop - geometry.rulerHeight) / geometry.cellHeight));
    const visibleEndRow = Math.min(
      numRows,
      visibleStartRow + Math.max(1, Math.ceil((viewportHeight - geometry.rulerHeight) / geometry.cellHeight) + 1),
    );

    return {
      cache: {
        endCol: Math.min(numCols, visibleEndCol + geometry.numOverscanCols),
        endRow: Math.min(numRows, visibleEndRow + geometry.numOverscanRows),
        startCol: Math.max(0, visibleStartCol - geometry.numOverscanCols),
        startRow: Math.max(0, visibleStartRow - geometry.numOverscanRows),
      },
      visible: {
        endCol: visibleEndCol,
        endRow: visibleEndRow,
        startCol: visibleStartCol,
        startRow: visibleStartRow,
      },
    };
  }

  public static isWithinGridRange(params: { cachedGridRange: GridRange; visibleGridRange: GridRange }): boolean {
    const { cachedGridRange, visibleGridRange } = params;
    return (
      visibleGridRange.startCol >= cachedGridRange.startCol &&
      visibleGridRange.endCol <= cachedGridRange.endCol &&
      visibleGridRange.startRow >= cachedGridRange.startRow &&
      visibleGridRange.endRow <= cachedGridRange.endRow
    );
  }

  /**
  * Helper that wraps a canvas drawing callback with a DPR-aware transform, then
  * restores the context to its pre-call state.
   *
   * @param canvas - The canvas element whose 2D context to use.
   * @param devicePixelRatio - Screen DPR to scale up for HiDPI rendering.
   * @param callback - Drawing operations to perform inside the transform.
   */
  private static draw(canvas: HTMLCanvasElement, devicePixelRatio: number, callback: (ctx: CanvasRenderingContext2D) => void): void {
    const ctx = EditorUtil.getCanvasContext(canvas);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    callback(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private static getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D canvas context.');
    }
    return ctx;
  }
}
