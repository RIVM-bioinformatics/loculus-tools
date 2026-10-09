import { WindowService } from '@gen-epix/ui-core/classes/services/WindowService';

export class UrlUtil {
  public static clearSearchParams(): void {
    const url = new URL(WindowService.getInstance().window.location.href);
    url.search = '';
    WindowService.getInstance().window.history.replaceState(null, '', url.toString());
  }

  public static fastaLabelFromUrl(url: string): string {
    try {
      const urlObject = new URL(url);
      const segment = urlObject.pathname.split('/').filter(Boolean).pop();
      if (segment) {
        return decodeURIComponent(segment);
      }
      return `${urlObject.hostname}.fasta`;
    } catch {
      return 'remote-alignment.fasta';
    }
  }

  public static validateFastaUrl(url: string): string {
    let urlObject: URL;
    try {
      urlObject = new URL(url.trim());
    } catch {
      throw new Error('Enter a valid FASTA URL.');
    }
    if (urlObject.protocol !== 'http:' && urlObject.protocol !== 'https:') {
      throw new Error('FASTA URLs must use HTTP or HTTPS.');
    }
    return urlObject.href;
  }
}
