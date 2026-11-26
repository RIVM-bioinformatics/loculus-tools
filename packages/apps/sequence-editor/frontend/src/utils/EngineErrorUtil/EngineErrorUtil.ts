import type { StructuredEngineError } from '../../models/editor.models';

export class EngineErrorUtil {
  public static getEngineErrorMessage(error: unknown): string {
    if (EngineErrorUtil.isStructuredEngineError(error)) {
      return `${error.code} - ${error.message}`;
    }
    const code = EngineErrorUtil.getEngineErrorCode(error);
    const message = (error as { message?: string })?.message ?? 'The sequence-editor command failed.';
    if (code) {
      return `${code} - ${message}`;
    }
    return message;
  }

  /** Narrows an unknown thrown value to the structured error emitted by the Rust engine. */
  public static isStructuredEngineError(error: unknown): error is StructuredEngineError {
    return typeof error === 'object'
      && error !== null
      && typeof (error as { code?: unknown }).code === 'string'
      && typeof (error as { message?: unknown }).message === 'string';
  }

  private static getEngineErrorCode(error: unknown): null | string {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code?: unknown }).code;
      return typeof code === 'string' ? code : null;
    }
    return null;
  }
}
