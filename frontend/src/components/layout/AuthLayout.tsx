import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: React.ReactNode;
    subtitle: string;
    brandingTitle?: React.ReactNode;
    brandingSubtitle?: string;
    image: string;
    showLogoInHeader?: boolean;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
    children,
    title,
    subtitle,
    brandingTitle,
    brandingSubtitle,
    image,
    showLogoInHeader = true
}) => {
    return (
        <div className="flex min-h-screen w-full bg-background relative">
            {/* Visual Section (Left) - Visible only on Desktop (LG+) via CSS hidden/block */}
            {/* This section contains MARKETING/BRANDING text only. It is NOT the auth header. */}
            <div className="hidden lg:block lg:w-1/2 relative overflow-hidden border-r" style={{ backgroundColor: 'var(--color-login-bg)' }}>
                <img
                    src={image}
                    alt="Authentication Background"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20" /> {/* Subtle overlay for text contrast */}

                <div className="absolute bottom-[10%] left-[10%] right-[10%] text-white z-20">
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight drop-shadow-lg">
                        {brandingTitle || "Your Health, Reimagined."}
                    </h2>
                    <p className="text-lg md:text-xl text-white/95 font-medium max-w-lg leading-relaxed drop-shadow-md">
                        {brandingSubtitle || "Experience the future of healthcare management with Haemi Life."}
                    </p>
                </div>
            </div>

            {/* Form Section (Right/Bottom) - Visible on ALL screens */}
            {/* This section contains INSTITUTIONAL text only. It is the SINGLE SOURCE OF TRUTH for the auth header. */}
            <main className="flex-1 lg:flex-none lg:w-1/2 flex items-center justify-center px-4 py-8 md:p-6 bg-background relative z-10 w-full" id="main-content">
                <div className="w-full max-w-[480px] space-y-8 animate-in slide-in-from-bottom-8 duration-700 fade-in fill-mode-forwards">

                    {/* Institutional Header - Renders IDENTICALLY on Mobile and Desktop */}
                    <div className="flex flex-col items-center text-center space-y-2">
                        {showLogoInHeader && (
                            <Link to="/login" className="mb-6">
                                <Logo size="auth" />
                            </Link>
                        )}
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
                        <p className="text-sm text-muted-foreground">{subtitle}</p>
                    </div>

                    {children}
                </div>
            </main>
        </div>
    );
};
