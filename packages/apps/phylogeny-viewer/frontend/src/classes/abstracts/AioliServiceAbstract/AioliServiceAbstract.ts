import type { AioliInstance } from '@biowasm/aioli';
import Aioli from '@biowasm/aioli';

import type { PhylogenyViewerConfig } from '../../../models/config.models';

export interface AioliService {
  getTree(fastaContent: string): Promise<string>;
}

export abstract class AioliServiceAbstract {
  private aioli: AioliInstance | null = null;
  private readonly config: PhylogenyViewerConfig;
  private readonly tool: string;

  protected constructor(tool: string, config: PhylogenyViewerConfig) {
    this.tool = tool;
    this.config = config;
  }

  public abstract getTree(fastaContent: string): Promise<string>;

  protected async exec(command: string, args: string[] = []): Promise<string> {
    const aioli = await this.init();
    try {
      const fullCommand = `${command} ${args.join(' ')}`.trim();
      console.info('[BiowasmService] Executing:', fullCommand);
      const result = await aioli.exec(fullCommand);
      return typeof result === 'string' ? result : (result?.stdout || JSON.stringify(result));
    } catch (error) {
      console.error(`[BiowasmService] Execution failed for '${command}':`, error);
      throw error;
    }
  }

  protected async mount(file: File): Promise<void> {
    const aioli = await this.init();
    try {
      await aioli.mount(file);
      console.info('[BiowasmService] File mounted successfully:', file.name);
    } catch (error) {
      console.error('[BiowasmService] Failed to mount file:', error);
      throw error;
    }
  }

  private async init(): Promise<AioliInstance> {
    if (!this.aioli) {
      if (this.config.aioli?.cdnUrl) {
        this.aioli = await new Aioli(this.tool, {
          urlCDN: this.config.aioli.cdnUrl,
          urlCDNStg: this.config.aioli.cdnUrl,
        });
      } else {
        this.aioli = await new Aioli(this.tool);
      }
    }
    return this.aioli;
  }
}
