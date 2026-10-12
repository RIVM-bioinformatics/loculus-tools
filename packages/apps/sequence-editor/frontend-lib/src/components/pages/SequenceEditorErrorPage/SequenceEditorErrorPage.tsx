import type { ErrorPageCommonProps } from '@rivm-loculus-tools/frontend-common/components/page';
import { ErrorPageCommon } from '@rivm-loculus-tools/frontend-common/components/page';

import { SequenceEditorPage } from '../../ui/SequenceEditorPage';

export type SequenceEditorErrorPageProps = ErrorPageCommonProps;

export const SequenceEditorErrorPage = ({ error }: SequenceEditorErrorPageProps) => {
  return (
    <SequenceEditorPage
      isNoInteraction
    >
      <ErrorPageCommon error={error} />
    </SequenceEditorPage>
  );
};
