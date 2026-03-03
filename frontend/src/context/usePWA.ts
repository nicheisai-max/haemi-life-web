import { useContext } from 'react';
import { PWAContext } from './PWAContextDef';

export const usePWA = () => useContext(PWAContext);
