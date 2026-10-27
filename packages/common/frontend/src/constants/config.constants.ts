import type { InjectionToken } from 'tsyringe';

import type { ConfigBase } from '../models/config.models';

export const CONFIG_TOKEN: InjectionToken<ConfigBase> = Symbol('CONFIG_TOKEN');
