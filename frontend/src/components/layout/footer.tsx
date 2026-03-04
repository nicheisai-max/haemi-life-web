import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
    return (
        <footer className="w-full border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-6 mt-auto">
            <div className="container flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>
                        &copy; {new Date().getFullYear()} <span className="font-semibold text-foreground">Haemi Life System</span>. All rights reserved.
                    </span>
                </div>

                <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
                    <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                    <a href="#" className="hover:text-primary transition-colors">Support</a>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-mono">
                        v2.1.0-stable
                    </span>
                </div>
            </div>
        </footer>
    );
};
