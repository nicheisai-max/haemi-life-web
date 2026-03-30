import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPendingVerifications, verifyDoctor } from '../../services/admin.service';
import type { PendingVerification } from '../../services/admin.service';
import { Clock, AlertCircle, X, ShieldCheck, User, Check, Mail, Phone, Calendar, Briefcase, FileText } from 'lucide-react';
import { getErrorMessage } from '../../lib/error';

export const VerifyDoctors: React.FC = () => {
    const [verifications, setVerifications] = useState<PendingVerification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        fetchVerifications();
    }, []);

    const fetchVerifications = async () => {
        try {
            setLoading(true);
            const data = await getPendingVerifications();
            setVerifications(data);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load verifications'));
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (doctorId: string, approved: boolean) => {
        try {
            setProcessing(doctorId);
            await verifyDoctor(doctorId, approved);
            await fetchVerifications();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to process verification'));
        } finally {
            setProcessing(null);
        }
    };

    if (loading) {
        return (
            <div className="pt-8 mx-auto p-8">
                <Card className="p-8 text-center">
                    <div className="animate-pulse text-muted-foreground">Loading verifications...</div>
                </Card>
            </div>
        );
    }

    return (<div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h1 className="page-heading !mb-0 transition-all duration-300">Verify Doctors</h1>
                <p className="page-subheading italic">Review and approve doctor registrations</p>
            </div>
            <Badge variant="secondary" className="px-3 py-1.5 text-sm font-medium flex items-center gap-2 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400">
                <Clock className="h-4 w-4" />
                {verifications.length} Pending
            </Badge>
        </div>

        {error && (
            <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md flex items-center gap-2 border border-destructive/20">
                <AlertCircle className="h-5 w-5" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} className="hover:bg-destructive/10 p-1 rounded">
                    <X className="h-4 w-4" />
                </button>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {verifications.length === 0 ? (
                <Card className="col-span-full p-12 text-center flex flex-col items-center justify-center space-y-4">
                    <ShieldCheck className="h-16 w-16 text-green-500/50" />
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold">All Caught Up!</h3>
                        <p className="text-muted-foreground">
                            There are no pending doctor verifications at the moment.
                        </p>
                    </div>
                </Card>
            ) : (
                verifications.map((verification) => (
                    <Card key={verification.id} className="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-6 border-b bg-muted/30">
                            <div className="flex items-start gap-4">
                                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                    <User className="h-7 w-7" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-lg truncate" title={verification.name}>
                                        {verification.name || 'Unknown Name'}
                                    </h3>
                                    <div className="flex flex-col gap-1 mt-1 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2 truncate" title={verification.email}>
                                            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                                            <span className="truncate">{verification.email || 'No email'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 truncate">
                                            <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                                            <span>{verification.phoneNumber || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 flex-1 space-y-4 text-sm">
                            <div className="flex justify-between items-center py-1 border-b border-border/50">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <Briefcase className="h-3.5 w-3.5" />
                                    Specialization
                                </span>
                                <span className="font-medium text-right">{verification.specialization || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-border/50">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5" />
                                    License Number
                                </span>
                                <span className="font-medium text-right font-mono">{verification.licenseNumber || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-border/50">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5" />
                                    Experience
                                </span>
                                <span className="font-medium text-right">{verification.yearsOfExperience || 0} years</span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5" />
                                    Registered
                                </span>
                                <span className="font-medium text-right">
                                    {new Date(verification.createdAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 bg-muted/30 border-t grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                                onClick={() => handleVerify(verification.id.toString(), false)}
                                disabled={processing === verification.id.toString()}
                            >
                                {processing === verification.id.toString() ? (
                                    <span className="animate-spin mr-2">⏳</span>
                                ) : (
                                    <X className="h-4 w-4 mr-2" />
                                )}
                                Reject
                            </Button>
                            <Button
                                variant="default"
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleVerify(verification.id.toString(), true)}
                                disabled={processing === verification.id.toString()}
                            >
                                {processing === verification.id.toString() ? (
                                    <span className="animate-spin mr-2">⏳</span>
                                ) : (
                                    <Check className="h-4 w-4 mr-2" />
                                )}
                                Approve
                            </Button>
                        </div>
                    </Card>
                ))
            )}
        </div>
    </div>);
};
