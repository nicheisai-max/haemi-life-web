import React, { useRef, useState, useEffect } from 'react';
import { Button } from './button';
import { Card } from './card';
import { Eraser, Check, Signature as SignatureIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SignaturePadProps {
    onSave?: (signatureData: string) => void;
    title?: string;
    description?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
    onSave,
    title = "Electronic Signature",
    description = "Please sign within the box below to authorize this clinical action."
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setIsEmpty(false);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const endDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);
    };

    const saveSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas || isEmpty) return;

        const dataUrl = canvas.toDataURL();
        onSave?.(dataUrl);
    };

    // Initialize context properties
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#000000';
            }
        }
    }, [canvasRef]);

    return (
        <Card className="p-6 space-y-4 border-2 border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <SignatureIcon className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="font-bold text-lg">{title}</h3>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
            </div>

            <div className="relative group">
                <canvas
                    ref={canvasRef}
                    width={500}
                    height={200}
                    className="w-full h-[200px] border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/50 cursor-crosshair transition-all group-hover:border-primary/50"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={endDrawing}
                />
                <AnimatePresence>
                    {isEmpty && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 font-medium italic text-sm"
                        >
                            Sign here...
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="flex items-center justify-between gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSignature}
                    className="text-muted-foreground hover:text-destructive gap-2 h-10 px-4 rounded-xl"
                >
                    <Eraser className="h-4 w-4" />
                    Clear
                </Button>
                <Button
                    size="sm"
                    disabled={isEmpty}
                    onClick={saveSignature}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-10 px-6 rounded-xl font-bold shadow-lg shadow-primary/20"
                >
                    <Check className="h-4 w-4" />
                    Apply Signature
                </Button>
            </div>
        </Card>
    );
};
