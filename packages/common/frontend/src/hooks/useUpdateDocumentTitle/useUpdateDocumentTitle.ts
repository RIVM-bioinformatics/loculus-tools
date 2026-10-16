import { useEffect } from 'react';

import { useConfig } from '../useConfig';


export const useUpdateDocumentTitle = (title: string) => {
  const config = useConfig();

  useEffect(() => {
    document.title = `${config.applicationName} - ${title}`;
  }, [config.applicationName, title]);
};
