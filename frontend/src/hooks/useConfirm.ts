import { useContext } from 'react';
import { AlertDialogContext } from '../context/AlertDialogContextDef';

export const useConfirm = () => {
    const context = useContext(AlertDialogContext);
    if (!context) {
        throw new Error('useConfirm must be used within an AlertDialogProvider');
    }
    return context;
};
