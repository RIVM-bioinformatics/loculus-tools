import { PageCommon } from '@rivm-loculus-tools/frontend-common/components/page';
import type { PropsWithChildren } from 'react';

import { SeqEditorPageHeader } from '../SeqEditorPageHeader';


export type PhyloViewerPageProps = PropsWithChildren<{
  isNoInteraction: boolean;
}>;

export const SeqEditorPage = ({ children, isNoInteraction }: PhyloViewerPageProps) => {
  return (
    <PageCommon
      headerComponent={<SeqEditorPageHeader />}
      isNoInteraction={isNoInteraction}
    >
      {children}
    </PageCommon>
  );

};
