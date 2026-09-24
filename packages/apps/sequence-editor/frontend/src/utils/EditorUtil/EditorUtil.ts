import type {
  EngineMeta,
  EngineViewportResult,
  PaletteModel,
} from '../../models';
import type {
  GridGeometry,
  GridRange,
  VisibleGridRange,
} from '../grid';
import { DEFAULT_GRID_GEOMETRY } from '../grid';
import { paletteEntryFor } from '../palette';

export type EditorAssembly = {
  foo: 'bar';
};

export type EditorAssemblyCells = {
  foo: 'bar';
};

export type EditorPathProperties = {
  foo: 'bar';
};


export class EditorUtil {
  // public static assembleEditor({
  //   canvasElement,
  //   geometry,
  //   meta,
  //   palette,
  //   scrollLeft,
  //   scrollTop,
  //   viewport,
  //   viewportHeight,
  //   viewportWidth,
  // }: {
  //   canvasElement: HTMLCanvasElement;
  //   geometry: GridGeometry;
  //   meta: EngineMeta;
  //   palette: PaletteModel;
  //   scrollLeft: number;
  //   scrollTop: number;
  //   viewport: EngineViewportResult;
  //   viewportHeight: number;
  //   viewportWidth: number;
  // }): EditorAssembly {
  //   const { cellHeight, cellWidth, labelWidth, rulerHeight } = geometry;
  //   context.textAlign = 'center';
  //   context.textBaseline = 'middle';
  //   const { bytes, cols, rows, startCol, startRow } = viewport;
  //   for (let row = 0; row < rows; row++) {
  //     // cell position on screen, offset by the viewport's grid origin and current scroll
  //     const y = (startRow + row) * cellHeight + rulerHeight - scrollTop;
  //     if (y + cellHeight < rulerHeight || y > viewportHeight) {
  //       continue;
  //     }
  //     for (let col = 0; col < cols; col++) {
  //       const x = (startCol + col) * cellWidth + labelWidth - scrollLeft;
  //       if (x + cellWidth < labelWidth || x > viewportWidth) {
  //         continue;
  //       }
  //       const byte = bytes[row * cols + col];
  //       const charCode = byte ?? '';
  //       const label = String.fromCharCode(charCode);
  //       const colors = paletteEntryFor(palette, label);
  //       let cellBackground = colors.background;
  //       if (byte === null) {
  //         cellBackground = '#e9eef2';
  //       } else if (label === ' ') {
  //         cellBackground = '#f7f8f9';
  //       }
  //       const rectanglePath = new Path2D();
  //       rectanglePath.rect(x, y, cellWidth, cellHeight);
  //       rectanglePath.closePath();
  //       // draw path on canvas
  //       context.fillStyle = cellBackground;
  //       context.fill(rectanglePath);
  //       context.fillStyle = colors.foreground;
  //       context.fillText(label, x + cellWidth / 2, y + cellHeight / 2);
  //     }
  //   }


  // }

  public static drawCanvas({
    canvasElement,
    devicePixelRatio,
    geometry,
    meta,
    palette,
    scrollLeft,
    scrollTop,
    viewport,
    viewportHeight,
    viewportWidth,
  }: {
    canvasElement: HTMLCanvasElement;
    devicePixelRatio: number;
    geometry: GridGeometry;
    meta: EngineMeta;
    palette: PaletteModel;
    scrollLeft: number;
    scrollTop: number;
    viewport: EngineViewportResult;
    viewportHeight: number;
    viewportWidth: number;
  }): void {
    if (!canvasElement) {
      return;
    }
    const context = canvasElement.getContext('2d');
    if (!context) {
      return;
    }

    EditorUtil.draw(canvasElement, devicePixelRatio, () => {
      context.clearRect(0, 0, canvasElement.width, canvasElement.height);

      const { cellHeight, cellWidth, labelWidth, rulerHeight } = geometry;

      // Render cells
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const { bytes, cols, rows, startCol, startRow } = viewport;
      for (let row = 0; row < rows; row++) {
        // cell position on screen, offset by the viewport's grid origin and current scroll
        const y = (startRow + row) * cellHeight + rulerHeight - scrollTop;
        if (y + cellHeight < rulerHeight || y > viewportHeight) {
          continue;
        }
        for (let col = 0; col < cols; col++) {
          const x = (startCol + col) * cellWidth + labelWidth - scrollLeft;
          if (x + cellWidth < labelWidth || x > viewportWidth) {
            continue;
          }
          const byte = bytes[row * cols + col];
          const charCode = byte ?? '';
          const label = String.fromCharCode(charCode);
          const colors = paletteEntryFor(palette, label);
          let cellBackground = colors.background;
          if (byte === null) {
            cellBackground = '#e9eef2';
          } else if (label === ' ') {
            cellBackground = '#f7f8f9';
          }
          const rectanglePath = new Path2D();
          rectanglePath.rect(x, y, cellWidth, cellHeight);
          rectanglePath.closePath();
          // draw path on canvas
          context.fillStyle = cellBackground;
          context.fill(rectanglePath);
          context.fillStyle = colors.foreground;
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
        const x = (startCol + col) * cellWidth + labelWidth - scrollLeft + 0.5;
        const tickHeight = isMajorTick ? 8 : 4;
        context.moveTo(x, rulerHeight);
        context.lineTo(x, rulerHeight - tickHeight);
      }
      context.stroke();

      context.fillStyle = '#486581';
      context.textAlign = 'center';
      tickCols.forEach((col) => {
        const x = (startCol + col) * cellWidth + labelWidth - scrollLeft;
        const label = String(startCol + col + 1);
        const textWidth = context.measureText(label).width;
        // skip labels that would be clipped by the gutter or the canvas edge
        if (x - textWidth / 2 < labelWidth || x + textWidth / 2 > viewportWidth) {
          return;
        }
        context.fillText(label, x, rulerHeight / 2);
      });
      context.textAlign = 'start';

      context.strokeStyle = '#bcccdc';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(labelWidth + 0.5, 0);
      context.lineTo(labelWidth + 0.5, viewportHeight);
      context.moveTo(0, rulerHeight + 0.5);
      context.lineTo(viewportWidth, rulerHeight + 0.5);
      context.stroke();

      // Corner stays fixed above the label gutter; ruler marks scroll underneath it
      context.fillStyle = '#edf2f6';
      context.fillRect(0, 0, labelWidth, rulerHeight);

      // Render labels
      context.fillStyle = '#f8fafb';
      context.fillRect(0, rulerHeight, labelWidth, viewportHeight - rulerHeight);
      context.font = '14px monospace';
      context.textBaseline = 'middle';
      context.fillStyle = '#334e68';
      for (let row = 0; row < rows; row++) {
        const y = (startRow + row) * cellHeight + rulerHeight - scrollTop;
        if (y + cellHeight < rulerHeight || y > viewportHeight) {
          continue;
        }
        context.fillText(String(startRow + row + 1), 8, y + cellHeight / 2);
      }
    });

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
   * @returns The {@link TreePathProperties} of the hit shape, or `undefined` if nothing was hit.
   */
  public static getPathPropertiesFromCanvas(params: { canvas: HTMLCanvasElement; devicePixelRatio: number; editorAssembly: EditorAssembly; event: MouseEvent }): EditorPathProperties {
    const { canvas, devicePixelRatio, editorAssembly, event } = params;

    const ctx = EditorUtil.getCanvasContext(canvas);
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
    const canvasX = (event.clientX - rect.left) * devicePixelRatio;
    const canvasY = (event.clientY - rect.top) * devicePixelRatio;

    // for (const path of treeAssembly.nodePathPropertiesMap.keys()) {
    //   if (ctx.isPointInPath(path, canvasX, canvasY)) {
    //     return treeAssembly.nodePathPropertiesMap.get(path);
    //   }
    // }

    // // Allow for a 1px vertical margin around the mouse position to allow for easier clicking
    // const canvasYs = [
    //   ((event.clientY - 1) - rect.top) * devicePixelRatio,
    //   canvasY,
    //   ((event.clientY + 1) - rect.top) * devicePixelRatio,
    // ];

    // for (const path of treeAssembly.horizontalLinePathPropertiesMap.keys()) {
    //   for (const y of canvasYs) {
    //     if (ctx.isPointInStroke(path, canvasX, y)) {
    //       return treeAssembly.horizontalLinePathPropertiesMap.get(path);
    //     }
    //   }
    // }

    // // Allow for a 1px horizontal margin around the mouse position to allow for easier clicking
    // const canvasXs = [
    //   ((event.clientX - 1) - rect.left) * devicePixelRatio,
    //   canvasX,
    //   ((event.clientX + 1) - rect.left) * devicePixelRatio,
    // ];
    // for (const path of treeAssembly.verticalLinePathPropertiesMap.keys()) {
    //   for (const x of canvasXs) {
    //     if (ctx.isPointInStroke(path, x, canvasY)) {
    //       return treeAssembly.verticalLinePathPropertiesMap.get(path);
    //     }
    //   }
    // }
  }

  public static getVisibleGridRange(params: {
    geometry?: GridGeometry;
    numCols: number;
    numOverscanCols?: number;
    numOverscanRows?: number;
    numRows: number;
    scrollLeft: number;
    scrollTop: number;
    viewportHeight: number;
    viewportWidth: number;
  }): VisibleGridRange {
    const {
      geometry = DEFAULT_GRID_GEOMETRY,
      numCols,
      numOverscanCols = 0,
      numOverscanRows = 0,
      numRows,
      scrollLeft,
      scrollTop,
      viewportHeight,
      viewportWidth,
    } = params;
    const visibleStartCol = Math.max(0, Math.floor(scrollLeft / geometry.cellWidth));
    const visibleEndCol = Math.min(
      numCols,
      visibleStartCol + Math.max(1, Math.ceil((viewportWidth - geometry.labelWidth) / geometry.cellWidth) + 1),
    );
    const visibleStartRow = Math.max(0, Math.floor(Math.max(0, scrollTop - geometry.rulerHeight) / geometry.cellHeight));
    const visibleEndRow = Math.min(
      numRows,
      visibleStartRow + Math.max(1, Math.ceil((viewportHeight - geometry.rulerHeight) / geometry.cellHeight) + 1),
    );

    return {
      cache: {
        endCol: Math.min(numCols, visibleEndCol + numOverscanCols),
        endRow: Math.min(numRows, visibleEndRow + numOverscanRows),
        startCol: Math.max(0, visibleStartCol - numOverscanCols),
        startRow: Math.max(0, visibleStartRow - numOverscanRows),
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
   * Helper that wraps a canvas drawing callback with a DPR-aware scale/translate
   * transform, then restores the context to its pre-call state.
   *
   * @param canvas - The canvas element whose 2D context to use.
   * @param devicePixelRatio - Screen DPR to scale up for HiDPI rendering.
   * @param callback - Drawing operations to perform inside the transform.
   */
  private static draw(canvas: HTMLCanvasElement, devicePixelRatio: number, callback: (ctx: CanvasRenderingContext2D) => void): void {
    const ctx = EditorUtil.getCanvasContext(canvas);
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.translate(0.5, 0.5);
    callback(ctx);
    ctx.translate(-0.5, -0.5);
    ctx.scale(1 / devicePixelRatio, 1 / devicePixelRatio);
  }

  private static getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D canvas context.');
    }
    return ctx;
  }

  // private static assembleCells(): EditorAssemblyCells {

  // }

}
