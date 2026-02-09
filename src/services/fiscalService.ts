import axios from 'axios';
import { API_BASE_URL } from '../lib/constants';

const API_URL = `${API_BASE_URL}/fiscal`;

export interface FiscalPayload {
    companyId: string;
    payload: any;
}

export const fiscalService = {
    async emitirNFe(companyId: string, payload: any, token: string) {
        const response = await axios.post(`${API_URL}/emitir`, {
            companyId,
            payload,
            type: 'nfe'
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async emitirNFSe(companyId: string, payload: any, token: string) {
        const response = await axios.post(`${API_URL}/emitir`, {
            companyId,
            payload,
            type: 'nfse'
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async checkStatus(id: string, companyId: string, token: string) {
        const response = await axios.get(`${API_URL}/status/${id}`, {
            params: { companyId },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async downloadPDF(id: string, companyId: string, token: string) {
        const response = await axios.get(`${API_URL}/nfe/${id}/pdf`, {
            params: { companyId },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            responseType: 'blob'
        });
        return response.data;
    },

    async downloadXML(id: string, companyId: string, token: string) {
        const response = await axios.get(`${API_URL}/nfe/${id}/xml`, {
            params: { companyId },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            responseType: 'blob'
        });
        return response.data;
    }
};
