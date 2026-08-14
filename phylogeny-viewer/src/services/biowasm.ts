import Aioli from "@biowasm/aioli";

/**
 * BiowasmService
 *
 * Thin wrapper around an Aioli instance that runs a set of biowasm
 * WebAssembly tools inside a single WebWorker. Each BiowasmService owns its
 * own Aioli instance (and therefore its own worker + shared virtual
 * filesystem), so tools that should be isolated from each other get separate
 * instances.
 */
export class BiowasmService {
  private aioli: Aioli | null = null;
  private tools: string[];

  constructor(tools: string[]) {
    this.tools = tools;
  }

  /**
   * Creates the Aioli instance and loads the configured tools.
   * Note: the Aioli constructor kicks off initialization itself, so awaiting
   * `new Aioli(tools)` is sufficient.
   */
  async init(): Promise<Aioli> {
    try {
      this.aioli = await new Aioli(this.tools);
      return this.aioli;
    } catch (error) {
      console.error("Failed to initialize Aioli:", error);
      throw error;
    }
  }

  /**
   * Runs a tool with the given arguments inside the worker.
   * @param command - The tool name (e.g. "fasttree", "tn93").
   * @param args - Command-line arguments for the tool.
   */
  async exec(command: string, args: string[] = []): Promise<string> {
    if (!this.aioli) {
      throw new Error("Aioli not initialized. Call init() first.");
    }
    const fullCommand = `${command} ${args.join(" ")}`.trim();
    return this.aioli.exec(fullCommand);
  }

  /**
   * Mounts a local file into the worker's virtual filesystem.
   */
  async mount(file: File): Promise<void> {
    if (!this.aioli) {
      throw new Error("Aioli not initialized. Call init() first.");
    }
    await this.aioli.mount(file);
  }
}