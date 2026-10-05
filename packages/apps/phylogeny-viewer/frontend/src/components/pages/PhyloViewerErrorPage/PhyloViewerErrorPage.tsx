import type { ErrorPageCommonProps } from '@rivm-loculus-tools/frontend-common/components/page';
import { ErrorPageCommon } from '@rivm-loculus-tools/frontend-common/components/page';

import { PhyloViewerPage } from '../../ui/PhyloViewerPage';

export type PhyloViewerErrorPageProps = ErrorPageCommonProps;

export const PhyloViewerErrorPage = ({ error }: PhyloViewerErrorPageProps) => {
  return (
    <PhyloViewerPage
      isNoInteraction
    >
      <ErrorPageCommon error={error} />
    </PhyloViewerPage>
  );
};
