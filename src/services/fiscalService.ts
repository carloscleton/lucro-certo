import axios from 'axios';
import { API_BASE_URL } from '../lib/constants';

const getFiscalUrl = (endpoint: string) => {
    const base = API_BASE_URL.replace(/\/$/, '');
    return `${base}/fiscal-module/${endpoint}`;
};

export interface FiscalPayload {
    companyId: string;
    payload: any;
}

export const fiscalService = {
    async emitirNFe(companyId: string, payload: any, token: string, quoteId?: string, isLabTest?: boolean, provider?: string) {
        const response = await axios.post(getFiscalUrl('emitir'), {
            companyId,
            payload,
            type: 'nfe',
            quoteId,
            isLabTest,
            provider
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async emitirNFSe(companyId: string, payload: any, token: string, quoteId?: string, isLabTest?: boolean, provider?: string) {
        const response = await axios.post(getFiscalUrl('emitir'), {
            companyId,
            payload,
            type: 'nfse',
            quoteId,
            isLabTest,
            provider
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async checkStatus(id: string, companyId: string, token: string, provider?: string) {
        const response = await axios.get(getFiscalUrl(`status/${id}`), {
            params: { companyId, provider },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async downloadPDF(id: string, type: 'nfse' | 'nfe', companyId: string, token: string, provider?: string) {
        const response = await axios.get(getFiscalUrl(`${type}/${id}/pdf`), {
            params: { companyId, provider },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            responseType: 'blob'
        });
        return response.data;
    },

    async downloadXML(id: string, type: 'nfse' | 'nfe', companyId: string, token: string, provider?: string) {
        const response = await axios.get(getFiscalUrl(`${type}/${id}/xml`), {
            params: { companyId, provider },
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

    async uploadCertificate(companyId: string, certificateFile: File, password: string, token: string, config?: any, provider?: string) {
        const formData = new FormData();
        formData.append('companyId', companyId);
        formData.append('arquivo', certificateFile);
        formData.append('senha', password);
        if (provider) {
            formData.append('provider', provider);
        }
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
    },

    async consultarNotasPorPeriodo(companyId: string, dataInicial: string, dataFinal: string, tipo: 'nfse' | 'nfe', token: string, ator?: number) {
        const response = await axios.get(getFiscalUrl('consultar/periodo'), {
            params: { companyId, dataInicial, dataFinal, tipo, ator },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async resendEmail(id: string, type: 'nfse' | 'nfe', companyId: string, recipients: string[], token: string) {
        const response = await axios.post(getFiscalUrl(`${type}/${id}/email`), {
            destinatarios: recipients
        }, {
            params: { companyId },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async consultarCidadeNotaNacional(codigoIbge: string, companyId: string, token: string) {
        const response = await axios.get(getFiscalUrl(`cidades/${codigoIbge}`), {
            params: { companyId },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async consultarCidadeNfeio(codigoIbge: string, companyId: string, token: string) {
        const response = await axios.get(getFiscalUrl(`nfeio/prefectures/${codigoIbge}`), {
            params: { companyId },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async checkNfeioCompanyStatus(companyId: string, token: string) {
        const response = await axios.get(getFiscalUrl(`nfeio/company/status`), {
            params: { companyId },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async deleteCertificate(companyId: string, token: string, provider?: string) {
        const response = await axios.delete(getFiscalUrl('delete-certificate'), {
            data: { companyId, provider },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    },

    async deactivateIssuer(companyId: string, token: string) {
        const response = await axios.post(getFiscalUrl('deactivate-issuer'), {
            companyId
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    }
};
