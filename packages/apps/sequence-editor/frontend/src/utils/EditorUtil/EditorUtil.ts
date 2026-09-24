import type {
  EngineViewportResult,
  PaletteModel,
} from '../../models';
import type {
  GridGeometry,
  VisibleGridRange,
} from '../grid';
import { DEFAULT_GRID_GEOMETRY } from '../grid';
import { paletteEntryFor } from '../palette';

export type EditorAssembly = {
  //
};

export type EditorAssemblyCells = {
  //
};


export class EditorUtil {
  public static assembleEditor(): EditorAssembly {

  }

  public static drawCanvas({
    canvasElement,
    palette,
    viewport,
  }: {
    canvasElement: HTMLCanvasElement;
    palette: PaletteModel;
    viewport: EngineViewportResult;
  }): void {
    if (!canvasElement) {
      return;
    }
    const context = canvasElement.getContext('2d');
    if (!context) {
      return;
    }
    context.clearRect(0, 0, canvasElement.width, canvasElement.height);

    const { cellHeight, cellWidth, labelWidth, rulerHeight } = DEFAULT_GRID_GEOMETRY;

    const { bytes, cols, rows } = viewport;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
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
        rectanglePath.rect(col * cellWidth + labelWidth, row * cellHeight + rulerHeight, cellWidth, cellHeight);
        rectanglePath.closePath();
        // draw path on canvas
        context.fillStyle = cellBackground;
        context.fill(rectanglePath);
        context.fillStyle = colors.foreground;
        context.fillText(label, col * cellWidth + labelWidth + cellWidth / 2, row * cellHeight + rulerHeight + cellHeight / 2);
      }
    }


  }

  public static getVisibleGridRange(
    scrollLeft: number,
    scrollTop: number,
    viewportWidth: number,
    viewportHeight: number,
    rows: number,
    cols: number,
    geometry: GridGeometry = DEFAULT_GRID_GEOMETRY,
    overscanRows = 16,
    overscanCols = 128,
  ): VisibleGridRange {
    const visibleStartCol = Math.max(0, Math.floor(scrollLeft / geometry.cellWidth));
    const visibleEndCol = Math.min(
      cols,
      visibleStartCol + Math.max(1, Math.ceil((viewportWidth - geometry.labelWidth) / geometry.cellWidth) + 1),
    );
    const visibleStartRow = Math.max(0, Math.floor(Math.max(0, scrollTop - geometry.rulerHeight) / geometry.cellHeight));
    const visibleEndRow = Math.min(
      rows,
      visibleStartRow + Math.max(1, Math.ceil((viewportHeight - geometry.rulerHeight) / geometry.cellHeight) + 1),
    );

    return {
      cache: {
        endCol: Math.min(cols, visibleEndCol + overscanCols),
        endRow: Math.min(rows, visibleEndRow + overscanRows),
        startCol: Math.max(0, visibleStartCol - overscanCols),
        startRow: Math.max(0, visibleStartRow - overscanRows),
      },
      visible: {
        endCol: visibleEndCol,
        endRow: visibleEndRow,
        startCol: visibleStartCol,
        startRow: visibleStartRow,
      },
    };
  }


  private static assembleCells(): EditorAssemblyCells {

  }

}
