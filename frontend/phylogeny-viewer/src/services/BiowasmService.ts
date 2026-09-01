import Aioli from '@biowasm/aioli';
import type { AioliInstance } from '@biowasm/aioli';

export class BiowasmService {
  public get initialized(): boolean {
    return this.isInitialized;
  }
  private aioli: AioliInstance | null = null;
  private isInitialized = false;

  private readonly tools: string[];

  public constructor(tools: string[]) {
    this.tools = tools;
  }

  public async exec(command: string, args: string[] = []): Promise<string> {
    if (!this.aioli) {
      await this.init();
    }
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

  public async init(): Promise<AioliInstance> {
    if (this.isInitialized && this.aioli) {
      return this.aioli;
    }
    try {
      console.log('[BiowasmService] Initializing Aioli with tools:', this.tools);
      this.aioli = await new Aioli(this.tools);
      this.isInitialized = true;
      console.log('[BiowasmService] Aioli initialized successfully:', this.tools);
      return this.aioli;
    } catch (error) {
      console.error('[BiowasmService] Failed to initialize Aioli:', error);
      this.isInitialized = false;
      this.aioli = null;
      throw error;
    }
  }

  public async mount(file: File): Promise<void> {
    if (!this.aioli) {
      await this.init();
    }
    try {
      await this.aioli.mount(file);
      console.log('[BiowasmService] File mounted successfully:', file.name);
    } catch (error) {
      console.error('[BiowasmService] Failed to mount file:', error);
      throw error;
    }
  }
}
