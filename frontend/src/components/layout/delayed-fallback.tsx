import React from 'react';
import { MedicalLoader } from '../ui/medical-loader';

export const DelayedFallback: React.FC = () => {
    return (
        <div className="opacity-0 animate-[fade-in_300ms_linear_100ms_forwards] w-full h-full">
            <MedicalLoader fullPage message="Securing clinical data..." />
        </div>
    );
};
