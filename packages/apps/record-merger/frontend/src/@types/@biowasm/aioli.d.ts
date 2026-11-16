/* eslint-disable import-x/unambiguous, import-x/no-default-export */

declare module '@biowasm/aioli' {
  export interface AioliConfig {
    callback?: ((output: AioliStreamOutput) => void) | null;
    debug?: boolean;
    dirData?: string;
    dirMounted?: string;
    dirShared?: string;
    env?: string;
    printInterleaved?: boolean;
    printStream?: boolean;
    urlCDN?: string;
    urlCDNStg?: string;
  }

  export interface AioliExecResult {
    stderr: string;
    stdout: string;
  }

  export interface AioliFileStat {
    atime: Date;
    blksize: number;
    blocks: number;
    ctime: Date;
    dev: number;
    gid: number;
    ino: number;
    mode: number;
    mtime: Date;
    nlink: number;
    rdev: number;
    size: number;
    uid: number;
  }

  export interface AioliInstance {
    cat(path: string): Promise<false | string>;
    cd(path: string): Promise<void>;
    close(): Promise<void>;
    download(path: string): Promise<false | string>;
    downloadBlob(path: string): Promise<Blob | false>;
    exec(command: string, args?: null | string[]): Promise<AioliExecResult | string>;
    init(): Promise<boolean>;
    ls(path: string): Promise<AioliFileStat | false | string[]>;
    mkdir(path: string): Promise<boolean>;
    mount(
      files?: AioliMountFileData | AioliMountFileUrl | File | FileList | readonly (AioliMountFileData | AioliMountFileUrl | File | string)[]
        | string,
    ): Promise<string[]>;
    pwd(): Promise<string>;
    read(options: AioliReadOptions): Promise<Uint8Array>;
    reinit(toolName: string): Promise<void>;
    stdin: string;
    write(options: AioliWriteOptions): Promise<void>;
  }

  export interface AioliMountFileData {
    data: Blob | string;
    name: string;
  }

  export interface AioliMountFileUrl {
    name: string;
    url: string;
  }

  export interface AioliReadOptions {
    flag?: string;
    length: number;
    offset?: number;
    path: string;
    position?: number;
  }

  export interface AioliStreamOutput {
    stderr?: string;
    stdout?: string;
  }

  export type AioliTool = AioliToolConfig | string;

  export interface AioliToolConfig {
    features?: AioliToolFeatures;
    loading?: 'eager' | 'lazy';
    program?: string;
    reinit?: boolean;
    tool: string;
    urlPrefix?: string;
    version: string;
  }

  export interface AioliToolFeatures {
    simd?: boolean;
  }

  export interface AioliWriteOptions {
    buffer: Uint8Array;
    flag?: string;
    offset?: number;
    path: string;
    position?: number;
  }

  interface AioliConstructor {
    new(tools: AioliTool | readonly AioliTool[], config?: AioliConfig): Promise<AioliInstance>;
  }

  const Aioli: AioliConstructor;
  export default Aioli;
}
