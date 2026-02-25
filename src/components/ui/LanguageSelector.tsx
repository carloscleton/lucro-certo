import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../../i18n/i18n';
import { Tooltip } from './Tooltip';

export function LanguageSelector() {
    const { i18n, t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language)
        || SUPPORTED_LANGUAGES[0];

    const handleChange = (code: string) => {
        i18n.changeLanguage(code);
        localStorage.setItem('language', code);
        setIsOpen(false);
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <Tooltip content={t('layout.change_language')}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1.5 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                    aria-label={t('layout.change_language')}
                >
                    <Globe size={20} />
                    <span className="text-sm font-medium hidden sm:inline">{currentLang.flag}</span>
                </button>
            </Tooltip>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {t('language.select')}
                        </p>
                    </div>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleChange(lang.code)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${i18n.language === lang.code
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                                }`}
                        >
                            <span className="text-lg">{lang.flag}</span>
                            <span>{lang.label}</span>
                            {i18n.language === lang.code && (
                                <div className="ml-auto w-2 h-2 rounded-full bg-blue-500" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
