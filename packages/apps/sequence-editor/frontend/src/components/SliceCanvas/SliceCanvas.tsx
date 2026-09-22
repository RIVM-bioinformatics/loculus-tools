import { Box } from '@mui/material';
import {
  useEffect,
  useRef,
} from 'react';

import {
  CELL_H,
  CELL_W,
  LABEL_W,
} from '../../constants';
import { SeqEditorUtil } from '../../utils/SeqEditorUtil';
import type { EngineViewportResult } from '../../models';

export const SliceCanvas = ({
  names,
  slice,
}: {
  names: string[];
  slice: { bytes: Uint8Array } & EngineViewportResult;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const { bytes, cols, rows, startRow } = slice;
    const w = LABEL_W + cols * CELL_W;
    const h = rows * CELL_H;
    canvas.width = w;
    canvas.height = h;

    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';

    for (let r = 0; r < rows; r++) {
      const name = names[r] ?? `seq${startRow + r}`;
      // Row label
      ctx.fillStyle = '#888';
      ctx.fillText(
        `${String(startRow + r).padStart(3, '0')} ${name.slice(0, 14).padEnd(14)} |`,
        0,
        r * CELL_H + 2,
      );
      // Bases
      const off = r * cols;
      for (let c = 0; c < cols; c++) {
        const ch = String.fromCharCode(bytes[off + c]);
        ctx.fillStyle = SeqEditorUtil.colorFor(ch);
        ctx.fillText(ch, LABEL_W + c * CELL_W, r * CELL_H + 2);
      }
    }
  }, [slice, names]);

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', fontFamily: 'monospace' }}
      />
    </Box>
  );
};
