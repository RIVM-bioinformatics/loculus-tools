import { App } from '@rivm-loculus-tools/common-frontend/components/app/App';

import { RecordMergerPageMainPage } from '../../../pages/RecordMergerPageMainPage';

export const RecordMergerApp = () => {
  return (
    <App useAuthentication>
      <RecordMergerPageMainPage />
    </App>
  );
};
