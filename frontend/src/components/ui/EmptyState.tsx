import React, { type ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import type { LucideProps } from 'lucide-react';

interface EmptyStateProps {
    icon?: ComponentType<LucideProps>;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    illustration?: 'appointments' | 'prescriptions' | 'messages' | 'doctors' | 'generic';
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    actionLabel,
    onAction,
    illustration = 'generic',
    className = '',
}) => {
    const getIllustrationSVG = () => {
        switch (illustration) {
            case 'appointments':
                return (
                    <svg viewBox="0 0 200 200" className="w-full h-full animate-in fade-in zoom-in duration-500">
                        <circle cx="100" cy="80" r="30" className="fill-primary/20" />
                        <rect x="70" y="110" width="60" height="70" rx="8" className="fill-primary/30" />
                        <line x1="80" y1="130" x2="120" y2="130" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
                        <line x1="80" y1="145" x2="110" y2="145" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
                        <line x1="80" y1="160" x2="115" y2="160" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                );
            case 'prescriptions':
                return (
                    <svg viewBox="0 0 200 200" className="w-full h-full animate-in fade-in zoom-in duration-500">
                        <rect x="60" y="40" width="80" height="120" rx="8" className="fill-primary/20" />
                        <rect x="70" y="60" width="30" height="30" rx="4" className="fill-primary/40" />
                        <line x1="75" y1="110" x2="125" y2="110" className="stroke-primary" strokeWidth="2" />
                        <line x1="75" y1="125" x2="125" y2="125" className="stroke-primary" strokeWidth="2" />
                        <line x1="75" y1="140" x2="110" y2="140" className="stroke-primary" strokeWidth="2" />
                    </svg>
                );
            case 'messages':
                return (
                    <svg viewBox="0 0 200 200" className="w-full h-full animate-in fade-in zoom-in duration-500">
                        <rect x="40" y="60" width="120" height="80" rx="12" className="fill-primary/20" />
                        <circle cx="70" cy="90" r="8" className="fill-primary/50" />
                        <line x1="85" y1="90" x2="140" y2="90" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
                        <line x1="85" y1="110" x2="125" y2="110" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                );
            case 'doctors':
                return (
                    <svg viewBox="0 0 200 200" className="w-full h-full animate-in fade-in zoom-in duration-500">
                        <circle cx="100" cy="70" r="25" className="fill-primary/30" />
                        <path d="M70 120 Q100 100 130 120 L130 160 L70 160 Z" className="fill-primary/20" />
                        <rect x="90" y="60" width="20" height="10" rx="2" className="fill-primary/50" />
                    </svg>
                );
            default:
                return (
                    <svg viewBox="0 0 200 200" className="w-full h-full animate-in fade-in zoom-in duration-500">
                        <circle cx="100" cy="100" r="60" className="fill-primary/20" />
                        <circle cx="100" cy="100" r="40" className="fill-primary/10" />
                    </svg>
                );
        }
    };

    return (
        <div className={`flex flex-col items-center justify-center text-center p-12 min-h-[400px] ${className}`}>
            <div className="w-[200px] h-[200px] mb-6">
                {getIllustrationSVG()}
            </div>

            {icon && (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    {React.createElement(icon, { className: "h-8 w-8 text-primary" })}
                </div>
            )}

            <h3 className="text-2xl font-semibold text-foreground mb-3">{title}</h3>
            <p className="text-muted-foreground max-w-[400px] leading-relaxed mb-8">{description}</p>

            {actionLabel && onAction && (
                <Button variant="default" onClick={onAction} className="min-w-[180px]">
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};

// Preset empty states for common scenarios
export const NoAppointmentsEmptyState: React.FC<{ onBook?: () => void }> = ({ onBook }) => (
    <EmptyState
        illustration="appointments"
        title="No Appointments Yet"
        description="Book your first appointment with a verified healthcare professional"
        actionLabel="Book Appointment"
        onAction={onBook}
    />
);

export const NoPrescriptionsEmptyState: React.FC = () => (
    <EmptyState
        illustration="prescriptions"
        title="No Prescriptions"
        description="Your prescriptions will appear here after doctor consultations"
    />
);

export const NoMessagesEmptyState: React.FC = () => (
    <EmptyState
        illustration="messages"
        title="No Messages"
        description="Your messages and notifications will appear here"
    />
);

export const NoDoctorsEmptyState: React.FC = () => (
    <EmptyState
        illustration="doctors"
        title="No Doctors Found"
        description="Try adjusting your search filters or check back later"
    />
);
