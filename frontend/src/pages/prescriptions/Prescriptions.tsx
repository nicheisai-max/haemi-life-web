import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getMyPrescriptions, type Prescription } from '../../services/prescription.service';
import { getMyRecords, uploadRecord, deleteRecord, type MedicalRecord } from '../../services/record.service';
import { useConfirm } from '@/context/AlertDialogContext';
import { AlertCircle, FileText, Pill, Stethoscope, X, User, Calendar, BadgeCheck, Building2, UploadCloud, Trash2, Download, Image as ImageIcon, File } from 'lucide-react';
import { PremiumLoader } from '@/components/ui/PremiumLoader';

import { TransitionItem } from '../../components/layout/PageTransition';

export const Prescriptions: React.FC = () => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [uploadedRecords, setUploadedRecords] = useState<MedicalRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
    const { confirm } = useConfirm();

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const [prescriptionsData, recordsData] = await Promise.all([
                getMyPrescriptions(),
                getMyRecords()
            ]);
            setPrescriptions(prescriptionsData);
            setUploadedRecords(recordsData);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                // Ideally, we might want to tag this as a prescription if the backend supported it.
                // For now, we upload it as a generic record which is displayed here.
                const newRecord = await uploadRecord(file);
                setUploadedRecords(prev => [newRecord, ...prev]);
            }
        } catch (error: any) {
            console.error('Error uploading file:', error);
            setError(error.message || 'Failed to upload file');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteRecord = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();

        await confirm({
            title: 'Delete Prescription File',
            message: 'Are you sure you want to delete this uploaded prescription file? This action cannot be undone.',
            type: 'error',
            confirmText: 'Delete File',
            cancelText: 'Cancel',
            onAsyncConfirm: async () => {
                try {
                    await deleteRecord(id);
                    setUploadedRecords(prev => prev.filter(r => r.id !== id));
                } catch (error: any) {
                    console.error('Error deleting record:', error);
                    setError(error.message || 'Failed to delete file');
                }
            }
        });
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900';
            case 'filled': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-900';
            case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-900';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
        }
    };

    const getFileIcon = (type: string | null | undefined) => {
        if (!type) return <File className="h-5 w-5" />;
        if (type.includes('pdf')) return <FileText className="h-5 w-5" />;
        if (type.includes('image')) return <ImageIcon className="h-5 w-5" />;
        return <File className="h-5 w-5" />;
    };

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="mb-8">
                    <Skeleton className="h-10 w-64 mb-2" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <TransitionItem className="mb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="page-heading !mb-0 transition-all duration-300">My Prescriptions</h1>
                    <p className="page-subheading italic">View your digital and uploaded prescriptions</p>
                </div>
                <div>
                    <label htmlFor="prescription-upload" className="cursor-pointer">
                        <Button
                            variant="default"
                            disabled={uploading}
                            className="gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:brightness-110 shadow-lg shadow-teal-900/20 border-0 transition-all duration-300"
                            asChild
                        >
                            <span>
                                {uploading ? <PremiumLoader size="xs" /> : <UploadCloud className="h-4 w-4 mr-2 inline-block" />}
                                {uploading ? 'Uploading...' : 'Upload Prescription'}
                            </span>
                        </Button>
                        <input
                            id="prescription-upload"
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={uploading}
                        />
                    </label>
                </div>
            </TransitionItem>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <div className="flex-shrink-0 flex items-center justify-center">
                        <AlertCircle className="h-4 w-4" />
                    </div>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className={`grid grid-cols-1 ${selectedPrescription ? 'lg:grid-cols-[1fr_24rem]' : ''} gap-8 transition-all duration-300`}>
                <div className="space-y-8">
                    {/* Digital Prescriptions Section */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Pill className="h-5 w-5 text-primary" />
                            Digital Prescriptions
                        </h2>
                        {prescriptions.length === 0 ? (
                            <Card className="p-8 text-center flex flex-col items-center justify-center text-muted-foreground bg-muted/5 border-dashed">
                                <FileText className="h-12 w-12 opacity-30 mb-3" />
                                <p>No digital prescriptions from doctors</p>
                            </Card>
                        ) : (
                            <div className="grid gap-4">
                                {prescriptions.map((prescription) => (
                                    <Card
                                        key={prescription.id}
                                        className={`group p-0 overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-2 ${selectedPrescription?.id === prescription.id ? 'border-primary ring-1 ring-primary/20' : 'border-transparent hover:border-border'}`}
                                        onClick={() => setSelectedPrescription(prescription)}
                                    >
                                        <div className="p-5 flex gap-5 items-start">
                                            <div className="shrink-0 w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                                                <Pill className="h-7 w-7" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                                    <h3 className="text-lg font-semibold text-foreground truncate">
                                                        {prescription.doctor_name || 'Unknown'}
                                                    </h3>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${getStatusStyles(prescription.status)}`}>
                                                        {prescription.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    <span>
                                                        {new Date(prescription.created_at).toLocaleDateString('en-US', {
                                                            month: 'long',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                                                    <Stethoscope className="h-4 w-4 text-primary/70" />
                                                    <span>{prescription.medication_count || 0} medication{(prescription.medication_count || 0) !== 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Uploaded Prescriptions Section */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <UploadCloud className="h-5 w-5 text-primary" />
                            Uploaded Prescriptions
                        </h2>
                        {uploadedRecords.length === 0 ? (
                            <Card className="p-8 text-center flex flex-col items-center justify-center text-muted-foreground bg-muted/5 border-dashed">
                                <UploadCloud className="h-12 w-12 opacity-30 mb-3" />
                                <p>No uploaded prescription files</p>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {uploadedRecords.map((record) => (
                                    <Card key={record.id} className="group p-4 flex items-start gap-4 transition-all hover:shadow-md hover:border-primary/50">
                                        <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                            {getFileIcon(record.file_type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold truncate mb-1 text-sm" title={record.name}>{record.name}</h4>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>{record.file_size}</span>
                                                <span className="w-1 h-1 rounded-full bg-muted-foreground/40"></span>
                                                <span>{new Date(record.uploaded_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" asChild>
                                                <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/${record.file_path}`} download target="_blank" rel="noopener noreferrer">
                                                    <Download className="h-4 w-4" />
                                                    <span className="sr-only">Download</span>
                                                </a>
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => handleDeleteRecord(e, record.id)}>
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Delete</span>
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Details Panel for Digital Prescriptions */}
                {selectedPrescription && (
                    <div className="relative">
                        <div className="lg:sticky lg:top-24 h-fit bg-background lg:bg-transparent">
                            {/* Mobile Overlay Background (Fixed) */}
                            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSelectedPrescription(null)} />

                            {/* Panel Content */}
                            <Card className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t shadow-2xl lg:shadow-sm lg:border lg:rounded-xl lg:relative lg:inset-auto max-h-[85vh] lg:max-h-[calc(100vh-8rem)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-full lg:slide-in-from-bottom-0 lg:fade-in duration-300">
                                <div className="p-4 border-b flex items-center justify-between shrink-0 bg-muted/30">
                                    <h2 className="text-lg font-semibold flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-primary" />
                                        Prescription Details
                                    </h2>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setSelectedPrescription(null)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <User className="h-3.5 w-3.5" />
                                            Doctor Information
                                        </h3>
                                        <div className="bg-muted/30 p-3 rounded-lg border">
                                            <div className="text-sm font-medium text-foreground">{selectedPrescription.doctor_name || 'Unknown'}</div>
                                            <div className="text-xs text-muted-foreground">Prescribing Physician</div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Calendar className="h-3.5 w-3.5" />
                                            Prescription Info
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-muted/30 p-3 rounded-lg border">
                                                <div className="text-xs text-muted-foreground mb-1">Prescribed On</div>
                                                <div className="text-sm font-medium">
                                                    {new Date(selectedPrescription.created_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </div>
                                            </div>
                                            <div className="bg-muted/30 p-3 rounded-lg border">
                                                <div className="text-xs text-muted-foreground mb-1">Status</div>
                                                <div className="flex items-center gap-1.5">
                                                    <BadgeCheck className={`h-3.5 w-3.5 ${selectedPrescription.status === 'filled' ? 'text-green-600' :
                                                        selectedPrescription.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                                                        }`} />
                                                    <span className="text-sm font-medium capitalize">{selectedPrescription.status}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Pill className="h-3.5 w-3.5" />
                                            Medications
                                        </h3>
                                        {selectedPrescription.medication_count && selectedPrescription.medication_count > 0 ? (
                                            <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 flex gap-3 items-start">
                                                <div className="shrink-0 w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary mt-0.5">
                                                    <Building2 className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-foreground">
                                                        {selectedPrescription.medication_count} medication{(selectedPrescription.medication_count || 0) !== 1 ? 's' : ''} prescribed
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        Full formulation details available at pharmacy
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic">No medication details available</p>
                                        )}
                                    </div>
                                </div>

                                {selectedPrescription.status === 'pending' && (
                                    <div className="p-4 border-t bg-muted/10">
                                        <Button className="w-full gap-2" size="lg">
                                            <Building2 className="h-4 w-4" />
                                            Fill at Pharmacy
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
