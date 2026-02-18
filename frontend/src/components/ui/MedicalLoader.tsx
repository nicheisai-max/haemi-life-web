import { Loader2, Activity } from 'lucide-react';
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
        <div className="flex flex-col items-center justify-center p-8 space-y-6 text-center animate-in fade-in duration-700">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-110 animate-pulse" />
                <div className="relative bg-background rounded-full p-4 border border-primary/10 shadow-xl">
                    <Logo size="md" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-primary rounded-full p-1.5 shadow-lg animate-bounce">
                    <Activity size={14} className="text-white" />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    <p className="text-sm font-bold tracking-widest text-primary uppercase">
                        Haemi Life Core
                    </p>
                </div>
                <p className="text-muted-foreground font-medium text-sm max-w-[200px]">
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
