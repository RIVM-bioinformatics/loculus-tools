import type { ErrorPageCommonProps } from '@rivm-loculus-tools/frontend-common/components/page';
import { ErrorPageCommon } from '@rivm-loculus-tools/frontend-common/components/page';

import { SeqEditorPage } from '../../ui/SeqEditorPage';

export type SeqenceEditorErrorPageProps = ErrorPageCommonProps;

export const SeqenceEditorErrorPage = ({ error }: SeqenceEditorErrorPageProps) => {
  return (
    <SeqEditorPage
      isNoInteraction
    >
      <ErrorPageCommon error={error} />
    </SeqEditorPage>
  );
};
