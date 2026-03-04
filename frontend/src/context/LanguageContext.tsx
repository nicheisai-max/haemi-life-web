import React, { useState, useEffect } from 'react';
import { LanguageContext, type Language } from './LanguageContextDef';

const translations: Record<Language, Record<string, string>> = {
    en: {
        'nav.dashboard': 'Dashboard',
        'nav.appointments': 'Appointments',
        'nav.patients': 'Patients',
        'nav.prescriptions': 'Prescriptions',
        'nav.inventory': 'Inventory',
        'nav.settings': 'Settings',
        'hero.greeting_morning': 'Good Morning',
        'hero.greeting_afternoon': 'Good Afternoon',
        'hero.greeting_evening': 'Good Evening',
        'hero.subtitle_doctor': 'You\'re leading the charge today with {count} patient encounters.',
        'common.loading': 'Loading...',
        'common.view_all': 'View All',
        'common.actions': 'Quick Actions',
    },
    tn: {
        'nav.dashboard': 'Dibeiboto',
        'nav.appointments': 'Ditshupetso',
        'nav.patients': 'Balwetse',
        'nav.prescriptions': 'Dipelelo',
        'nav.inventory': 'Didiriswa',
        'nav.settings': 'Di-setting',
        'hero.greeting_morning': 'Dumela mo mosong',
        'hero.greeting_afternoon': 'Dumela mo motshegareng',
        'hero.greeting_evening': 'Dumela mo mantsiboeng',
        'hero.subtitle_doctor': 'O eteletse pele gompieno ka dikopano tsa balwetse di le {count}.',
        'common.loading': 'Go a laisa...',
        'common.view_all': 'Bona Tsotlhe',
        'common.actions': 'Ditiro ka Bonako',
    }
};

// LanguageContext and useLanguage moved to LanguageContextDef.ts and useLanguage.ts to satisfy Fast Refresh rules.

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>(() => {
        const saved = sessionStorage.getItem('haemi_language');
        return (saved as Language) || 'en';
    });

    useEffect(() => {
        sessionStorage.setItem('haemi_language', language);
        document.documentElement.lang = language;
    }, [language]);

    const t = (key: string) => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

// useLanguage moved to hooks/useLanguage.ts.
