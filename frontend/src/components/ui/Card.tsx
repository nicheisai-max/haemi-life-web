import React from 'react';
import { clsx } from 'clsx';
import './Card.css';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
    children,
    className,
    padding = 'md',
    ...props
}) => {
    return (
        <div className={clsx('card', `card-padding-${padding}`, className)} {...props}>
            {children}
        </div>
    );
};
