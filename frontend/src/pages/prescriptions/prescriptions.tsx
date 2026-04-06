import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MedicalLoader } from '../../components/ui/medical-loader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getMyPrescriptions, getPrescriptionById, type Prescription } from '../../services/prescription.service';
import { getMyRecords, type MedicalRecord } from '../../services/record.service';
import { AlertCircle, FileText, Pill, Stethoscope, X, User, Calendar, BadgeCheck, Building2, UploadCloud, Trash2, Download, Image as ImageIcon, File, Clock, FolderOpen } from 'lucide-react';
import { PremiumLoader } from '@/components/ui/premium-loader';
import { secureDownload } from '../../services/file.service';
import { TransitionItem } from '../../components/layout/page-transition';
import { ClinicalRecordType } from '../../../../shared/clinical-types';
import { useFileActionHandler } from '@/hooks/use-file-action-handler';

export const Prescriptions: React.FC = () => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [uploadedRecords, setUploadedRecords] = useState<MedicalRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
    const [fetchingDetails, setFetchingDetails] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const [prescriptionsData, recordsData] = await Promise.all([
                getMyPrescriptions(),
                getMyRecords(ClinicalRecordType.Prescription)
            ]);
            setPrescriptions(prescriptionsData);
            setUploadedRecords(recordsData);
        } catch (err: unknown) {
            const apiErr = err as { response?: { data?: { message?: string } } };
            setError(apiErr.response?.data?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    // 🛡️ UNIFIED FILE HUB: Surgical Hook Injection (v4.0)
    const { handleBatchUpload, handleDelete, isProcessing } = useFileActionHandler({
        onSuccess: (newRecord: MedicalRecord) => setUploadedRecords(prev => [newRecord, ...prev]),
        onDeleteSuccess: (id: string) => setUploadedRecords(prev => prev.filter(r => r.id !== id)),
        onError: (err: unknown) => {
            const uploadErr = err as { message?: string };
            setError(uploadErr.message || 'File operation failed');
        }
    });

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        try {
            setError(null); // Clear previous errors before batch upload
            await handleBatchUpload(files, ClinicalRecordType.Prescription);
        } finally {
            // 🔄 SURGICAL SYNC: Always re-fetch to ensure UI parity with Database
            await fetchAllData();
            if (e.target) e.target.value = '';
        }
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

    const handleDownload = async (record: MedicalRecord) => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            await secureDownload({
                url: `${baseUrl}/api/files/record/${record.id}`,
                fileName: record.name || `prescription-${record.id}`
            });
        } catch {
            setError('Failed to download the clinical document. Please try again later.');
        }
    };

    const handlePrescriptionClick = async (prescription: Prescription) => {
        setSelectedPrescription(prescription);
        
        if (!prescription.items || prescription.items.length === 0) {
            try {
                setFetchingDetails(true);
                const fullData = await getPrescriptionById(prescription.id);
                setSelectedPrescription(fullData);
                setPrescriptions(prev => prev.map(p => p.id === prescription.id ? { ...p, ...fullData } : p));
            } catch (err) {
                console.error('[PRESCRIPTION] Detail fetch failure:', err);
            } finally {
                setFetchingDetails(false);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[32rem]">
                <MedicalLoader message="Loading your prescriptions..." />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <TransitionItem className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="page-heading !mb-0 transition-all duration-300">My Prescriptions</h1>
                    <p className="page-subheading italic">View your digital and uploaded prescriptions</p>
                </div>
                <div>
                    <Button
                        variant="default"
                        disabled={isProcessing}
                        className="gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:brightness-110 shadow-lg shadow-teal-900/20 border-0 transition-all duration-300"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {isProcessing ? <PremiumLoader size="xs" /> : <UploadCloud className="h-4 w-4 mr-2 inline-block" />}
                        {isProcessing ? 'Uploading...' : 'Upload Prescription'}
                    </Button>
                    <input
                        ref={fileInputRef}
                        id="prescription-upload"
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={onFileChange}
                        className="hidden"
                        disabled={isProcessing}
                    />
                </div>
            </TransitionItem>

            {error && (
                <TransitionItem>
                    <Alert variant="destructive" className="mb-6">
                        <div className="flex-shrink-0 flex items-center justify-center">
                            <AlertCircle className="h-4 w-4" />
                        </div>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </TransitionItem>
            )}

            <TransitionItem>
                <div className={`grid grid-cols-1 ${selectedPrescription ? 'lg:grid-cols-[1fr_24rem]' : ''} gap-8 transition-all duration-300`}>
                    <div className="space-y-8">
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
                                            onClick={() => handlePrescriptionClick(prescription)}
                                        >
                                            <div className="p-5 flex gap-5 items-start">
                                                <div className="shrink-0 w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                                                    <Pill className="h-7 w-7" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                                        <h3 className="text-lg font-semibold text-foreground truncate">
                                                            {prescription.doctorName || 'Unknown'}
                                                        </h3>
                                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${getStatusStyles(prescription.status)}`}>
                                                            {prescription.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        <span>
                                                            {new Date(prescription.createdAt).toLocaleDateString('en-US', {
                                                                month: 'long',
                                                                day: 'numeric',
                                                                year: 'numeric'
                                                            })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                                                        <Stethoscope className="h-4 w-4 text-primary/70" />
                                                        <span>{prescription.medicationCount || 0} medication{(prescription.medicationCount || 0) !== 1 ? 's' : ''}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
                                <UploadCloud className="h-5 w-5 text-primary" />
                                Uploaded Prescriptions
                            </h2>
                            {uploadedRecords.length === 0 ? (
                                <Card className="p-16 flex flex-col items-center justify-center text-center text-muted-foreground min-h-80 border-dashed rounded-xl bg-muted/5">
                                    <div className="bg-muted/30 p-6 rounded-full mb-6">
                                        <UploadCloud className="h-12 w-12 opacity-30" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2">No uploaded prescriptions</h3>
                                    <p className="max-w-md mx-auto">Your uploaded prescription files will appear here for easy access.</p>
                                </Card>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {uploadedRecords.map((record) => (
                                        <Card key={record.id} className="group p-0 overflow-hidden hover:shadow-md transition-all border shadow-sm flex flex-col md:flex-row h-full rounded-xl bg-card">
                                            <div className="w-full md:w-1.5 h-1.5 md:h-auto bg-blue-500 shrink-0" />

                                            <div className="flex-1 p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
                                                <div className="shrink-0">
                                                    <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center text-foreground border shadow-sm">
                                                        {getFileIcon(record.fileMime)}
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0 space-y-1 text-left">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="text-xs font-normal gap-1 bg-muted/30">
                                                            <UploadCloud className="h-3.5 w-3.5" />
                                                            Patient Upload
                                                        </Badge>
                                                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border bg-emerald-100/10 text-emerald-600 border-emerald-600/20">
                                                            FINAL
                                                        </span>
                                                    </div>
                                                    <h3 className="font-bold text-lg text-foreground truncate">{record.name}</h3>
                                                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                                                        <div className="flex items-center gap-1.5 font-medium">
                                                            <Calendar className="h-4 w-4 text-primary/70" />
                                                            <span>{new Date(record.uploadedAt).toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 font-medium">
                                                            <FolderOpen className="h-4 w-4 text-primary/70" />
                                                            <span>{record.fileSize}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-row items-center gap-3 w-full md:w-auto mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-border/50">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="flex gap-2 h-9 px-4 font-medium transition-all"
                                                        onClick={() => handleDownload(record)}
                                                    >
                                                        <Download className="h-4 w-4" />
                                                        <span>Download</span>
                                                    </Button>
                                                    
                                                    <Button 
                                                        variant="destructive" 
                                                        size="sm" 
                                                        className="flex gap-2 h-9 px-4 font-medium shadow-sm transition-all hover:brightness-110 active:scale-95" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete({ id: record.id.toString(), name: record.name });
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-white" />
                                                        <span className="text-white">Delete</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedPrescription && (
                        <div className="relative">
                            <div className="lg:sticky lg:top-24 h-fit bg-background lg:bg-transparent">
                                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSelectedPrescription(null)} />

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
                                                <div className="text-sm font-medium text-foreground">{selectedPrescription.doctorName || 'Unknown'}</div>
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
                                                        {new Date(selectedPrescription.createdAt).toLocaleDateString('en-US', {
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
                                            
                                            {fetchingDetails ? (
                                                <div className="flex flex-col items-center justify-center py-10 bg-muted/20 rounded-lg border border-dashed">
                                                    <PremiumLoader size="sm" />
                                                    <span className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">Synchronizing Clinical Data...</span>
                                                </div>
                                            ) : (selectedPrescription.items && selectedPrescription.items.length > 0) ? (
                                                <div className="space-y-3">
                                                    {selectedPrescription.items.map((item) => (
                                                        <div key={item.id} className="bg-primary/5 border border-primary/10 rounded-lg p-3 hover:bg-primary/10 transition-colors duration-200">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <div className="text-sm font-bold text-foreground">{item.medicineName || 'Medication'}</div>
                                                                <div className="text-[10px] font-bold px-2 py-0.5 bg-primary/20 text-primary rounded-full">{item.strength || 'N/A'}</div>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1"><Pill className="h-2.5 w-2.5" /> {item.dosage}</span>
                                                                <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {item.frequency}</span>
                                                            </div>
                                                            {item.instructions && (
                                                                <div className="mt-2 pt-2 border-t border-primary/5 text-[11px] italic text-muted-foreground leading-snug">
                                                                    "{item.instructions}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <div className="text-[10px] text-center text-muted-foreground italic mt-2">
                                                        Total: {selectedPrescription.items.length} medication{(selectedPrescription.items.length !== 1 ? 's' : '')} prescribed
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-muted/30 border border-dashed rounded-lg p-6 text-center">
                                                    <Pill className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                                    <p className="text-sm text-muted-foreground italic">No medication details available</p>
                                                </div>
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
            </TransitionItem>
        </div>
    );
};
