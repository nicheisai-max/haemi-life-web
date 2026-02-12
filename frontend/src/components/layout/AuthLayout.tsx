import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';


interface AuthLayoutProps {
    children: React.ReactNode;
    title: React.ReactNode;
    subtitle: string;
    image: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle, image }) => {
    return (
        <div className="flex min-h-screen w-full bg-background overflow-hidden relative">
            {/* Visual Section (Left/Top on mobile) */}
            <div className="hidden lg:block lg:w-1/2 relative bg-background overflow-hidden border-r">
                <img
                    src={image}
                    alt="Authentication Background"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20" /> {/* Subtle overlay for text contrast */}

                <div className="absolute bottom-[10%] left-[10%] right-[10%] text-white z-20">
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight drop-shadow-lg">
                        {title}
                    </h2>
                    <p className="text-lg md:text-xl text-white/95 font-medium max-w-lg leading-relaxed drop-shadow-md">
                        {subtitle}
                    </p>
                </div>
            </div>

            {/* Form Section (Right/Bottom) */}
            <main className="flex-1 lg:flex-none lg:w-1/2 flex items-center justify-center px-4 py-8 md:p-6 bg-background relative z-10 w-full" id="main-content">
                <div className="w-full max-w-[480px] space-y-8 animate-in slide-in-from-bottom-8 duration-700 fade-in fill-mode-forwards">
                    {/* Mobile Header (Visible only on mobile) */}
                    <div className="lg:hidden flex flex-col items-center text-center mb-4">
                        <Link to="/login" className="mb-4">
                            <Logo size="auth" />
                        </Link>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
                        <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
                    </div>
                    {children}
                </div>
            </main>
        </div>
    );
};
