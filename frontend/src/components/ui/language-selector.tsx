import React from 'react';
import { useLanguage } from '../../hooks/use-language';
import { Button } from './button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Languages, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const LanguageSelector: React.FC = () => {
    const { language, setLanguage } = useLanguage();

    const languages = [
        { code: 'en', label: 'English', flag: '🇬🇧' },
        { code: 'tn', label: 'Setswana', flag: '🇧🇼' }
    ] as const;

    const currentLang = languages.find(l => l.code === language);

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="haemi-nav-action-capsule gap-2 hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
                >
                    <Languages className="h-4 w-4" />
                    <span className="font-bold text-xs uppercase tracking-wider">{currentLang?.code}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-[var(--card-radius)] p-1.5 bg-card/95 backdrop-blur-xl border-border shadow-2xl mt-2 transition-all">
                <div className="px-2 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Select Region
                </div>
                {languages.map((lang) => (
                    <DropdownMenuItem
                        key={lang.code}
                        onClick={() => setLanguage(lang.code)}
                        className={`
                            flex items-center justify-between p-3 rounded-[var(--card-radius)] cursor-pointer transition-all mb-1
                            ${language === lang.code ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}
                        `}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-xl">{lang.flag}</span>
                            <span className="text-sm">{lang.label}</span>
                        </div>
                        <AnimatePresence>
                            {language === lang.code && (
                                <motion.div
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                >
                                    <Check className="h-4 w-4" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
