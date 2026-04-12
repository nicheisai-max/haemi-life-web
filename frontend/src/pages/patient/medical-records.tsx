import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    UploadCloud, FileText, Image as ImageIcon, Download, Trash2, FolderOpen, File,
    Search, Calendar, Building2, Stethoscope, ShieldCheck, Activity, Pill
} from 'lucide-react';

import { PremiumLoader } from '@/components/ui/premium-loader';
import { MedicalLoader } from '../../components/ui/medical-loader';
import { getMyRecords } from '../../services/record.service';
import { getMyPrescriptions } from '../../services/prescription.service';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { MedicalRecord } from '../../services/record.service';
import { ClinicalRecordType } from '../../../../shared/clinical-types';
import { useFileActionHandler } from '@/hooks/use-file-action-handler';

import { TransitionItem } from '../../components/layout/page-transition';
import { motion, AnimatePresence } from 'framer-motion';
import { secureDownload } from '../../services/file.service';
import { logger } from '@/utils/logger';

import { useToast } from '../../hooks/use-toast';

export const MedicalRecords: React.FC = () => {
    const { error: toastError, warning: toastWarning } = useToast();
    const [records, setRecords] = useState<MedicalRecord[]>([]);
    const [filteredRecords, setFilteredRecords] = useState<MedicalRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchRecords();
    }, []);

    useEffect(() => {
        let result = records;

        if (selectedType !== 'all') {
            result = result.filter(r =>
                selectedType === 'lab' ? r.recordType === ClinicalRecordType.LabResult :
                    selectedType === 'radiology' ? r.recordType === ClinicalRecordType.Radiology :
                        selectedType === 'prescription' ? r.recordType === ClinicalRecordType.Prescription :
                            selectedType === 'notes' ? [ClinicalRecordType.ClinicalNote, ClinicalRecordType.SpecialistReport].includes(r.recordType as ClinicalRecordType) :
                                selectedType === 'other' ? ![ClinicalRecordType.LabResult, ClinicalRecordType.Radiology, ClinicalRecordType.Prescription, ClinicalRecordType.ClinicalNote, ClinicalRecordType.SpecialistReport].includes(r.recordType as ClinicalRecordType) :
                                    true
            );
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(r =>
                r.name.toLowerCase().includes(lowerTerm) ||
                (r.doctorName || '').toLowerCase().includes(lowerTerm) ||
                (r.facilityName || '').toLowerCase().includes(lowerTerm) ||
                (r.notes || '').toLowerCase().includes(lowerTerm)
            );
        }

        setFilteredRecords(result);
    }, [records, searchTerm, selectedType]);

    const fetchRecords = async () => {
        try {
            setLoading(true);

            const [uploadedData, digitalData] = await Promise.all([
                getMyRecords(),
                getMyPrescriptions()
            ]);

            const mappedDigital: MedicalRecord[] = digitalData.map(p => ({
                id: `digital-${p.id}`,
                patientId: p.patientId,
                name: `Prescription from ${p.doctorName || 'Doctor'}`,
                url: '#',
                fileMime: 'application/json',
                fileSize: `${p.medicationCount || 0} med${(p.medicationCount || 0) !== 1 ? 's' : ''}`,
                uploadedAt: p.createdAt,
                recordType: ClinicalRecordType.Prescription,
                status: p.status,
                notes: p.notes || 'Digital prescription',
                doctorName: p.doctorName,
                facilityName: 'Digital Clinical Hub',
                dateOfService: p.createdAt
            }));

            const combined = [...uploadedData, ...mappedDigital].sort((a, b) =>
                new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
            );

            setRecords(combined);
        } catch (error: unknown) {
            logger.error('[Medical-Records] Record retrieval collapsed', { 
                error: error instanceof Error ? error.message : String(error) 
            });
        } finally {
            setLoading(false);
        }
    };

    // 🛡️ UNIFIED FILE HUB: Surgical Hook Injection (v4.0)
    const { handleBatchUpload, handleDelete, isProcessing } = useFileActionHandler({
        onSuccess: (newRecord: MedicalRecord) => setRecords(prev => [newRecord, ...prev]),
        onDeleteSuccess: (id: string) => setRecords(prev => prev.filter(r => r.id !== id)),
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

            // 🛡️ CONTEXTUAL INFERENCE OVERRIDE (v5.0)
            // Maps the active tab to a suggested ClinicalRecordType for better heuristic accuracy.
            let suggestedType = ClinicalRecordType.GeneralRecord;
            if (selectedType === 'lab') suggestedType = ClinicalRecordType.LabResult;
            if (selectedType === 'radiology') suggestedType = ClinicalRecordType.Radiology;
            if (selectedType === 'prescription') suggestedType = ClinicalRecordType.Prescription;
            if (selectedType === 'notes') suggestedType = ClinicalRecordType.ClinicalNote;

            await handleBatchUpload(files, suggestedType);
        } catch (err: unknown) {
            logger.error('[Medical-Records] Upload dispatch failure:', err instanceof Error ? err.message : String(err));
            setError('Institutional communication failure. Please try again.');
        } finally {
            if (e.target) e.target.value = '';
        }
    };

    const getFileIcon = (type: string | null | undefined) => {
        if (!type) return <File className="h-5 w-5" />;
        if (type.includes('pdf')) return <FileText className="h-5 w-5" />;
        if (type.includes('image')) return <ImageIcon className="h-5 w-5" />;
        return <File className="h-5 w-5" />;
    };

    const getTypeIcon = (type: ClinicalRecordType) => {
        switch (type) {
            case ClinicalRecordType.LabResult: return <Activity className="h-4 w-4" />;
            case ClinicalRecordType.Radiology: return <ImageIcon className="h-4 w-4" />;
            case ClinicalRecordType.Prescription: return <Pill className="h-4 w-4" />;
            case ClinicalRecordType.Immunization: return <ShieldCheck className="h-4 w-4" />;
            default: return <FileText className="h-4 w-4" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'final': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
            case 'verified': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
            case 'preliminary': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
            case 'pending review': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const handleDownload = async (record: MedicalRecord) => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            await secureDownload({
                url: `${baseUrl}/api/files/record/${record.id}`,
                fileName: record.name || `record-${record.id}`
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            
            if (msg === 'FILE_TYPE_RESTRICTED') {
                toastWarning('Institutional Security: This file type is restricted for safety.');
            } else if (msg === 'ASSET_MISSING') {
                toastError('Institutional Guard: Clinical asset missing or corrupted. This may be a system-generated demo record.');
            } else if (msg === 'INTEGRITY_FAILURE') {
                toastError('Security Gate: Verified file integrity failed. Download blocked for your safety.');
            } else {
                toastError('Communication Failure: Backend security protocol rejected the request.');
            }
        }
    };


    return (
        <div className="space-y-8">
            <TransitionItem className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="page-heading !mb-0 transition-all duration-300">Medical Records</h1>
                    <p className="page-subheading italic">Secure repository of your clinical history in Botswana</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="default"
                        disabled={isProcessing}
                        className="gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:brightness-110 shadow-lg shadow-teal-900/20 border-0 transition-all duration-300"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {isProcessing ? <PremiumLoader size="xs" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                        {isProcessing ? 'Uploading...' : 'Upload Record'}
                    </Button>
                    <input
                        ref={fileInputRef}
                        id="file-upload"
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
                <Card className="p-4 bg-background/50 backdrop-blur-sm shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search records, doctors, or facilities..."
                                className="pl-10 bg-background"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Tabs defaultValue="all" value={selectedType} onValueChange={setSelectedType} className="w-full md:w-auto">
                            <TabsList className="grid grid-cols-3 md:flex w-full">
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="lab">Labs</TabsTrigger>
                                <TabsTrigger value="radiology">Radiology</TabsTrigger>
                                <TabsTrigger value="notes">Notes</TabsTrigger>
                                <TabsTrigger value="other">Other</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </Card>
            </TransitionItem>

            {/* Records List */}
            <TransitionItem className="space-y-6">
                {loading ? (
                    <MedicalLoader message="Retrieving clinical records from MoH database..." />
                ) : filteredRecords.length === 0 ? (
                    <Card className="p-16 flex flex-col items-center justify-center text-center text-muted-foreground min-h-80 border-dashed rounded-[var(--card-radius)]">
                        <div className="bg-muted/30 p-6 rounded-full mb-6">
                            <FolderOpen className="h-12 w-12 opacity-30" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No records found</h3>
                        <p className="max-w-md mx-auto">
                            {searchTerm || selectedType !== 'all'
                                ? "Try adjusting your search or filters to find what you're looking for."
                                : "Your medical history will appear here once your doctors upload reports."}
                        </p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        <AnimatePresence>
                            {filteredRecords.map((record) => (
                                <motion.div
                                    key={record.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    layout
                                >
                                    <Card className="group p-0 overflow-hidden hover:shadow-md transition-all shadow-sm flex flex-col md:flex-row h-full rounded-[var(--card-radius)]">
                                        <div className="w-full md:w-1.5 h-1.5 md:h-auto" style={{ 
                                            backgroundColor: 
                                                record.recordType === ClinicalRecordType.LabResult ? 'var(--record-lab)' :
                                                record.recordType === ClinicalRecordType.Radiology ? 'var(--record-radiology)' :
                                                record.recordType === ClinicalRecordType.Immunization ? 'var(--record-immunization)' :
                                                record.recordType === ClinicalRecordType.Prescription ? 'var(--record-prescription)' :
                                                (record.recordType === ClinicalRecordType.ClinicalNote || record.recordType === ClinicalRecordType.SpecialistReport) ? 'var(--record-notes)' :
                                                'var(--record-general)'
                                        }} />

                                        <div className="flex-1 p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
                                            <div className="shrink-0">
                                                <div className="w-12 h-12 rounded-[var(--card-radius)] bg-muted/30 flex items-center justify-center text-foreground institutional-border shadow-sm">
                                                    {getFileIcon(record.fileMime)}
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className="text-xs font-normal gap-1 bg-muted/30">
                                                        {getTypeIcon(record.recordType || 'General')}
                                                        {record.recordType || 'General Record'}
                                                    </Badge>
                                                    {record.status && (
                                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getStatusColor(record.status)}`}>
                                                            {record.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="font-bold text-lg text-foreground truncate">{record.name}</h3>
                                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                                                    {record.doctorName && (
                                                        <div className="flex items-center gap-1.5">
                                                            <Stethoscope className="h-3.5 w-3.5" />
                                                            <span>{record.doctorName}</span>
                                                        </div>
                                                    )}
                                                    {record.facilityName && (
                                                        <div className="flex items-center gap-1.5">
                                                            <Building2 className="h-3.5 w-3.5" />
                                                            <span>{record.facilityName}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        <span>{new Date(record.dateOfService || record.uploadedAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                {record.notes && (
                                                    <p className="text-sm text-muted-foreground/80 mt-2 line-clamp-1 border-l-2 pl-2 border-primary/20 italic">
                                                        "{record.notes}"
                                                    </p>
                                                )}
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

                                                {!record.id.toString().startsWith('digital-') && (
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
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </TransitionItem>
        </div>
    );
};
