import React from 'react';
import { MedicalLoader } from '../ui/medical-loader';

export const DelayedFallback: React.FC = () => {
    return <MedicalLoader variant="global" message="Securing clinical data..." />;
};
