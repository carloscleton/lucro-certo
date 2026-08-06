import { API_BASE_URL } from '../lib/constants';
import { supabase } from '../lib/supabase';

export interface SendWhatsAppParams {
    instanceName: string;
    number: string;
    text: string;
    mediaUrl?: string;
    mediaType?: 'document' | 'image' | 'video';
    mimetype?: string;
    fileName?: string;
    companyId?: string;
    token?: string;
}

export const whatsappService = {
    async sendMessage({ instanceName, number, text, mediaUrl, mediaType, mimetype, fileName, companyId, token }: SendWhatsAppParams) {
        let cleanNumber = number.replace(/\D/g, '');
        if (cleanNumber.length === 10 || cleanNumber.length === 11) {
            cleanNumber = '55' + cleanNumber;
        }
        
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const response = await fetch(`${API_BASE_URL}/whatsapp/send`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    instanceName,
                    number: cleanNumber,
                    text,
                    mediaUrl,
                    mediaType,
                    mimetype,
                    fileName,
                    companyId,
                    token
                })
            });

            if (!response.ok) {
                let errText = '';
                try {
                    const errJson = await response.json();
                    const respMsg = errJson.detail?.response?.message;
                    errText = 
                        (Array.isArray(respMsg) ? respMsg[0] : respMsg) ||
                        (errJson.detail?.message) ||
                        (typeof errJson.detail === 'string' ? errJson.detail : null) ||
                        errJson.message ||
                        (typeof errJson.error === 'string' ? errJson.error : null);
                } catch (e) {
                    try { errText = await response.text(); } catch (e2) {}
                }
                throw new Error(errText || 'Falha ao enviar mensagem via WhatsApp.');
            }

            return await response.json();
        } catch (error: any) {
            console.error('WhatsApp Service Error:', error);
            throw error;
        }
    }
};
