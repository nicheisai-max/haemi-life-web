import React, { useState, useEffect } from 'react';
import { useConfirm } from '@/context/AlertDialogContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getPendingPrescriptions, updatePrescriptionStatus } from '../../services/prescription.service';
import type { Prescription } from '../../services/prescription.service';
import { AlertCircle, X, CheckCircle2, AlertTriangle, Clock, Calendar, Pill, Check } from 'lucide-react';
import { MedicalLoader } from '../../components/ui/MedicalLoader';
import { PremiumLoader } from '@/components/ui/PremiumLoader';

export const PrescriptionQueue: React.FC = () => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        fetchPrescriptions();
    }, []);

    const fetchPrescriptions = async () => {
        try {
            setLoading(true);
            const data = await getPendingPrescriptions();
            setPrescriptions(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load prescription queue');
        } finally {
            setLoading(false);
        }
    };

    const handleFill = async (prescriptionId: number) => {
        try {
            setProcessing(prescriptionId.toString());
            await updatePrescriptionStatus(prescriptionId, 'filled');
            await fetchPrescriptions();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fill prescription');
        } finally {
            setProcessing(null);
        }
    };

    const { confirm } = useConfirm();
    const handleReject = async (prescriptionId: number) => {
        const isConfirmed = await confirm({
            title: 'Reject Prescription',
            message: 'Are you sure you want to reject this prescription? This action cannot be undone.',
            type: 'warning',
            confirmText: 'Reject Prescription',
            cancelText: 'Cancel'
        });

        if (!isConfirmed) return;

        try {
            setProcessing(prescriptionId.toString());
            await updatePrescriptionStatus(prescriptionId, 'cancelled');
            await fetchPrescriptions();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to reject prescription');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto p-8 flex justify-center items-center min-h-[400px]">
                <MedicalLoader message="Retrieving prescription queue..." />
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                <div>
                    <h1 className="page-heading">Prescription Queue</h1>
                    <p className="page-subheading">Process pending prescription orders</p>
                </div>
                <div className="flex bg-primary/10 rounded-lg p-4 items-center gap-3">
                    <div className="text-h3 text-primary leading-none">{prescriptions.length}</div>
                    <div className="text-sm font-medium text-muted-foreground">Pending Orders</div>
                </div>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-6 relative">
                    <div className="flex-shrink-0 flex items-center justify-center">
                        <AlertCircle className="h-4 w-4" />
                    </div>
                    <AlertDescription>{error}</AlertDescription>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setError(null)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </Alert>
            )}

            <div className="grid gap-4">
                {prescriptions.length === 0 ? (
                    <Card className="p-12 text-center flex flex-col items-center justify-center bg-muted/30 border-dashed">
                        <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full mb-4 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">All caught up!</h3>
                        <p className="text-muted-foreground mt-1">
                            No pending prescriptions to process.
                        </p>
                    </Card>
                ) : (
                    prescriptions.map((prescription) => (
                        <Card key={prescription.id} className="group hover:shadow-lg transition-all duration-300 border-border/60 hover:border-primary/20">
                            <CardContent className="p-6">
                                <div className="flex flex-col md:flex-row gap-5 items-start">
                                    <div className="hidden md:flex flex-shrink-0 w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 items-center justify-center text-orange-600 dark:text-orange-400">
                                        <AlertTriangle className="h-6 w-6" />
                                    </div>

                                    <div className="flex-1 space-y-3 w-full">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="flex md:hidden flex-shrink-0 w-8 h-8 rounded-md bg-orange-100 dark:bg-orange-900/30 items-center justify-center text-orange-600 dark:text-orange-400">
                                                <AlertTriangle className="h-4 w-4" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-foreground">Patient: {prescription.patient_name || 'Unknown'}</h3>
                                            <Badge variant="secondary" className="flex items-center gap-1.5 font-normal ml-auto md:ml-0">
                                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                                {new Date(prescription.created_at).toLocaleTimeString('en-US', {
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                    hour12: true
                                                })}
                                            </Badge>
                                        </div>

                                        <p className="text-sm text-muted-foreground">Prescribed by: <span className="font-medium text-foreground">Dr. {prescription.doctor_name || 'Unknown'}</span></p>

                                        <div className="flex flex-wrap gap-4 pt-1">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
                                                <Calendar className="h-4 w-4 text-primary" />
                                                <span>{new Date(prescription.created_at).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
                                                <Pill className="h-4 w-4 text-primary" />
                                                <span>{prescription.medication_count || 0} item(s)</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex md:flex-col gap-3 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-0 border-border/50">
                                        <Button
                                            size="sm"
                                            onClick={() => handleFill(prescription.id)}
                                            disabled={processing === prescription.id.toString()}
                                            className="flex-1 md:w-full justify-center shadow-sm"
                                        >
                                            {processing === prescription.id.toString() ? (
                                                <PremiumLoader size="xs" />
                                            ) : (
                                                <>
                                                    <Check className="h-4 w-4 mr-2" />
                                                    Fill
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleReject(prescription.id)}
                                            disabled={processing === prescription.id.toString()}
                                            className="flex-1 md:w-full justify-center hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                                        >
                                            <X className="h-4 w-4 mr-2" />
                                            Reject
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};
