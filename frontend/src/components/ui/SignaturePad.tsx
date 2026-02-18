import { useRef, useState, useEffect } from 'react';
import { Button } from './button';
import { Card } from './card';
import { Eraser, Check, Signature as SignatureIcon, PenTool, Type, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from './input';
import { Label } from './label';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
    onSave?: (signatureData: string) => void;
    title?: string;
    description?: string;
}

// Premium Cursive Fonts (loaded via Google Fonts in global CSS or dynamically here)
const SIGNATURE_FONTS = [
    { name: 'Great Vibes', family: '"Great Vibes", cursive', label: 'Classic' },
    { name: 'Sacramento', family: '"Sacramento", cursive', label: 'Modern' },
    { name: 'Allura', family: '"Allura", cursive', label: 'Elegant' },
];

export const SignaturePad: React.FC<SignaturePadProps> = ({
    onSave,
    title = "Electronic Signature",
    description = "Please sign within the box below to authorize this clinical action."
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [activeTab, setActiveTab] = useState<'draw' | 'type'>('draw');
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);

    // Drawing State
    const lastPoint = useRef<{ x: number, y: number } | null>(null);
    const lastTime = useRef<number>(0);
    const lastWidth = useRef<number>(2);

    // Typing State
    const [typedName, setTypedName] = useState('');
    const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0]);

    // Inject Fonts
    useEffect(() => {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Allura&family=Great+Vibes&family=Sacramento&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        return () => {
            document.head.removeChild(link);
        };
    }, []);

    // ----------------------------------------------------------------------
    // Drawing Logic (Bezier Curves & Velocity)
    // ----------------------------------------------------------------------

    const getPoint = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        // Calculate scale ratios (relationship between internal buffer and CSS size)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const clientX = ('touches' in e) ? e.touches[0].clientX : e.clientX;
        const clientY = ('touches' in e) ? e.touches[0].clientY : e.clientY;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault(); // Prevent scrolling on touch
        setIsDrawing(true);
        setIsEmpty(false);
        const point = getPoint(e);
        lastPoint.current = point;
        lastTime.current = Date.now();
        lastWidth.current = 2; // Reset width

        // Draw a single dot
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, lastWidth.current / 2, 0, Math.PI * 2);
            ctx.fillStyle = 'black';
            ctx.fill();
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !lastPoint.current) return;
        e.preventDefault();

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const currentPoint = getPoint(e);
        const currentTime = Date.now();
        const timeDiff = currentTime - lastTime.current;

        // Velocity-based width calculation
        const distance = Math.sqrt(
            Math.pow(currentPoint.x - lastPoint.current.x, 2) +
            Math.pow(currentPoint.y - lastPoint.current.y, 2)
        );
        const velocity = distance / (timeDiff || 1);

        // Smoother width transition
        const minWidth = 1.0;
        const maxWidth = 3.5;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, maxWidth - (velocity * 0.5)));
        const width = lastWidth.current + (newWidth - lastWidth.current) * 0.2; // Ease the width change

        ctx.beginPath();
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'black';

        // Quadratic Bezier Curve for smoothness
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
        // Use midpoint as control point for smoother curves
        // Actually, simple quadratic to current point is okay if points are close,
        // but true smooth requires (p1 + p2) / 2
        // For high frequency mouse events, simple lineTo or quadraticTo is often sufficient if we smooth the width.
        // Let's stick to quadratic to the average for ultra smoothness

        ctx.quadraticCurveTo(
            lastPoint.current.x,
            lastPoint.current.y,
            (lastPoint.current.x + currentPoint.x) / 2,
            (lastPoint.current.y + currentPoint.y) / 2
        );
        ctx.stroke();

        // Connect the rest
        ctx.beginPath();
        ctx.moveTo((lastPoint.current.x + currentPoint.x) / 2, (lastPoint.current.y + currentPoint.y) / 2);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();

        lastPoint.current = currentPoint;
        lastTime.current = currentTime;
        lastWidth.current = width;
    };

    const endDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        if (activeTab === 'draw') {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (canvas && ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                setIsEmpty(true);
            }
        } else {
            setTypedName('');
        }
    };

    // ----------------------------------------------------------------------
    // Save Logic
    // ----------------------------------------------------------------------

    const handleSave = () => {
        if (activeTab === 'draw') {
            const canvas = canvasRef.current;
            if (canvas && !isEmpty) {
                onSave?.(canvas.toDataURL());
            }
        } else {
            if (!typedName.trim()) return;

            // Create a temporary canvas to render the text font as an image
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 500;
            tempCanvas.height = 200;
            const ctx = tempCanvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'white'; // Transparent background preference? usually signatures are on transparent.
                // But for saving, maybe transparent.
                // ctx.fillRect(0, 0, 500, 200); 

                ctx.font = `48px ${selectedFont.family.replace(/"/g, '')}, cursive`;
                ctx.fillStyle = 'black';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(typedName, 250, 100);

                onSave?.(tempCanvas.toDataURL());
            }
        }
    };

    return (
        <Card className="p-0 border-0 shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-card ring-1 ring-slate-200 dark:ring-slate-800">
            {/* Header / Tabs */}
            <div className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 p-2 flex items-center justify-between">
                <div className="flex items-center gap-3 px-4 py-2">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <SignatureIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-foreground">{title}</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Verified Identity</p>
                    </div>
                </div>

                <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('draw')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300",
                            activeTab === 'draw'
                                ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <PenTool className="h-3.5 w-3.5" />
                        Draw
                    </button>
                    <button
                        onClick={() => setActiveTab('type')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300",
                            activeTab === 'type'
                                ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Type className="h-3.5 w-3.5" />
                        Type
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-6 space-y-6">

                {/* DRAW MODE */}
                <div className={cn("relative group transition-opacity duration-300", activeTab === 'draw' ? "block" : "hidden")}>
                    <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
                    <canvas
                        ref={canvasRef}
                        width={500}
                        height={200}
                        className="w-full h-[200px] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/30 dark:bg-slate-900/30 cursor-crosshair touch-none transition-all group-hover:border-primary/30 group-hover:bg-slate-50/80"
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
                                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400"
                            >
                                <PenTool className="h-8 w-8 mb-2 opacity-50" />
                                <span className="font-medium text-sm">Sign here with your mouse or finger</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* TYPE MODE */}
                <div className={cn("space-y-6", activeTab === 'type' ? "block" : "hidden")}>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="signature-name">Full Name</Label>
                            <Input
                                id="signature-name"
                                placeholder="Type your full name..."
                                value={typedName}
                                onChange={(e) => {
                                    setTypedName(e.target.value);
                                    setIsEmpty(!e.target.value);
                                }}
                                className="h-12 text-lg"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs uppercase text-muted-foreground tracking-wider font-bold">Select Style</Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {SIGNATURE_FONTS.map((font) => (
                                    <button
                                        key={font.name}
                                        onClick={() => setSelectedFont(font)}
                                        className={cn(
                                            "h-24 rounded-xl border-2 flex items-center justify-center p-2 transition-all duration-300 bg-slate-50 dark:bg-slate-900/50 hover:border-primary/50 relative overflow-hidden group",
                                            selectedFont.name === font.name
                                                ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                                                : "border-border text-muted-foreground"
                                        )}
                                    >
                                        <span
                                            style={{ fontFamily: font.family }}
                                            className="text-2xl md:text-3xl break-all line-clamp-1 px-2"
                                        >
                                            {typedName || "Signature"}
                                        </span>
                                        {selectedFont.name === font.name && (
                                            <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center">
                                                <Check className="h-3 w-3" />
                                            </div>
                                        )}
                                        <div className="absolute bottom-2 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] uppercase font-bold tracking-widest">{font.label}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSignature}
                        className="text-muted-foreground hover:text-destructive gap-2 h-10 px-4 rounded-xl hover:bg-destructive/10 transition-colors"
                    >
                        {activeTab === 'draw' ? <Eraser className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                        {activeTab === 'draw' ? 'Clear Canvas' : 'Reset'}
                    </Button>

                    <div className="flex gap-3">
                        <Button
                            onClick={handleSave}
                            disabled={activeTab === 'draw' ? isEmpty : !typedName}
                            className={cn(
                                "gap-2 h-11 px-8 rounded-xl font-bold transition-all duration-300 shadow-lg",
                                activeTab === 'draw' && isEmpty
                                    ? "opacity-50 cursor-not-allowed bg-slate-200 text-slate-400"
                                    : "bg-gradient-to-r from-primary to-teal-600 hover:from-primary/90 hover:to-teal-700 text-white shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5"
                            )}
                        >
                            <Check className="h-4 w-4" />
                            Adopt & Sign
                        </Button>
                    </div>
                </div>

                <p className="text-[10px] text-center text-muted-foreground/60 w-full">
                    By clicking "Adopt & Sign", you agree that this electronic signature is fully valid and legally binding.
                </p>
            </div>
        </Card>
    );
};
