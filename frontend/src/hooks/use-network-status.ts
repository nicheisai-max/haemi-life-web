import { useContext } from 'react';
import { NetworkStatusContext } from '../context/network-status-def';

export const useNetworkStatus = () => useContext(NetworkStatusContext);
