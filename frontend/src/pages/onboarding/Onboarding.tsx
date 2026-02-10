import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import './Onboarding.css';

interface OnboardingStep {
    title: string;
    description: string;
    icon: string;
    image?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
    {
        title: 'Welcome to Haemi Life',
        description: 'Your trusted digital healthcare platform for Botswana. Access quality healthcare from anywhere.',
        icon: 'favorite',
    },
    {
        title: 'Book Appointments',
        description: 'Find and book appointments with verified doctors across various specializations.',
        icon: 'calendar_today',
    },
    {
        title: 'Video Consultations',
        description: 'Consult with doctors via secure video calls, optimized for low bandwidth connections.',
        icon: 'videocam',
    },
    {
        title: 'Digital Prescriptions',
        description: 'Receive electronic prescriptions and fill them at any registered pharmacy.',
        icon: 'medication',
    },
    {
        title: 'Offline  Access',
        description: 'Access your medical records and appointments even with poor internet connectivity.',
        icon: 'cloud_done',
    },
];

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

    useEffect(() => {
        // Check if user has already seen onboarding
        const seen = localStorage.getItem('hasSeenOnboarding');
        if (seen === 'true') {
            setHasSeenOnboarding(true);
            // Redirect if already seen
            navigate('/dashboard');
        }
    }, [navigate]);

    const handleNext = () => {
        if (currentStep < ONBOARDING_STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            completeOnboarding();
        }
    };

    const handleSkip = () => {
        completeOnboarding();
    };

    const completeOnboarding = () => {
        localStorage.setItem('hasSeenOnboarding', 'true');
        navigate('/dashboard');
    };

    if (hasSeenOnboarding) {
        return null;
    }

    const step = ONBOARDING_STEPS[currentStep];

    return (
        <div className="onboarding-container">
            <div className="onboarding-content">
                {/* Skip Button */}
                <button className="skip-btn" onClick={handleSkip}>
                    Skip
                </button>

                {/* Progress Indicators */}
                <div className="progress-indicators">
                    {ONBOARDING_STEPS.map((_, index) => (
                        <div
                            key={index}
                            className={`progress-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                        />
                    ))}
                </div>

                {/* Step Content */}
                <Card className="onboarding-card">
                    <div className="step-icon">
                        <span className="material-icons-outlined">{step.icon}</span>
                    </div>
                    <h1>{step.title}</h1>
                    <p>{step.description}</p>
                </Card>

                {/* Navigation */}
                <div className="onboarding-actions">
                    {currentStep > 0 && (
                        <Button
                            variant="outline"
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            leftIcon={<span className="material-icons-outlined">arrow_back</span>}
                        >
                            Back
                        </Button>
                    )}
                    <Button
                        variant="primary"
                        onClick={handleNext}
                        fullWidth={currentStep === 0}
                        rightIcon={
                            currentStep < ONBOARDING_STEPS.length - 1 ? (
                                <span className="material-icons-outlined">arrow_forward</span>
                            ) : undefined
                        }
                    >
                        {currentStep < ONBOARDING_STEPS.length - 1 ? 'Next' : 'Get Started'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
