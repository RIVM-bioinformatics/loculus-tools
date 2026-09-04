import type { AioliInstance } from '@biowasm/aioli';
import Aioli from '@biowasm/aioli';

export interface AioliService {
  getTree(fastaContent: string): Promise<string>;
}

export abstract class AioliServiceAbstract {
  private aioli: AioliInstance | null = null;
  private readonly tool: string;

  protected constructor(tool: string) {
    this.tool = tool;
  }

  public abstract getTree(fastaContent: string): Promise<string>;

  protected async exec(command: string, args: string[] = []): Promise<string> {
    await this.init();
    try {
      const fullCommand = `${command} ${args.join(' ')}`.trim();
      console.log('[BiowasmService] Executing:', fullCommand);
      const result = await this.aioli.exec(fullCommand);
      return typeof result === 'string' ? result : (result?.stdout || JSON.stringify(result));
    } catch (error) {
      console.error(`[BiowasmService] Execution failed for '${command}':`, error);
      throw error;
    }
  }


  protected async mount(file: File): Promise<void> {
    await this.init();
    try {
      await this.aioli.mount(file);
      console.log('[BiowasmService] File mounted successfully:', file.name);
    } catch (error) {
      console.error('[BiowasmService] Failed to mount file:', error);
      throw error;
    }
  }

  private async init(): Promise<void> {
    if (!this.aioli) {
      this.aioli = await new Aioli(this.tool);
    }
  }
}
