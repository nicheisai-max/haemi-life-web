import React from 'react';
import { Button } from './Button';
import './EmptyState.css';

interface EmptyStateProps {
    icon?: string;
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
                    <svg viewBox="0 0 200 200" className="empty-state-svg">
                        <circle cx="100" cy="80" r="30" fill="var(--brand-primary-light)" opacity="0.2" />
                        <rect x="70" y="110" width="60" height="70" rx="8" fill="var(--brand-primary)" opacity="0.3" />
                        <line x1="80" y1="130" x2="120" y2="130" stroke="var(--brand-primary)" strokeWidth="3" strokeLinecap="round" />
                        <line x1="80" y1="145" x2="110" y2="145" stroke="var(--brand-primary)" strokeWidth="3" strokeLinecap="round" />
                        <line x1="80" y1="160" x2="115" y2="160" stroke="var(--brand-primary)" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                );
            case 'prescriptions':
                return (
                    <svg viewBox="0 0 200 200" className="empty-state-svg">
                        <rect x="60" y="40" width="80" height="120" rx="8" fill="var(--brand-primary-light)" opacity="0.2" />
                        <rect x="70" y="60" width="30" height="30" rx="4" fill="var(--brand-primary)" opacity="0.4" />
                        <line x1="75" y1="110" x2="125" y2="110" stroke="var(--brand-primary)" strokeWidth="2" />
                        <line x1="75" y1="125" x2="125" y2="125" stroke="var(--brand-primary)" strokeWidth="2" />
                        <line x1="75" y1="140" x2="110" y2="140" stroke="var(--brand-primary)" strokeWidth="2" />
                    </svg>
                );
            case 'messages':
                return (
                    <svg viewBox="0 0 200 200" className="empty-state-svg">
                        <rect x="40" y="60" width="120" height="80" rx="12" fill="var(--brand-primary-light)" opacity="0.2" />
                        <circle cx="70" cy="90" r="8" fill="var(--brand-primary)" opacity="0.5" />
                        <line x1="85" y1="90" x2="140" y2="90" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" />
                        <line x1="85" y1="110" x2="125" y2="110" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                );
            case 'doctors':
                return (
                    <svg viewBox="0 0 200 200" className="empty-state-svg">
                        <circle cx="100" cy="70" r="25" fill="var(--brand-primary)" opacity="0.3" />
                        <path d="M70 120 Q100 100 130 120 L130 160 L70 160 Z" fill="var(--brand-primary-light)" opacity="0.2" />
                        <rect x="90" y="60" width="20" height="10" rx="2" fill="var(--brand-primary)" opacity="0.5" />
                    </svg>
                );
            default:
                return (
                    <svg viewBox="0 0 200 200" className="empty-state-svg">
                        <circle cx="100" cy="100" r="60" fill="var(--brand-primary-light)" opacity="0.2" />
                        <circle cx="100" cy="100" r="40" fill="var(--brand-primary)" opacity="0.1" />
                    </svg>
                );
        }
    };

    return (
        <div className={`empty-state ${className}`}>
            <div className="empty-state-illustration">
                {getIllustrationSVG()}
            </div>

            {icon && (
                <div className="empty-state-icon">
                    <span className="material-icons-outlined">{icon}</span>
                </div>
            )}

            <h3 className="empty-state-title">{title}</h3>
            <p className="empty-state-description">{description}</p>

            {actionLabel && onAction && (
                <Button variant="primary" onClick={onAction} className="empty-state-action">
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
