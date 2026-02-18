
import { Logo } from './Logo';

interface MedicalLoaderProps {
    message?: string;
    fullPage?: boolean;
}

export const MedicalLoader: React.FC<MedicalLoaderProps> = ({
    message = "Securing clinical data...",
    fullPage = false
}) => {
    const content = (
        <div className="flex flex-col items-center justify-center p-8 space-y-8 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="relative">
                {/* Subtle Glow Background */}
                <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full scale-150 animate-pulse functionality-reduced-motion:animate-none" />

                {/* Main Logo Container */}
                <div className="relative bg-background/80 backdrop-blur-xl rounded-[28px] p-6 border border-white/10 shadow-2xl ring-1 ring-black/5">
                    <Logo size="auth" />
                </div>

                {/* Status Indicator (Subtle Pulse instead of Bounce) */}
                <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-lg border border-slate-100 dark:border-slate-800 flex items-center justify-center">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex flex-col items-center justify-center gap-1.5">
                    <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                        Haemi Life Core
                    </h3>
                    <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm animate-pulse">
                    {message}
                </p>
            </div>
        </div>
    );

    if (fullPage) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
                {content}
            </div>
        );
    }

    return content;
};
