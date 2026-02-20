import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, CheckCircle2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AlertType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

export interface AlertOptions {
    title: string;
    message: string;
    type?: AlertType;
    confirmText?: string;
    cancelText?: string;
    icon?: React.ReactNode;
}

interface GlobalAlertDialogProps {
    isOpen: boolean;
    options: AlertOptions;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}

export const GlobalAlertDialog: React.FC<GlobalAlertDialogProps> = ({
    isOpen,
    options,
    onConfirm,
    onCancel
}) => {
    const [isLoading, setIsLoading] = React.useState(false);

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            await Promise.resolve(onConfirm());
        } finally {
            setIsLoading(false);
        }
    };

    const {
        title,
        message,
        type = 'confirm',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        icon
    } = options;

    const getIcon = () => {
        if (icon) return icon;

        const draw = {
            hidden: { pathLength: 0, opacity: 0 },
            visible: {
                pathLength: 1,
                opacity: 1,
                transition: {
                    pathLength: { delay: 0.2, type: "spring", duration: 1.5, bounce: 0 },
                    opacity: { delay: 0.2, duration: 0.01 }
                }
            }
        };

        const pop = {
            hidden: { scale: 0.5, opacity: 0 },
            visible: {
                scale: 1,
                opacity: 1,
                transition: {
                    delay: 0.1,
                    type: "spring",
                    stiffness: 200,
                    damping: 10
                }
            }
        };

        switch (type) {
            case 'success':
                return (
                    <motion.svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="h-10 w-10 text-emerald-600 dark:text-emerald-400 stroke-[3px]"
                        initial="hidden"
                        animate="visible"
                    >
                        <motion.circle cx="12" cy="12" r="10" className="stroke-emerald-600/20 dark:stroke-emerald-400/20 fill-none" />
                        <motion.path
                            d="M9 12l2 2 4-4"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            variants={draw}
                        />
                    </motion.svg>
                );
            case 'error':
            case 'destructive': // Handle alias if used
                return (
                    <motion.svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="h-12 w-12 text-destructive drop-shadow-md"
                        initial="hidden"
                        animate="visible"
                    >
                        <motion.circle cx="12" cy="12" r="12" className="fill-red-100 dark:fill-red-900/20" />
                        <motion.path
                            d="M15 9l-6 6M9 9l6 6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            variants={draw}
                        />
                    </motion.svg>
                );
            case 'warning':
                return (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={pop}
                        className="relative"
                    >
                        <AlertTriangle className="h-10 w-10 text-amber-500 fill-amber-500/10 stroke-[2.5px]" />
                        <motion.div
                            className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                        />
                    </motion.div>
                );
            case 'info':
                return <Info className="h-10 w-10 text-blue-500 stroke-[2.5px]" />;
            default:
                return (
                    <HelpCircle className="h-12 w-12 text-primary-800 dark:text-primary-400 drop-shadow-md" />
                );
        }
    };

    const getIconContainerClass = () => {
        switch (type) {
            case 'success': return 'bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-100 dark:ring-emerald-500/20';
            case 'error': return 'bg-rose-50 dark:bg-rose-900/20 ring-rose-100 dark:ring-rose-500/20';
            case 'warning': return 'bg-amber-50 dark:bg-amber-900/20 ring-amber-100 dark:ring-amber-500/20';
            default: return 'bg-slate-50 dark:bg-slate-800 ring-slate-100 dark:ring-slate-700';
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        onClick={!isLoading ? onCancel : undefined}
                        className={`absolute inset-0 bg-slate-900/40 transition-all ${isLoading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                        className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[32px] shadow-2xl overflow-hidden border border-white/50 dark:border-slate-700/50 ring-1 ring-black/5 dark:ring-white/5"
                    >
                        {/* Decorative Top Highlight */}
                        <div className={`absolute top-0 left-0 right-0 h-1.5 ${type === 'error' ? 'bg-rose-500' : type === 'warning' ? 'bg-amber-500' : type === 'success' ? 'bg-emerald-500' : 'bg-primary-800'}`} />

                        <div className="flex flex-col items-center text-center p-8 space-y-6 pt-10">
                            {/* Icon Container */}
                            <div className="relative">
                                {/* Glow Effect */}
                                <div className={`absolute inset-0 blur-3xl opacity-30 scale-150 ${type === 'error' ? 'bg-rose-500' : type === 'warning' ? 'bg-amber-500' : type === 'success' ? 'bg-emerald-500' : 'bg-primary-500'}`} />

                                <motion.div
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: "spring", duration: 0.5, delay: 0.1 }}
                                    className={`relative p-5 rounded-full shadow-lg ring-1 ${getIconContainerClass()}`}
                                >
                                    {getIcon()}
                                </motion.div>
                            </div>

                            {/* Content */}
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                    {title}
                                </h3>
                                <p className="text-muted-foreground leading-relaxed font-medium">
                                    {message}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex w-full gap-3 pt-2">
                                {(type === 'confirm' || type === 'warning' || type === 'error') && (
                                    <Button
                                        variant="outline"
                                        onClick={onCancel}
                                        disabled={isLoading}
                                        className="flex-1 h-12 rounded-xl text-base font-medium"
                                    >
                                        {cancelText}
                                    </Button>
                                )}
                                <Button
                                    onClick={handleConfirm}
                                    disabled={isLoading}
                                    isLoading={isLoading}
                                    variant={type === 'error' ? 'destructive' : type === 'warning' ? 'default' : type === 'success' ? 'default' : 'default'}
                                    className={`flex-1 h-12 rounded-xl text-base font-semibold ${type === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : type === 'confirm' ? 'bg-primary-800 hover:bg-primary-900' : ''}`}
                                >
                                    {confirmText}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
