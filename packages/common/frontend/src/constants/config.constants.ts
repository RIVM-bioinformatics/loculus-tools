import type { InjectionToken } from 'tsyringe';

import type { ConfigBase } from '../models/config.models';

export const CONFIG_TOKEN: InjectionToken<ConfigBase> = Symbol('CONFIG_TOKEN');
export const DATA_RECEIVER_CHANNEL_PARAM = 'data-receiver-channel';
export const DATA_RECEIVER_READY_MESSAGE_TYPE = 'data-receiver-ready';
export const IMPORT_DATA_MESSAGE_TYPE = 'import-data';
