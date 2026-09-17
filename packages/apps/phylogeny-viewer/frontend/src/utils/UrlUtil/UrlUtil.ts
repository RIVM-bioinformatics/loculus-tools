import { WindowService } from '@gen-epix/ui-core/classes/services/WindowService';

export class UrlUtil {
  public static clearSearchParams(): void {
    const url = new URL(WindowService.getInstance().window.location.href);
    url.search = '';
    WindowService.getInstance().window.history.replaceState(null, '', url.toString());
  }
}
