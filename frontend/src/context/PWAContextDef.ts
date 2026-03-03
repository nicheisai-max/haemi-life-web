// Context type definition and context object — no components, no hooks
import { createContext } from 'react';

export interface PWAContextType {
    isInstallable: boolean;
    installApp: () => Promise<void>;
}

export const PWAContext = createContext<PWAContextType>({
    isInstallable: false,
    installApp: async () => { },
});
