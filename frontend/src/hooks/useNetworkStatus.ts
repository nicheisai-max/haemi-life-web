import { useContext } from 'react';
import { NetworkStatusContext } from '../context/NetworkStatusDef';

export const useNetworkStatus = () => useContext(NetworkStatusContext);
