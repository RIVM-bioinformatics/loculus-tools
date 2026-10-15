export class EngineErrorUtil {
  public static getEngineErrorMessage(error: unknown): string {
    const code = EngineErrorUtil.getEngineErrorCode(error);
    const message = (error as { message?: string })?.message ?? 'The sequence-editor command failed.';
    if (code) {
      return `${code} - ${message}`;
    }
    return message;
  }

  private static getEngineErrorCode(error: unknown): null | string {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code?: unknown }).code;
      return typeof code === 'string' ? code : null;
    }
    return null;
  }
}
