import { container } from 'tsyringe';
import { WindowService } from '@gen-epix/ui-core/classes/services/WindowService';


export class UrlUtil {
  public static clearSearchParams(): void {
    const url = new URL(container.resolve(WindowService).window.location.href);
    url.search = '';
    container.resolve(WindowService).window.history.replaceState(null, '', url.toString());
    container.resolve(WindowService).window.dispatchEvent(new Event('loculus:urlparamschange'));
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

  public static getBaseURLWithPath(): string {
    const url = new URL(container.resolve(WindowService).window.location.href);
    if (url.pathname) {
      return `${url.protocol}//${url.host}/${url.pathname.split('/').filter(Boolean).shift()}`;
    }
    return `${url.protocol}//${url.host}`;
  }


  public static isValidResourceUrl(url: string): boolean {
    let urlObject: URL;
    try {
      urlObject = new URL(url.trim());
    } catch {
      return false;
    }
    if (urlObject.protocol !== 'http:' && urlObject.protocol !== 'https:') {
      return false;
    }
    return true;
  }
}
