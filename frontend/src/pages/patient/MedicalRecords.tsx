import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import './MedicalRecords.css';

interface MedicalRecord {
    id: string;
    name: string;
    type: string;
    size: string;
    uploadedAt: string;
}

export const MedicalRecords: React.FC = () => {
    const [records, setRecords] = useState<MedicalRecord[]>([]);
    const [uploading, setUploading] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        setUploading(true);

        // Simulate upload (replace with actual API call)
        setTimeout(() => {
            const newRecords: MedicalRecord[] = Array.from(files).map(file => ({
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                type: file.type,
                size: (file.size / 1024).toFixed(2) + ' KB',
                uploadedAt: new Date().toISOString()
            }));

            setRecords([...newRecords, ...records]);
            setUploading(false);
        }, 1500);
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this record?')) {
            setRecords(records.filter(r => r.id !== id));
        }
    };

    const getFileIcon = (type: string) => {
        if (type.includes('pdf')) return 'picture_as_pdf';
        if (type.includes('image')) return 'image';
        return 'description';
    };

    return (
        <div className="medical-records-container fade-in">
            <div className="page-header">
                <div>
                    <h1>Medical Records</h1>
                    <p>Upload and manage your medical documents</p>
                </div>
                <div className="header-actions">
                    <label htmlFor="file-upload" className="upload-btn-wrapper">
                        <Button
                            variant="primary"
                            leftIcon={<span className="material-icons-outlined">upload_file</span>}
                            disabled={uploading}
                        >
                            {uploading ? 'Uploading...' : 'Upload Files'}
                        </Button>
                        <input
                            id="file-upload"
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>
            </div>

            {/* Upload Area */}
            <Card className="upload-area">
                <div className="upload-content">
                    <span className="material-icons-outlined upload-icon">cloud_upload</span>
                    <h3>Drag & Drop Files Here</h3>
                    <p>or click the "Upload Files" button above</p>
                    <p className="supported-formats">Supported: PDF, JPG, PNG, DOC, DOCX (Max 10MB)</p>
                </div>
            </Card>

            {/* Records List */}
            <div className="records-section">
                <h2>Your Medical Records ({records.length})</h2>

                {records.length === 0 ? (
                    <Card style={{ padding: '3rem', textAlign: 'center' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '64px', opacity: 0.3 }}>folder_open</span>
                        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                            No medical records uploaded yet
                        </p>
                    </Card>
                ) : (
                    <div className="records-grid">
                        {records.map((record) => (
                            <Card key={record.id} className="record-card hover-lift">
                                <div className="record-icon">
                                    <span className="material-icons-outlined">
                                        {getFileIcon(record.type)}
                                    </span>
                                </div>
                                <div className="record-info">
                                    <h4>{record.name}</h4>
                                    <div className="record-meta">
                                        <span>{record.size}</span>
                                        <span>•</span>
                                        <span>{new Date(record.uploadedAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}</span>
                                    </div>
                                </div>
                                <div className="record-actions">
                                    <button className="action-btn" title="Download">
                                        <span className="material-icons-outlined">download</span>
                                    </button>
                                    <button className="action-btn delete-btn" title="Delete" onClick={() => handleDelete(record.id)}>
                                        <span className="material-icons-outlined">delete</span>
                                    </button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
