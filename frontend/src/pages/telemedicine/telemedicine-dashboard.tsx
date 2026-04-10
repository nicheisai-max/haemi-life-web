import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, CalendarPlus, ShieldCheck, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PATHS } from '@/routes/paths';
import { motion } from 'framer-motion';

export const TelemedicineDashboard: React.FC = () => {
    const navigate = useNavigate();

    // 🛡️ INSTITUTIONAL PROTECTION: Relying on TelemedicineGuard for atomic flow.
    // Dashboard logic now assumes a valid session with appropriate consent.

    return (
        <div className="space-y-8 animate-in fade-in">
            {/* Page Header */}
            <div className="space-y-1">
                <h1 className="page-heading !mb-0">Telemedicine</h1>
                <p className="page-subheading">Consult with certified specialists from anywhere in Botswana</p>
            </div>

            {/* Consent Status Badge */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 px-5 py-3 rounded-xl bg-primary/10 border border-primary/20 w-fit"
            >
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <div>
                    <p className="text-sm font-semibold text-primary">Telemedicine Consent Signed</p>
                    <p className="text-xs text-muted-foreground">You are authorised to book video consultations</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-primary ml-2 shrink-0" />
            </motion.div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Book a Video Consultation */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                >
                    <Card className="p-6 h-full flex flex-col justify-between gap-6 hover:border-primary/40 transition-colors duration-300 group cursor-pointer"
                        onClick={() => navigate(`${PATHS.PATIENT.BOOK_APPOINTMENT}?type=video`)}
                    >
                        <div className="space-y-3">
                            <div className="p-3 rounded-xl bg-primary/10 w-fit">
                                <CalendarPlus className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">Book a Video Consultation</h2>
                                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                    Connect with a certified specialist via secure, encrypted video call. Choose your doctor, date, and time.
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(PATHS.PATIENT.BOOK_APPOINTMENT);
                            }}
                            className="w-full gap-2 bg-gradient-to-r from-primary to-teal-600 hover:from-primary/90 hover:to-teal-700 text-white font-medium rounded-[var(--card-radius)] h-11 shadow-lg shadow-primary/20 group-hover:-translate-y-0.5 transition-transform"
                        >
                            <Video className="h-4 w-4" />
                            Book Video Call
                            <ArrowRight className="h-4 w-4 ml-auto" />
                        </Button>
                    </Card>
                </motion.div>

                {/* How It Works */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.2 }}
                >
                    <Card className="p-6 h-full space-y-4">
                        <div className="space-y-2">
                            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit">
                                <Clock className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h2 className="text-lg font-semibold text-foreground">How It Works</h2>
                        </div>
                        <ol className="space-y-3">
                            {[
                                'Choose your specialist and preferred time slot',
                                'Receive a secure video call link via notification',
                                'Join from any device — no downloads required',
                                'Get your prescription digitally after the consult',
                            ].map((step, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                                    <span className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 flex items-center justify-center">
                                        {i + 1}
                                    </span>
                                    {step}
                                </li>
                            ))}
                        </ol>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
};

export default TelemedicineDashboard;
