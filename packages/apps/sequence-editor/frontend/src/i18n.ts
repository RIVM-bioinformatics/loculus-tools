import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const editorI18n = i18n.createInstance();

void editorI18n
  .use(initReactI18next)
  .init({
    interpolation: { escapeValue: false },
    lng: 'en',
    resources: {
      en: {
        translation: {},
      },
    },
  });
