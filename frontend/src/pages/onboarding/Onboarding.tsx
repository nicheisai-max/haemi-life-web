import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { OnboardingCarousel } from '../../components/onboarding/OnboardingCarousel';
import { completeOnboarding } from '../../utils/onboardingStorage';

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();

    const handleCompleteOnboarding = () => {
        completeOnboarding();
        // Strict routing requirement: Always to login.
        navigate('/login', { replace: true });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-slate-50 relative overflow-hidden transition-colors duration-500">
            {/* Elegant Medical Mesh Gradient Map */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,_#ECFCFA_0%,_transparent_40%),radial-gradient(circle_at_100%_100%,_#D5F6F1_0%,_transparent_40%)] opacity-80" />

            {/* Soft Ambient Floating Orbs - Medical/Trustworthy Aesthetic */}
            <motion.div
                animate={{ y: [-20, 20, -20], x: [-10, 10, -10] }}
                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                className="absolute top-[10%] left-[15%] w-[40vw] h-[40vw] rounded-full bg-primary/5 blur-[120px] mix-blend-multiply opacity-60"
            />
            <motion.div
                animate={{ y: [20, -20, 20], x: [10, -10, 10] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                className="absolute bottom-[10%] right-[15%] w-[45vw] h-[45vw] rounded-full bg-primary/10 blur-[130px] mix-blend-multiply opacity-50"
            />

            {/* Dark Mode Ambient Support */}
            <div className="hidden dark:block absolute inset-0 bg-background z-0" />
            <div className="hidden dark:block absolute top-[10%] right-[20%] w-[40vw] h-[40vw] rounded-full bg-primary/10 blur-[120px] opacity-40 z-0" />

            {/* The Premium Carousel Container */}
            <div className="z-10 w-full flex justify-center animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-[var(--ease-premium)]">
                <OnboardingCarousel onComplete={handleCompleteOnboarding} />
            </div>
        </div>
    );
};
