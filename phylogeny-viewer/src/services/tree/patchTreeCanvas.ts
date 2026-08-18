import { TreeUtil } from '@gen-epix/ui-casedb';
import { useTreeViewStore } from '../../stores/treeViewStore';
import { useMetadataStore } from '../../stores/metadataStore';
import { useDatasetStore } from '../../stores/datasetStore';
import { getRecordForSample } from '../parsers/tsvParser';

let isPatched = false;

export function setupTreeCanvasDrawing(): void {
  if (isPatched) return;
  isPatched = true;

  const originalDrawTreeCanvas = (TreeUtil as any).drawTreeCanvas;

  (TreeUtil as any).drawTreeCanvas = function (params: any) {
    // 1. Execute standard Gen-Epix tree rendering (branches, node dots, background, scale bar)
    originalDrawTreeCanvas.call(this, params);

    const {
      canvas,
      devicePixelRatio: r = 1,
      headerHeight: s = 0,
      highlightedNodeNames: c = [],
      horizontalScrollPosition: l = 0,
      verticalScrollPosition: x = 0,
      treeAssembly: v,
      zoomLevel: S = 1,
    } = params;

    if (!canvas || !v) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Read active settings directly from store
    const { showBranchLengths, showLeafLabels, showSupportLines } = useTreeViewStore.getState();
    const { selectedLabelFields, matchKeyColumn } = useMetadataStore.getState();
    const { parsedMetadata } = useDatasetStore.getState();

    // Clip to below the header/scale bar if active
    if (s > 0) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath();
      ctx.rect(0, s * r, canvas.width, Math.max(0, canvas.height - s * r));
      ctx.clip();
    }

    // Apply EXACT coordinate transform used by PhylogeneticTreeComponent: (1 / zoomLevel) * devicePixelRatio
    const scale = (1 / S) * r;
    ctx.setTransform(scale, 0, 0, scale, -l + 0.5, -x + s * r + 0.5);

    // 1. Draw Branch Length Distance Labels
    if (showBranchLengths && v.distanceTexts && v.distanceTexts.length > 0) {
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      v.distanceTexts.forEach(({ text, x: dtX, y: dtY }: { text: string; x: number; y: number }) => {
        if (text) {
          ctx.fillText(text, dtX, dtY - 3);
        }
      });
    }

    // 2. Draw Leaf Labels, Highlight Badges, and Guide Lines
    if (v.supportLines && v.supportLines.length > 0) {
      ctx.textBaseline = 'middle';

      // Find max X for tidy guide line alignment within tree space
      let maxLeafX = 0;
      v.supportLines.forEach(({ fromX }: { fromX: number }) => {
        if (fromX > maxLeafX) maxLeafX = fromX;
      });
      const guideAlignmentX = maxLeafX + 220;

      v.supportLines.forEach(({ fromX, fromY, nodeName }: { fromX: number; fromY: number; nodeName: string }) => {
        // Build composite label text: accessionVersion | Field1 | Field2
        let labelText = nodeName;
        const meta = getRecordForSample(parsedMetadata, nodeName, matchKeyColumn);

        if (meta && selectedLabelFields.length > 0) {
          const extraParts = selectedLabelFields
            .map((f) => meta[f])
            .filter((val) => val !== undefined && val !== '');
          if (extraParts.length > 0) {
            labelText = `${nodeName} | ${extraParts.join(' | ')}`;
          }
        }

        const isHighlighted = c && c.includes(nodeName);
        const textX = fromX + 10;
        const textY = fromY;

        // Draw glowing highlight rings on matching node dot
        if (isHighlighted) {
          ctx.beginPath();
          ctx.arc(fromX, fromY, 6, 0, Math.PI * 2);
          ctx.strokeStyle = '#DC2626';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(fromX, fromY, 9, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Draw Leaf Label Text
        let labelWidth = 0;
        if (showLeafLabels || isHighlighted) {
          ctx.textAlign = 'left';
          if (isHighlighted) {
            ctx.font = 'bold 12px Inter, system-ui, -apple-system, sans-serif';
            const metrics = ctx.measureText(labelText);
            labelWidth = metrics.width;
            const padX = 5;
            const padY = 2;

            ctx.fillStyle = '#FEF2F2';
            ctx.strokeStyle = '#EF4444';
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.roundRect(
              textX - padX,
              textY - 9 - padY,
              metrics.width + padX * 2,
              18 + padY * 2,
              3
            );
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#991B1B';
            ctx.fillText(labelText, textX, textY);
          } else {
            ctx.font = '12px Inter, system-ui, -apple-system, sans-serif';
            const metrics = ctx.measureText(labelText);
            labelWidth = metrics.width;
            ctx.fillStyle = '#1E293B';
            ctx.fillText(labelText, textX, textY);
          }
        }

        // Draw Guide Line (only when Show Leaf Guide Lines is active)
        if (showSupportLines) {
          const startGuideX = (showLeafLabels || isHighlighted) ? textX + labelWidth + 8 : fromX + 12;
          const endGuideX = Math.max(startGuideX + 20, guideAlignmentX);

          ctx.beginPath();
          ctx.setLineDash([2, 3]);
          ctx.strokeStyle = '#CBD5E1';
          ctx.lineWidth = 1;
          ctx.moveTo(startGuideX, fromY);
          ctx.lineTo(endGuideX, fromY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }

    if (s > 0) {
      ctx.restore();
    }
  };
}
