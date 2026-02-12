import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

export const PremiumLoader: React.FC = () => {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm transition-colors duration-500">
            <div className="relative flex flex-col items-center gap-6">
                {/* Logo Icon Animation */}
                <div className="relative flex h-24 w-24 items-center justify-center">
                    <motion.div
                        className="absolute inset-0 rounded-full border-4 border-primary/30"
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.1, 0.3],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />
                    <motion.div
                        className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent"
                        animate={{ rotate: 360 }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Activity className="h-10 w-10 text-primary" />
                    </motion.div>
                </div>

                {/* Text Animation */}
                <div className="flex flex-col items-center space-y-2">
                    <motion.div
                        className="flex items-center gap-2 text-3xl font-black tracking-tighter"
                        initial="hidden"
                        animate="visible"
                        variants={{
                            hidden: { opacity: 0 },
                            visible: {
                                opacity: 1,
                                transition: {
                                    staggerChildren: 0.1,
                                },
                            },
                        }}
                    >
                        {['H', 'A', 'E', 'M', 'I'].map((char, i) => (
                            <motion.span
                                key={i}
                                variants={{
                                    hidden: { opacity: 0, y: 10 },
                                    visible: { opacity: 1, y: 0 },
                                }}
                                className="text-primary"
                            >
                                {char}
                            </motion.span>
                        ))}
                        <span className="w-2" />
                        {['L', 'I', 'F', 'E'].map((char, i) => (
                            <motion.span
                                key={i}
                                variants={{
                                    hidden: { opacity: 0, y: 10 },
                                    visible: { opacity: 1, y: 0 },
                                }}
                                className="text-foreground dark:text-white"
                            >
                                {char}
                            </motion.span>
                        ))}
                    </motion.div>

                    <motion.p
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 1 }}
                    >
                        Secured Healthcare System
                    </motion.p>
                </div>

                {/* Loading Bar */}
                <div className="h-1 w-48 overflow-hidden rounded-full bg-secondary/50 mt-4">
                    <motion.div
                        className="h-full bg-primary"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
