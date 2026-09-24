const ENGINE_ERROR_MESSAGES = new Map<string, string>([
  ['DeleteNotGap', 'Delete failed: the selected position is not a gap.'],
  ['MoveNoGapTarget', 'Move failed: the target position must be a gap.'],
  ['MoveNotIupac', 'Move failed: only nucleotide or gap characters can move.'],
  ['MutateNotIupac', 'Edit failed: use a nucleotide, IUPAC ambiguity code, or gap.'],
]);
export class EngineErrorUtil {
  public static getEngineErrorCode(error: unknown): null | string {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code?: unknown }).code;
      return typeof code === 'string' ? code : null;
    }
    return null;
  }

  public static getEngineErrorMessage(error: unknown): string {
    const code = EngineErrorUtil.getEngineErrorCode(error);
    const mappedMessage = code ? ENGINE_ERROR_MESSAGES.get(code) : undefined;
    if (mappedMessage) {
      return mappedMessage;
    }
    return error instanceof Error ? error.message : 'The sequence-editor command failed.';
  }
}
