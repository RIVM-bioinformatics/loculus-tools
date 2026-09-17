import {
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const I18nWrapper = ({ children }: { children: ReactNode }) => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const performInitialization = async () => {
      await i18n
        .use(initReactI18next) // passes i18n down to react-i18next
        .init({
          interpolation: {
            escapeValue: false, // react already safes from xss
          },
          lng: 'en',
          resources: {
            en: {
              translation: {
              },
            },
          },
        });
      setIsInitialized(true);
    };
    void performInitialization();
  }, []);


  return (
    <>
      {isInitialized ? children : null}
    </>
  );
};
