import axios from 'axios';
import { API_BASE_URL } from '../lib/constants';

// Função para garantir URLs consistentes com prefixo /fiscal
const getFiscalUrl = (endpoint: string) => {
    // Limpeza agressiva: remove barras, hífens ou espaços no final da URL base
    const base = (API_BASE_URL || '').trim().replace(/[\/\-]+$/, '');
    const url = `${base}/fiscal/${endpoint}`;

    // Log para depuração (vísivel no navegador do usuário)
    console.log(`[FiscalService] BaseURL: "${API_BASE_URL}"`);
    console.log(`[FiscalService] API_BASE_URL (Process): "${import.meta.env.VITE_API_URL}"`);
    console.log(`[FiscalService] Target URL: "${url}"`);

    return url;
};

export interface FiscalPayload {
    companyId: string;
    payload: any;
}

export const fiscalService = {
    async emitirNFe(companyId: string, payload: any, token: string, quoteId?: string) {
        const response = await axios.post(getFiscalUrl('emitir'), {
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
        const response = await axios.post(getFiscalUrl('emitir'), {
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
        const response = await axios.get(getFiscalUrl(`status/${id}`), {
            params: { companyId },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async downloadPDF(id: string, companyId: string, token: string) {
        const response = await axios.get(getFiscalUrl(`nfe/${id}/pdf`), {
            params: { companyId },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            responseType: 'blob'
        });
        return response.data;
    },

    async downloadXML(id: string, companyId: string, token: string) {
        const response = await axios.get(getFiscalUrl(`nfe/${id}/xml`), {
            params: { companyId },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            responseType: 'blob'
        });
        return response.data;
    },

    async syncIssuer(companyId: string, config: any, token: string) {
        const response = await axios.post(getFiscalUrl('sync-issuer'), {
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

        const response = await axios.post(getFiscalUrl('upload-certificate'), formData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    async getCertificateStatus(companyId: string, token: string) {
        const response = await axios.get(getFiscalUrl('certificate-status'), {
            params: { companyId },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    }
};
