import type { InjectionToken } from 'tsyringe';
import type { WindowService } from '@gen-epix/ui-core/classes/services/WindowService';
import type { DevicePixelRatioService } from '@gen-epix/ui-core/classes/services/DevicePixelRatioService';
import type { KeyboardShortcutService } from '@gen-epix/ui-core/classes/services/KeyboardShortcutService';

import type { ConfigBase } from '../models/config.models';

export const CONFIG_TOKEN: InjectionToken<ConfigBase> = Symbol('CONFIG_TOKEN');
export const WINDOW_SERVICE_TOKEN: InjectionToken<WindowService> = Symbol('WINDOW_SERVICE_TOKEN');
export const DEVICE_PIXEL_RATIO_SERVICE_TOKEN: InjectionToken<DevicePixelRatioService> = Symbol('DEVICE_PIXEL_RATIO_SERVICE_TOKEN');
export const KEYBOARD_SHORTCUT_SERVICE_TOKEN: InjectionToken<KeyboardShortcutService> = Symbol('KEYBOARD_SHORTCUT_SERVICE_TOKEN');
