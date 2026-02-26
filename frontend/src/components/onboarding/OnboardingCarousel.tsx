import React, { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
    ChevronRight,
    ChevronLeft,
    Shield,
    Video,
    Heart,
    Stethoscope,
    FileText,
    CalendarDays,
    Lock,
    Fingerprint,
    ShieldCheck,
    MonitorSmartphone,
    Wifi,
    UserRound,
} from 'lucide-react';

/* ────────────────────────────────────────────
 * Ultra-Premium Inline CSS Illustrations
 * Glassmorphism, layered depth, and floating motion
 * ──────────────────────────────────────────── */

const HealthIllustration = memo(() => (
    <div className="relative w-full h-full flex items-center justify-center">
        {/* Core Icon Container - Elevated Glassmorphism */}
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, y: [-4, 4, -4] }}
            transition={{
                duration: 0.8, ease: [0.16, 1, 0.3, 1],
                y: { duration: 6, repeat: Infinity, ease: 'easeInOut' }
            }}
            className="relative z-10"
        >
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] bg-white/40 backdrop-blur-2xl flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(20,140,139,0.2)] ring-1 ring-white/80 ring-inset relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/60 before:to-transparent before:opacity-50">
                <Heart className="w-10 h-10 md:w-14 md:h-14 text-primary drop-shadow-[0_2px_10px_rgba(20,140,139,0.3)] relative z-10" strokeWidth={1.5} />
            </div>
        </motion.div>

        {/* Floating Satellite Elements - Premium Staggered Motion */}
        <motion.div
            animate={{ y: [-6, 6, -6], rotate: [-2, 2, -2] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-2 right-10 md:top-8 md:right-20 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/50 backdrop-blur-xl flex items-center justify-center ring-1 ring-white/60 ring-inset shadow-[0_10px_20px_-5px_rgba(0,0,0,0.05)]"
        >
            <Stethoscope className="w-6 h-6 md:w-7 md:h-7 text-primary/90" strokeWidth={1.5} />
        </motion.div>

        <motion.div
            animate={{ y: [6, -6, 6], rotate: [2, -2, 2] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="absolute bottom-8 left-6 md:bottom-12 md:left-14 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/60 backdrop-blur-xl flex items-center justify-center ring-1 ring-white/70 ring-inset shadow-[0_8px_16px_-4px_rgba(0,0,0,0.05)]"
        >
            <FileText className="w-5 h-5 md:w-6 md:h-6 text-primary/80" strokeWidth={1.5} />
        </motion.div>

        <motion.div
            animate={{ y: [-4, 4, -4] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute top-16 left-6 md:top-24 md:left-14 w-9 h-9 md:w-10 md:h-10 rounded-lg bg-white/40 backdrop-blur-md flex items-center justify-center ring-1 ring-white/50 ring-inset shadow-[0_4px_12px_-2px_rgba(0,0,0,0.04)]"
        >
            <CalendarDays className="w-4 h-4 md:w-5 md:h-5 text-primary/70" strokeWidth={1.5} />
        </motion.div>

        {/* Minimalist Geometric Rings */}
        <div className="absolute w-44 h-44 md:w-64 md:h-64 rounded-full border border-primary/10" />
        <div className="absolute w-60 h-60 md:w-80 md:h-80 rounded-full border border-primary/5 border-dashed animate-[spin_60s_linear_infinite]" />
    </div>
));
HealthIllustration.displayName = 'HealthIllustration';

const SecurityIllustration = memo(() => (
    <div className="relative w-full h-full flex items-center justify-center">
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, y: [-4, 4, -4] }}
            transition={{
                duration: 0.8, ease: [0.16, 1, 0.3, 1],
                y: { duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }
            }}
            className="relative z-10"
        >
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] bg-white/40 backdrop-blur-2xl flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(79,70,229,0.2)] ring-1 ring-white/80 ring-inset relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/60 before:to-transparent before:opacity-50">
                <Shield className="w-10 h-10 md:w-14 md:h-14 text-indigo-600 drop-shadow-[0_2px_10px_rgba(79,70,229,0.3)] relative z-10" strokeWidth={1.5} />
            </div>
        </motion.div>

        <motion.div
            animate={{ y: [-6, 6, -6], rotate: [2, -2, 2] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-4 right-10 md:top-10 md:right-20 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/50 backdrop-blur-xl flex items-center justify-center ring-1 ring-white/60 ring-inset shadow-[0_10px_20px_-5px_rgba(0,0,0,0.05)]"
        >
            <Lock className="w-6 h-6 md:w-7 md:h-7 text-indigo-600/90" strokeWidth={1.5} />
        </motion.div>

        <motion.div
            animate={{ y: [6, -6, 6], rotate: [-2, 2, -2] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
            className="absolute bottom-8 left-8 md:bottom-12 md:left-16 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/60 backdrop-blur-xl flex items-center justify-center ring-1 ring-white/70 ring-inset shadow-[0_8px_16px_-4px_rgba(0,0,0,0.05)]"
        >
            <Fingerprint className="w-5 h-5 md:w-6 md:h-6 text-indigo-600/80" strokeWidth={1.5} />
        </motion.div>

        <motion.div
            animate={{ y: [-4, 4, -4] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
            className="absolute top-16 left-8 md:top-24 md:left-16 w-9 h-9 md:w-10 md:h-10 rounded-lg bg-white/40 backdrop-blur-md flex items-center justify-center ring-1 ring-white/50 ring-inset shadow-[0_4px_12px_-2px_rgba(0,0,0,0.04)]"
        >
            <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-indigo-600/70" strokeWidth={1.5} />
        </motion.div>

        <div className="absolute w-44 h-44 md:w-64 md:h-64 rounded-full border border-indigo-500/10" />
        <div className="absolute w-60 h-60 md:w-80 md:h-80 rounded-full border border-indigo-500/5 border-dashed animate-[spin_60s_linear_infinite]" />
    </div>
));
SecurityIllustration.displayName = 'SecurityIllustration';

const TelemedicineIllustration = memo(() => (
    <div className="relative w-full h-full flex items-center justify-center">
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, y: [-4, 4, -4] }}
            transition={{
                duration: 0.8, ease: [0.16, 1, 0.3, 1],
                y: { duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }
            }}
            className="relative z-10"
        >
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] bg-white/40 backdrop-blur-2xl flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(16,185,129,0.2)] ring-1 ring-white/80 ring-inset relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/60 before:to-transparent before:opacity-50">
                <Video className="w-10 h-10 md:w-14 md:h-14 text-emerald-600 drop-shadow-[0_2px_10px_rgba(16,185,129,0.3)] relative z-10" strokeWidth={1.5} />
            </div>
        </motion.div>

        <motion.div
            animate={{ y: [-6, 6, -6], rotate: [-2, 2, -2] }}
            transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-4 right-8 md:top-10 md:right-16 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/50 backdrop-blur-xl flex items-center justify-center ring-1 ring-white/60 ring-inset shadow-[0_10px_20px_-5px_rgba(0,0,0,0.05)]"
        >
            <MonitorSmartphone className="w-6 h-6 md:w-7 md:h-7 text-emerald-600/90" strokeWidth={1.5} />
        </motion.div>

        <motion.div
            animate={{ y: [6, -6, 6], rotate: [2, -2, 2] }}
            transition={{ duration: 4.7, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
            className="absolute bottom-8 left-6 md:bottom-14 md:left-14 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/60 backdrop-blur-xl flex items-center justify-center ring-1 ring-white/70 ring-inset shadow-[0_8px_16px_-4px_rgba(0,0,0,0.05)]"
        >
            <Wifi className="w-5 h-5 md:w-6 md:h-6 text-emerald-600/80" strokeWidth={1.5} />
        </motion.div>

        <motion.div
            animate={{ y: [-4, 4, -4] }}
            transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
            className="absolute top-14 left-6 md:top-20 md:left-14 w-9 h-9 md:w-10 md:h-10 rounded-lg bg-white/40 backdrop-blur-md flex items-center justify-center ring-1 ring-white/50 ring-inset shadow-[0_4px_12px_-2px_rgba(0,0,0,0.04)]"
        >
            <UserRound className="w-4 h-4 md:w-5 md:h-5 text-emerald-600/70" strokeWidth={1.5} />
        </motion.div>

        <div className="absolute w-44 h-44 md:w-64 md:h-64 rounded-full border border-emerald-500/10" />
        <div className="absolute w-60 h-60 md:w-80 md:h-80 rounded-full border border-emerald-500/5 border-dashed animate-[spin_60s_linear_infinite]" />
    </div>
));
TelemedicineIllustration.displayName = 'TelemedicineIllustration';

/* ────────────────────────────────────────────
 * Slide Data (Strict: 3 Slides)
 * ──────────────────────────────────────────── */

interface Slide {
    title: string;
    description: string;
    gradient: string;
    illustration: React.ReactNode;
}

const slides: Slide[] = [
    {
        title: 'Your Health, Simplified',
        description: 'Access your medical records, prescriptions, and appointments in one secure location. Haemi Life brings the hospital to your fingertips.',
        gradient: 'from-[#E6F7F6]/90 via-[#F0FDFB]/70 to-white/50',
        illustration: <HealthIllustration />,
    },
    {
        title: 'Secure & Private',
        description: 'We use banking-grade encryption to ensure your medical data is only accessible by you and your authorized healthcare providers.',
        gradient: 'from-[#EEF2FF]/90 via-[#F5F7FF]/70 to-white/50',
        illustration: <SecurityIllustration />,
    },
    {
        title: 'Video Consultations',
        description: 'Connect with verified specialists across Botswana via high-quality video calls, even on low-bandwidth connections.',
        gradient: 'from-[#ECFDF5]/90 via-[#F4FEFA]/70 to-white/50',
        illustration: <TelemedicineIllustration />,
    },
];

/* ────────────────────────────────────────────
 * Premium Main Carousel Component
 * ──────────────────────────────────────────── */

interface OnboardingCarouselProps {
    onComplete: () => void;
}

export const OnboardingCarousel: React.FC<OnboardingCarouselProps> = ({ onComplete }) => {
    const [index, setIndex] = useState(0);
    const [direction, setDirection] = useState(0);

    const nextStep = useCallback(() => {
        if (index === slides.length - 1) {
            onComplete();
        } else {
            setDirection(1);
            setIndex((prev) => prev + 1);
        }
    }, [index, onComplete]);

    const prevStep = useCallback(() => {
        if (index > 0) {
            setDirection(-1);
            setIndex((prev) => prev - 1);
        }
    }, [index]);

    // Apple/Stripe-style smooth transition curves
    const slideVariants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 100 : -100,
            opacity: 0,
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
        },
        exit: (dir: number) => ({
            zIndex: 0,
            x: dir < 0 ? 100 : -100,
            opacity: 0,
        }),
    };

    const currentSlide = slides[index];

    return (
        <div className="relative w-[95vw] md:w-[75vw] lg:w-[60vw] max-w-[960px] flex flex-col md:flex-row bg-card/95 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04),_0_30px_60px_rgb(0,0,0,0.08)] border border-white/60 dark:border-border/40 my-4 mx-auto ring-1 ring-black/5 dark:ring-white/10 transition-all duration-500 ease-[var(--ease-premium)]">

            {/* Visual Section (Top on mobile, Left on desktop) - Elevated Bright Canvas */}
            <div className={`relative w-full min-h-[280px] md:min-h-[360px] shrink-0 md:flex-[0.45] lg:flex-[0.5] bg-gradient-to-br ${currentSlide.gradient} transition-colors duration-1000 flex items-center justify-center overflow-hidden rounded-t-[2rem] md:rounded-tr-none md:rounded-l-[2.5rem]`}>

                {/* Abstract Light Orbs */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/60 blur-[80px] rounded-full translate-x-1/3 -translate-y-1/3" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/10 blur-[100px] rounded-full -translate-x-1/3 translate-y-1/3" />

                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.div
                        key={index}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute inset-0 flex items-center justify-center p-4 md:p-8"
                    >
                        {currentSlide.illustration}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Content Section (Bottom on mobile, Right on desktop) */}
            <div className="flex-[0.55] lg:flex-[0.5] flex flex-col p-[clamp(1.25rem,3.2vw,3rem)] bg-transparent relative z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.02)] md:shadow-none min-h-[320px] md:min-h-0 justify-between">

                {/* Skip / Brand Header */}
                <div className="flex justify-between items-center w-full mb-8 md:mb-10">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[length:var(--font-h4)] text-foreground/90 font-bold tracking-[0.1em] uppercase"
                    >
                        Haemi Life
                    </motion.div>
                    <button
                        onClick={onComplete}
                        className="group relative text-muted-foreground/80 hover:text-foreground transition-colors text-sm font-semibold tracking-wide px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
                    >
                        <span className="relative z-10 group-hover:-translate-y-[1px] transition-transform duration-300 inline-block">Skip</span>
                        <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-primary/40 group-hover:w-full transition-all duration-300 ease-[var(--ease-premium)]" />
                    </button>
                </div>

                {/* Main Text Content */}
                <div className="flex-1 flex flex-col justify-center">
                    <AnimatePresence initial={false} custom={direction} mode="wait">
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="w-full max-w-[600px]"
                        >
                            <div className="inline-flex items-center gap-2 mb-8 uppercase tracking-[0.15em] text-[11px] font-bold text-primary">
                                <span>Step</span>
                                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full shadow-inner ring-1 ring-primary/20">0{index + 1}</span>
                            </div>

                            <h2 className="text-[length:var(--font-h1)] md:text-[length:var(--font-h1)] text-foreground font-extrabold tracking-tight leading-[1.1] mb-6 drop-shadow-[0_1px_1px_rgba(0,0,0,0.02)]">
                                {currentSlide.title}
                            </h2>

                            <p className="text-[length:var(--font-body-lg)] md:text-[length:var(--font-h4)] text-muted-foreground/80 leading-[1.7] font-medium">
                                {currentSlide.description}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer Controls */}
                <div className="mt-[clamp(1.25rem,3vw,2.5rem)] flex flex-col md:flex-row md:items-center justify-between gap-[clamp(0.75rem,2vw,1.5rem)] pb-2">

                    {/* Elegant Progress Track */}
                    <div className="relative w-32 md:w-48 h-1.5 bg-muted rounded-full overflow-hidden shadow-inner hidden md:block">
                        <motion.div
                            className="absolute top-0 left-0 h-full bg-primary rounded-full shadow-[0_0_10px_rgba(20,140,139,0.3)]"
                            initial={false}
                            animate={{
                                width: `${100 / slides.length}%`,
                                x: `${index * 100}%`
                            }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                    </div>
                    {/* Mobile fallback indicator */}
                    <div className="flex gap-2 md:hidden">
                        {slides.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? 'w-8 bg-primary' : 'w-4 bg-muted'}`} />
                        ))}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex gap-3 self-end md:self-auto w-full md:w-auto mt-4 md:mt-0">
                        {index > 0 && (
                            <Button
                                variant="outline"
                                onClick={prevStep}
                                className="rounded-2xl h-12 w-12 md:h-14 md:w-14 p-0 border-border/50 hover:bg-accent/50 transition-colors shadow-sm bg-background/50 backdrop-blur-sm"
                            >
                                <ChevronLeft className="h-5 w-5 text-foreground" />
                            </Button>
                        )}
                        <Button
                            onClick={nextStep}
                            className="relative overflow-hidden rounded-2xl h-12 md:h-14 flex-1 md:w-48 md:px-8 bg-primary hover:bg-primary/90 text-white font-semibold text-base transition-all duration-300 shadow-[0_8px_20px_-4px_rgba(20,140,139,0.3)] hover:shadow-[0_12px_25px_-5px_rgba(20,140,139,0.4)] hover:-translate-y-[2px] hover:scale-[1.02] active:scale-[0.98] active:translate-y-[1px]"
                        >
                            <span className="relative z-10 flex items-center justify-center w-full">
                                {index === slides.length - 1 ? 'Get Started' : 'Continue'}
                                {index !== slides.length - 1 && (
                                    <ChevronRight className="ml-2 h-5 w-5" />
                                )}
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] hover:translate-x-[150%] transition-transform duration-1000 ease-in-out" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
