import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { GlobalAlertDialog, type AlertOptions } from '../components/ui/GlobalAlertDialog';

// Define a local extended AlertOptions type to include onAsyncConfirm
// This allows the AlertDialogContext to pass this prop to GlobalAlertDialog
// without modifying the original AlertOptions type directly in GlobalAlertDialog.tsx
// The GlobalAlertDialog component itself will need to be updated to accept and handle this prop.
type ExtendedAlertOptions = AlertOptions & {
    onAsyncConfirm?: () => Promise<void>;
};

interface AlertDialogContextType {
    confirm: (options: ExtendedAlertOptions) => Promise<boolean>;
    alert: (options: ExtendedAlertOptions) => Promise<void>;
}

const AlertDialogContext = createContext<AlertDialogContextType | undefined>(undefined);

export const AlertDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ExtendedAlertOptions>({ title: '', message: '' });
    const resolveRef = useRef<(value: boolean) => void>(() => { });

    const confirm = useCallback((opts: ExtendedAlertOptions) => {
        setOptions({ ...opts, type: opts.type || 'confirm' });
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
        });
    }, []);

    const alert = useCallback((opts: ExtendedAlertOptions) => {
        setOptions({ ...opts, type: opts.type || 'info', cancelText: undefined }); // Alert doesn't usually have cancel
        setIsOpen(true);
        return new Promise<void>((resolve) => {
            resolveRef.current = (confirmed) => {
                if (confirmed) resolve();
            };
        });
    }, []);

    const handleConfirm = async () => {
        if (options.onAsyncConfirm) {
            await options.onAsyncConfirm();
        }
        setIsOpen(false);
        resolveRef.current(true);
    };

    const handleCancel = () => {
        setIsOpen(false);
        resolveRef.current(false);
    };

    return (
        <AlertDialogContext.Provider value={{ confirm, alert }}>
            {children}
            <GlobalAlertDialog
                isOpen={isOpen}
                options={options}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </AlertDialogContext.Provider>
    );
};

export const useConfirm = () => {
    const context = useContext(AlertDialogContext);
    if (!context) {
        throw new Error('useConfirm must be used within an AlertDialogProvider');
    }
    return context;
};
