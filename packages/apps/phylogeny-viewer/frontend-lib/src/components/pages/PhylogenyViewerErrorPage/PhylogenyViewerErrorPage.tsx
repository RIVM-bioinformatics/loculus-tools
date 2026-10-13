import type { ErrorPageCommonProps } from '@rivm-loculus-tools/common-frontend/components/page';
import { ErrorPageCommon } from '@rivm-loculus-tools/common-frontend/components/page';

import { PhylogenyViewerPage } from '../../ui/PhylogenyViewerPage';

export type PhylogenyViewerErrorPageProps = ErrorPageCommonProps;

export const PhylogenyViewerErrorPage = ({ error }: PhylogenyViewerErrorPageProps) => {
  return (
    <PhylogenyViewerPage
      isNoInteraction
    >
      <ErrorPageCommon error={error} />
    </PhylogenyViewerPage>
  );
};
