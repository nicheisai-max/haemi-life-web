import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, Shield, Video, Heart, Activity } from 'lucide-react';

interface Slide {
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    image?: string;
}

const slides: Slide[] = [
    {
        title: "Your Health, Simplified",
        description: "Access your medical records, prescriptions, and appointments in one secure location. Haemi Life brings the hospital to your home.",
        icon: <Heart className="h-12 w-12 text-white" />,
        color: "bg-blue-600",
        image: "/onboarding_telemedicine_hero_v2.png" // Placeholder for generated image
    },
    {
        title: "Secure & Private",
        description: "We use banking-grade encryption to ensure your medical data is only accessible by you and your authorized healthcare providers.",
        icon: <Shield className="h-12 w-12 text-white" />,
        color: "bg-indigo-600",
        image: "/onboarding_security_vault_v2.png"
    },
    {
        title: "Video Consultations",
        description: "Connect with verified specialists across Botswana via high-quality video calls, even on low-bandwidth connections.",
        icon: <Video className="h-12 w-12 text-white" />,
        color: "bg-emerald-600",
        image: "/onboarding_telemedicine_hero.png"
    },
    {
        title: "Better Living",
        description: "Monitor your health progress and receive personalized wellness tips to live your best life, every day.",
        icon: <Activity className="h-12 w-12 text-white" />,
        color: "bg-rose-600",
        image: "/onboarding_healthy_lifestyle.png"
    }
];

interface OnboardingCarouselProps {
    onComplete: () => void;
}

export const OnboardingCarousel: React.FC<OnboardingCarouselProps> = ({ onComplete }) => {
    const [index, setIndex] = useState(0);
    const [direction, setDirection] = useState(0);

    const nextStep = () => {
        if (index === slides.length - 1) {
            onComplete();
        } else {
            setDirection(1);
            setIndex((prev) => prev + 1);
        }
    };

    const prevStep = () => {
        if (index > 0) {
            setDirection(-1);
            setIndex((prev) => prev - 1);
        }
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 500 : -500,
            opacity: 0,
            scale: 0.9,
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1,
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 500 : -500,
            opacity: 0,
            scale: 0.9,
        }),
    };

    const currentSlide = slides[index];

    return (
        <div className="relative w-full max-w-5xl h-[600px] flex flex-col md:flex-row bg-card rounded-3xl overflow-hidden shadow-2xl border border-border/50">
            {/* Left: Visual/Image Section */}
            <div className={`relative flex-1 ${currentSlide.color} transition-colors duration-700 overflow-hidden hidden md:flex items-center justify-center`}>
                <AnimatePresence initial={false} custom={direction}>
                    <motion.div
                        key={index}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.4 },
                        }}
                        className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-white"
                    >
                        {/* Placeholder for Image - in production we use <img> with source from state */}
                        <div className="mb-8 p-6 bg-white/20 rounded-full backdrop-blur-md">
                            {currentSlide.icon}
                        </div>
                        <h2 className="text-4xl font-extrabold mb-4 tracking-tight drop-shadow-sm">
                            Haemi Life
                        </h2>
                        <div className="w-24 h-1.5 bg-white/30 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-white"
                                initial={{ width: 0 }}
                                animate={{ width: `${((index + 1) / slides.length) * 100}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    </motion.div>
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>

            {/* Right: Content Section */}
            <div className="flex-1 flex flex-col justify-between p-8 md:p-16 bg-background relative">
                <AnimatePresence initial={false} custom={direction} mode="wait">
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="flex-1 flex flex-col justify-center"
                    >
                        <span className="text-primary font-bold tracking-widest uppercase text-xs mb-4">
                            Step {index + 1} of {slides.length}
                        </span>
                        <h3 className="text-3xl md:text-5xl font-black mb-6 tracking-tight text-foreground leading-tight">
                            {currentSlide.title}
                        </h3>
                        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                            {currentSlide.description}
                        </p>
                    </motion.div>
                </AnimatePresence>

                {/* Controls */}
                <div className="mt-12 flex items-center justify-between">
                    <div className="flex gap-2">
                        {slides.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setDirection(i > index ? 1 : -1);
                                    setIndex(i);
                                }}
                                className={`h-2.5 rounded-full transition-all duration-300 ${i === index ? 'w-8 bg-primary' : 'w-2.5 bg-muted hover:bg-muted-foreground/30'
                                    }`}
                                aria-label={`Go to slide ${i + 1}`}
                            />
                        ))}
                    </div>

                    <div className="flex gap-3">
                        {index > 0 && (
                            <Button
                                variant="ghost"
                                onClick={prevStep}
                                className="rounded-full h-12 w-12 p-0"
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                        )}
                        <Button
                            onClick={nextStep}
                            className="rounded-full px-8 h-12 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all"
                        >
                            {index === slides.length - 1 ? 'Get Started' : 'Next'}
                            {index !== slides.length - 1 && <ChevronRight className="ml-2 h-5 w-5" />}
                        </Button>
                    </div>
                </div>

                {/* Skip Button */}
                <button
                    onClick={onComplete}
                    className="absolute top-8 right-8 text-muted-foreground hover:text-primary transition-colors text-sm font-semibold"
                >
                    Skip
                </button>
            </div>
        </div>
    );
};
