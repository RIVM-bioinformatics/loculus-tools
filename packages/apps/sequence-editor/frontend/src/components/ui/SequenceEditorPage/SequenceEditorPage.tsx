import { PageCommon } from '@rivm-loculus-tools/frontend-common/components/page';
import type { PropsWithChildren } from 'react';

import { SequenceEditorPageHeader } from '../SequenceEditorPageHeader';


export type SequenceEditorPageProps = PropsWithChildren<{
  isNoInteraction: boolean;
}>;

export const SequenceEditorPage = ({ children, isNoInteraction }: SequenceEditorPageProps) => {
  return (
    <PageCommon
      headerComponent={<SequenceEditorPageHeader />}
      isNoInteraction={isNoInteraction}
    >
      {children}
    </PageCommon>
  );

};
