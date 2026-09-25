import padStart from 'lodash/padStart';

import type {
  EditorAssembly,
  EditorPathProperties,
  EditorSelection,
  EngineMeta,
  EngineViewportResult,
  GridGeometry,
  GridRange,
  PaletteModel,
  VisibleGridRange,
} from '../../models';
import { EDITOR_PATH_PROPERTIES_TYPE } from '../../models';
import { paletteEntryFor } from '../palette';
import { DEFAULT_GRID_GEOMETRY } from '../../constants';


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
    palette: PaletteModel;
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

    EditorUtil.draw(canvasElement, devicePixelRatio, () => {
      context.clearRect(0, 0, canvasElement.width, canvasElement.height);

      const { cellHeight, cellWidth, dividerWidth, labelWidth, rulerHeight } = geometry;
      const gridStart = labelWidth + dividerWidth;

      const { bytes, cols, rows, startCol, startRow } = viewport;

      // Render cells
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
          const colors = paletteEntryFor(palette, label);
          let cellBackground = colors.background;
          if (byte === null) {
            cellBackground = '#e9eef2';
          } else if (label === ' ') {
            cellBackground = '#f7f8f9';
          }
          let cellForeground = colors.foreground;
          const isCellSelected = Boolean(
            selection?.cells &&
            cellCol >= selection.cells.startCol &&
            cellCol <= selection.cells.endCol &&
            cellRow >= selection.cells.startRow &&
            cellRow <= selection.cells.endRow,
          ) || Boolean(
            selection?.cols?.includes(cellCol),
          ) || Boolean(
            isRowSelected(cellRow),
          );
          if (isCellSelected) {
            [cellBackground, cellForeground] = [cellForeground, cellBackground];
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
   * @param params.devicePixelRatio - Screen DPR for correct coordinate scaling.
   * @returns The {@link EditorPathProperties} of the hit cell, or `undefined` if nothing was hit.
   */
  public static getPathPropertiesFromCanvas(params: { canvas: HTMLCanvasElement; devicePixelRatio: number; editorAssembly: EditorAssembly; event: MouseEvent }): EditorPathProperties | undefined {
    const { canvas, devicePixelRatio, editorAssembly, event } = params;

    const ctx = EditorUtil.getCanvasContext(canvas);
    const rect = canvas.getBoundingClientRect();
    const canvasX = (event.clientX - rect.left) * devicePixelRatio;
    const canvasY = (event.clientY - rect.top) * devicePixelRatio;

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
      } as EditorSelection;
    }

    if (startPath.type === EDITOR_PATH_PROPERTIES_TYPE.CELL && endPath.type === EDITOR_PATH_PROPERTIES_TYPE.CELL) {
      return {
        cells: {
          endCol: Math.max(startPath.col, endPath.col),
          endRow: Math.max(startPath.row, endPath.row),
          startCol: Math.min(startPath.col, endPath.col),
          startRow: Math.min(startPath.row, endPath.row),
        },
      } as EditorSelection;
    }

    if (startPath.type === EDITOR_PATH_PROPERTIES_TYPE.LABEL && endPath.type === EDITOR_PATH_PROPERTIES_TYPE.LABEL) {
      const startRow = Math.min(startPath.row, endPath.row);
      const endRow = Math.max(startPath.row, endPath.row);
      return {
        rows: Array.from({ length: endRow - startRow + 1 }, (_, index) => startRow + index),
      } as EditorSelection;
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
