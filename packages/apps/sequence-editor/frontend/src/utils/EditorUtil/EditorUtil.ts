import padStart from 'lodash/padStart';

import type {
  EditorAssembly,
  EditorPathProperties,
  EditorSelection,
  EngineMeta,
  EngineSearchResult,
  EngineViewportResult,
  GridGeometry,
  GridRange,
  SearchMatch,
  SearchResult,
  StatusBarSelectionStats,
  VisibleGridRange,
} from '../../models/editor.models';
import {
  EDITOR_DIRECTION,
  EDITOR_PATH_PROPERTIES_TYPE,
  MATRIX_TYPE,
} from '../../models/editor.models';
import { PaletteUtil } from '../PaletteUtil';
import { DEFAULT_GRID_GEOMETRY } from '../../constants';
import type {
  AminoAcidPalette,
  NucleotidePalette,
} from '../../models/palette.models';

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
    searchResult,
    searchResultHighlightedIndex,
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
    searchResult: EngineSearchResult | null;
    searchResultHighlightedIndex: null | number;
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
    const highlightedSearchHit = searchResult && searchResultHighlightedIndex !== null
      ? EditorUtil.searchHitAt(searchResult, searchResultHighlightedIndex)
      : null;

    EditorUtil.draw(canvasElement, devicePixelRatio, () => {
      context.clearRect(0, 0, canvasElement.width, canvasElement.height);

      const { cellHeight, cellWidth, dividerWidth, labelWidth, rulerHeight } = geometry;
      const gridStart = labelWidth + dividerWidth;

      const { bytes, cols, rows, startCol, startRow } = viewport;
      const hasSearchResult = (searchResult?.positions.length ?? 0) > 0;
      const searchMatchFlags = hasSearchResult ? new Uint8Array(rows * cols) : null;
      const highlightedSearchMatchFlags = highlightedSearchHit ? new Uint8Array(rows * cols) : null;
      const searchRowFlags = hasSearchResult ? new Uint8Array(rows) : null;
      const highlightedSearchRowFlags = highlightedSearchHit ? new Uint8Array(rows) : null;
      const searchMatchPath = hasSearchResult ? new Path2D() : null;
      const highlightedSearchMatchPath = highlightedSearchHit ? new Path2D() : null;
      let hasSearchMatches = false;
      let hasHighlightedSearchMatches = false;

      const addSearchHitToFlags = (
        hit: EngineSearchResult['positions'][number],
        flags: Uint8Array,
      ): void => {
        if (!searchResult) {
          return;
        }
        const hitLength = Math.max(1, searchResult.query.length);
        const hitRow = hit.row - startRow;
        if (hitRow < 0 || hitRow >= rows) {
          return;
        }
        if (hit.matrix_type === MATRIX_TYPE.RECORD_NAME) {
          flags.fill(1, hitRow * cols, (hitRow + 1) * cols);
          return;
        }
        const hitStartCol = Math.max(startCol, hit.col);
        const hitEndCol = Math.min(startCol + cols, hit.col + hitLength);
        if (hitStartCol >= hitEndCol || !EditorUtil.searchHitContainsCell(hit, searchResult.query, hit.row, hitStartCol)) {
          return;
        }
        const startIndex = hitRow * cols + hitStartCol - startCol;
        flags.fill(1, startIndex, startIndex + hitEndCol - hitStartCol);
      };

      const addSearchHitToRowFlags = (hit: EngineSearchResult['positions'][number], flags: Uint8Array): void => {
        if (hit.matrix_type === MATRIX_TYPE.RECORD_NAME && hit.row >= startRow && hit.row < startRow + rows) {
          flags[hit.row - startRow] = 1;
        }
      };

      if (searchResult && searchMatchFlags) {
        searchResult.positions.forEach((hit) => addSearchHitToFlags(hit, searchMatchFlags));
        searchResult.positions.forEach((hit) => {
          if (searchRowFlags) {
            addSearchHitToRowFlags(hit, searchRowFlags);
          }
        });
        if (highlightedSearchHit && highlightedSearchMatchFlags) {
          addSearchHitToFlags(highlightedSearchHit, highlightedSearchMatchFlags);
          if (highlightedSearchRowFlags) {
            addSearchHitToRowFlags(highlightedSearchHit, highlightedSearchRowFlags);
          }
        }
      }

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
          const cellIndex = row * cols + col;
          const matchesSearch = searchMatchFlags?.[cellIndex] === 1;
          const matchesHighlightedSearch = highlightedSearchMatchFlags?.[cellIndex] === 1;
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
          if (matchesHighlightedSearch || highlightedSearchRowFlags?.[row] === 1) {
            context.fillStyle = 'rgba(255, 193, 7, 0.35)';
            context.fillRect(x + 2, y + 2, Math.max(0, cellWidth - 4), Math.max(0, cellHeight - 4));
          }
          context.fillStyle = cellForeground;
          context.fillText(label, x + cellWidth / 2, y + cellHeight / 2);
          if ((matchesSearch || searchRowFlags?.[row] === 1) && searchMatchPath) {
            hasSearchMatches = true;
            searchMatchPath.rect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1);
            if ((matchesHighlightedSearch || highlightedSearchRowFlags?.[row] === 1) && highlightedSearchMatchPath) {
              hasHighlightedSearchMatches = true;
              highlightedSearchMatchPath.rect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
            }
          }
        }
      }

      if (hasSearchMatches && searchMatchPath) {
        context.strokeStyle = '#000000';
        context.lineWidth = 1;
        context.stroke(searchMatchPath);
      }
      if (hasHighlightedSearchMatches && highlightedSearchMatchPath) {
        context.lineWidth = 2;
        context.stroke(highlightedSearchMatchPath);
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
        const matchesSearchRow = searchRowFlags?.[row] === 1;
        const matchesHighlightedSearchRow = highlightedSearchRowFlags?.[row] === 1;
        const isLabelSelected = Boolean(selection?.cols) || Boolean(
          selection?.cells &&
          labelRow >= selection.cells.startRow &&
          labelRow <= selection.cells.endRow,
        ) || isRowSelected(labelRow);
        context.fillStyle = isLabelSelected ? '#1565c0' : '#f8fafb';
        context.fillRect(0, y, labelWidth, cellHeight);
        if (matchesSearchRow) {
          context.fillStyle = '#ffecb3';
          context.fillRect(0, y, labelWidth, cellHeight);
        }
        if (matchesHighlightedSearchRow) {
          context.fillStyle = 'rgba(255, 193, 7, 0.35)';
          context.fillRect(2, y + 2, Math.max(0, labelWidth - 4), Math.max(0, cellHeight - 4));
        }
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


  public static getMovedRowsEndSelection(selection: EditorSelection | null, direction: EDITOR_DIRECTION, metaData: EngineMeta | null): EditorSelection | null {
    if (!selection || !metaData) {
      return null;
    }

    const cells = selection.cells;
    if (cells) {
      const rowCount = cells.endRow - cells.startRow + 1;
      if (direction === EDITOR_DIRECTION.UP) {
        return {
          cells: {
            ...cells,
            endRow: rowCount - 1,
            startRow: 0,
          },
        };
      }
      const startRow = Math.max(0, metaData.sequenceCount - rowCount);
      return {
        cells: {
          ...cells,
          endRow: metaData.sequenceCount - 1,
          startRow,
        },
      };
    }

    const rows = selection.rows;
    if (rows && rows.length > 0) {
      const rowCount = rows.length;
      if (direction === EDITOR_DIRECTION.UP) {
        return {
          rows: Array.from({ length: rowCount }, (_, idx) => idx),
        };
      }
      const startRow = Math.max(0, metaData.sequenceCount - rowCount);
      return {
        rows: Array.from({ length: rowCount }, (_, idx) => startRow + idx),
      };
    }

    return null;
  }

  public static getMovedRowsGroupedSelection(selection: EditorSelection | null, targetRow: number, metaData: EngineMeta | null): EditorSelection | null {
    if (!selection || !metaData) {
      return null;
    }

    const cells = selection.cells;
    if (cells) {
      const rowCount = cells.endRow - cells.startRow + 1;
      const startRow = Math.max(0, Math.min(targetRow, metaData.sequenceCount - rowCount));
      return {
        cells: {
          ...cells,
          endRow: startRow + rowCount - 1,
          startRow,
        },
      };
    }

    const rows = selection.rows;
    if (rows && rows.length > 0) {
      const rowCount = rows.length;
      const startRow = Math.max(0, Math.min(targetRow, metaData.sequenceCount - rowCount));
      return {
        rows: Array.from({ length: rowCount }, (_, idx) => startRow + idx),
      };
    }

    return null;
  }

  public static getMovedRowsRelativeSelection(selection: EditorSelection | null, direction: EDITOR_DIRECTION, metaData: EngineMeta | null): EditorSelection | null {
    if (!selection || !metaData) {
      return null;
    }

    const cells = selection.cells;
    if (cells) {
      const canMoveUp = direction === EDITOR_DIRECTION.UP && cells.startRow > 0;
      const canMoveDown = direction === EDITOR_DIRECTION.DOWN && cells.endRow < metaData.sequenceCount - 1;
      if (!canMoveUp && !canMoveDown) {
        return selection;
      }
      const offset = direction === EDITOR_DIRECTION.UP ? -1 : 1;
      return {
        cells: {
          ...cells,
          endRow: cells.endRow + offset,
          startRow: cells.startRow + offset,
        },
      };
    }

    const rows = selection.rows;
    if (rows && rows.length > 0) {
      const sortedRows = [...new Set(rows)].sort((a, b) => a - b);
      const blocks: [number, number][] = [];
      let start = sortedRows[0];
      let end = start;

      for (let i = 1; i < sortedRows.length; i++) {
        if (sortedRows[i] === end + 1) {
          end = sortedRows[i];
        } else {
          blocks.push([start, end]);
          start = sortedRows[i];
          end = start;
        }
      }
      blocks.push([start, end]);

      const nextRows: number[] = [];
      if (direction === EDITOR_DIRECTION.UP) {
        for (const [bStart, bEnd] of blocks) {
          if (bStart > 0) {
            for (let r = bStart - 1; r <= bEnd - 1; r++) {
              nextRows.push(r);
            }
          } else {
            for (let r = bStart; r <= bEnd; r++) {
              nextRows.push(r);
            }
          }
        }
      } else if (direction === EDITOR_DIRECTION.DOWN) {
        for (const [bStart, bEnd] of blocks) {
          if (bEnd + 1 < metaData.sequenceCount) {
            for (let r = bStart + 1; r <= bEnd + 1; r++) {
              nextRows.push(r);
            }
          } else {
            for (let r = bStart; r <= bEnd; r++) {
              nextRows.push(r);
            }
          }
        }
      } else {
        return null;
      }

      return { rows: nextRows.sort((a, b) => a - b) };
    }

    return null;
  }

  public static getMovedSelection(selection: EditorSelection | null, direction: EDITOR_DIRECTION, metaData: EngineMeta | null): EditorSelection | null {
    if (!selection || !metaData) {
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
      return EditorUtil.getMovedRowsRelativeSelection(selection, direction, metaData);
    }

    return null;
  }

  public static getMutateArguments(selection: EditorSelection | null, metaData: EngineMeta, offset: number = 0): { columns: number[]; rows: number[] } | undefined {
    const cells = selection?.cells;
    if (cells) {
      const startCol = cells.startCol + offset;
      const endCol = cells.endCol + offset;
      return {
        columns: Array.from({ length: endCol - startCol + 1 }, (_, index) => startCol + index),
        rows: Array.from({ length: cells.endRow - cells.startRow + 1 }, (_, index) => cells.startRow + index),
      };
    }

    const cols = selection?.cols;
    if (cols) {
      return {
        columns: cols.map((col) => col + offset),
        rows: Array.from({ length: metaData.sequenceCount }, (_, index) => index),
      };
    }

    const rows = selection?.rows;
    if (rows) {
      return {
        columns: Array.from({ length: metaData.alignmentWidth }, (_, index) => index + offset),
        rows,
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

    const sortedRows = [...new Set(rows)].sort((a, b) => a - b);
    const k = sortedRows.length;
    if (k === 0 || k === metaData.sequenceCount) {
      return undefined;
    }

    if (direction === EDITOR_DIRECTION.UP) {
      const alreadyAtTop = sortedRows.every((row, idx) => row === idx);
      if (alreadyAtTop) {
        return undefined;
      }
    } else if (direction === EDITOR_DIRECTION.DOWN) {
      const alreadyAtBottom = sortedRows.every((row, idx) => row === metaData.sequenceCount - k + idx);
      if (alreadyAtBottom) {
        return undefined;
      }
    }
    return rows;
  }

  public static getRowsToMoveEnd(selection: EditorSelection | null, direction: EDITOR_DIRECTION, metaData: EngineMeta): number[] | undefined {
    const cells = selection?.cells;
    const rows = selection?.rows ?? (cells
      ? Array.from({ length: cells.endRow - cells.startRow + 1 }, (_, index) => cells.startRow + index)
      : undefined);
    if (!rows || rows.length === 0) {
      return undefined;
    }

    const sortedRows = [...new Set(rows)].sort((a, b) => a - b);
    const k = sortedRows.length;
    if (k === 0 || k === metaData.sequenceCount) {
      return undefined;
    }

    if (direction === EDITOR_DIRECTION.UP) {
      const alreadyAtTop = sortedRows.every((row, idx) => row === idx);
      if (alreadyAtTop) {
        return undefined;
      }
    } else if (direction === EDITOR_DIRECTION.DOWN) {
      const alreadyAtBottom = sortedRows.every((row, idx) => row === metaData.sequenceCount - k + idx);
      if (alreadyAtBottom) {
        return undefined;
      }
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

  public static scrollToPosition(params: {
    geometry: GridGeometry;
    scrollContainer: HTMLDivElement | null;
    x: null | number;
    y: null | number;
  }): void {
    const {
      geometry,
      scrollContainer,
      x,
      y,
    } = params;
    if (!scrollContainer) {
      return;
    }
    scrollContainer.scrollTo({
      left: x === null ? scrollContainer.scrollLeft : Math.max(0, x - 1) * geometry.cellWidth,
      top: y === null ? scrollContainer.scrollTop : Math.max(0, y - 1) * geometry.cellHeight,
    });
  }

  public static scrollToSearchResult(params: {
    geometry: GridGeometry;
    scrollContainer: HTMLDivElement | null;
    searchResult: EngineSearchResult | null;
    searchResultHighlightedIndex: null | number;
  }): void {
    const {
      geometry,
      scrollContainer,
      searchResult,
      searchResultHighlightedIndex,
    } = params;
    const searchHit = searchResult && searchResultHighlightedIndex !== null
      ? EditorUtil.searchHitAt(searchResult, searchResultHighlightedIndex)
      : null;
    if (!searchHit) {
      return;
    }
    EditorUtil.scrollToPosition({
      geometry,
      scrollContainer,
      x: searchHit.col + 1,
      y: searchHit.row + 1,
    });
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

  private static searchHitAt(result: null | SearchResult, index: number): null | SearchMatch {
    return result?.positions[index] ?? null;
  }

  private static searchHitContainsCell(
    hit: SearchMatch,
    query: string,
    row: number,
    col: number,
  ): boolean {
    return (
      hit.matrix_type === MATRIX_TYPE.NUCLEOTIDE
      && hit.row === row
      && col >= hit.col
      && col < hit.col + Math.max(1, query.length)
    );
  }
}
