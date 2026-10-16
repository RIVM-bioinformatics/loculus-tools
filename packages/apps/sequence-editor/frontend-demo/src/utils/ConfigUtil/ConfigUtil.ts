import type { SequenceEditorConfig } from '@rivm-loculus-tools/sequence-editor/models/config.models';
import { SequenceEditorStandardConfigUtil } from '@rivm-loculus-tools/sequence-editor/utils/SequenceEditorStandardConfigUtil';
import { theme } from '@rivm-loculus-tools/common-frontend/theme';

export class ConfigUtil {
  public static createConfig(): SequenceEditorConfig {
    const config: SequenceEditorConfig = {
      ...SequenceEditorStandardConfigUtil.createConfig(),
      theme,
    };

    return config;
  }
}
