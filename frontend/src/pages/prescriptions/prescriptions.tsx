import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MedicalLoader } from '../../components/ui/medical-loader';
import { TablePagination } from '@/components/ui/table-pagination';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getMyPrescriptions, getPrescriptionById, type Prescription } from '../../services/prescription.service';
import { getMyRecords, type MedicalRecord } from '../../services/record.service';
import { AlertCircle, FileText, Pill, Stethoscope, X, Calendar, UploadCloud, Trash2, Download, Image as ImageIcon, File, FolderOpen } from 'lucide-react';

import { PremiumLoader } from '@/components/ui/premium-loader';
import { useToast } from '../../hooks/use-toast';
import { TransitionItem } from '@/components/layout/page-transition';
import { secureDownload } from '@/services/file.service';
import { ClinicalRecordType } from '../../../../shared/clinical-types';
import { useFileActionHandler } from '@/hooks/use-file-action-handler';
import { logger } from '@/utils/logger';
import { motion, AnimatePresence } from 'framer-motion';

export const Prescriptions: React.FC = () => {
    const { error: toastError, warning: toastWarning } = useToast();
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [uploadedRecords, setUploadedRecords] = useState<MedicalRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
    const [fetchingDetails, setFetchingDetails] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Pagination State
    const [digitalPage, setDigitalPage] = useState(1);
    const [uploadedPage, setUploadedPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const [prescriptionsData, allRecords] = await Promise.all([
                getMyPrescriptions(),
                getMyRecords()
            ]);
            setPrescriptions(prescriptionsData);
            
            // Filter only prescription type from uploaded records
            const uploaded = allRecords.filter(r => 
                r.recordType === ClinicalRecordType.Prescription || 
                r.name.toLowerCase().includes('prescription')
            );
            setUploadedRecords(uploaded);
        } catch {
            setError('Institutional error retrieving prescription history.');
        } finally {
            setLoading(false);
        }
    };

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
            setError(null);
            await handleBatchUpload(files, ClinicalRecordType.Prescription);
        } finally {
            await fetchAllData();
            if (e.target) e.target.value = '';
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900';
            case 'filled':
            case 'active': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
            case 'cancelled': return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-900';
            default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
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
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg === 'FILE_TYPE_RESTRICTED') {
                toastWarning('Institutional Security: This file type is restricted for safety.');
            } else if (msg === 'ASSET_MISSING') {
                toastError('Institutional Guard: Clinical asset missing or corrupted.');
            } else {
                toastError('Communication Failure: Backend security protocol rejected the request.');
            }
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
            } catch (err: unknown) {
                logger.error('[PRESCRIPTION] Detail fetch failure', {
                    error: err instanceof Error ? err.message : String(err),
                    prescriptionId: prescription.id
                });
            } finally {
                setFetchingDetails(false);
            }
        }
    };

    const digitalTotalPages = Math.ceil(prescriptions.length / itemsPerPage);
    const digitalStartIndex = (digitalPage - 1) * itemsPerPage;
    const digitalEndIndex = Math.min(digitalStartIndex + itemsPerPage, prescriptions.length);
    const paginatedDigital = prescriptions.slice(digitalStartIndex, digitalEndIndex);

    const uploadedTotalPages = Math.ceil(uploadedRecords.length / itemsPerPage);
    const uploadedStartIndex = (uploadedPage - 1) * itemsPerPage;
    const uploadedEndIndex = Math.min(uploadedStartIndex + itemsPerPage, uploadedRecords.length);
    const paginatedUploaded = uploadedRecords.slice(uploadedStartIndex, uploadedEndIndex);

    if (loading) {
        return <MedicalLoader message="Retrieving institutional prescription history..." />;
    }

    return (
        <div className="space-y-8">
            <TransitionItem className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="page-heading !mb-0 transition-all duration-300">My Prescriptions</h1>
                    <p className="page-subheading italic">Secure repository of your clinical medications in Botswana</p>
                </div>
                <div>
                    <Button
                        variant="default"
                        disabled={isProcessing}
                        className="gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:brightness-110 shadow-lg shadow-teal-900/20 border-0 transition-all duration-300"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {isProcessing ? <PremiumLoader size="xs" /> : <UploadCloud className="h-4 w-4 mr-1 inline-block" />}
                        {isProcessing ? 'Processing...' : 'Upload Prescription'}
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

            <div className={`grid grid-cols-1 ${selectedPrescription ? 'lg:grid-cols-[1fr_24rem]' : ''} gap-8 transition-all duration-300`}>
                <div className="space-y-10">
                    <TransitionItem className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-primary/10 rounded-[var(--card-radius)] border border-primary/20">
                                <Pill className="h-5 w-5 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold tracking-tight">Digital Prescriptions</h2>
                        </div>
                        {prescriptions.length === 0 ? (
                            <Card className="p-12 text-center flex flex-col items-center justify-center text-muted-foreground bg-muted/5 border-dashed rounded-[var(--card-radius)]">
                                <FileText className="h-12 w-12 opacity-30 mb-4" />
                                <h3 className="font-semibold text-lg mb-1">No digital prescriptions</h3>
                                <p className="max-w-xs mx-auto text-sm italic">Direct clinical transmissions will appear here.</p>
                            </Card>
                        ) : (
                            <div className="grid gap-4">
                                <AnimatePresence mode="popLayout">
                                    {paginatedDigital.map((prescription) => (
                                        <motion.div
                                            key={prescription.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            layout
                                        >
                                            <Card
                                                className={`group p-0 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-md border shadow-sm ${selectedPrescription?.id === prescription.id ? 'ring-2 ring-primary border-primary/30' : 'institutional-border'}`}
                                                onClick={() => handlePrescriptionClick(prescription)}
                                            >
                                                <div className="p-5 flex gap-5 items-center">
                                                    <div className="shrink-0 w-14 h-14 rounded-[var(--card-radius)] bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors duration-300 border border-primary/10">
                                                        <Pill className="h-7 w-7" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                                                            <h3 className="text-lg font-bold text-foreground truncate">
                                                                Dr. {prescription.doctorName || 'Unknown Physician'}
                                                            </h3>
                                                            <Badge className={`${getStatusStyles(prescription.status)} uppercase font-bold text-[10px] tracking-wider px-2 py-0.5 rounded-full`}>
                                                                {prescription.status}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar className="h-3.5 w-3.5 text-primary/60" />
                                                                <span>{new Date(prescription.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 font-medium text-foreground/80">
                                                                <Stethoscope className="h-3.5 w-3.5 text-primary/60" />
                                                                <span>{prescription.medicationCount || 0} medications</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                                <TablePagination
                                    currentPage={digitalPage}
                                    totalPages={digitalTotalPages}
                                    totalItems={prescriptions.length}
                                    startIndex={digitalStartIndex}
                                    endIndex={digitalEndIndex}
                                    showPagination={digitalTotalPages > 1}
                                    onPageChange={setDigitalPage}
                                    itemLabel="prescriptions"
                                />
                            </div>
                        )}
                    </TransitionItem>

                    <TransitionItem className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-amber-500/10 rounded-[var(--card-radius)] border border-amber-500/20">
                                <UploadCloud className="h-5 w-5 text-amber-600" />
                            </div>
                            <h2 className="text-xl font-bold tracking-tight text-foreground">Uploaded Prescriptions</h2>
                        </div>
                        {uploadedRecords.length === 0 ? (
                            <Card className="p-16 flex flex-col items-center justify-center text-center text-muted-foreground min-h-80 border-dashed rounded-[var(--card-radius)] bg-muted/5">
                                <div className="bg-muted/30 p-6 rounded-full mb-6">
                                    <UploadCloud className="h-12 w-12 opacity-30" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">No uploaded records</h3>
                                <p className="max-w-md mx-auto text-sm italic">Uploaded files will appear here.</p>
                            </Card>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <AnimatePresence mode="popLayout">
                                    {paginatedUploaded.map((record) => (
                                        <motion.div
                                            key={record.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            layout
                                        >
                                            <Card className="group p-0 overflow-hidden hover:shadow-md transition-all border shadow-sm flex flex-col md:flex-row h-full rounded-[var(--card-radius)] bg-card/50 backdrop-blur-sm">
                                                <div className="w-full md:w-1.5 h-1.5 md:h-auto bg-amber-500/60 shrink-0" />

                                                <div className="flex-1 p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
                                                    <div className="shrink-0">
                                                        <div className="w-12 h-12 rounded-[var(--card-radius)] bg-muted/40 flex items-center justify-center text-foreground border shadow-sm">
                                                            {getFileIcon(record.fileMime)}
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 min-w-0 space-y-1 text-left">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Badge variant="outline" className="text-[10px] font-bold gap-1 bg-muted/30 uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                                <UploadCloud className="h-3 w-3" />
                                                                Manual Upload
                                                            </Badge>
                                                        </div>
                                                        <h3 className="font-bold text-lg text-foreground truncate">{record.name}</h3>
                                                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar className="h-4 w-4 text-primary/60" />
                                                                <span>{new Date(record.uploadedAt).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <FolderOpen className="h-4 w-4 text-primary/60" />
                                                                <span>{record.fileSize}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-row items-center gap-3 w-full md:w-auto mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-border/50">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="flex gap-2 h-9 px-4 font-medium transition-all hover:bg-muted/50 shadow-sm"
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
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                                <TablePagination
                                    currentPage={uploadedPage}
                                    totalPages={uploadedTotalPages}
                                    totalItems={uploadedRecords.length}
                                    startIndex={uploadedStartIndex}
                                    endIndex={uploadedEndIndex}
                                    showPagination={uploadedTotalPages > 1}
                                    onPageChange={setUploadedPage}
                                    itemLabel="records"
                                />
                            </div>
                        )}
                    </TransitionItem>
                </div>

                <AnimatePresence>
                    {selectedPrescription && (
                        <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="relative"
                        >
                            <div className="lg:sticky lg:top-24 h-fit">
                                <Card className="fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] border-t shadow-2xl lg:shadow-sm lg:border lg:rounded-2xl lg:relative lg:inset-auto max-h-[85vh] lg:max-h-[calc(100vh-8rem)] flex flex-col overflow-hidden">
                                    <div className="p-5 border-b flex items-center justify-between bg-muted/20">
                                        <h2 className="text-lg font-bold">Prescription Details</h2>
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedPrescription(null)}>
                                            <X className="h-5 w-5" />
                                        </Button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                        {fetchingDetails ? (
                                            <div className="flex flex-col items-center justify-center py-16">
                                                <PremiumLoader size="sm" />
                                                <span className="text-[10px] text-muted-foreground mt-4 uppercase font-black">Syncing...</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {selectedPrescription.items?.map((item) => (
                                                    <div key={item.id} className="p-4 border rounded-2xl bg-card shadow-sm">
                                                        <div className="font-bold text-foreground">{item.medicineName}</div>
                                                        <div className="text-xs text-muted-foreground mt-1">{item.dosage} - {item.frequency}</div>
                                                        {item.instructions && <div className="mt-2 text-[11px] italic text-muted-foreground border-t pt-2">"{item.instructions}"</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
