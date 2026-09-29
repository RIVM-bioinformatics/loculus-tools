import { PageCommon } from '@rivm-loculus-tools/frontend-common/components/page';
import type { PropsWithChildren } from 'react';

import { PhyloViewerPageHeader } from '../PhyloViewerPageHeader/PhyloViewerPageHeader';
import { PhyloViewerPageDrawer } from '../PhyloViewerPageDrawer/PhyloViewerPageDrawer';


export type PhyloViewerPageProps = PropsWithChildren<{
  isNoInteraction: boolean;
}>;

export const PhyloViewerPage = ({ children, isNoInteraction }: PhyloViewerPageProps) => {
  return (
    <PageCommon
      drawerComponent={<PhyloViewerPageDrawer />}
      headerComponent={<PhyloViewerPageHeader />}
      isNoInteraction={isNoInteraction}
    >
      {children}
    </PageCommon>
  );

};
