import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TransitionItem } from '../../components/layout/PageTransition';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { IconWrapper } from '@/components/ui/IconWrapper';
import { QrCode, Search, Pill, User, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { getPrescriptionById, updatePrescriptionStatus } from '../../services/prescription.service';
import type { Prescription } from '../../services/prescription.service';
import { PremiumLoader } from '@/components/ui/PremiumLoader';
import { useToast } from '@/hooks/useToast';
import { PATHS } from '../../routes/paths';
import { getErrorMessage } from '../../lib/error';

const DispensePrescription: React.FC = () => {
    const [rxId, setRxId] = useState('');
    const [prescription, setPrescription] = useState<Prescription | null>(null);
    const [loading, setLoading] = useState(false);
    const [dispensing, setDispensing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { showToast } = useToast();

    const handleSearch = async () => {
        if (!rxId) return;
        try {
            setLoading(true);
            setError(null);
            // Assuming the input ID is numeric for the API, but users might type RX-123
            const numericId = rxId.replace(/\D/g, '');
            if (!numericId) {
                setError('Invalid Prescription ID format');
                return;
            }
            const data = await getPrescriptionById(parseInt(numericId));
            setPrescription(data);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Prescription not found'));
            setPrescription(null);
        } finally {
            setLoading(false);
        }
    };

    const handleDispense = async () => {
        if (!prescription) return;
        try {
            setDispensing(true);
            await updatePrescriptionStatus(prescription.id, 'filled');
            showToast('Prescription dispensed successfully', 'success');
            navigate(PATHS.PHARMACIST.QUEUE);
        } catch (err: unknown) {
            showToast(getErrorMessage(err, 'Failed to dispense'), 'error');
        } finally {
            setDispensing(false);
        }
    };

    return (
        <main className="space-y-6">
            <TransitionItem className="relative overflow-hidden rounded-2xl border bg-teal-900 text-white shadow-xl">
                <GradientMesh variant="primary" className="opacity-20" />
                <div className="relative z-10 p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <IconWrapper icon={QrCode} variant="success" className="bg-white/10" />
                        <div>
                            <h1 className="page-heading !text-white !mb-1">Dispense Prescription</h1>
                            <p className="page-subheading !text-white/70">Verify RX ID or Scan QR to initiate dispensing process.</p>
                        </div>
                    </div>
                </div>
            </TransitionItem>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <TransitionItem>
                        <DashboardCard title="Search & Verify" className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prescription ID</label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="e.g. RX-99283"
                                        className="font-mono"
                                        value={rxId}
                                        onChange={(e) => setRxId(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                    <Button size="icon" onClick={handleSearch} disabled={loading}>
                                        {loading ? <PremiumLoader size="xs" /> : <Search className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            <div className="relative pt-4">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-dashed" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground font-bold">OR</span>
                                </div>
                            </div>
                            <Button variant="outline" className="w-full h-12 border-dashed border-2 hover:border-teal-500/50 hover:bg-teal-500/5">
                                <QrCode className="h-5 w-5 mr-2" />
                                Open Scanner
                            </Button>
                        </DashboardCard>
                    </TransitionItem>

                    {error && (
                        <TransitionItem>
                            <DashboardCard className="p-4 bg-destructive/5 border-destructive/20">
                                <div className="flex gap-3 text-destructive">
                                    <AlertCircle className="h-5 w-5 shrink-0" />
                                    <div className="text-xs font-medium">{error}</div>
                                </div>
                            </DashboardCard>
                        </TransitionItem>
                    )}

                    <TransitionItem>
                        <DashboardCard className="p-4 bg-amber-500/5 border-amber-500/20">
                            <div className="flex gap-3 text-amber-600 dark:text-amber-400">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <div className="text-xs font-medium">
                                    Ensure to double-verify patient identity and check for potential drug interactions before dispensing.
                                </div>
                            </div>
                        </DashboardCard>
                    </TransitionItem>
                </div>

                <div className="lg:col-span-2">
                    <TransitionItem className="h-full">
                        {prescription ? (
                            <DashboardCard className="h-full flex flex-col p-6 space-y-6">
                                <div className="flex items-center justify-between border-b pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-full bg-teal-500/10 text-teal-600">
                                            <User className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">{prescription.patient_name}</h3>
                                            <p className="text-xs text-muted-foreground font-mono">ID: {prescription.patient_phone}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold uppercase text-muted-foreground">RX DATE</div>
                                        <div className="text-sm font-mono">{new Date(prescription.prescription_date).toLocaleDateString()}</div>
                                    </div>
                                </div>

                                <div className="space-y-4 flex-1">
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <Pill className="h-4 w-4" />
                                        Medications ({prescription.items?.length || 0})
                                    </h4>
                                    <div className="space-y-3">
                                        {prescription.items?.map((item, i) => (
                                            <div key={i} className="p-4 rounded-xl border bg-slate-50/50 dark:bg-slate-900/50">
                                                <div className="flex justify-between font-bold text-sm">
                                                    <span>{item.medicine_name}</span>
                                                    <span className="text-teal-600">{item.dosage}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {item.frequency} • {item.instructions}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-6 border-t flex gap-4">
                                    <Button variant="outline" className="flex-1 h-12" onClick={() => setPrescription(null)}>Cancel</Button>
                                    <Button
                                        className="flex-1 h-12 bg-teal-600 hover:bg-teal-700 shadow-lg gap-2"
                                        onClick={handleDispense}
                                        disabled={dispensing || prescription.status === 'filled'}
                                    >
                                        {dispensing ? <PremiumLoader size="xs" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                        {prescription.status === 'filled' ? 'Already Dispensed' : 'Dispense Now'}
                                    </Button>
                                </div>
                            </DashboardCard>
                        ) : (
                            <DashboardCard className="h-full flex flex-col items-center justify-center p-12 text-center border-dashed border-2 group hover:border-teal-500/30 transition-colors">
                                <div className="p-6 rounded-full bg-slate-100 dark:bg-slate-800 mb-4 group-hover:scale-110 transition-transform">
                                    <FileText className="h-10 w-10 text-muted-foreground" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">No Active Prescription</h3>
                                <p className="text-muted-foreground max-w-sm mb-6">Enter a Prescription ID or scan a patient's pharmacy card to see medication details here.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
                                    <div className="p-4 rounded-xl border bg-slate-50/50 dark:bg-slate-900/50 text-left">
                                        <div className="flex items-center gap-2 mb-1">
                                            <User className="h-4 w-4 text-teal-500" />
                                            <span className="text-xs font-bold uppercase">Patient Data</span>
                                        </div>
                                        <div className="text-sm text-muted-foreground italic">Waiting for input...</div>
                                    </div>
                                    <div className="p-4 rounded-xl border bg-slate-50/50 dark:bg-slate-900/50 text-left">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Pill className="h-4 w-4 text-teal-500" />
                                            <span className="text-xs font-bold uppercase">Medication</span>
                                        </div>
                                        <div className="text-sm text-muted-foreground italic">Waiting for input...</div>
                                    </div>
                                </div>
                            </DashboardCard>
                        )}
                    </TransitionItem>
                </div>
            </div>
        </main>
    );
};

export default DispensePrescription;
