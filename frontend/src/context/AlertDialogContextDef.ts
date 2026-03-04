import { createContext } from 'react';
import { type AlertOptions } from '../components/ui/GlobalAlertDialog';

export type ExtendedAlertOptions = AlertOptions & {
    onAsyncConfirm?: () => Promise<void>;
};

export interface AlertDialogContextType {
    confirm: (options: ExtendedAlertOptions) => Promise<boolean>;
    alert: (options: ExtendedAlertOptions) => Promise<void>;
}

export const AlertDialogContext = createContext<AlertDialogContextType | undefined>(undefined);
