import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logo } from '../../components/ui/Logo';

export const NotFound: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-background p-6 text-center animate-in fade-in duration-700">
            <div className="max-w-[500px] w-full space-y-8">
                <div className="flex justify-center mb-4">
                    <Logo size="lg" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Page Not Found</h1>
                    <p className="text-base text-muted-foreground">The link you followed might be broken, or the page may have been moved.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                    <Button variant="default" size="lg" onClick={() => navigate('/dashboard')} className="min-w-[160px]">
                        Return to Dashboard
                    </Button>
                    <Button variant="outline" size="lg" onClick={() => navigate(-1)} className="min-w-[160px]">
                        Go Back
                    </Button>
                </div>
            </div>
        </div>
    );
};
