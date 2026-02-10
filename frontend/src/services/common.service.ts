import api from './api';

export const commonService = {
    getLocations: async () => {
        const response = await api.get('/common/locations');
        return response.data;
    },

    getMedicines: async () => {
        const response = await api.get('/common/medicines');
        return response.data;
    },

    getPharmacies: async () => {
        const response = await api.get('/common/pharmacies');
        return response.data;
    }
};
