import { PageCommon } from '@rivm-loculus-tools/frontend-common/components/page';
import type { PropsWithChildren } from 'react';

import { PhylogenyViewerPageHeader } from '../PhylogenyViewerPageHeader/PhylogenyViewerPageHeader';
import { PhylogenyViewerPageDrawer } from '../PhylogenyViewerPageDrawer/PhylogenyViewerPageDrawer';


export type PhylogenyViewerPageProps = PropsWithChildren<{
  isNoInteraction: boolean;
}>;

export const PhylogenyViewerPage = ({ children, isNoInteraction }: PhylogenyViewerPageProps) => {
  return (
    <PageCommon
      drawerComponent={<PhylogenyViewerPageDrawer />}
      headerComponent={<PhylogenyViewerPageHeader />}
      isNoInteraction={isNoInteraction}
    >
      {children}
    </PageCommon>
  );

};
