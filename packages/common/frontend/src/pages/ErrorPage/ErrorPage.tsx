import { useTranslation } from 'react-i18next';

import { GenericErrorMessage } from '../../components/ui/GenericErrorMessage';
import { PageCommon } from '../../components/ui/PageCommon';

export type ErrorPageProps = {
  readonly error?: unknown;
};

export const ErrorPage = ({ error }: ErrorPageProps) => {
  const { t } = useTranslation();

  return (
    <PageCommon
      isNoInteraction
      title={t`Error`}
    >
      <GenericErrorMessage
        error={error}
      />
    </PageCommon>
  );
};
