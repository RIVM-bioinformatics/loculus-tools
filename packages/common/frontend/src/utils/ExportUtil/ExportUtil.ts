import { DownloadUtil } from '@gen-epix/ui-core/utils/DownloadUtil';

export class ExportUtil {
  public static downloadCanvasAsImage(
    canvas: HTMLCanvasElement | null,
    format: 'jpeg' | 'png',
    filename = 'phylogenetic_tree',
  ): void {
    if (!canvas) {
      console.error('No canvas available for export.');
      return;
    }

    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const extension = format === 'jpeg' ? 'jpg' : 'png';

    let exportCanvas = canvas;
    if (format === 'jpeg') {
      exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        ctx.drawImage(canvas, 0, 0);
      }
    }

    const dataUrl = exportCanvas.toDataURL(mimeType, 0.95);
    DownloadUtil.createDownloadUrl(dataUrl, `${filename}.${extension}`);
  }

  public static downloadCanvasAsSvg(
    canvas: HTMLCanvasElement | null,
    filename = 'phylogenetic_tree.svg',
  ): void {
    if (!canvas) {
      console.error('No canvas available for export.');
      return;
    }

    const imgData = canvas.toDataURL('image/png');
    const width = canvas.width;
    const height = canvas.height;

    const svgContent = `<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="${width}" height="${height}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image xlink:href="${imgData}" x="0" y="0" height="${height}" width="${width}" />
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    DownloadUtil.createDownloadUrl(url, filename);
    URL.revokeObjectURL(url);
  }

  public static downloadFastaFile(fasta: string, filename = 'sequence.fasta'): void {
    const blob = new Blob([fasta], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    DownloadUtil.createDownloadUrl(url, filename);
    URL.revokeObjectURL(url);
  }

  public static downloadNewickFile(newick: string, filename = 'phylogenetic_tree.nwk'): void {
    const blob = new Blob([newick], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    DownloadUtil.createDownloadUrl(url, filename);
    URL.revokeObjectURL(url);
  }
}
