declare module "@biowasm/aioli" {
  /**
   * Minimal type declarations for the Aioli library.
   *
   * Aioli runs biowasm WebAssembly tools inside a single WebWorker and
   * exposes a Comlink-based proxy for interacting with them.
   */
  export default class Aioli {
    constructor(tools: string[]);
    /** Initializes the WebWorker and loads all configured tools. */
    init(): Promise<void>;
    /** Runs a tool with the given full command string. */
    exec(command: string): Promise<string>;
    /** Mounts a local file into the shared virtual filesystem. */
    mount(file: File): Promise<void>;
    /** Writes a file into the shared virtual filesystem. */
    writeFile(path: string, data: string | Uint8Array): Promise<void>;
    /** Reads a file from the shared virtual filesystem. */
    readFile(path: string): Promise<string>;
    /** Lists files in a directory of the shared virtual filesystem. */
    ls(path: string): Promise<string[]>;
  }
}
