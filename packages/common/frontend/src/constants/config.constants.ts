import type { InjectionToken } from 'tsyringe';
import type { WindowService } from '@gen-epix/ui-core/classes/services/WindowService';

import type { ConfigBase } from '../models/config.models';

export const CONFIG_TOKEN: InjectionToken<ConfigBase> = Symbol('CONFIG_TOKEN');
export const WINDOW_SERVICE_TOKEN: InjectionToken<WindowService> = Symbol('WINDOW_SERVICE_TOKEN');
