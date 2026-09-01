/* eslint-disable import-x/unambiguous, import-x/no-default-export */

declare module '@biowasm/aioli' {
  export interface AioliExecResult {
    [key: string]: unknown;
    code?: number;
    stderr?: string;
    stdout?: string;
  }

  export interface AioliInstance {
    exec(command: string): Promise<AioliExecResult | string>;
    mount(file: Blob | File | string): Promise<void>;
  }

  export type AioliTool = string;

  interface AioliConstructor {
    new(tools: AioliTool | readonly AioliTool[]): Promise<AioliInstance>;
  }

  const Aioli: AioliConstructor;
  export default Aioli;
}
