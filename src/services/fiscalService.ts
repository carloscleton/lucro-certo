import axios from 'axios';
import { API_BASE_URL } from '../lib/constants';

// Função para garantir URLs consistentes com prefixo /fiscal
// Na verdade, vamos ser mais simples e diretos:
const getFiscalUrl = (endpoint: string) => {
    const base = API_BASE_URL.replace(/\/$/, '');
    const url = `${base}/fiscal-module/${endpoint}`;
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
        const response = await axios.get(getFiscalUrl(`pdf/${id}`), {
            params: { companyId },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            responseType: 'blob'
        });
        return response.data;
    },

    async downloadXML(id: string, companyId: string, token: string) {
        const response = await axios.get(getFiscalUrl(`xml/${id}`), {
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

    async uploadCertificate(companyId: string, certificateFile: File, password: string, token: string, config?: any) {
        const formData = new FormData();
        formData.append('companyId', companyId);
        formData.append('arquivo', certificateFile);
        formData.append('senha', password);
        if (config) {
            formData.append('config', JSON.stringify(config));
        }

        const response = await axios.post(getFiscalUrl('upload-certificate'), formData, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },
    
    async checkIssuerStatus(companyId: string, cpfCnpj: string, token: string) {
        const response = await axios.get(getFiscalUrl(`issuer-status/${cpfCnpj}`), {
            params: { companyId },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async saveConfig(companyId: string, config: any, token: string) {
        const response = await axios.post(getFiscalUrl('save-config'), {
            companyId,
            config
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async cancelarNota(id: string, type: 'nfse' | 'nfe', companyId: string, justificativa: string, token: string) {
        const response = await axios.post(getFiscalUrl('cancelar'), {
            id,
            type,
            companyId,
            justificativa
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    }
};
