import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileText, Image as ImageIcon, Download, Trash2, FolderOpen, File } from 'lucide-react';
import { Loader } from '@/components/ui/Loader';
import { getMyRecords, uploadRecord, deleteRecord } from '../../services/record.service';
import type { MedicalRecord } from '../../services/record.service';

export const MedicalRecords: React.FC = () => {
    const [records, setRecords] = useState<MedicalRecord[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        fetchRecords();
    }, []);

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
                setRecords((prev: MedicalRecord[]) => [newRecord, ...prev]);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this record?')) return;

        try {
            await deleteRecord(id);
            setRecords((records: MedicalRecord[]) => records.filter(r => r.id !== id));
        } catch (error) {
            console.error('Error deleting record:', error);
        }
    };

    const getFileIcon = (type: string) => {
        if (type.includes('pdf')) return <FileText className="h-8 w-8" />;
        if (type.includes('image')) return <ImageIcon className="h-8 w-8" />;
        return <File className="h-8 w-8" />;
    };

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-[1200px] space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Medical Records</h1>
                    <p className="text-muted-foreground text-lg">Upload and manage your medical documents</p>
                </div>
                <div>
                    <label htmlFor="file-upload" className="cursor-pointer">
                        <Button
                            variant="default"
                            disabled={uploading}
                            className="gap-2"
                            asChild
                        >
                            <span>
                                {uploading ? <Loader size="xs" className="mr-2 inline-block" /> : <UploadCloud className="h-4 w-4 mr-2 inline-block" />}
                                {uploading ? 'Uploading...' : 'Upload Files'}
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
            </div>

            {/* Upload Area */}
            <Card className="border-2 border-dashed border-muted-foreground/25 bg-muted/5 hover:bg-muted/10 transition-colors cursor-pointer p-12 flex flex-col items-center justify-center text-center group">
                <div className="p-4 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors mb-4">
                    <UploadCloud className="h-10 w-10 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Drag & Drop Files Here</h3>
                <p className="text-muted-foreground mb-4">or click the "Upload Files" button above</p>
                <p className="text-xs text-muted-foreground/70 uppercase tracking-wide">Supported: PDF, JPG, PNG, DOC, DOCX (Max 10MB)</p>
            </Card>

            {/* Records List */}
            <div className="space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    Your Medical Records
                    <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">{records.length}</span>
                </h2>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader size="lg" />
                    </div>
                ) : records.length === 0 ? (
                    <Card className="p-12 flex flex-col items-center justify-center text-center text-muted-foreground min-h-[200px]">
                        <FolderOpen className="h-16 w-16 opacity-20 mb-4" />
                        <p>No medical records uploaded yet</p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {records.map((record) => (
                            <Card key={record.id} className="group p-4 flex items-start gap-4 transition-all hover:shadow-md hover:border-primary/50">
                                <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    {getFileIcon(record.file_type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold truncate mb-1" title={record.name}>{record.name}</h4>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>{record.file_size}</span>
                                        <span className="w-1 h-1 rounded-full bg-muted-foreground/40"></span>
                                        <span>{new Date(record.uploaded_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" asChild>
                                        <a href={`http://localhost:5000/${record.file_path}`} download target="_blank" rel="noopener noreferrer">
                                            <Download className="h-4 w-4" />
                                            <span className="sr-only">Download</span>
                                        </a>
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(record.id)}>
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
    );
};
