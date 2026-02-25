import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ptBR from './locales/pt-BR.json';
import ptPT from './locales/pt-PT.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = [
    { code: 'pt-BR', label: 'Português (BR)', flag: '🇧🇷' },
    { code: 'pt-PT', label: 'Português (PT)', flag: '🇵🇹' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
] as const;

i18n
    .use(initReactI18next)
    .init({
        resources: {
            'pt-BR': { translation: ptBR },
            'pt-PT': { translation: ptPT },
            'en': { translation: en },
            'es': { translation: es },
            'fr': { translation: fr },
        },
        lng: localStorage.getItem('language') || 'pt-BR',
        fallbackLng: 'pt-BR',
        interpolation: {
            escapeValue: false, // React already escapes
        },
    });

export default i18n;
