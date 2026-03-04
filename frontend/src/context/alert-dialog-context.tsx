import React, { useState, useCallback } from 'react';
import { GlobalAlertDialog } from '../components/ui/global-alert-dialog';
import { AlertDialogContext, type ExtendedAlertOptions } from './alert-dialog-context-def';

interface AlertRequest {
    id: string;
    options: ExtendedAlertOptions;
    resolve: (value: boolean) => void;
}

export const AlertDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [queue, setQueue] = useState<AlertRequest[]>([]);
    const [isInternalProcessing, setIsInternalProcessing] = useState(false);

    const currentRequest = queue[0] || null;

    const confirm = useCallback((opts: ExtendedAlertOptions) => {
        return new Promise<boolean>((resolve) => {
            const id = Math.random().toString(36).substring(2, 11);
            const newRequest: AlertRequest = {
                id,
                options: { ...opts, type: opts.type || 'confirm' },
                resolve
            };
            setQueue(prev => [...prev, newRequest]);
        });
    }, []);

    const alert = useCallback((opts: ExtendedAlertOptions) => {
        return new Promise<void>((resolve) => {
            const id = Math.random().toString(36).substring(2, 11);
            const newRequest: AlertRequest = {
                id,
                options: { ...opts, type: opts.type || 'info', cancelText: undefined },
                resolve: () => resolve()
            };
            setQueue(prev => [...prev, newRequest]);
        });
    }, []);

    const handleConfirm = async () => {
        if (!currentRequest || isInternalProcessing) return;

        setIsInternalProcessing(true);
        try {
            if (currentRequest.options.onAsyncConfirm) {
                await currentRequest.options.onAsyncConfirm();
            }
            currentRequest.resolve(true);
            setQueue(prev => prev.slice(1));
        } catch (error) {
            console.error('Error in AlertDialog onConfirm:', error);
            // We resolve false or just clear if error occurs during async action
            currentRequest.resolve(false);
            setQueue(prev => prev.slice(1));
        } finally {
            setIsInternalProcessing(false);
        }
    };

    const handleCancel = () => {
        if (!currentRequest || isInternalProcessing) return;
        currentRequest.resolve(false);
        setQueue(prev => prev.slice(1));
    };

    return (
        <AlertDialogContext.Provider value={{ confirm, alert }}>
            {children}
            <GlobalAlertDialog
                isOpen={!!currentRequest}
                options={currentRequest?.options || { title: '', message: '' }}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </AlertDialogContext.Provider>
    );
};

// useConfirm moved to hooks/useConfirm.ts.
