import axios from 'axios';
import { API_BASE_URL } from '../lib/constants';

const API_URL = `${API_BASE_URL}/fiscal`;

export interface FiscalPayload {
    companyId: string;
    payload: any;
}

export const fiscalService = {
    async emitirNFe(companyId: string, payload: any, token: string, quoteId?: string) {
        const response = await axios.post(`${API_URL}/emitir`, {
            companyId,
            payload,
            type: 'nfe',
            quoteId
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async emitirNFSe(companyId: string, payload: any, token: string, quoteId?: string) {
        const response = await axios.post(`${API_URL}/emitir`, {
            companyId,
            payload,
            type: 'nfse',
            quoteId
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
    },

    async syncIssuer(companyId: string, config: any, token: string) {
        const response = await axios.post(`${API_URL}/sync-issuer`, {
            companyId,
            config
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async uploadCertificate(companyId: string, certificateFile: File, password: string, token: string) {
        const formData = new FormData();
        formData.append('companyId', companyId);
        formData.append('arquivo', certificateFile);
        formData.append('senha', password);

        const response = await axios.post(`${API_URL}/upload-certificate`, formData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    }
};
