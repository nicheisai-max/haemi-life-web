import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock } from 'lucide-react';
import { logger } from '@/utils/logger';

interface SessionExpiringPopupProps {
    onExtend: () => Promise<void>;
}

/**
 * Enterprise-grade Session Expiry Popup
 * 
 * Features:
 * - 100% Relative Units (rem)
 * - Global CSS Variable Design Tokens
 * - Framer Motion Micro-interactions
 * - Smooth 1s Local Countdown
 * - WCAG Accessible
 */
export const SessionExpiringPopup: React.FC<SessionExpiringPopupProps> = ({ onExtend }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [timeLeft, setTimeLeft] = useState(120); 
    const [isExtending, setIsExtending] = useState(false);
    const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

    // ─── Event Subscriptions ─────────────────────────────────
    useEffect(() => {
        const handleSessionExpiring = (event: Event) => {
            const customEvent = event as CustomEvent<{ timeLeft: number }>;
            const eventTimeLeft = customEvent.detail.timeLeft;
            
            setTimeLeft(eventTimeLeft);
            if (!isOpen) {
                logger.info('[Session] Session approaching timeout. Opening warning UI.');
                setIsOpen(true);
            }
        };

        const handleUnauthorized = () => {
            setIsOpen(false);
        };

        window.addEventListener('auth:session-expiring', handleSessionExpiring);
        window.addEventListener('auth:unauthorized', handleUnauthorized);

        return () => {
            window.removeEventListener('auth:session-expiring', handleSessionExpiring);
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
        };
    }, [isOpen]);

    // ─── Smooth 1s Local Countdown ───────────────────────────
    useEffect(() => {
        if (isOpen && timeLeft > 0) {
            countdownTimerRef.current = setInterval(() => {
                setTimeLeft(prev => Math.max(0, prev - 1));
            }, 1000);
        } else {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        }

        return () => {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        };
    }, [isOpen, timeLeft]);

    const handleExtend = async () => {
        try {
            setIsExtending(true);
            await onExtend();
            setIsOpen(false);
            logger.info('[Session] Session successfully extended by user.');
        } catch (error) {
            logger.error('[Session] Extension failure', error);
        } finally {
            setIsExtending(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent 
                        className="sm:max-w-[26.5rem] border-border bg-card shadow-elevation"
                        aria-labelledby="session-expiry-title"
                        aria-describedby="session-expiry-description"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <DialogHeader>
                                <div className="flex items-center gap-[0.5rem] mb-[0.5rem]">
                                    <AlertCircle className="h-[1.5rem] w-[1.5rem] text-[var(--color-warning)]" />
                                    <DialogTitle id="session-expiry-title" className="text-h3 text-foreground">
                                        Security Alert
                                    </DialogTitle>
                                </div>
                                <DialogDescription id="session-expiry-description" className="text-[0.9rem] text-muted-foreground leading-relaxed">
                                    Your secure healthcare session is about to expire due to inactivity. 
                                    For your protection, you will be automatically logged out in:
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex flex-col items-center justify-center py-[1.5rem] my-[1rem] bg-muted/30 dark:bg-muted/10 rounded-lg border border-border/50">
                                <motion.div 
                                    className="flex items-center gap-[0.75rem] text-[2rem] font-bold text-primary"
                                    animate={timeLeft <= 30 ? { scale: [1, 1.05, 1] } : {}}
                                    transition={{ repeat: Infinity, duration: 1 }}
                                >
                                    <Clock className={`h-[1.75rem] w-[1.75rem] ${timeLeft <= 30 ? 'text-destructive' : 'text-primary'}`} />
                                    <span className={timeLeft <= 30 ? 'text-destructive' : 'text-primary'}>
                                        {formatTime(timeLeft)}
                                    </span>
                                </motion.div>
                                <p className="text-[0.75rem] text-muted-foreground mt-[0.5rem] font-medium uppercase tracking-wider">
                                    Secure Logout Countdown
                                </p>
                            </div>

                            <DialogFooter className="mt-[1rem] flex sm:flex-row flex-col gap-[0.5rem]">
                                <Button 
                                    variant="outline" 
                                    className="flex-1 h-[2.75rem] text-[0.875rem] font-medium border-border hover:bg-accent transition-colors"
                                    onClick={() => setIsOpen(false)}
                                    disabled={isExtending}
                                >
                                    Dismiss
                                </Button>
                                <Button 
                                    className="flex-1 h-[2.75rem] text-[0.875rem] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all active:scale-[0.98]"
                                    onClick={handleExtend}
                                    isLoading={isExtending}
                                    disabled={isExtending}
                                >
                                    Extend Session
                                </Button>
                            </DialogFooter>
                        </motion.div>
                    </DialogContent>
                </Dialog>
            )}
        </AnimatePresence>
    );
};
