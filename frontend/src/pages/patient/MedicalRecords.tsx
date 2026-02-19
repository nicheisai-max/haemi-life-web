import React, { useState, useEffect } from 'react';
import { useConfirm } from '@/context/AlertDialogContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    UploadCloud, FileText, Image as ImageIcon, Download, Trash2, FolderOpen, File,
    Search, Calendar, Building2, Stethoscope, ShieldCheck, Activity, Pill
} from 'lucide-react';

import { MedicalLoader } from '../../components/ui/MedicalLoader';
import { getMyRecords, uploadRecord, deleteRecord } from '../../services/record.service';
import type { MedicalRecord } from '../../services/record.service';

import { TransitionItem } from '../../components/layout/PageTransition';
import { motion, AnimatePresence } from 'framer-motion';

export const MedicalRecords: React.FC = () => {
    const [records, setRecords] = useState<MedicalRecord[]>([]);
    const [filteredRecords, setFilteredRecords] = useState<MedicalRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('all');
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const { confirm } = useConfirm();

    useEffect(() => {
        fetchRecords();
    }, []);

    useEffect(() => {
        let result = records;

        if (selectedType !== 'all') {
            result = result.filter(r =>
                selectedType === 'lab' ? r.record_type === 'Lab Result' :
                    selectedType === 'radiology' ? r.record_type === 'Radiology' :
                        selectedType === 'prescription' ? r.record_type === 'Prescription' :
                            selectedType === 'notes' ? ['Clinical Note', 'Specialist Report'].includes(r.record_type || '') :
                                selectedType === 'other' ? !['Lab Result', 'Radiology', 'Prescription', 'Clinical Note', 'Specialist Report'].includes(r.record_type || '') :
                                    true
            );
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(r =>
                r.name.toLowerCase().includes(lowerTerm) ||
                r.doctor_name?.toLowerCase().includes(lowerTerm) ||
                r.facility_name?.toLowerCase().includes(lowerTerm) ||
                r.notes?.toLowerCase().includes(lowerTerm)
            );
        }

        setFilteredRecords(result);
    }, [records, searchTerm, selectedType]);

    const fetchRecords = async () => {
        try {
            setLoading(true);
            const data = await getMyRecords();
            setRecords(data);
        } catch (error) {
            console.error('Error fetching records:', error);
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
                const newRecord = await uploadRecord(file);
                setRecords(prev => [newRecord, ...prev]);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteRecord = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Delete Record',
            message: 'Are you sure you want to delete this medical record? This action cannot be undone and may affect your clinical history.',
            type: 'error',
            confirmText: 'Delete Record',
            cancelText: 'Cancel'
        });

        if (isConfirmed) {
            try {
                await deleteRecord(id);
                setRecords(prev => prev.filter(r => r.id !== id));
            } catch (error) {
                console.error('Error deleting record:', error);
            }
        }
    };

    const getFileIcon = (type: string) => {
        if (type.includes('pdf')) return <FileText className="h-5 w-5" />;
        if (type.includes('image')) return <ImageIcon className="h-5 w-5" />;
        return <File className="h-5 w-5" />;
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Lab Result': return <Activity className="h-4 w-4" />;
            case 'Radiology': return <ImageIcon className="h-4 w-4" />;
            case 'Prescription': return <Pill className="h-4 w-4" />;
            case 'Immunization': return <ShieldCheck className="h-4 w-4" />;
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

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-[1920px] space-y-8">
            <TransitionItem className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">Medical Records</h1>
                    <p className="text-muted-foreground text-lg">Secure repository of your clinical history in Botswana</p>
                </div>
                <div className="flex gap-2">
                    <label htmlFor="file-upload" className="cursor-pointer">
                        <Button
                            variant="default"
                            disabled={uploading}
                            className="gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:brightness-110 shadow-lg shadow-teal-900/20 border-0 transition-all duration-300"
                            asChild
                        >
                            <span>
                                {uploading ? <MedicalLoader /> : <UploadCloud className="h-4 w-4 mr-2" />}
                                {uploading ? 'Uploading...' : 'Upload Record'}
                            </span>
                        </Button>
                        <input
                            id="file-upload"
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

            <TransitionItem>
                <Card className="p-4 bg-background/50 backdrop-blur-sm border shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search records, doctors, or facilities..."
                                className="pl-9 bg-background"
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
                    <div className="flex justify-center p-24">
                        <MedicalLoader message="Retrieving clinical records from MoH database..." />
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <Card className="p-16 flex flex-col items-center justify-center text-center text-muted-foreground min-h-[300px] border-dashed">
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
                                    <Card className="group p-0 overflow-hidden hover:shadow-md transition-all border shadow-sm flex flex-col md:flex-row h-full">
                                        {/* Left Accent Strip */}
                                        <div className={`w-full md:w-1.5 h-1.5 md:h-auto ${record.record_type === 'Lab Result' ? 'bg-purple-500' :
                                            record.record_type === 'Radiology' ? 'bg-blue-500' :
                                                record.record_type === 'Immunization' ? 'bg-emerald-500' :
                                                    'bg-slate-400'
                                            }`} />

                                        <div className="flex-1 p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
                                            {/* Icon */}
                                            <div className="shrink-0">
                                                <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center text-foreground border shadow-sm">
                                                    {getFileIcon(record.file_type)}
                                                </div>
                                            </div>

                                            {/* Main Info */}
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className="text-xs font-normal gap-1 bg-muted/30">
                                                        {getTypeIcon(record.record_type || 'General')}
                                                        {record.record_type || 'General Record'}
                                                    </Badge>
                                                    {record.status && (
                                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getStatusColor(record.status)}`}>
                                                            {record.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="font-bold text-lg text-foreground truncate">{record.name}</h3>
                                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                                                    {record.doctor_name && (
                                                        <div className="flex items-center gap-1.5">
                                                            <Stethoscope className="h-3.5 w-3.5" />
                                                            <span>{record.doctor_name}</span>
                                                        </div>
                                                    )}
                                                    {record.facility_name && (
                                                        <div className="flex items-center gap-1.5">
                                                            <Building2 className="h-3.5 w-3.5" />
                                                            <span>{record.facility_name}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        <span>{new Date(record.date_of_service || record.uploaded_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                {record.notes && (
                                                    <p className="text-sm text-muted-foreground/80 mt-2 line-clamp-1 border-l-2 pl-2 border-primary/20 italic">
                                                        "{record.notes}"
                                                    </p>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-border/50">
                                                <Button variant="outline" size="sm" className="hidden md:flex gap-2" asChild>
                                                    <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/files/record/${record.id}`} download target="_blank" rel="noopener noreferrer">
                                                        <Download className="h-4 w-4" />
                                                        Download
                                                    </a>
                                                </Button>
                                                <Button variant="outline" size="icon" className="md:hidden h-9 w-9" asChild>
                                                    <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/files/record/${record.id}`} download target="_blank" rel="noopener noreferrer">
                                                        <Download className="h-4 w-4" />
                                                    </a>
                                                </Button>


                                                {record.record_type === 'Patient Upload' && (
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteRecord(record.id)}>
                                                        <Trash2 className="h-4 w-4" />
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

