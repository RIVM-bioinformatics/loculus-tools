export class DownloadUtil {
  public static datasetFilename(label: string): string {
    const withoutExtension = label.trim().replace(/\.[^.]+$/, '');
    const safeLabel = withoutExtension
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 80);
    return `${safeLabel || 'alignment'}.fasta`;
  }
}
