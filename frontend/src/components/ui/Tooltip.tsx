import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    side?: 'top' | 'right' | 'bottom' | 'left';
    className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, side = 'right', className }) => {
    const [isVisible, setIsVisible] = useState(false);

    const variants = {
        hidden: { opacity: 0, scale: 0.9, x: side === 'right' ? -10 : 0, y: side === 'top' ? 10 : 0 },
        visible: { opacity: 1, scale: 1, x: 0, y: 0 }
    };

    return (
        <div
            className="relative flex items-center"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={variants}
                        className={`absolute z-50 px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-md shadow-lg whitespace-nowrap pointer-events-none ${className}`}
                        style={{
                            left: side === 'right' ? '100%' : 'auto',
                            top: side === 'right' ? '50%' : 'auto',
                            marginLeft: side === 'right' ? '10px' : 0,
                            translateY: side === 'right' ? '-50%' : 0
                        }}
                    >
                        {content}
                        {/* Arrow */}
                        <div
                            className="absolute w-2 h-2 bg-slate-900 dark:bg-slate-100 rotate-45"
                            style={{
                                left: side === 'right' ? '-4px' : 'auto',
                                top: '50%',
                                marginTop: '-4px'
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
