import { container } from 'tsyringe';
import type { DependencyContainer } from 'tsyringe';
import { WindowService } from '@gen-epix/ui-core/classes/services/WindowService';
import { DevicePixelRatioService } from '@gen-epix/ui-core/classes/services/DevicePixelRatioService';
import { KeyboardShortcutService } from '@gen-epix/ui-core/classes/services/KeyboardShortcutService';

import {
  CONFIG_TOKEN,
  DEVICE_PIXEL_RATIO_SERVICE_TOKEN,
  KEYBOARD_SHORTCUT_SERVICE_TOKEN,
  WINDOW_SERVICE_TOKEN,
} from '../../constants/config.constants';
import type { ConfigBase } from '../../models/config.models';

export class DependencyContainerUtil {
  public static createContainer<TConfig extends ConfigBase>(config: TConfig): DependencyContainer {
    container.register(CONFIG_TOKEN, { useValue: config });
    container.registerInstance(WINDOW_SERVICE_TOKEN, WindowService.getInstance());
    container.registerInstance(DEVICE_PIXEL_RATIO_SERVICE_TOKEN, DevicePixelRatioService.getInstance());
    container.registerInstance(KEYBOARD_SHORTCUT_SERVICE_TOKEN, KeyboardShortcutService.getInstance());

    return container;
  }

  public static resolveConfig<TConfig extends ConfigBase = ConfigBase>(dependencyContainer: DependencyContainer = container): TConfig {
    return dependencyContainer.resolve(CONFIG_TOKEN) as TConfig;
  }
}
