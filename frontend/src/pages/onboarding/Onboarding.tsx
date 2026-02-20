import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingCarousel } from '../../components/onboarding/OnboardingCarousel';

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

    useEffect(() => {
        // Check if user has already seen onboarding
        const seen = sessionStorage.getItem('hasSeenOnboarding');
        if (seen === 'true') {
            setHasSeenOnboarding(true);
            navigate('/dashboard');
        }
    }, [navigate]);

    const completeOnboarding = () => {
        sessionStorage.setItem('hasSeenOnboarding', 'true');
        navigate('/dashboard');
    };

    if (hasSeenOnboarding) {
        return null;
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
            {/* Aesthetic Background Elements */}
            <div className="absolute top-0 right-0 w-128 h-128 bg-primary/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-128 h-128 bg-emerald-500/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />

            {/* The Premium Carousel */}
            <div className="z-10 w-full flex justify-center animate-in fade-in zoom-in-95 duration-1000">
                <OnboardingCarousel onComplete={completeOnboarding} />
            </div>
        </div>
    );
};
